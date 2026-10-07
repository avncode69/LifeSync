import { readConfig } from "@lifesync/config";
import * as schema from "@lifesync/db";
import { localDay } from "@lifesync/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ApiHarness, createApiHarness, type TestActor } from "../../../tests/helpers/api-harness";
import { deliverReminders, generateRecurring } from "../src/jobs";
import { hashRequest } from "../src/resources";

let harness: ApiHarness, actor: TestActor;
async function data<T = Record<string, string>>(response: Response): Promise<T> {
  const body = (await response.json()) as { data: T };
  expect(response.status, JSON.stringify(body)).toBeLessThan(400);
  return body.data;
}
beforeAll(async () => {
  harness = await createApiHarness();
  actor = harness.actor();
  await actor.register("api-regression@example.test");
  await actor.verify("api-regression@example.test");
  await actor.login("api-regression@example.test");
}, 30000);
afterAll(async () => {
  await harness?.close();
});
describe("persisted service edge cases", () => {
  it("authenticates webhook channels and ignores duplicate or older message numbers atomically", async () => {
    const me = await data(await actor.request("/api/v1/me"));
    const [connection] = await harness.db
      .insert(schema.googleWorkspaceConnections)
      .values({
        userId: me.id,
        googleSubject: "webhook-fixture",
        email: "calendar-fixture@example.test",
        encryptedRefreshToken: "test-only-unused-token",
        scopes: [],
        calendarEnabled: true,
      })
      .returning();
    const [calendar] = await harness.db
      .insert(schema.googleCalendars)
      .values({
        userId: me.id,
        connectionId: connection.id,
        externalCalendarId: "calendar-fixture",
        name: "Calendar fixture",
        timezone: "Europe/Kyiv",
        selected: true,
        accessRole: "writer",
      })
      .returning();
    const token = crypto.randomUUID(),
      channelId = crypto.randomUUID(),
      resourceId = crypto.randomUUID();
    await harness.db.insert(schema.googleWatchChannels).values({
      userId: me.id,
      calendarId: calendar.id,
      channelId,
      resourceId,
      tokenHash: await hashRequest("CHANNEL", "", token),
      expiresAt: new Date(Date.now() + 3600000),
    });
    const path = "/api/webhooks/google/calendar",
      headers = {
        "X-Goog-Channel-ID": channelId,
        "X-Goog-Resource-ID": resourceId,
        "X-Goog-Channel-Token": token,
        "X-Goog-Message-Number": "9007199254740993",
      };
    const duplicates = await Promise.all([
      actor.request(path, "POST", undefined, headers),
      actor.request(path, "POST", undefined, headers),
    ]);
    expect(duplicates.map((response) => response.status)).toEqual([204, 204]);
    expect(
      (await actor.request(path, "POST", undefined, { ...headers, "X-Goog-Message-Number": "9007199254740992" }))
        .status,
    ).toBe(204);
    const bad = await actor.request(path, "POST", undefined, {
      ...headers,
      "X-Goog-Channel-Token": "invalid-token",
      "X-Goog-Message-Number": "9007199254740994",
    });
    expect(bad.status).toBe(403);
    expect(((await bad.json()) as { error: { code: string } }).error.code).toBe("WEBHOOK_REJECTED");
    const jobs = await harness.db.$client.query(
      "select count(*)::integer as count from background_jobs where type='google_sync' and target_id=$1",
      [calendar.id],
    );
    expect(jobs.rows[0].count).toBe(1);
    const watch = await harness.db.$client.query(
      "select last_message_number::text as number from google_watch_channels where channel_id=$1",
      [channelId],
    );
    expect(watch.rows[0].number).toBe("9007199254740993");
  });

  it("registers a browser endpoint idempotently and revives its owner subscription", async () => {
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/owner-regression",
      p256dh: "A".repeat(86),
      auth: "B".repeat(22),
      deviceName: "Browser",
    };
    const first = await data(await actor.request("/api/v1/push/subscriptions", "POST", subscription));
    const renewed = await data(
      await actor.request("/api/v1/push/subscriptions", "POST", {
        ...subscription,
        auth: "C".repeat(22),
        deviceName: "Renewed",
      }),
    );
    expect(renewed.id).toBe(first.id);
    expect(renewed.auth).toBe("C".repeat(22));
    expect(renewed.deviceName).toBe("Renewed");
    await data(await actor.request(`/api/v1/push/subscriptions/${first.id}`, "DELETE"));
    const revived = await data(await actor.request("/api/v1/push/subscriptions", "POST", subscription));
    expect(revived.id).toBe(first.id);
    expect(revived.deletedAt).toBeNull();
    const rows = await harness.db.$client.query(
      "select count(*)::integer as count from push_subscriptions where endpoint=$1",
      [subscription.endpoint],
    );
    expect(rows.rows[0].count).toBe(1);
    await data(
      await actor.request("/api/v1/push/subscriptions/current", "DELETE", { endpoint: subscription.endpoint }),
    );
    await data(
      await actor.request("/api/v1/push/subscriptions/current", "DELETE", { endpoint: subscription.endpoint }),
    );
    const removed = await harness.db.$client.query(
      "select count(*)::integer as count from push_subscriptions where endpoint=$1",
      [subscription.endpoint],
    );
    expect(removed.rows[0].count).toBe(0);
  });
  it("never reassigns another owner's endpoint or lets another owner remove it", async () => {
    const foreign = harness.actor(),
      email = "push-foreign@example.test";
    await foreign.register(email);
    await foreign.verify(email);
    await foreign.login(email);
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/cross-owner-regression",
      p256dh: "A".repeat(86),
      auth: "B".repeat(22),
    };
    const original = await data(await actor.request("/api/v1/push/subscriptions", "POST", subscription));
    const conflict = await foreign.request("/api/v1/push/subscriptions", "POST", {
      ...subscription,
      auth: "D".repeat(22),
    });
    expect(conflict.status).toBe(409);
    expect(((await conflict.json()) as { error: { code: string } }).error.code).toBe("PUSH_ENDPOINT_CONFLICT");
    await data(
      await foreign.request("/api/v1/push/subscriptions/current", "DELETE", { endpoint: subscription.endpoint }),
    );
    const row = await harness.db.$client.query("select user_id,auth from push_subscriptions where id=$1", [
      original.id,
    ]);
    expect(row.rows[0]).toEqual({ user_id: original.userId, auth: subscription.auth });
  });

  it("filters dashboard tasks before the row limit and keeps high-priority future work", async () => {
    const me = await data(await actor.request("/api/v1/me"));
    await harness.db.$client.query(
      "insert into tasks(user_id,title,status,priority) select $1,'Completed noise','done','urgent' from generate_series(1,30)",
      [me.id],
    );
    const critical = await data(
      await actor.request("/api/v1/tasks", "POST", {
        title: "Important future",
        priority: "urgent",
        dueDate: "2030-01-01",
      }),
    );
    const today = localDay(new Date().toISOString(), "Europe/Kyiv");
    const due = await data(
      await actor.request("/api/v1/tasks", "POST", { title: "Today focus", priority: "high", dueDate: today }),
    );
    const tomorrowFuture = await data(
      await actor.request("/api/v1/tasks", "POST", { title: "Distant low", priority: "low", dueDate: "2030-01-01" }),
    );
    const response = await data<{ today: string; tasks: Record<string, string>[]; calendarEvents: unknown[] }>(
      await actor.request("/api/v1/dashboard"),
    );
    expect(response.today).toBe(today);
    expect(response.tasks.map((row) => row.id)).toContain(critical.id);
    expect(response.tasks.map((row) => row.id)).toContain(due.id);
    expect(response.tasks.map((row) => row.id)).not.toContain(tomorrowFuture.id);
    expect(response.tasks.every((row) => row.status !== "done")).toBe(true);
  });
  it("expands timed and all-day calendar series across DST preserving owner isolation and duration", async () => {
    const timed = await data(
      await actor.request("/api/v1/calendar/events", "POST", {
        title: "Morning",
        startsAt: "2026-03-27T07:00:00Z",
        endsAt: "2026-03-27T08:00:00Z",
        timezone: "Europe/Kyiv",
        recurrenceRule: "FREQ=DAILY;COUNT=4",
      }),
    );
    const allDay = await data(
      await actor.request("/api/v1/calendar/events", "POST", {
        title: "Two-day",
        allDay: true,
        startDate: "2026-03-27",
        endDate: "2026-03-29",
        timezone: "Europe/Kyiv",
        recurrenceRule: "FREQ=DAILY;COUNT=4",
      }),
    );
    const rows = await data<Record<string, unknown>[]>(
      await actor.request("/api/v1/calendar/occurrences?from=2026-03-28&to=2026-03-30"),
    );
    const times = rows.filter((row) => row.seriesId === timed.id);
    expect(times.map((row) => row.startsAt)).toEqual([
      "2026-03-28T07:00:00.000Z",
      "2026-03-29T06:00:00.000Z",
      "2026-03-30T06:00:00.000Z",
    ]);
    expect(times.every((row) => Date.parse(String(row.endsAt)) - Date.parse(String(row.startsAt)) === 3600000)).toBe(
      true,
    );
    expect(rows.find((row) => row.seriesId === allDay.id && row.startDate === "2026-03-29")).toMatchObject({
      endDate: "2026-03-31",
      startsAt: null,
      endsAt: null,
    });
    expect(new Set(rows.map((row) => row.occurrenceId)).size).toBe(rows.length);
    expect((await harness.actor().request("/api/v1/calendar/occurrences?from=2026-03-28&to=2026-03-30")).status).toBe(
      401,
    );
  });
  it("delivers each recurring calendar reminder once on the occurrence instant", async () => {
    const event = await data(
      await actor.request("/api/v1/calendar/events", "POST", {
        title: "Recurring reminder",
        startsAt: "2026-03-27T07:00:00Z",
        endsAt: "2026-03-27T08:00:00Z",
        timezone: "Europe/Kyiv",
        recurrenceRule: "FREQ=DAILY;COUNT=4",
      }),
    );
    const reminder = await data(
      await actor.request("/api/v1/reminders", "POST", {
        eventId: event.id,
        triggerType: "offset",
        offsetMinutes: 10,
        channels: ["in_app"],
      }),
    );
    const config = readConfig({
      APP_URL: "http://lifesync.test",
      BETTER_AUTH_URL: "http://lifesync.test",
      APP_ENV: "test",
      BETTER_AUTH_SECRET: "test-secret-more-than-32-characters",
      DATABASE_URL: "test",
    });
    await deliverReminders(harness.db, config, new Date("2026-03-30T07:00:00Z"));
    await deliverReminders(harness.db, config, new Date("2026-03-30T07:00:00Z"));
    const rows = await harness.db.$client.query(
      "select occurrence_at,status from reminder_deliveries where reminder_id=$1 order by occurrence_at",
      [reminder.id],
    );
    expect(rows.rows).toHaveLength(4);
    expect(rows.rows.every((row) => row.status === "delivered")).toBe(true);
    expect(rows.rows[2].occurrence_at.toISOString()).toBe("2026-03-29T05:50:00.000Z");
  });
  it("documents custom services and mutation DTOs in generated OpenAPI", async () => {
    const response = await actor.request("/api/v1/openapi.json");
    expect(response.status).toBe(200);
    const document = (await response.json()) as { paths: Record<string, Record<string, Record<string, unknown>>> };
    for (const path of [
      "/api/v1/calendar/occurrences",
      "/api/v1/entitlements",
      "/api/v1/dashboard",
      "/api/v1/finance/report",
      "/api/v1/health/summary",
      "/api/v1/ai/chat",
      "/api/v1/ai/actions/{id}/confirm",
      "/api/v1/ai/actions/{id}/undo",
      "/api/v1/integrations/google",
      "/api/v1/admin/metrics",
      "/api/auth/sign-up/email",
    ])
      expect(document.paths[path], path).toBeDefined();
    expect(document.paths["/api/v1/ai/chat"].post.requestBody).toBeDefined();
    expect(document.paths["/api/v1/inbox/items/{id}/convert"].post.requestBody).toBeDefined();
  });

  it("counts all unread notifications through the static route beyond one page", async () => {
    const me = await data(await actor.request("/api/v1/me"));
    const before = await data<{ count: number }>(await actor.request("/api/v1/notifications/unread-count"));
    await harness.db.$client.query(
      "insert into notifications(user_id,title,body,kind) select $1,'Reminder','Scheduled item','reminder' from generate_series(1,61)",
      [me.id],
    );
    const count = await data<{ count: number }>(await actor.request("/api/v1/notifications/unread-count"));
    expect(count.count).toBe(before.count + 61);
  });

  it("uses the saved historical reference and exposes stale conversion explicitly", async () => {
    const rate = await harness.db.$client.query(
      "insert into exchange_rates(currency,date,rate_to_uah,source,fetched_at) values('USD','2026-10-04',40,'NBU',now()) returning id",
    );
    const account = await data(
      await actor.request("/api/v1/finance/accounts", "POST", { name: "USD Wallet", currency: "USD" }),
    );
    const transaction = await data(
      await actor.request(
        "/api/v1/finance/transactions",
        "POST",
        {
          accountId: account.id,
          type: "income",
          amount: "1",
          currency: "USD",
          transactionDate: "2026-10-05",
          exchangeRateId: rate.rows[0].id,
        },
        { "Idempotency-Key": "historical-reference" },
      ),
    );
    await harness.db.$client.query(
      "insert into exchange_rates(currency,date,rate_to_uah,source,fetched_at) values('USD','2026-10-05',45,'NBU',now())",
    );
    const report = await data<{
      income: string;
      rateSnapshots: { transactionId: string; rateDate: string; stale: boolean }[];
      staleRates: unknown[];
    }>(await actor.request("/api/v1/finance/report?from=2026-10-05&to=2026-10-05&currency=UAH"));
    expect(report.income).toBe("40.00");
    expect(report.rateSnapshots.find((row) => row.transactionId === transaction.id)).toMatchObject({
      rateDate: "2026-10-04",
      stale: true,
    });
    expect(report.staleRates.length).toBeGreaterThan(0);
  });

  it("retries a failed in-app delivery and recovers abandoned leases without duplicates", async () => {
    const now = new Date("2026-10-05T12:00:00Z");
    const task = await data(
      await actor.request("/api/v1/tasks", "POST", { title: "Reminder task", dueAt: now.toISOString() }),
    );
    const rule = await data(
      await actor.request("/api/v1/reminders", "POST", {
        taskId: task.id,
        triggerType: "offset",
        offsetMinutes: 0,
        channels: ["in_app"],
      }),
    );
    await harness.db.$client.query(
      "insert into reminder_deliveries(user_id,reminder_id,occurrence_at,channel,status,attempts,updated_at) values($1,$2,$3,'in_app','failed',1,$4)",
      [task.userId, rule.id, now.toISOString(), new Date(now.getTime() - 600000).toISOString()],
    );
    await deliverReminders(
      harness.db,
      readConfig({
        APP_URL: "http://lifesync.test",
        BETTER_AUTH_URL: "http://lifesync.test",
        APP_ENV: "test",
        BETTER_AUTH_SECRET: "test-secret-more-than-32-characters",
        DATABASE_URL: "test",
      }),
      now,
    );
    await deliverReminders(
      harness.db,
      readConfig({
        APP_URL: "http://lifesync.test",
        BETTER_AUTH_URL: "http://lifesync.test",
        APP_ENV: "test",
        BETTER_AUTH_SECRET: "test-secret-more-than-32-characters",
        DATABASE_URL: "test",
      }),
      new Date(now.getTime() + 300000),
    );
    const rows = await harness.db.$client.query(
      "select status,attempts from reminder_deliveries where reminder_id=$1",
      [rule.id],
    );
    expect(rows.rows).toEqual([{ status: "delivered", attempts: 2 }]);
    const notifications = await harness.db.$client.query(
      "select count(*)::integer as count from notifications where target_id=$1",
      [task.id],
    );
    expect(notifications.rows[0].count).toBe(1);
  });

  it("converts Inbox exactly once and keeps original content", async () => {
    const box = await data(await actor.request("/api/v1/inbox/boxes", "POST", { name: "Capture" }));
    const item = await data(
      await actor.request("/api/v1/inbox/items", "POST", {
        boxId: box.id,
        title: "Source",
        content: "Original history",
      }),
    );
    const request = { resource: "tasks", input: { title: "Converted task" } };
    const first = await data<{ item: Record<string, string> }>(
      await actor.request(`/api/v1/inbox/items/${item.id}/convert`, "POST", request),
    );
    const retry = await data<{ item: Record<string, string> }>(
      await actor.request(`/api/v1/inbox/items/${item.id}/convert`, "POST", request),
    );
    expect(retry.item.id).toBe(first.item.id);
    const original = await data(await actor.request(`/api/v1/inbox/items/${item.id}`));
    expect(original.content).toBe("Original history");
    expect(original.convertedId).toBe(first.item.id);
  });
  it("refuses currency changes after financial history, including soft deleted history", async () => {
    const account = await data(
      await actor.request("/api/v1/finance/accounts", "POST", { name: "Cash", currency: "UAH" }),
    );
    const entry = await data(
      await actor.request(
        "/api/v1/finance/transactions",
        "POST",
        { accountId: account.id, type: "expense", amount: "10", currency: "UAH", transactionDate: "2026-10-05" },
        { "Idempotency-Key": "currency-history" },
      ),
    );
    await actor.request(`/api/v1/finance/transactions/${entry.id}`, "DELETE");
    const response = await actor.request(`/api/v1/finance/accounts/${account.id}`, "PATCH", { currency: "USD" });
    expect(response.status).toBe(409);
  });
  it("starts a template once with every prescribed set", async () => {
    const exercise = await data(await actor.request("/api/v1/health/exercises", "POST", { name: "Squat" }));
    const template = await data(await actor.request("/api/v1/health/templates", "POST", { name: "Legs" }));
    await data(
      await actor.request("/api/v1/health/template-exercises", "POST", {
        templateId: template.id,
        exerciseId: exercise.id,
        position: 0,
        sets: 3,
        reps: 10,
        loadKg: "20",
      }),
    );
    const path = `/api/v1/health/templates/${template.id}/start`,
      payload = { startsAt: "2026-10-05T12:00:00Z" },
      headers = { "Idempotency-Key": "start-workout" };
    const first = await data(await actor.request(path, "POST", payload, headers)),
      retry = await data(await actor.request(path, "POST", payload, headers));
    expect(first.id).toBe(retry.id);
    const sets = await data<unknown[]>(await actor.request(`/api/v1/health/sets?sessionId=${first.id}`));
    expect(sets).toHaveLength(3);
  });
  it("generates eastern timezone dates without gaps and clones offset reminders", async () => {
    const task = await data(
      await actor.request("/api/v1/tasks", "POST", {
        title: "Daily",
        dueDate: "2026-03-27",
        timezone: "Europe/Kyiv",
        recurrenceRule: "FREQ=DAILY",
      }),
    );
    await data(
      await actor.request("/api/v1/reminders", "POST", {
        taskId: task.id,
        triggerType: "offset",
        offsetMinutes: 10,
        channels: ["in_app"],
      }),
    );
    await generateRecurring(harness.db, new Date("2026-03-28T12:00:00Z"));
    await generateRecurring(harness.db, new Date("2026-03-29T12:00:00Z"));
    const rows = await harness.db.$client.query(
      "select occurrence_date from tasks where recurrence_source_id=$1 order by occurrence_date",
      [task.id],
    );
    expect(rows.rows.map((row) => row.occurrence_date)).toHaveLength(2);
    const rules = await harness.db.$client.query(
      "select count(*)::integer as total from reminder_rules where task_id in (select id from tasks where recurrence_source_id=$1)",
      [task.id],
    );
    expect(rules.rows[0].total).toBe(2);
  });
});

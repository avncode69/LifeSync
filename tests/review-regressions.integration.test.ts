import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../apps/api/src/app";
import { generateRecurring } from "../apps/api/src/jobs";
import { readConfig } from "../packages/config/src/index";
import { encryptToken } from "../packages/integrations/src/index";
import { type ApiHarness, createApiHarness, type TestActor } from "./helpers/api-harness";

let harness: ApiHarness;
let owner: TestActor;
let stranger: TestActor;
let ownerId: string;

async function data(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBeLessThan(400);
  return body.data;
}
async function create(path: string, input: unknown) {
  return data(await owner.request(`/api/v1${path}`, "POST", input, { "Idempotency-Key": randomUUID() }));
}
beforeAll(async () => {
  harness = await createApiHarness();
  owner = harness.actor();
  stranger = harness.actor();
  for (const [actor, email] of [
    [owner, "review-owner@example.test"],
    [stranger, "review-stranger@example.test"],
  ] as const) {
    expect((await actor.register(email)).status).toBe(200);
    expect((await actor.verify(email)).status).toBeLessThan(400);
    expect((await actor.login(email)).status).toBe(200);
  }
  ownerId = String((await data(await owner.request("/api/v1/me"))).id);
}, 30000);
afterAll(async () => {
  await harness?.close();
});

describe("independent review regressions through real auth and PostgreSQL", () => {
  it("disconnects an already synchronized Google calendar while preserving local events", async () => {
    const key = Buffer.alloc(32, 7).toString("base64");
    const config = readConfig({
      APP_ENV: "test",
      APP_URL: "http://lifesync.test",
      BETTER_AUTH_URL: "http://lifesync.test",
      DATABASE_URL: "test",
      BETTER_AUTH_SECRET: "test-only-secret-with-more-than-32-characters",
      GOOGLE_WORKSPACE_CLIENT_ID: "review-client",
      GOOGLE_WORKSPACE_CLIENT_SECRET: "review-secret",
      GOOGLE_TOKEN_ENCRYPTION_KEY: key,
    });
    const app = createApp({ db: harness.db, auth: harness.auth, config });
    const connectionId = randomUUID(),
      calendarId = randomUUID();
    const event = await create("/calendar/events", {
      title: "Preserved after disconnect",
      startsAt: "2026-10-05T10:00:00Z",
      endsAt: "2026-10-05T11:00:00Z",
    });
    await harness.db.$client.query(
      "INSERT INTO google_workspace_connections(id,user_id,google_subject,email,encrypted_refresh_token,scopes,calendar_enabled) VALUES($1,$2,$3,$4,$5,$6,true)",
      [
        connectionId,
        ownerId,
        "review-google-subject",
        "workspace@example.test",
        await encryptToken("test-refresh-token", key, ownerId),
        ["https://www.googleapis.com/auth/calendar.events"],
      ],
    );
    await harness.db.$client.query(
      "INSERT INTO google_calendars(id,user_id,connection_id,external_calendar_id,name,timezone,access_role) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [calendarId, ownerId, connectionId, "review-calendar", "Workspace", "Europe/Kyiv", "owner"],
    );
    await harness.db.$client.query("INSERT INTO calendar_sync_state(user_id,calendar_id,sync_token) VALUES($1,$2,$3)", [
      ownerId,
      calendarId,
      "review-sync-token",
    ]);
    await harness.db.$client.query(
      "INSERT INTO calendar_event_mappings(user_id,calendar_id,event_id,external_event_id) VALUES($1,$2,$3,$4)",
      [ownerId, calendarId, event.id, "review-remote-event"],
    );
    const login = await owner.login("review-owner@example.test");
    expect(login.status).toBe(200);
    const cookie = login.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input) !== "https://oauth2.googleapis.com/revoke")
        throw new Error("Unexpected external request in disconnect regression");
      return new Response(null, { status: 200 });
    });
    try {
      const response = await app.request(
        new Request("http://lifesync.test/api/v1/integrations/google", {
          method: "DELETE",
          headers: { Origin: "http://lifesync.test", Cookie: cookie },
        }),
      );
      expect(response.status, JSON.stringify(await response.json())).toBe(200);
      expect(fetcher).toHaveBeenCalledOnce();
      for (const table of ["google_calendars", "calendar_sync_state", "calendar_event_mappings"]) {
        const rows = await harness.db.$client.query(`SELECT count(*)::int AS count FROM ${table} WHERE user_id=$1`, [
          ownerId,
        ]);
        expect(rows.rows[0].count, table).toBe(0);
      }
      expect((await data(await owner.request(`/api/v1/calendar/events/${event.id}`))).title).toBe(
        "Preserved after disconnect",
      );
    } finally {
      fetcher.mockRestore();
    }
  });
  it("preserves account currency for both active and trashed transaction history", async () => {
    const account = await create("/finance/accounts", { name: "Historical account", currency: "UAH" });
    const transaction = await create("/finance/transactions", {
      accountId: account.id,
      type: "income",
      amount: "100",
      currency: "UAH",
      transactionDate: "2026-10-05",
    });
    expect((await owner.request(`/api/v1/finance/accounts/${account.id}`, "PATCH", { currency: "USD" })).status).toBe(
      409,
    );
    await data(await owner.request(`/api/v1/finance/transactions/${transaction.id}`, "DELETE"));
    expect((await owner.request(`/api/v1/finance/accounts/${account.id}`, "PATCH", { currency: "USD" })).status).toBe(
      409,
    );
    expect((await data(await owner.request(`/api/v1/finance/accounts/${account.id}`))).currency).toBe("UAH");
  });

  it("preserves savings currency when contributions already exist", async () => {
    const goal = await create("/finance/savings-goals", {
      name: "History goal",
      targetAmount: "1000",
      currency: "UAH",
    });
    await create("/finance/contributions", { goalId: goal.id, amount: "100", currency: "UAH", date: "2026-10-05" });
    expect((await owner.request(`/api/v1/finance/savings-goals/${goal.id}`, "PATCH", { currency: "USD" })).status).toBe(
      409,
    );
    expect((await data(await owner.request(`/api/v1/finance/savings-goals/${goal.id}`))).currency).toBe("UAH");
  });

  it("protects currency referenced by a recurring rule before its first transaction", async () => {
    const account = await create("/finance/accounts", { name: "Future recurring account", currency: "UAH" });
    await create("/finance/recurring", {
      name: "Future income",
      accountId: account.id,
      type: "income",
      amount: "10",
      currency: "UAH",
      recurrenceRule: "FREQ=MONTHLY",
      timezone: "Europe/Kyiv",
      startDate: "2030-01-01",
      nextDate: "2030-01-01",
    });
    expect((await owner.request(`/api/v1/finance/accounts/${account.id}`, "PATCH", { currency: "USD" })).status).toBe(
      409,
    );
  });

  it("applies Free limits to active FREE and expired PRO rows in every entitlement reader", async () => {
    for (const [plan, expiresAt] of [
      ["FREE", null],
      ["PRO", "2000-01-01T00:00:00Z"],
    ] as const) {
      await harness.db.$client.query(
        "INSERT INTO user_entitlements(user_id,plan,ai_daily_limit,inbox_box_limit,expires_at) VALUES($1,$2,100,5,$3) ON CONFLICT(user_id) DO UPDATE SET plan=$2,ai_daily_limit=100,inbox_box_limit=5,expires_at=$3",
        [ownerId, plan, expiresAt],
      );
      expect(await data(await owner.request("/api/v1/entitlements"))).toMatchObject({
        plan: "FREE",
        aiDailyLimit: 3,
        inboxLimit: 2,
      });
      expect(await data(await owner.request("/api/v1/ai/quota"))).toMatchObject({ limit: 3, remaining: 3 });
    }
  });

  it("converts inbox once under concurrent retries and rejects a foreign owner", async () => {
    const box = await create("/inbox/boxes", { name: "Review capture" });
    const item = await create("/inbox/items", { boxId: box.id, title: "Convert only once" });
    const path = `/api/v1/inbox/items/${item.id}/convert`;
    const input = { resource: "tasks", input: { title: "Converted review task" } };
    expect((await stranger.request(path, "POST", input)).status).toBe(404);
    const responses = await Promise.all([owner.request(path, "POST", input), owner.request(path, "POST", input)]);
    const converted = await Promise.all(responses.map(data));
    const ids = converted.map((value) => (value.item as Record<string, unknown>).id);
    expect(ids[0]).toBe(ids[1]);
    const stored = await harness.db.$client.query(
      "SELECT count(*)::int AS count FROM tasks WHERE user_id=$1 AND title=$2",
      [ownerId, "Converted review task"],
    );
    expect(stored.rows[0].count).toBe(1);
    expect(await data(await owner.request(`/api/v1/inbox/items/${item.id}`))).toMatchObject({
      archived: true,
      convertedType: "tasks",
      convertedId: ids[0],
    });
    expect((await owner.request(path, "POST", { resource: "projects", input: { name: "Other target" } })).status).toBe(
      409,
    );
  });

  it("starts a template with copied exercise sets once and denies foreign template access", async () => {
    const exercise = await create("/health/exercises", { name: "Review squat", type: "strength" });
    const template = await create("/health/templates", { name: "Review workout" });
    await create("/health/template-exercises", {
      templateId: template.id,
      exerciseId: exercise.id,
      position: 0,
      sets: 3,
      reps: 8,
      loadKg: "20",
    });
    const path = `/api/v1/health/templates/${template.id}/start`;
    const input = { startsAt: "2026-10-05T09:00:00Z" };
    expect((await stranger.request(path, "POST", input, { "Idempotency-Key": randomUUID() })).status).toBe(404);
    const headers = { "Idempotency-Key": randomUUID() };
    const session = await data(await owner.request(path, "POST", input, headers));
    expect((await data(await owner.request(path, "POST", input, headers))).id).toBe(session.id);
    const sets = await harness.db.$client.query(
      "SELECT exercise_id,reps,load_kg::text,completed FROM workout_sets WHERE user_id=$1 AND session_id=$2 ORDER BY position",
      [ownerId, session.id],
    );
    expect(sets.rows).toHaveLength(3);
    for (const set of sets.rows)
      expect(set).toMatchObject({ exercise_id: exercise.id, reps: 8, load_kg: "20.0000", completed: false });
  });

  it("generates every local date across Kyiv DST with copied reminders and checklists once", async () => {
    const task = await create("/tasks", {
      title: "DST recurring review",
      dueDate: "2026-10-24",
      timezone: "Europe/Kyiv",
      recurrenceRule: "FREQ=DAILY;COUNT=4",
    });
    await create("/reminders", { taskId: task.id, triggerType: "offset", offsetMinutes: 10, channels: ["in_app"] });
    await create("/tasks/checklist-items", { taskId: task.id, title: "Fresh checklist", completed: true });
    for (const now of ["2026-10-25T12:00:00Z", "2026-10-26T12:00:00Z", "2026-10-26T12:00:00Z"])
      await generateRecurring(harness.db, new Date(now));
    const children = await harness.db.$client.query(
      "SELECT id,occurrence_date::text,due_date::text FROM tasks WHERE user_id=$1 AND recurrence_source_id=$2 ORDER BY occurrence_date",
      [ownerId, task.id],
    );
    expect(children.rows.map((row) => row.occurrence_date)).toEqual(["2026-10-25", "2026-10-26"]);
    for (const child of children.rows) {
      expect(child.due_date).toBe(child.occurrence_date);
      const reminders = await harness.db.$client.query(
        "SELECT offset_minutes,channels FROM reminder_rules WHERE user_id=$1 AND task_id=$2",
        [ownerId, child.id],
      );
      expect(reminders.rows).toEqual([{ offset_minutes: 10, channels: ["in_app"] }]);
      const checklist = await harness.db.$client.query(
        "SELECT title,completed FROM task_checklist_items WHERE user_id=$1 AND task_id=$2",
        [ownerId, child.id],
      );
      expect(checklist.rows).toEqual([{ title: "Fresh checklist", completed: false }]);
    }
  });
});

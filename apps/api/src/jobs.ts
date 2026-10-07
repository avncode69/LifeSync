import type { AppConfig } from "@lifesync/config";
import { type ResourceName, resourceRegistry } from "@lifesync/contracts";
import type { Database } from "@lifesync/db";
import * as schema from "@lifesync/db";
import { localDay, nextOccurrences } from "@lifesync/domain";
import { GoogleCalendarClient, NbuRateProvider, sendWebPush } from "@lifesync/integrations";
import { and, asc, eq, gt, isNull, lt, lte, sql } from "drizzle-orm";
import { hashRequest, tableFor } from "./resources";
import { synchronizeCalendar, workspaceAccessToken } from "./workspace";

export async function refreshRates(db: Database, date: string) {
  const provider = new NbuRateProvider();
  const rates = await provider.rates(date);
  await db.transaction(async (tx) => {
    for (const rate of rates)
      await tx
        .insert(schema.exchangeRates)
        .values({
          currency: rate.currency,
          date: rate.date,
          rateToUah: rate.rate,
          source: rate.source,
          fetchedAt: new Date(rate.fetchedAt),
        })
        .onConflictDoNothing();
  });
  return rates;
}
function localDateTime(instant: Date, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
async function* scanPages<Row extends { id: string }>(read: (cursor: string | undefined) => Promise<Row[]>) {
  let cursor: string | undefined;
  while (true) {
    const rows = await read(cursor);
    if (!rows.length) return;
    for (const row of rows) yield row;
    cursor = rows.at(-1)!.id;
    if (rows.length < 100) return;
  }
}
export async function generateRecurring(db: Database, now: Date) {
  for await (const source of scanPages((cursor) =>
    db
      .select()
      .from(schema.tasks)
      .where(
        and(
          isNull(schema.tasks.deletedAt),
          sql`${schema.tasks.recurrenceRule} is not null`,
          cursor ? gt(schema.tasks.id, cursor) : undefined,
        ),
      )
      .orderBy(asc(schema.tasks.id))
      .limit(100),
  )) {
    const anchor = source.dueAt ?? source.startsAt ?? (source.dueDate ? new Date(`${source.dueDate}T00:00:00Z`) : null);
    if (!anchor || !source.recurrenceRule) continue;
    const sourceReminders = await db
      .select()
      .from(schema.reminderRules)
      .where(
        and(
          eq(schema.reminderRules.userId, source.userId),
          eq(schema.reminderRules.taskId, source.id),
          eq(schema.reminderRules.triggerType, "offset"),
          isNull(schema.reminderRules.deletedAt),
        ),
      );
    const maxOffset = Math.max(
      0,
      ...sourceReminders.filter((rule) => rule.enabled).map((rule) => rule.offsetMinutes ?? 0),
    );
    const today = localDay(new Date(now.getTime() + maxOffset * 60000).toISOString(), source.timezone);
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`recurrence:${source.id}`},0))`);
      const [last] = await tx
        .select({ date: sql<string>`max(${schema.tasks.occurrenceDate})` })
        .from(schema.tasks)
        .where(and(eq(schema.tasks.userId, source.userId), eq(schema.tasks.recurrenceSourceId, source.id)));
      const start = source.dueDate ? `${source.dueDate}T00:00:00` : localDateTime(anchor, source.timezone);
      const after = last?.date
        ? new Date(Date.parse(`${last.date}T00:00:00Z`) - 86400000).toISOString()
        : new Date(anchor.getTime() - 86400000).toISOString();
      const occurrences = nextOccurrences({
        rule: source.recurrenceRule!,
        start,
        timezone: source.timezone,
        after,
        limit: 100,
      });
      for (const occurrence of occurrences) {
        const date = localDay(occurrence, source.timezone);
        if (date > today) break;
        if (date <= (last?.date ?? source.dueDate ?? localDay(anchor.toISOString(), source.timezone))) continue;
        const [created] = await tx
          .insert(schema.tasks)
          .values({
            userId: source.userId,
            title: source.title,
            description: source.description,
            projectId: source.projectId,
            parentTaskId: source.parentTaskId,
            priority: source.priority,
            status: "todo",
            dueDate: source.dueDate ? date : null,
            dueAt: source.dueAt ? new Date(occurrence) : null,
            startsAt: source.startsAt
              ? new Date(Date.parse(occurrence) + source.startsAt.getTime() - anchor.getTime())
              : null,
            recurrenceSourceId: source.id,
            occurrenceDate: date,
            timezone: source.timezone,
          })
          .onConflictDoNothing()
          .returning();
        if (created) {
          for (const reminder of sourceReminders)
            await tx.insert(schema.reminderRules).values({
              userId: source.userId,
              taskId: created.id,
              triggerType: reminder.triggerType,
              offsetMinutes: reminder.offsetMinutes,
              channels: reminder.channels,
              enabled: reminder.enabled,
            });
          const checklist = await tx
            .select()
            .from(schema.taskChecklistItems)
            .where(
              and(
                eq(schema.taskChecklistItems.userId, source.userId),
                eq(schema.taskChecklistItems.taskId, source.id),
                isNull(schema.taskChecklistItems.deletedAt),
              ),
            );
          for (const item of checklist)
            await tx.insert(schema.taskChecklistItems).values({
              userId: source.userId,
              taskId: created.id,
              title: item.title,
              position: item.position,
              completed: false,
            });
        }
      }
    });
  }
  for await (const source of scanPages((cursor) =>
    db
      .select()
      .from(schema.recurringTransactions)
      .where(
        and(
          isNull(schema.recurringTransactions.deletedAt),
          eq(schema.recurringTransactions.enabled, true),
          cursor ? gt(schema.recurringTransactions.id, cursor) : undefined,
        ),
      )
      .orderBy(asc(schema.recurringTransactions.id))
      .limit(100),
  )) {
    const today = localDay(now.toISOString(), source.timezone);
    if (source.nextDate > today) continue;
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`finance-recurrence:${source.id}`},0))`);
      const occurrences = nextOccurrences({
        rule: source.recurrenceRule,
        start: `${source.startDate}T00:00:00`,
        timezone: source.timezone,
        after: new Date(Date.parse(`${source.nextDate}T00:00:00Z`) - 172800000).toISOString(),
        limit: 100,
      });
      let next = source.nextDate;
      for (const occurrence of occurrences) {
        const date = localDay(occurrence, source.timezone);
        if (date < source.nextDate) continue;
        if (source.endDate && date > source.endDate) {
          await tx
            .update(schema.recurringTransactions)
            .set({ enabled: false })
            .where(eq(schema.recurringTransactions.id, source.id));
          break;
        }
        next = date;
        if (date > today) break;
        await tx
          .insert(schema.financeTransactions)
          .values({
            userId: source.userId,
            accountId: source.accountId,
            categoryId: source.categoryId,
            type: source.type,
            amount: source.amount,
            currency: source.currency,
            transactionDate: date,
            note: source.note,
            recurringTransactionId: source.id,
            occurrenceDate: date,
          })
          .onConflictDoNothing();
      }
      await tx
        .update(schema.recurringTransactions)
        .set({ nextDate: next, updatedAt: now })
        .where(eq(schema.recurringTransactions.id, source.id));
    });
  }
}
export async function deliverReminders(db: Database, config: AppConfig, now: Date) {
  const targets: Record<string, ResourceName> = {
    taskId: "tasks",
    eventId: "calendarEvents",
    habitId: "habits",
    projectId: "projects",
    transactionId: "financeTransactions",
    inboxItemId: "inboxItems",
  };
  for await (const rule of scanPages((cursor) =>
    db
      .select()
      .from(schema.reminderRules)
      .where(
        and(
          eq(schema.reminderRules.enabled, true),
          isNull(schema.reminderRules.deletedAt),
          cursor ? gt(schema.reminderRules.id, cursor) : undefined,
        ),
      )
      .orderBy(asc(schema.reminderRules.id))
      .limit(100),
  )) {
    const relation = Object.entries(targets).find(([field]) => rule[field as keyof typeof rule]);
    if (!relation) continue;
    const table = tableFor(relation[1]),
      targetId = String(rule[relation[0] as keyof typeof rule]);
    const [target] = await db
      .select()
      .from(table)
      .where(and(eq(table.userId, rule.userId), eq(table.id, targetId), isNull(table.deletedAt)))
      .limit(1);
    if (!target) continue;
    let instants: Date[] = rule.exactAt ? [rule.exactAt] : [];
    if (rule.triggerType === "offset") {
      let value = target.dueAt ?? target.startsAt;
      const timezone = String(target.timezone ?? "Europe/Kyiv"),
        date = target.dueDate ?? target.startDate;
      if (!(value instanceof Date) && typeof date === "string")
        value = new Date(
          nextOccurrences({
            rule: "FREQ=DAILY;COUNT=1",
            start: `${date}T00:00:00`,
            timezone,
            after: new Date(Date.parse(date) - 172800000).toISOString(),
            limit: 1,
          })[0]!,
        );
      if (!(value instanceof Date) || !Number.isFinite(value.getTime())) continue;
      const offset = (rule.offsetMinutes ?? 0) * 60000;
      instants = [new Date(value.getTime() - offset)];
      if (target.recurrenceRule && relation[1] === "calendarEvents") {
        const after = new Date(now.getTime() + offset - 7 * 86400000).toISOString();
        const start = typeof date === "string" ? `${date}T00:00:00` : localDateTime(value, timezone);
        instants = nextOccurrences({ rule: String(target.recurrenceRule), start, timezone, after, limit: 100 }).map(
          (occurrence) => new Date(Date.parse(occurrence) - offset),
        );
      }
    }
    for (const instant of instants) {
      if (instant > now) continue;
      const [preferences] = await db
        .select({ enabled: schema.userPreferences.webPushEnabled })
        .from(schema.userPreferences)
        .where(eq(schema.userPreferences.userId, rule.userId))
        .limit(1);
      const subscriptions =
        rule.channels.includes("push") && preferences?.enabled
          ? await db
              .select()
              .from(schema.pushSubscriptions)
              .where(and(eq(schema.pushSubscriptions.userId, rule.userId), isNull(schema.pushSubscriptions.deletedAt)))
          : [];
      const channels = [
        ...(rule.channels.includes("in_app") ? ["in_app"] : []),
        ...subscriptions.map((subscription) => `push:${subscription.id}`),
      ];
      for (const channel of channels) {
        const delivery = await db.transaction(async (tx) => {
          const [created] = await tx
            .insert(schema.reminderDeliveries)
            .values({
              userId: rule.userId,
              reminderId: rule.id,
              occurrenceAt: instant,
              channel,
              attempts: 1,
              updatedAt: now,
            })
            .onConflictDoNothing()
            .returning();
          if (created) return created;
          const [retry] = await tx
            .update(schema.reminderDeliveries)
            .set({ status: "pending", attempts: sql`${schema.reminderDeliveries.attempts}+1`, updatedAt: now })
            .where(
              and(
                eq(schema.reminderDeliveries.userId, rule.userId),
                eq(schema.reminderDeliveries.reminderId, rule.id),
                eq(schema.reminderDeliveries.occurrenceAt, instant),
                eq(schema.reminderDeliveries.channel, channel),
                lt(schema.reminderDeliveries.attempts, 5),
                sql`(${schema.reminderDeliveries.status}='failed' and ${schema.reminderDeliveries.updatedAt}<${new Date(now.getTime() - 300000)} or ${schema.reminderDeliveries.status}='pending' and ${schema.reminderDeliveries.updatedAt}<${new Date(now.getTime() - 600000)})`,
              ),
            )
            .returning();
          return retry;
        });
        if (!delivery) continue;
        try {
          if (channel === "in_app")
            await db
              .insert(schema.notifications)
              .values({
                userId: rule.userId,
                title: "LifeSync reminder",
                body: "You have a scheduled reminder",
                kind: "reminder",
                targetType: relation[1],
                targetId,
                deliveryKey: `reminder:${delivery.id}`,
              })
              .onConflictDoNothing();
          else {
            if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) throw new Error("PUSH_NOT_CONFIGURED");
            const subscription = subscriptions.find((row) => channel === `push:${row.id}`)!;
            const result = await sendWebPush(
              { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
              {
                id: delivery.id,
                title: "LifeSync reminder",
                body: "You have a scheduled reminder",
                url: "/notifications",
              },
              {
                publicKey: config.VAPID_PUBLIC_KEY,
                privateKey: config.VAPID_PRIVATE_KEY,
                subject: config.VAPID_SUBJECT,
              },
            );
            if (result === "expired")
              await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, subscription.id));
          }
          await db
            .update(schema.reminderDeliveries)
            .set({ status: "delivered", deliveredAt: now, errorCode: null, updatedAt: now })
            .where(eq(schema.reminderDeliveries.id, delivery.id));
        } catch {
          await db
            .update(schema.reminderDeliveries)
            .set({ status: "failed", errorCode: "DELIVERY_FAILED", updatedAt: now })
            .where(eq(schema.reminderDeliveries.id, delivery.id));
        }
      }
    }
  }
}
async function cleanup(db: Database, now: Date) {
  await db.delete(schema.aiMessages).where(lte(schema.aiMessages.expiresAt, now));
  await db.delete(schema.aiActionLogs).where(lte(schema.aiActionLogs.expiresAt, now));
  await db.delete(schema.aiConversations).where(lte(schema.aiConversations.expiresAt, now));
  const cutoff = new Date(now.getTime() - 30 * 86400000);
  // Children first avoids restoring records whose relational parents have disappeared.
  for (const name of Object.keys(resourceRegistry).reverse()) {
    const table = tableFor(name as ResourceName);
    await db.delete(table).where(lt(table.deletedAt, cutoff));
  }
  await db.delete(schema.idempotencyKeys).where(lt(schema.idempotencyKeys.expiresAt, now));
  await db.delete(schema.verification).where(lt(schema.verification.expiresAt, now));
  await db.delete(schema.session).where(lt(schema.session.expiresAt, now));
  await db.delete(schema.rateLimit).where(lt(schema.rateLimit.lastRequest, now.getTime() - 86400000));
  const abandoned = await db
    .select()
    .from(schema.backgroundJobs)
    .where(
      and(
        eq(schema.backgroundJobs.type, "ai_reservation"),
        eq(schema.backgroundJobs.status, "pending"),
        lte(schema.backgroundJobs.runAt, now),
      ),
    )
    .limit(100);
  for (const job of abandoned)
    await db.transaction(async (tx) => {
      const [released] = await tx
        .update(schema.backgroundJobs)
        .set({ status: "failed", errorCode: "AI_REQUEST_ABANDONED", completedAt: now })
        .where(and(eq(schema.backgroundJobs.id, job.id), eq(schema.backgroundJobs.status, "pending")))
        .returning();
      if (released && job.targetId)
        await tx
          .update(schema.dailyUsageCounters)
          .set({
            reserved: sql`greatest(${schema.dailyUsageCounters.reserved}-1,0)`,
            providerErrors: sql`${schema.dailyUsageCounters.providerErrors}+1`,
          })
          .where(eq(schema.dailyUsageCounters.id, job.targetId));
    });
}
async function synchronizeGoogle(db: Database, config: AppConfig, now: Date) {
  if (!config.GOOGLE_WORKSPACE_CLIENT_ID || !config.GOOGLE_TOKEN_ENCRYPTION_KEY) return;
  for await (const calendar of scanPages((cursor) =>
    db
      .select()
      .from(schema.googleCalendars)
      .where(
        and(
          eq(schema.googleCalendars.selected, true),
          isNull(schema.googleCalendars.deletedAt),
          cursor ? gt(schema.googleCalendars.id, cursor) : undefined,
        ),
      )
      .orderBy(asc(schema.googleCalendars.id))
      .limit(100),
  )) {
    try {
      await synchronizeCalendar(db, config, calendar.userId, calendar.id);
      if (new URL(config.APP_URL).protocol !== "https:") continue;
      const [watch] = await db
        .select()
        .from(schema.googleWatchChannels)
        .where(
          and(
            eq(schema.googleWatchChannels.userId, calendar.userId),
            eq(schema.googleWatchChannels.calendarId, calendar.id),
            gt(schema.googleWatchChannels.expiresAt, new Date(now.getTime() + 3600000)),
          ),
        )
        .limit(1);
      if (watch) continue;
      const client = new GoogleCalendarClient(await workspaceAccessToken(db, config, calendar.userId));
      const token = crypto.randomUUID(),
        channelId = crypto.randomUUID();
      const remote = await client.watch(
        calendar.externalCalendarId,
        channelId,
        token,
        `${new URL(config.APP_URL).origin}/api/webhooks/google/calendar`,
      );
      await db.insert(schema.googleWatchChannels).values({
        userId: calendar.userId,
        calendarId: calendar.id,
        channelId,
        resourceId: remote.resourceId,
        tokenHash: await hashRequest("CHANNEL", "", token),
        expiresAt: new Date(Number(remote.expiration)),
      });
      const previous = await db
        .select()
        .from(schema.googleWatchChannels)
        .where(
          and(
            eq(schema.googleWatchChannels.calendarId, calendar.id),
            lt(schema.googleWatchChannels.expiresAt, new Date(now.getTime() + 3600000)),
          ),
        );
      for (const old of previous) {
        try {
          await client.stopWatch(old.channelId, old.resourceId);
        } catch {}
        await db.delete(schema.googleWatchChannels).where(eq(schema.googleWatchChannels.id, old.id));
      }
    } catch {
      await db
        .update(schema.googleWorkspaceConnections)
        .set({ errorCode: "BACKGROUND_SYNC_FAILED" })
        .where(eq(schema.googleWorkspaceConnections.userId, calendar.userId));
    }
  }
}
async function processGoogleJobs(db: Database, config: AppConfig, now: Date) {
  const jobs = await db
    .select()
    .from(schema.backgroundJobs)
    .where(
      and(
        eq(schema.backgroundJobs.type, "google_sync"),
        lte(schema.backgroundJobs.runAt, now),
        lt(schema.backgroundJobs.attempts, 5),
        sql`(${schema.backgroundJobs.status} in ('pending','failed') or (${schema.backgroundJobs.status}='running' and ${schema.backgroundJobs.lockedUntil}<${now}))`,
      ),
    )
    .orderBy(asc(schema.backgroundJobs.runAt))
    .limit(100);
  for (const job of jobs) {
    const [claimed] = await db
      .update(schema.backgroundJobs)
      .set({
        status: "running",
        lockedUntil: new Date(now.getTime() + 300000),
        attempts: sql`${schema.backgroundJobs.attempts}+1`,
      })
      .where(
        and(
          eq(schema.backgroundJobs.id, job.id),
          eq(schema.backgroundJobs.status, job.status),
          eq(schema.backgroundJobs.attempts, job.attempts),
        ),
      )
      .returning();
    if (!claimed || !job.targetId) continue;
    try {
      await synchronizeCalendar(db, config, job.userId, job.targetId);
      await db
        .update(schema.backgroundJobs)
        .set({ status: "completed", completedAt: new Date(), lockedUntil: null, errorCode: null })
        .where(eq(schema.backgroundJobs.id, job.id));
    } catch {
      await db
        .update(schema.backgroundJobs)
        .set({
          status: "failed",
          lockedUntil: null,
          errorCode: "GOOGLE_SYNC_FAILED",
          runAt: new Date(now.getTime() + Math.min(3600000, 30000 * 2 ** claimed.attempts)),
        })
        .where(eq(schema.backgroundJobs.id, job.id));
    }
  }
}
export async function runScheduled(db: Database, config: AppConfig, now = new Date()) {
  for (const [name, job] of Object.entries({
    cleanup: () => cleanup(db, now),
    recurrence: () => generateRecurring(db, now),
    reminders: () => deliverReminders(db, config, now),
    googleQueue: () => processGoogleJobs(db, config, now),
    google: () => synchronizeGoogle(db, config, now),
    rates: () => refreshRates(db, now.toISOString().slice(0, 10)),
  })) {
    try {
      await job();
      console.log(JSON.stringify({ job: name, status: "completed" }));
    } catch {
      console.error(JSON.stringify({ job: name, status: "failed", code: "SCHEDULED_JOB_FAILED" }));
      await db
        .insert(schema.dailyProductMetrics)
        .values({ date: now.toISOString().slice(0, 10), metric: `job.${name}.failed`, count: 1 })
        .onConflictDoUpdate({
          target: [schema.dailyProductMetrics.date, schema.dailyProductMetrics.metric],
          set: { count: sql`${schema.dailyProductMetrics.count}+1` },
        });
    }
  }
}

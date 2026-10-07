import { type ResourceName, resourceRegistry } from "@lifesync/contracts";
import * as schema from "@lifesync/db";
import { convertMoney, financeTotals, habitStatistics, localDay, parseCapture } from "@lifesync/domain";
import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import type { AppDependencies, AppEnv } from "./app";
import { calendarOccurrences } from "./calendar";
import { refreshRates } from "./jobs";
import {
  databaseValues,
  hashRequest,
  ownedRow,
  ownerScope,
  rateLimitRequest,
  tableFor,
  validateRelations,
} from "./resources";
import { ApiFailure, parseCursor } from "./security";
import {
  accountDeleteSchema,
  adminFlagSchema,
  adminUserSchema,
  calendarRangeSchema,
  capturePreviewSchema,
  inboxConversionSchema,
  templateStartSchema,
} from "./service-contracts";

export function registerServices(app: Hono<AppEnv>, { db, auth, config }: AppDependencies) {
  async function ratesForDate(date: string) {
    let rows = await db.select().from(schema.exchangeRates).where(eq(schema.exchangeRates.date, date));
    if (!rows.length) {
      try {
        await refreshRates(db, date);
        rows = await db.select().from(schema.exchangeRates).where(eq(schema.exchangeRates.date, date));
      } catch {}
    }
    if (rows.length) return { rows, stale: false, requestedDate: date, rateDate: date };
    const [latest] = await db
      .select({ date: schema.exchangeRates.date })
      .from(schema.exchangeRates)
      .where(lte(schema.exchangeRates.date, date))
      .orderBy(desc(schema.exchangeRates.date))
      .limit(1);
    if (!latest) throw new ApiFailure("RATES_UNAVAILABLE", "Historical exchange rates are unavailable", 503);
    rows = await db.select().from(schema.exchangeRates).where(eq(schema.exchangeRates.date, latest.date));
    return { rows, stale: true, requestedDate: date, rateDate: latest.date };
  }
  app.get("/api/v1/calendar/occurrences", async (c) => {
    const parsed = calendarRangeSchema.safeParse({ from: c.req.query("from"), to: c.req.query("to") });
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Choose a calendar range up to one year");
    const userId = c.get("identity").id;
    const [prefs] = await db
      .select({ timezone: schema.userPreferences.timezone })
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);
    return c.json({
      data: await calendarOccurrences(db, userId, parsed.data.from, parsed.data.to, prefs?.timezone ?? "Europe/Kyiv"),
    });
  });
  app.get("/api/v1/finance/rates", async (c) => {
    await rateLimitRequest(db, c.get("identity").id, "rates", 10);
    const date = c.req.query("date") ?? new Date().toISOString().slice(0, 10);
    if (!z.iso.date().safeParse(date).success || date > new Date().toISOString().slice(0, 10))
      throw new ApiFailure("VALIDATION_ERROR", "Invalid historical date");
    return c.json({ data: await ratesForDate(date) });
  });
  app.get("/api/v1/finance/report", async (c) => {
    await rateLimitRequest(db, c.get("identity").id, "report", 10);
    const userId = c.get("identity").id;
    const [prefs] = await db
      .select()
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);
    const to = c.req.query("to") ?? localDay(new Date().toISOString(), prefs?.timezone ?? "Europe/Kyiv"),
      from = c.req.query("from") ?? `${to.slice(0, 7)}-01`,
      currency = c.req.query("currency") ?? prefs?.baseCurrency ?? "UAH";
    if (
      !z.iso.date().safeParse(from).success ||
      !z.iso.date().safeParse(to).success ||
      from > to ||
      Date.parse(to) - Date.parse(from) > 366 * 86400000 ||
      !/^[A-Z]{3}$/.test(currency)
    )
      throw new ApiFailure("VALIDATION_ERROR", "Invalid report date range or currency");
    const transactions = await db
      .select()
      .from(schema.financeTransactions)
      .where(
        and(
          ownerScope(tableFor("financeTransactions"), userId),
          gte(schema.financeTransactions.transactionDate, from),
          lte(schema.financeTransactions.transactionDate, to),
        ),
      )
      .limit(10001);
    if (transactions.length > 10000) throw new ApiFailure("REPORT_TOO_LARGE", "Choose a shorter reporting period", 413);
    const cache = new Map<string, Awaited<ReturnType<typeof ratesForDate>>>();
    const referenceIds = transactions.flatMap((row) => (row.exchangeRateId ? [row.exchangeRateId] : []));
    const storedRates = referenceIds.length
      ? await db.select().from(schema.exchangeRates).where(inArray(schema.exchangeRates.id, referenceIds))
      : [];
    const snapshots: {
      transactionId: string;
      rateDate: string;
      currency: string;
      source: string;
      fetchedAt: Date;
      stale: boolean;
    }[] = [];
    const converted: { amount: string; type: string; date: string; categoryId: string | null }[] = [];
    for (const transaction of transactions) {
      if (transaction.type === "transfer") continue;
      let amount = transaction.amount;
      if (transaction.currency !== currency) {
        let rates = cache.get(transaction.transactionDate);
        const stored = storedRates.find((rate) => rate.id === transaction.exchangeRateId);
        if (!rates && (!stored || currency !== "UAH")) {
          rates = await ratesForDate(transaction.transactionDate);
          cache.set(transaction.transactionDate, rates);
        }
        const source = stored ?? rates?.rows.find((rate) => rate.currency === transaction.currency);
        const values = Object.fromEntries((rates?.rows ?? []).map((rate) => [rate.currency, rate.rateToUah]));
        if (source) {
          values[transaction.currency] = source.rateToUah;
          snapshots.push({
            transactionId: transaction.id,
            rateDate: source.date,
            currency: source.currency,
            source: source.source,
            fetchedAt: source.fetchedAt,
            stale: source.date !== transaction.transactionDate,
          });
          if (!transaction.exchangeRateId)
            await db
              .update(schema.financeTransactions)
              .set({ exchangeRateId: source.id })
              .where(
                and(
                  eq(schema.financeTransactions.id, transaction.id),
                  eq(schema.financeTransactions.userId, userId),
                  isNull(schema.financeTransactions.exchangeRateId),
                  eq(schema.financeTransactions.updatedAt, transaction.updatedAt),
                ),
              );
        }
        try {
          amount = convertMoney(transaction.amount, transaction.currency, currency, values);
        } catch {
          throw new ApiFailure("RATES_UNAVAILABLE", "A historical currency rate is unavailable", 503);
        }
      }
      converted.push({
        amount,
        type: transaction.type,
        date: transaction.transactionDate,
        categoryId: transaction.categoryId,
      });
    }
    const trends = [...new Set(converted.map((t) => t.date))]
      .sort()
      .map((date) => ({ date, ...financeTotals(converted.filter((t) => t.date === date)) }));
    const distribution = [...new Set(converted.filter((t) => t.type === "expense").map((t) => t.categoryId))].map(
      (categoryId) => ({
        categoryId,
        amount: financeTotals(converted.filter((t) => t.type === "expense" && t.categoryId === categoryId)).expense,
      }),
    );
    return c.json({
      data: {
        from,
        to,
        currency,
        ...financeTotals(converted),
        trends,
        distribution,
        rateSnapshots: snapshots,
        staleRates: [...cache.values()]
          .filter((r) => r.stale)
          .map((r) => ({ requestedDate: r.requestedDate, rateDate: r.rateDate, source: "NBU" }))
          .concat(
            snapshots
              .filter((row) => row.stale)
              .map((row) => ({
                requestedDate: transactions.find((transaction) => transaction.id === row.transactionId)!
                  .transactionDate,
                rateDate: row.rateDate,
                source: row.source,
              })),
          ),
      },
    });
  });
  app.post("/api/v1/inbox/items/:id/convert", async (c) => {
    const parsed = inboxConversionSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Invalid conversion target");
    const id = parseCursor(c.req.param("id"))!,
      userId = c.get("identity").id,
      name = parsed.data.resource;
    const input = resourceRegistry[name].createSchema.safeParse(parsed.data.input);
    if (!input.success) throw new ApiFailure("VALIDATION_ERROR", "Invalid target data");
    const row = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId},0))`);
      const source = await ownedRow(tx, "inboxItems", userId, id);
      if (source.convertedId) {
        if (source.convertedType !== name)
          throw new ApiFailure("ALREADY_CONVERTED", "This item has already been converted", 409);
        return ownedRow(tx, name, userId, String(source.convertedId));
      }
      await validateRelations(tx, name, userId, input.data);
      const [item] = await tx
        .insert(tableFor(name))
        .values({ ...databaseValues(name, input.data), userId })
        .returning();
      await tx
        .update(schema.inboxItems)
        .set({
          convertedType: name,
          convertedId: String(item!.id),
          convertedAt: new Date(),
          archived: true,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.inboxItems.id, id), eq(schema.inboxItems.userId, userId)));
      return item;
    });
    return c.json({ data: { resource: name, item: row } }, 201);
  });
  app.post("/api/v1/health/templates/:id/start", async (c) => {
    const parsed = templateStartSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Workout start time required");
    const id = parseCursor(c.req.param("id"))!,
      userId = c.get("identity").id,
      key = c.req.header("Idempotency-Key");
    if (!key || key.length > 128 || !/^[A-Za-z0-9_-]+$/.test(key))
      throw new ApiFailure("IDEMPOTENCY_REQUIRED", "An idempotency key is required");
    const path = c.req.path,
      requestHash = await hashRequest("POST", path, parsed.data);
    const session = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId},0))`);
      const [existing] = await tx
        .select()
        .from(schema.idempotencyKeys)
        .where(and(eq(schema.idempotencyKeys.userId, userId), eq(schema.idempotencyKeys.key, key)))
        .limit(1);
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new ApiFailure("IDEMPOTENCY_CONFLICT", "This key belongs to another request", 409);
        return ownedRow(tx, "workoutSessions", userId, existing.resourceId!);
      }
      const template = await ownedRow(tx, "workoutTemplates", userId, id);
      const exercises = await tx
        .select()
        .from(schema.workoutTemplateExercises)
        .where(
          and(
            eq(schema.workoutTemplateExercises.userId, userId),
            eq(schema.workoutTemplateExercises.templateId, id),
            isNull(schema.workoutTemplateExercises.deletedAt),
          ),
        )
        .orderBy(asc(schema.workoutTemplateExercises.position));
      for (const exercise of exercises) await ownedRow(tx, "exercises", userId, exercise.exerciseId);
      const [created] = await tx
        .insert(schema.workoutSessions)
        .values({ userId, templateId: id, name: String(template.name), startsAt: new Date(parsed.data.startsAt) })
        .returning();
      let position = 0;
      for (const exercise of exercises)
        for (let set = 0; set < exercise.sets; set++)
          await tx.insert(schema.workoutSets).values({
            userId,
            sessionId: created!.id,
            exerciseId: exercise.exerciseId,
            position: position++,
            reps: exercise.reps,
            loadKg: exercise.loadKg,
            durationSeconds: exercise.durationSeconds,
          });
      await tx.insert(schema.idempotencyKeys).values({
        userId,
        key,
        path,
        method: "POST",
        requestHash,
        resourceId: created!.id,
        status: "completed",
        expiresAt: new Date(Date.now() + 86400000),
      });
      return created;
    });
    return c.json({ data: session }, 201);
  });
  app.post("/api/v1/capture/preview", async (c) => {
    const parsed = capturePreviewSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Invalid capture text");
    const [prefs] = await db
      .select()
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, c.get("identity").id))
      .limit(1);
    return c.json({ data: parseCapture(parsed.data.text, new Date().toISOString(), prefs?.timezone ?? "Europe/Kyiv") });
  });
  app.get("/api/v1/habits/:id/statistics", async (c) => {
    const id = parseCursor(c.req.param("id"))!,
      userId = c.get("identity").id;
    const habit = await ownedRow(db, "habits", userId, id);
    const [prefs] = await db
      .select()
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);
    const entries = await db
      .select()
      .from(schema.habitEntries)
      .where(
        and(
          eq(schema.habitEntries.userId, userId),
          eq(schema.habitEntries.habitId, id),
          isNull(schema.habitEntries.deletedAt),
        ),
      );
    const weekdays = habit.schedule === "daily" || habit.schedule === "weekly_goal" ? [] : (habit.weekdays as number[]);
    return c.json({
      data: habitStatistics({
        startDate: String(habit.startDate),
        weekdays,
        schedule: habit.schedule as "daily" | "weekdays" | "weekly_goal",
        targetPerWeek: Number(habit.weeklyGoal),
        entries: entries.filter((e) => Number(e.count) >= Number(habit.targetCount)).map((e) => e.date),
        today: localDay(new Date().toISOString(), prefs?.timezone ?? "Europe/Kyiv"),
        ...(habit.endDate ? { endDate: String(habit.endDate) } : {}),
      }),
    });
  });
  app.get("/api/v1/finance/summary", async (c) => {
    const userId = c.get("identity").id;
    const [prefs] = await db
      .select()
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);
    const today = localDay(new Date().toISOString(), prefs?.timezone ?? "Europe/Kyiv");
    const month = c.req.query("month") ?? `${today.slice(0, 7)}-01`;
    if (!z.iso.date().safeParse(month).success || month.slice(8) !== "01")
      throw new ApiFailure("VALIDATION_ERROR", "Month must be its first date");
    const balances = await db.execute(sql`
      select a.id,a.name,a.currency,
      (a.opening_balance+coalesce((select sum(case when t.type='income' then t.amount else -t.amount end) from finance_transactions t where t.user_id=${userId} and t.account_id=a.id and t.deleted_at is null),0)+coalesce((select sum(t.destination_amount) from finance_transactions t where t.user_id=${userId} and t.destination_account_id=a.id and t.deleted_at is null),0))::text as balance
      from financial_accounts a where a.user_id=${userId} and a.deleted_at is null order by a.name`);
    const totals = await db.execute(
      sql`select currency,type,sum(amount)::text as amount from finance_transactions where user_id=${userId} and deleted_at is null and type<>'transfer' and transaction_date>=${month}::date and transaction_date<${month}::date+interval '1 month' group by currency,type`,
    );
    const categories = await db.execute(
      sql`select t.currency,t.category_id,c.name,sum(t.amount)::text as amount from finance_transactions t left join finance_categories c on c.id=t.category_id and c.user_id=t.user_id where t.user_id=${userId} and t.deleted_at is null and t.type='expense' and t.transaction_date>=${month}::date and t.transaction_date<${month}::date+interval '1 month' group by t.currency,t.category_id,c.name`,
    );
    const budgets = await db.execute(
      sql`select b.id,b.name,b.amount::text,b.currency,b.warning_threshold,coalesce(sum(t.amount),0)::text as consumed from budgets b left join finance_transactions t on t.user_id=b.user_id and t.deleted_at is null and t.type='expense' and t.currency=b.currency and (b.category_id is null or t.category_id=b.category_id) and t.transaction_date>=b.month and t.transaction_date<b.month+interval '1 month' where b.user_id=${userId} and b.deleted_at is null and b.month=${month}::date group by b.id`,
    );
    const savings = await db.execute(
      sql`select g.id,g.name,g.target_amount::text,g.currency,coalesce(sum(c.amount),0)::text as current_amount from savings_goals g left join savings_contributions c on c.goal_id=g.id and c.user_id=g.user_id and c.deleted_at is null where g.user_id=${userId} and g.deleted_at is null group by g.id`,
    );
    return c.json({
      data: {
        month,
        baseCurrency: prefs?.baseCurrency ?? "UAH",
        accounts: balances.rows,
        totals: totals.rows,
        categories: categories.rows,
        budgets: budgets.rows,
        savings: savings.rows,
      },
    });
  });
  app.get("/api/v1/health/summary", async (c) => {
    const userId = c.get("identity").id;
    const [prefs] = await db
      .select()
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);
    const date = c.req.query("date") ?? localDay(new Date().toISOString(), prefs?.timezone ?? "Europe/Kyiv");
    if (!z.iso.date().safeParse(date).success) throw new ApiFailure("VALIDATION_ERROR", "Invalid date");
    const [profile] = await db
      .select()
      .from(schema.healthProfiles)
      .where(ownerScope(tableFor("healthProfiles"), userId))
      .limit(1);
    const macros = await db.execute(
      sql`select coalesce(sum(i.calories),0)::text as calories,coalesce(sum(i.protein),0)::text as protein,coalesce(sum(i.fat),0)::text as fat,coalesce(sum(i.carbohydrates),0)::text as carbohydrates from meal_entry_items i join meal_entries m on m.id=i.meal_entry_id and m.user_id=i.user_id where i.user_id=${userId} and m.date=${date}::date and i.deleted_at is null and m.deleted_at is null`,
    );
    const [water] = await db
      .select({ amountMl: sql<number>`coalesce(sum(${schema.waterEntries.amountMl}),0)::integer` })
      .from(schema.waterEntries)
      .where(and(ownerScope(tableFor("waterEntries"), userId), eq(schema.waterEntries.date, date)));
    const measurements = await db
      .select()
      .from(schema.bodyMeasurements)
      .where(ownerScope(tableFor("bodyMeasurements"), userId))
      .orderBy(desc(schema.bodyMeasurements.date))
      .limit(30);
    const workouts = await db
      .select()
      .from(schema.workoutSessions)
      .where(ownerScope(tableFor("workoutSessions"), userId))
      .orderBy(desc(schema.workoutSessions.startsAt))
      .limit(5);
    return c.json({
      data: {
        date,
        profile: profile ?? null,
        macros: macros.rows[0],
        waterMl: water?.amountMl ?? 0,
        measurements,
        workouts,
      },
    });
  });
  app.post("/api/v1/push/subscriptions", async (c) => {
    const parsed = resourceRegistry.pushSubscriptions.createSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Invalid push subscription");
    const userId = c.get("identity").id;
    await validateRelations(db, "pushSubscriptions", userId, parsed.data);
    const [subscription] = await db
      .insert(schema.pushSubscriptions)
      .values({ userId, ...parsed.data, lastUsedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.pushSubscriptions.endpoint,
        set: {
          p256dh: parsed.data.p256dh,
          auth: parsed.data.auth,
          deviceName: parsed.data.deviceName ?? null,
          deletedAt: null,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        },
        setWhere: eq(schema.pushSubscriptions.userId, userId),
      })
      .returning();
    if (!subscription)
      throw new ApiFailure("PUSH_ENDPOINT_CONFLICT", "This push endpoint belongs to another account", 409);
    return c.json({ data: subscription }, 201);
  });
  app.delete("/api/v1/push/subscriptions/current", async (c) => {
    const parsed = z
      .strictObject({ endpoint: resourceRegistry.pushSubscriptions.createSchema.shape.endpoint })
      .safeParse(await c.req.json());
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Push endpoint required");
    await db
      .delete(schema.pushSubscriptions)
      .where(
        and(
          eq(schema.pushSubscriptions.userId, c.get("identity").id),
          eq(schema.pushSubscriptions.endpoint, parsed.data.endpoint),
        ),
      );
    return c.json({ data: { unsubscribed: true } });
  });
  app.get("/api/v1/notifications/unread-count", async (c) => {
    const [row] = await db
      .select({ count: sql<number>`count(*)::integer` })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, c.get("identity").id),
          isNull(schema.notifications.readAt),
          isNull(schema.notifications.deletedAt),
        ),
      );
    return c.json({ data: { count: row?.count ?? 0 } });
  });
  app.post("/api/v1/notifications/read-all", async (c) => {
    await db
      .update(schema.notifications)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(and(eq(schema.notifications.userId, c.get("identity").id), isNull(schema.notifications.readAt)));
    return c.json({ data: { read: true } });
  });
  app.delete("/api/v1/account", async (c) => {
    const parsed = accountDeleteSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Deletion confirmation required");
    const userId = c.get("identity").id;
    const [credential] = await db
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "credential")))
      .limit(1);
    if (credential) {
      if (!parsed.data.password) throw new ApiFailure("REAUTH_REQUIRED", "Confirm your password", 403);
      try {
        await auth.api.verifyPassword({ headers: c.req.raw.headers, body: { password: parsed.data.password } });
      } catch {
        throw new ApiFailure("REAUTH_REQUIRED", "Authentication failed", 403);
      }
    } else {
      const [current] = await db
        .select()
        .from(schema.session)
        .where(and(eq(schema.session.id, c.get("sessionId")), eq(schema.session.userId, userId)))
        .limit(1);
      if (!current || Date.now() - current.createdAt.getTime() > 300000)
        throw new ApiFailure("REAUTH_REQUIRED", "Sign in again before deleting your account", 403);
    }
    const [workspace] = await db
      .select()
      .from(schema.googleWorkspaceConnections)
      .where(eq(schema.googleWorkspaceConnections.userId, userId))
      .limit(1);
    if (workspace && workspace.status !== "disconnected") {
      const response = await app.fetch(
        new Request(`${new URL(config.APP_URL).origin}/api/v1/integrations/google`, {
          method: "DELETE",
          headers: c.req.raw.headers,
        }),
      );
      if (!response.ok)
        throw new ApiFailure(
          "DISCONNECT_REQUIRED",
          "Google could not be revoked; disconnect Workspace and retry deletion",
          409,
        );
    }
    await db.transaction(async (tx) => {
      await tx.insert(schema.auditLogs).values({
        actorUserId: userId,
        action: "account.deleted",
        targetType: "user",
        targetId: userId,
        requestId: c.get("requestId"),
      });
      await tx.delete(schema.user).where(eq(schema.user.id, userId));
    });
    return c.json({ data: { deleted: true } });
  });
  app.use("/api/v1/admin/*", async (c, next) => {
    if (c.get("identity").role !== "admin") throw new ApiFailure("FORBIDDEN", "Administrator access required", 403);
    await next();
  });
  app.get("/api/v1/admin/users", async (c) => {
    const limit = Number(c.req.query("limit") ?? 50),
      cursor = parseCursor(c.req.query("cursor"));
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new ApiFailure("INVALID_LIMIT", "Invalid page size");
    const rows = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        role: schema.user.role,
        disabled: schema.user.disabled,
        emailVerified: schema.user.emailVerified,
        createdAt: schema.user.createdAt,
        plan: schema.userEntitlements.plan,
      })
      .from(schema.user)
      .leftJoin(schema.userEntitlements, eq(schema.userEntitlements.userId, schema.user.id))
      .where(cursor ? gt(schema.user.id, cursor) : undefined)
      .orderBy(asc(schema.user.id))
      .limit(limit + 1);
    return c.json({ data: rows.slice(0, limit), ...(rows.length > limit ? { nextCursor: rows[limit - 1]?.id } : {}) });
  });
  app.patch("/api/v1/admin/users/:id", async (c) => {
    const id = parseCursor(c.req.param("id"))!;
    const parsed = adminUserSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Invalid administrative action");
    if (id === c.get("identity").id && parsed.data.disabled)
      throw new ApiFailure("FORBIDDEN", "Cannot disable your own account", 403);
    await db.transaction(async (tx) => {
      const [target] = await tx.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.id, id)).limit(1);
      if (!target) throw new ApiFailure("NOT_FOUND", "User not found", 404);
      if (parsed.data.disabled !== undefined) {
        await tx
          .update(schema.user)
          .set({ disabled: parsed.data.disabled, updatedAt: new Date() })
          .where(eq(schema.user.id, id));
        if (parsed.data.disabled) await tx.delete(schema.session).where(eq(schema.session.userId, id));
      }
      if (parsed.data.plan) {
        const values = {
          plan: parsed.data.plan,
          aiDailyLimit: parsed.data.plan === "PRO" ? config.PRO_AI_DAILY_LIMIT : 3,
          inboxBoxLimit: parsed.data.plan === "PRO" ? 5 : 2,
          grantedBy: c.get("identity").id,
        };
        await tx
          .insert(schema.userEntitlements)
          .values({ userId: id, ...values })
          .onConflictDoUpdate({
            target: schema.userEntitlements.userId,
            set: { ...values, expiresAt: null, deletedAt: null, updatedAt: new Date() },
          });
      }
      await tx.insert(schema.auditLogs).values({
        actorUserId: c.get("identity").id,
        action: parsed.data.plan ? "admin.plan_changed" : "admin.account_status_changed",
        targetType: "user",
        targetId: id,
        requestId: c.get("requestId"),
      });
    });
    return c.json({ data: { updated: true } });
  });
  app.get("/api/v1/admin/metrics", async (c) => {
    const counters = await db.execute(
      sql`select (select count(*) from users)::integer as users,(select count(*) from sessions where expires_at>now())::integer as active_sessions,(select count(*) from tasks where deleted_at is null)::integer as tasks,(select count(*) from tasks where deleted_at is null and status='done')::integer as completed_tasks,(select coalesce(sum(successful),0) from daily_usage_counters)::integer as ai_successful,(select coalesce(sum(rejected),0) from daily_usage_counters)::integer as ai_rejected,(select coalesce(sum(provider_errors),0) from daily_usage_counters)::integer as ai_provider_errors,(select count(*) from google_workspace_connections where status='connected')::integer as google_connected`,
    );
    const jobs = await db
      .select({
        type: schema.backgroundJobs.type,
        status: schema.backgroundJobs.status,
        count: sql<number>`count(*)::integer`,
      })
      .from(schema.backgroundJobs)
      .groupBy(schema.backgroundJobs.type, schema.backgroundJobs.status);
    const activity = await db.execute(
      sql`select (select count(*) from users where created_at>=date_trunc('day',now()))::integer as registered_today,(select count(distinct user_id) from sessions where updated_at>=date_trunc('day',now()))::integer as active_today,(select count(distinct user_id) from sessions where updated_at>=now()-interval '30 days')::integer as active_30_days,(select count(*) from calendar_sync_state where error_code is not null)::integer as google_sync_errors`,
    );
    const featureUsage = await db
      .select({
        date: schema.dailyProductMetrics.date,
        metric: schema.dailyProductMetrics.metric,
        count: schema.dailyProductMetrics.count,
      })
      .from(schema.dailyProductMetrics)
      .where(gte(schema.dailyProductMetrics.date, new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)))
      .orderBy(desc(schema.dailyProductMetrics.date))
      .limit(1000);
    return c.json({ data: { ...counters.rows[0], ...activity.rows[0], jobs, featureUsage } });
  });
  app.get("/api/v1/admin/jobs", async (c) =>
    c.json({
      data: await db
        .select({
          id: schema.backgroundJobs.id,
          type: schema.backgroundJobs.type,
          status: schema.backgroundJobs.status,
          attempts: schema.backgroundJobs.attempts,
          runAt: schema.backgroundJobs.runAt,
          errorCode: schema.backgroundJobs.errorCode,
          completedAt: schema.backgroundJobs.completedAt,
        })
        .from(schema.backgroundJobs)
        .orderBy(desc(schema.backgroundJobs.createdAt))
        .limit(100),
    }),
  );
  app.get("/api/v1/admin/audit", async (c) =>
    c.json({ data: await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(100) }),
  );
  app.get("/api/v1/admin/flags", async (c) =>
    c.json({ data: await db.select().from(schema.featureFlags).orderBy(asc(schema.featureFlags.key)) }),
  );
  app.patch("/api/v1/admin/flags/:key", async (c) => {
    const parsed = z
      .strictObject({ enabled: z.boolean(), description: z.string().trim().min(1).max(500).optional() })
      .safeParse(await c.req.json());
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Invalid flag state");
    const key = c.req.param("key");
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(key)) throw new ApiFailure("VALIDATION_ERROR", "Invalid flag key");
    const [row] = await db
      .insert(schema.featureFlags)
      .values({ key, enabled: parsed.data.enabled, description: parsed.data.description ?? key })
      .onConflictDoUpdate({ target: schema.featureFlags.key, set: { ...parsed.data, updatedAt: new Date() } })
      .returning();
    await db.insert(schema.auditLogs).values({
      actorUserId: c.get("identity").id,
      action: "admin.flag_changed",
      targetType: "feature_flag",
      requestId: c.get("requestId"),
    });
    if (!row) throw new ApiFailure("NOT_FOUND", "Flag not found", 404);
    return c.json({ data: row });
  });
}

import type { Auth } from "@lifesync/auth";
import type { AppConfig } from "@lifesync/config";
import { effectiveEntitlement } from "@lifesync/config";
import {
  aiPermissionsSchema,
  preferencesSchema,
  resourceRegistry,
  updateAiPermissionsSchema,
  updatePreferencesSchema,
} from "@lifesync/contracts";
import type { Database } from "@lifesync/db";
import * as schema from "@lifesync/db";
import { localDay } from "@lifesync/domain";
import type { AIProvider } from "@lifesync/integrations";
import { and, asc, desc, eq, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import { registerAi } from "./ai";
import { calendarOccurrences, localStartOfDay, nextDate } from "./calendar";
import { makeOpenApi } from "./openapi";
import {
  databaseValues,
  enforceInboxLimit,
  hashRequest,
  listRows,
  ownedRow,
  ownerScope,
  rateLimitRequest,
  tableFor,
  validateRelations,
} from "./resources";
import { ApiFailure, parseCursor, publicError, requireMutationOrigin } from "./security";
import { registerServices } from "./services";
import { registerWorkspace } from "./workspace";

type Identity = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
  role?: string;
  disabled?: boolean;
  termsAcceptedAt?: Date | null;
};
export type AppEnv = { Variables: { requestId: string; identity: Identity; sessionId: string } };
export interface AppDependencies {
  db: Database;
  auth: Auth;
  config: AppConfig;
  aiProvider?: AIProvider;
}

export function createApp(dependencies: AppDependencies) {
  const { db, auth, config } = dependencies;
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("requestId", crypto.randomUUID());
    c.header("X-Request-ID", c.get("requestId"));
    c.header("Cache-Control", "private, no-store");
    const started = Date.now();
    await next();
    try {
      const module = c.req.path.startsWith("/api/v1/")
        ? c.req.path.split("/")[3]
        : c.req.path.startsWith("/api/auth/")
          ? "auth"
          : null;
      if (module && /^[a-z-]+$/.test(module))
        await db
          .insert(schema.dailyProductMetrics)
          .values({
            date: new Date().toISOString().slice(0, 10),
            metric: `api.${module}.${c.res.status >= 500 ? "error" : "request"}`,
            count: 1,
          })
          .onConflictDoUpdate({
            target: [schema.dailyProductMetrics.date, schema.dailyProductMetrics.metric],
            set: { count: sql`${schema.dailyProductMetrics.count}+1` },
          });
    } catch {
      console.error(JSON.stringify({ requestId: c.get("requestId"), code: "METRICS_WRITE_FAILED" }));
    }
    console.log(
      JSON.stringify({
        requestId: c.get("requestId"),
        method: c.req.method,
        route: c.req.routePath,
        status: c.res.status,
        durationMs: Date.now() - started,
      }),
    );
  });
  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      referrerPolicy: "no-referrer",
    }),
  );
  app.use(
    "*",
    bodyLimit({
      maxSize: 262144,
      onError: () => {
        throw new ApiFailure("BODY_TOO_LARGE", "Request body too large", 413);
      },
    }),
  );
  app.use("*", async (c, next) => {
    const origin = c.req.header("Origin");
    if (origin && origin !== new URL(config.APP_URL).origin)
      throw new ApiFailure("ORIGIN_REJECTED", "Request origin is not permitted", 403);
    if (origin) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Credentials", "true");
      c.header("Vary", "Origin");
    }
    if (c.req.method === "OPTIONS") {
      c.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
      c.header("Access-Control-Allow-Headers", "Content-Type,Idempotency-Key,X-Turnstile-Token");
      return c.body(null, 204);
    }
    if (c.req.path !== "/api/webhooks/google/calendar")
      requireMutationOrigin(c.req.method, origin ?? null, config.APP_URL);
    await next();
  });
  app.onError((error, c) => {
    const cause = error.cause as { code?: string } | undefined;
    console.error(
      JSON.stringify({
        requestId: c.get("requestId"),
        code: error instanceof ApiFailure ? error.code : "INTERNAL_ERROR",
        databaseCode: cause?.code,
        method: c.req.method,
        route: c.req.routePath,
      }),
    );
    const safe = error instanceof SyntaxError ? new ApiFailure("INVALID_JSON", "Invalid JSON body") : error;
    return c.json(publicError(safe, c.get("requestId")), (safe instanceof ApiFailure ? safe.status : 500) as 400);
  });
  app.notFound((c) =>
    c.json(publicError(new ApiFailure("NOT_FOUND", "Endpoint not found", 404), c.get("requestId")), 404),
  );
  app.get("/health", (c) => c.json({ data: { status: "ok" } }));
  app.get("/api/public/config", (c) =>
    c.json({
      data: {
        googleWorkspaceClientId: config.GOOGLE_WORKSPACE_CLIENT_ID ?? null,
        googlePickerApiKey: config.GOOGLE_PICKER_API_KEY ?? null,
        googlePickerAppId: config.GOOGLE_PICKER_APP_ID ?? null,
        turnstileSiteKey: config.TURNSTILE_SITE_KEY ?? null,
        googleIdentityEnabled: !!config.GOOGLE_CLIENT_ID,
        supportEmail: config.SUPPORT_EMAIL,
        vapidPublicKey: config.VAPID_PUBLIC_KEY ?? null,
      },
    }),
  );
  app.post("/api/webhooks/google/calendar", async (c) => {
    const channelId = c.req.header("X-Goog-Channel-ID"),
      resourceId = c.req.header("X-Goog-Resource-ID"),
      token = c.req.header("X-Goog-Channel-Token"),
      number = c.req.header("X-Goog-Message-Number");
    if (!channelId || !resourceId || !token || !number || !/^[0-9]{1,30}$/.test(number))
      throw new ApiFailure("WEBHOOK_REJECTED", "Invalid channel notification", 403);
    const tokenHash = await hashRequest("CHANNEL", "", token);
    await db.transaction(async (tx) => {
      const [watch] = await tx
        .update(schema.googleWatchChannels)
        .set({ lastMessageNumber: number, updatedAt: new Date() })
        .where(
          and(
            eq(schema.googleWatchChannels.channelId, channelId),
            eq(schema.googleWatchChannels.resourceId, resourceId),
            eq(schema.googleWatchChannels.tokenHash, tokenHash),
            sql`${schema.googleWatchChannels.expiresAt}>now()`,
            sql`${schema.googleWatchChannels.lastMessageNumber}<${number}::numeric`,
          ),
        )
        .returning();
      if (!watch) {
        const [existing] = await tx
          .select({ id: schema.googleWatchChannels.id })
          .from(schema.googleWatchChannels)
          .where(
            and(
              eq(schema.googleWatchChannels.channelId, channelId),
              eq(schema.googleWatchChannels.resourceId, resourceId),
              eq(schema.googleWatchChannels.tokenHash, tokenHash),
            ),
          )
          .limit(1);
        if (!existing) throw new ApiFailure("WEBHOOK_REJECTED", "Invalid channel notification", 403);
        return;
      }
      await tx
        .insert(schema.backgroundJobs)
        .values({
          userId: watch.userId,
          type: "google_sync",
          targetId: watch.calendarId,
          idempotencyKey: `google:${watch.channelId}:${number}`,
        })
        .onConflictDoNothing();
    });
    return c.body(null, 204);
  });
  app.all("/api/auth/*", async (c) => {
    if (
      c.req.method === "POST" &&
      ["/api/auth/sign-up/email", "/api/auth/request-password-reset"].includes(c.req.path) &&
      config.TURNSTILE_SECRET_KEY
    ) {
      const token = c.req.header("X-Turnstile-Token");
      if (!token) throw new ApiFailure("ANTIBOT_REQUIRED", "Verification required", 403);
      const check = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: new URLSearchParams({ secret: config.TURNSTILE_SECRET_KEY, response: token }),
        signal: AbortSignal.timeout(10000),
      });
      const result = z.object({ success: z.boolean(), hostname: z.string().optional() }).parse(await check.json());
      if (!result.success || result.hostname !== new URL(config.APP_URL).hostname)
        throw new ApiFailure("ANTIBOT_FAILED", "Verification failed", 403);
    }
    if (c.req.path === "/api/auth/sign-up/email" && c.req.method === "POST") {
      const body = (await c.req.raw.clone().json()) as Record<string, unknown>;
      if (body.termsAccepted !== true) throw new ApiFailure("TERMS_REQUIRED", "Terms and privacy acceptance required");
    }
    const path = c.req.path;
    const auditAction =
      path === "/api/auth/sign-in/email"
        ? "auth.login"
        : path === "/api/auth/sign-out"
          ? "auth.logout"
          : path === "/api/auth/change-password"
            ? "auth.password_changed"
            : null;
    const actor =
      auditAction && auditAction !== "auth.login" ? await auth.api.getSession({ headers: c.req.raw.headers }) : null;
    const response = await auth.handler(c.req.raw);
    if (auditAction) {
      let actorUserId = actor?.user.id;
      if (auditAction === "auth.login" && response.ok) {
        const body = z.object({ user: z.object({ id: z.uuid() }) }).safeParse(await response.clone().json());
        if (body.success) actorUserId = body.data.user.id;
      }
      await db.insert(schema.auditLogs).values({
        actorUserId: actorUserId ?? null,
        action: response.ok ? auditAction : `${auditAction}_failed`,
        requestId: c.get("requestId"),
      });
    }
    return response;
  });
  app.use("/api/v1/*", async (c, next) => {
    const identity = await auth.api.getSession({ headers: c.req.raw.headers, query: { disableCookieCache: true } });
    if (!identity) throw new ApiFailure("UNAUTHENTICATED", "Sign in required", 401);
    if (!identity.user.emailVerified) throw new ApiFailure("EMAIL_NOT_VERIFIED", "Verify your email", 403);
    const [stored] = await db.select().from(schema.user).where(eq(schema.user.id, identity.user.id)).limit(1);
    if (!stored || stored.disabled) throw new ApiFailure("ACCOUNT_DISABLED", "Account is unavailable", 403);
    if (!stored.termsAcceptedAt && !["/api/v1/me", "/api/v1/consent"].includes(c.req.path))
      throw new ApiFailure("TERMS_REQUIRED", "Accept terms and privacy policy", 403);
    c.set("identity", stored);
    c.set("sessionId", identity.session.id);
    await rateLimitRequest(
      db,
      stored.id,
      c.req.path.endsWith("/search") ? "search" : "general",
      c.req.path.endsWith("/search") ? 30 : 180,
    );
    await next();
  });
  app.get("/api/v1/me", (c) => {
    const u = c.get("identity");
    return c.json({
      data: {
        id: u.id,
        email: u.email,
        name: u.name,
        image: u.image,
        emailVerified: u.emailVerified,
        role: u.role,
        termsAcceptedAt: u.termsAcceptedAt,
      },
    });
  });
  app.post("/api/v1/consent", async (c) => {
    if (!z.strictObject({ accepted: z.literal(true) }).safeParse(await c.req.json()).success)
      throw new ApiFailure("TERMS_REQUIRED", "Explicit acceptance required");
    await db
      .update(schema.user)
      .set({ termsAcceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.user.id, c.get("identity").id));
    return c.json({ data: { accepted: true } });
  });
  app.patch("/api/v1/me", async (c) => {
    const parsed = z
      .strictObject({ name: z.string().trim().min(1).max(100).optional(), image: z.url().nullable().optional() })
      .refine((v) => Object.keys(v).length > 0)
      .safeParse(await c.req.json());
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Invalid profile");
    const [row] = await db
      .update(schema.user)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(schema.user.id, c.get("identity").id))
      .returning({ id: schema.user.id, name: schema.user.name, image: schema.user.image });
    return c.json({ data: row });
  });
  app.get("/api/v1/preferences", async (c) => {
    const [row] = await db
      .select()
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, c.get("identity").id))
      .limit(1);
    return c.json({ data: row ?? preferencesSchema.parse({}) });
  });
  app.patch("/api/v1/preferences", async (c) => {
    const parsed = updatePreferencesSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Invalid preferences");
    const userId = c.get("identity").id;
    const [row] = await db
      .insert(schema.userPreferences)
      .values({ userId, ...preferencesSchema.parse(parsed.data) })
      .onConflictDoUpdate({ target: schema.userPreferences.userId, set: { ...parsed.data, updatedAt: new Date() } })
      .returning();
    return c.json({ data: row });
  });
  app.post("/api/v1/onboarding", async (c) => {
    const parsed = z.strictObject({ completed: z.literal(true) }).safeParse(await c.req.json());
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Invalid onboarding state");
    const [row] = await db
      .insert(schema.userPreferences)
      .values({ userId: c.get("identity").id, ...preferencesSchema.parse({ onboardingCompleted: true }) })
      .onConflictDoUpdate({
        target: schema.userPreferences.userId,
        set: { onboardingCompleted: true, updatedAt: new Date() },
      })
      .returning();
    return c.json({ data: row });
  });
  app.get("/api/v1/entitlements", async (c) => {
    const [row] = await db
      .select()
      .from(schema.userEntitlements)
      .where(eq(schema.userEntitlements.userId, c.get("identity").id))
      .limit(1);
    return c.json({ data: effectiveEntitlement(row, config.PRO_AI_DAILY_LIMIT) });
  });
  app.get("/api/v1/ai/permissions", async (c) => {
    const [row] = await db
      .select()
      .from(schema.aiPermissions)
      .where(eq(schema.aiPermissions.userId, c.get("identity").id))
      .limit(1);
    return c.json({ data: row ?? aiPermissionsSchema.parse({}) });
  });
  app.patch("/api/v1/ai/permissions", async (c) => {
    const parsed = updateAiPermissionsSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Invalid AI permissions");
    const [row] = await db
      .insert(schema.aiPermissions)
      .values({ userId: c.get("identity").id, ...aiPermissionsSchema.parse(parsed.data) })
      .onConflictDoUpdate({ target: schema.aiPermissions.userId, set: { ...parsed.data, updatedAt: new Date() } })
      .returning();
    return c.json({ data: row });
  });
  app.get("/api/v1/sessions", async (c) => {
    const rows = await db
      .select({
        id: schema.session.id,
        createdAt: schema.session.createdAt,
        updatedAt: schema.session.updatedAt,
        expiresAt: schema.session.expiresAt,
        userAgent: schema.session.userAgent,
      })
      .from(schema.session)
      .where(eq(schema.session.userId, c.get("identity").id));
    return c.json({ data: rows.map((s) => ({ ...s, current: s.id === c.get("sessionId") })) });
  });
  app.delete("/api/v1/sessions/:id", async (c) => {
    const id = parseCursor(c.req.param("id"))!;
    const rows = await db
      .delete(schema.session)
      .where(and(eq(schema.session.id, id), eq(schema.session.userId, c.get("identity").id)))
      .returning({ id: schema.session.id });
    if (!rows.length) throw new ApiFailure("NOT_FOUND", "Session not found", 404);
    await db.insert(schema.auditLogs).values({
      actorUserId: c.get("identity").id,
      action: "auth.sessions_revoked",
      targetType: "session",
      requestId: c.get("requestId"),
    });
    return c.json({ data: { revoked: true } });
  });
  app.post("/api/v1/sessions/revoke-others", async (c) => {
    await db
      .delete(schema.session)
      .where(and(eq(schema.session.userId, c.get("identity").id), sql`${schema.session.id} <> ${c.get("sessionId")}`));
    await db.insert(schema.auditLogs).values({
      actorUserId: c.get("identity").id,
      action: "auth.sessions_revoked",
      targetType: "session",
      requestId: c.get("requestId"),
    });
    return c.json({ data: { revoked: true } });
  });
  registerServices(app, { db, auth, config });
  registerWorkspace(app, { db, auth, config });
  registerAi(app, dependencies);
  // Register longer nested paths before /tasks/:id and /habits/:id.
  const entries = Object.entries(resourceRegistry).sort((a, b) => b[1].path.length - a[1].path.length);
  for (const [key, resource] of entries) {
    const name = key as keyof typeof resourceRegistry;
    const path = `/api/v1${resource.path}`;
    const table = tableFor(name);
    app.get(path, async (c) => c.json(await listRows(db, name, c.get("identity").id, c.req.query())));
    app.get(`${path}/:id`, async (c) =>
      c.json({ data: await ownedRow(db, name, c.get("identity").id, parseCursor(c.req.param("id"))!) }),
    );
    app.post(path, async (c) => {
      if (name === "notifications") throw new ApiFailure("FORBIDDEN", "Notifications are system managed", 403);
      const parsed = resource.createSchema.safeParse(await c.req.json());
      if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Invalid resource input");
      const userId = c.get("identity").id;
      const idemKey = c.req.header("Idempotency-Key");
      if (idemKey && (idemKey.length > 128 || !/^[A-Za-z0-9_-]+$/.test(idemKey)))
        throw new ApiFailure("INVALID_IDEMPOTENCY_KEY", "Invalid idempotency key");
      if (name === "financeTransactions" && !idemKey)
        throw new ApiFailure("IDEMPOTENCY_REQUIRED", "An idempotency key is required");
      const requestHash = await hashRequest("POST", path, parsed.data);
      const row = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
        if (idemKey) {
          const [existing] = await tx
            .select()
            .from(schema.idempotencyKeys)
            .where(and(eq(schema.idempotencyKeys.userId, userId), eq(schema.idempotencyKeys.key, idemKey)))
            .limit(1);
          if (existing) {
            if (existing.requestHash !== requestHash || existing.path !== path)
              throw new ApiFailure("IDEMPOTENCY_CONFLICT", "This key was used for another request", 409);
            if (existing.responseBody) return (existing.responseBody as { data: Record<string, unknown> }).data;
            if (existing.resourceId) return ownedRow(tx, name, userId, existing.resourceId);
            throw new ApiFailure("IDEMPOTENCY_PENDING", "Request is being processed", 409);
          }
        }
        await validateRelations(tx, name, userId, parsed.data);
        if (name === "inboxBoxes") await enforceInboxLimit(tx, userId);
        const values = databaseValues(name, parsed.data);
        const [inserted] = await tx
          .insert(table)
          .values({ ...values, userId })
          .returning();
        if (idemKey)
          await tx.insert(schema.idempotencyKeys).values({
            userId,
            key: idemKey,
            method: "POST",
            path,
            requestHash,
            resourceId: String(inserted?.id),
            status: "completed",
            responseBody: { data: inserted },
            statusCode: 201,
            expiresAt: new Date(Date.now() + 86400000),
          });
        return inserted;
      });
      return c.json({ data: row }, 201);
    });
    app.patch(`${path}/:id`, async (c) => {
      const id = parseCursor(c.req.param("id"))!;
      const body = await c.req.json();
      if (name === "notifications" && !z.strictObject({ readAt: z.iso.datetime().nullable() }).safeParse(body).success)
        throw new ApiFailure("FORBIDDEN", "Only notification read state may be changed", 403);
      const parsed = resource.updateSchema.safeParse(body);
      if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Invalid resource input");
      const userId = c.get("identity").id;
      const row = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
        const current = await ownedRow(tx, name, userId, id);
        const merged: Record<string, unknown> = { ...current, ...parsed.data };
        // Revalidate the complete state so partial calendar/transfer/target edits cannot break invariants.
        const shape: Record<string, z.ZodType> = resource.createSchema.shape;
        const candidate = Object.fromEntries(
          Object.keys(shape).flatMap((k) =>
            merged[k] === null && !shape[k]?.isNullable()
              ? []
              : [[k, merged[k] instanceof Date ? (merged[k] as Date).toISOString() : merged[k]]],
          ),
        );
        const complete = resource.createSchema.safeParse(candidate);
        if (!complete.success) throw new ApiFailure("VALIDATION_ERROR", "Updated resource violates its constraints");
        await validateRelations(tx, name, userId, complete.data, id);
        const [updated] = await tx
          .update(table)
          .set({ ...databaseValues(name, parsed.data), updatedAt: new Date() })
          .where(ownerScope(table, userId, id))
          .returning();
        return updated;
      });
      return c.json({ data: row });
    });
    app.delete(`${path}/:id`, async (c) => {
      const id = parseCursor(c.req.param("id"))!;
      const [row] = await db
        .update(table)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(ownerScope(table, c.get("identity").id, id))
        .returning({ id: table.id });
      if (!row) throw new ApiFailure("NOT_FOUND", "Resource not found", 404);
      return c.json({ data: row });
    });
    app.post(`${path}/:id/restore`, async (c) => {
      const id = parseCursor(c.req.param("id"))!,
        userId = c.get("identity").id;
      const row = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
        const old = await ownedRow(tx, name, userId, id, true);
        await validateRelations(tx, name, userId, old, id);
        if (name === "inboxBoxes") await enforceInboxLimit(tx, userId);
        const [restored] = await tx
          .update(table)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(ownerScope(table, userId, id, true))
          .returning();
        return restored;
      });
      return c.json({ data: row });
    });
  }
  app.get("/api/v1/dashboard", async (c) => {
    const userId = c.get("identity").id;
    const [preferences] = await db
      .select()
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);
    const timezone = preferences?.timezone ?? "Europe/Kyiv",
      today = localDay(new Date().toISOString(), timezone),
      start = localStartOfDay(today, timezone),
      end = localStartOfDay(nextDate(today), timezone),
      weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    const [projects, tasks, habits, calendarEvents, inboxItems] = await Promise.all([
      db
        .select()
        .from(schema.projects)
        .where(
          and(
            eq(schema.projects.userId, userId),
            isNull(schema.projects.deletedAt),
            eq(schema.projects.archived, false),
            eq(schema.projects.status, "active"),
          ),
        )
        .orderBy(desc(schema.projects.updatedAt), asc(schema.projects.id))
        .limit(20),
      db
        .select()
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.userId, userId),
            isNull(schema.tasks.deletedAt),
            sql`${schema.tasks.status} not in ('done','cancelled')`,
            or(
              lte(schema.tasks.dueDate, today),
              lt(schema.tasks.dueAt, end),
              and(gte(schema.tasks.startsAt, start), lt(schema.tasks.startsAt, end)),
              sql`${schema.tasks.priority} in ('high','urgent')`,
              and(isNull(schema.tasks.dueAt), isNull(schema.tasks.dueDate)),
            ),
          ),
        )
        .orderBy(
          sql`case ${schema.tasks.priority} when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end`,
          sql`coalesce(${schema.tasks.dueAt},${schema.tasks.dueDate}::timestamp at time zone ${timezone}) asc nulls last`,
          asc(schema.tasks.position),
          asc(schema.tasks.id),
        )
        .limit(20),
      db
        .select()
        .from(schema.habits)
        .where(
          and(
            eq(schema.habits.userId, userId),
            isNull(schema.habits.deletedAt),
            eq(schema.habits.archived, false),
            lte(schema.habits.startDate, today),
            or(isNull(schema.habits.endDate), gte(schema.habits.endDate, today)),
            sql`(${schema.habits.schedule} <> 'weekdays' or ${weekday}=any(${schema.habits.weekdays}))`,
          ),
        )
        .orderBy(asc(schema.habits.name), asc(schema.habits.id))
        .limit(20),
      calendarOccurrences(db, userId, today, today, timezone),
      db
        .select()
        .from(schema.inboxItems)
        .where(
          and(
            eq(schema.inboxItems.userId, userId),
            isNull(schema.inboxItems.deletedAt),
            eq(schema.inboxItems.archived, false),
          ),
        )
        .orderBy(desc(schema.inboxItems.pinned), desc(schema.inboxItems.createdAt), asc(schema.inboxItems.id))
        .limit(20),
    ]);
    return c.json({ data: { today, timezone, projects, tasks, habits, calendarEvents, inboxItems } });
  });
  app.get("/api/v1/search", async (c) => {
    const q = c.req.query("q")?.trim();
    if (!q || q.length > 200) throw new ApiFailure("INVALID_SEARCH", "Search must contain 1-200 characters");
    const names = [
      "projects",
      "tasks",
      "habits",
      "calendarEvents",
      "inboxItems",
      "financeTransactions",
      "customFoods",
      "exercises",
      "driveLinks",
    ] as const;
    const groups = await Promise.all(
      names.map(async (name) => ({
        resource: name,
        path: resourceRegistry[name].path,
        items: (await listRows(db, name, c.get("identity").id, { limit: "10", search: q })).data,
      })),
    );
    return c.json({ data: groups });
  });
  app.get("/api/v1/trash", async (c) => {
    const groups = await Promise.all(
      entries.map(async ([name, resource]) => ({
        resource: name,
        path: resource.path,
        ...(await listRows(db, name as keyof typeof resourceRegistry, c.get("identity").id, { limit: "100" }, true)),
      })),
    );
    return c.json({ data: groups });
  });
  app.delete("/api/v1/trash/:resource/:id", async (c) => {
    const name = c.req.param("resource") as keyof typeof resourceRegistry;
    if (!resourceRegistry[name]) throw new ApiFailure("NOT_FOUND", "Resource not found", 404);
    const table = tableFor(name),
      id = parseCursor(c.req.param("id"))!;
    const [row] = await db
      .delete(table)
      .where(ownerScope(table, c.get("identity").id, id, true))
      .returning({ id: table.id });
    if (!row) throw new ApiFailure("NOT_FOUND", "Resource not found", 404);
    return c.json({ data: row });
  });
  app.get("/api/v1/export", async (c) => {
    const userId = c.get("identity").id;
    const content = await db.transaction(async (tx) => {
      await tx.execute(sql`set transaction isolation level repeatable read read only`);
      const output: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        version: 1,
        profile: { name: c.get("identity").name, email: c.get("identity").email },
      };
      for (const [name] of entries) {
        if (name === "pushSubscriptions") continue;
        const table = tableFor(name as keyof typeof resourceRegistry);
        output[name] = await tx.select().from(table).where(eq(table.userId, userId));
      }
      for (const table of [
        schema.userProfiles,
        schema.userPreferences,
        schema.userEntitlements,
        schema.aiPermissions,
        schema.aiMessages,
        schema.googleCalendars,
      ]) {
        const name =
          table === schema.userProfiles
            ? "profileDetails"
            : table === schema.userPreferences
              ? "preferences"
              : table === schema.userEntitlements
                ? "entitlements"
                : table === schema.aiPermissions
                  ? "aiPermissions"
                  : table === schema.aiMessages
                    ? "aiMessages"
                    : "googleCalendars";
        output[name] = await tx.select().from(table).where(eq(table.userId, userId));
      }
      output.googleWorkspace = await tx
        .select({
          email: schema.googleWorkspaceConnections.email,
          googleSubject: schema.googleWorkspaceConnections.googleSubject,
          scopes: schema.googleWorkspaceConnections.scopes,
          calendarEnabled: schema.googleWorkspaceConnections.calendarEnabled,
          driveEnabled: schema.googleWorkspaceConnections.driveEnabled,
          status: schema.googleWorkspaceConnections.status,
        })
        .from(schema.googleWorkspaceConnections)
        .where(eq(schema.googleWorkspaceConnections.userId, userId));
      return output;
    });
    c.header("Content-Disposition", 'attachment; filename="lifesync-export.json"');
    return c.json(content);
  });
  app.get("/api/v1/openapi.json", (c) => c.json(makeOpenApi(app.routes)));
  return app;
}

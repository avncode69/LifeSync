import type { AppConfig } from "@lifesync/config";
import type { Database } from "@lifesync/db";
import * as schema from "@lifesync/db";
import {
  decryptToken,
  encryptToken,
  exchangeGoogleCode,
  GoogleCalendarClient,
  type GoogleEvent,
  googleDriveMetadata,
  googleIdentity,
  ProviderError,
  parseGoogleFile,
  pkceChallenge,
  refreshGoogleToken,
  revokeGoogleToken,
  syncDecision,
  workspaceAuthorizationUrl,
} from "@lifesync/integrations";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import type { AppDependencies, AppEnv } from "./app";
import { hashRequest, rateLimitRequest } from "./resources";
import { ApiFailure, parseCursor } from "./security";
import { calendarConflictSchema, calendarSelectionSchema, workspaceConnectSchema } from "./service-contracts";

function credentials(config: AppConfig) {
  if (
    !config.GOOGLE_WORKSPACE_CLIENT_ID ||
    !config.GOOGLE_WORKSPACE_CLIENT_SECRET ||
    !config.GOOGLE_TOKEN_ENCRYPTION_KEY
  )
    throw new ApiFailure("INTEGRATION_NOT_CONFIGURED", "Google Workspace is not configured", 503);
  return {
    clientId: config.GOOGLE_WORKSPACE_CLIENT_ID,
    clientSecret: config.GOOGLE_WORKSPACE_CLIENT_SECRET,
    key: config.GOOGLE_TOKEN_ENCRYPTION_KEY,
  };
}
async function decryptStored(value: string, config: AppConfig, userId: string) {
  const keys = credentials(config);
  try {
    return await decryptToken(value, keys.key, userId);
  } catch (error) {
    if (config.GOOGLE_TOKEN_PREVIOUS_ENCRYPTION_KEY)
      return decryptToken(value, config.GOOGLE_TOKEN_PREVIOUS_ENCRYPTION_KEY, userId);
    throw error;
  }
}
export async function workspaceAccessToken(db: Database, config: AppConfig, userId: string) {
  const keys = credentials(config);
  return db
    .transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`google:${userId}`},0))`);
      const [connection] = await tx
        .select()
        .from(schema.googleWorkspaceConnections)
        .where(
          and(
            eq(schema.googleWorkspaceConnections.userId, userId),
            isNull(schema.googleWorkspaceConnections.deletedAt),
          ),
        )
        .limit(1);
      if (!connection || connection.status !== "connected")
        throw new ApiFailure("GOOGLE_CONNECT_REQUIRED", "Connect Google Workspace", 409);
      if (
        connection.encryptedAccessToken &&
        connection.accessTokenExpiresAt &&
        connection.accessTokenExpiresAt.getTime() > Date.now() + 60000
      )
        return decryptStored(connection.encryptedAccessToken, config, userId);
      try {
        const refreshed = await refreshGoogleToken({
          refreshToken: await decryptStored(connection.encryptedRefreshToken, config, userId),
          clientId: keys.clientId,
          clientSecret: keys.clientSecret,
        });
        await tx
          .update(schema.googleWorkspaceConnections)
          .set({
            encryptedAccessToken: await encryptToken(refreshed.access_token, keys.key, userId),
            encryptedRefreshToken: await encryptToken(
              refreshed.refresh_token ?? (await decryptStored(connection.encryptedRefreshToken, config, userId)),
              keys.key,
              userId,
            ),
            accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
            updatedAt: new Date(),
          })
          .where(eq(schema.googleWorkspaceConnections.id, connection.id));
        return refreshed.access_token;
      } catch (error) {
        if (error instanceof ProviderError && error.code === "PROVIDER_RECONNECT_REQUIRED")
          throw new ApiFailure("GOOGLE_RECONNECT_REQUIRED", "Reconnect Google Workspace", 409);
        throw error;
      }
    })
    .catch(async (error) => {
      if (error instanceof ApiFailure && error.code === "GOOGLE_RECONNECT_REQUIRED")
        await db
          .update(schema.googleWorkspaceConnections)
          .set({ status: "reconnect_required", errorCode: "TOKEN_REFRESH_FAILED" })
          .where(eq(schema.googleWorkspaceConnections.userId, userId));
      throw error;
    });
}
export function registerWorkspace(app: Hono<AppEnv>, { db, config }: AppDependencies) {
  app.get("/api/v1/integrations/google", async (c) => {
    const [row] = await db
      .select({
        id: schema.googleWorkspaceConnections.id,
        email: schema.googleWorkspaceConnections.email,
        avatarUrl: schema.googleWorkspaceConnections.avatarUrl,
        status: schema.googleWorkspaceConnections.status,
        scopes: schema.googleWorkspaceConnections.scopes,
        calendarEnabled: schema.googleWorkspaceConnections.calendarEnabled,
        driveEnabled: schema.googleWorkspaceConnections.driveEnabled,
        lastSyncedAt: schema.googleWorkspaceConnections.lastSyncedAt,
        errorCode: schema.googleWorkspaceConnections.errorCode,
      })
      .from(schema.googleWorkspaceConnections)
      .where(
        and(
          eq(schema.googleWorkspaceConnections.userId, c.get("identity").id),
          isNull(schema.googleWorkspaceConnections.deletedAt),
        ),
      )
      .limit(1);
    return c.json({ data: row ?? { status: "disconnected", calendarEnabled: false, driveEnabled: false, scopes: [] } });
  });
  app.post("/api/v1/integrations/google/connect", async (c) => {
    const keys = credentials(config);
    const parsed = workspaceConnectSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Select Calendar or Drive permissions");
    const userId = c.get("identity").id,
      state = crypto.randomUUID(),
      verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join(
        "",
      );
    const identifier = `workspace:${userId}:${await hashRequest("STATE", "", state)}`;
    await db.insert(schema.verification).values({
      identifier,
      value: await encryptToken(JSON.stringify({ verifier, ...parsed.data }), keys.key, userId),
      expiresAt: new Date(Date.now() + 600000),
    });
    const url = workspaceAuthorizationUrl({
      clientId: keys.clientId,
      redirectUri: `${new URL(config.APP_URL).origin}/api/v1/integrations/google/callback`,
      state,
      challenge: await pkceChallenge(verifier),
      ...parsed.data,
    });
    return c.json({ data: { url } });
  });
  app.get("/api/v1/integrations/google/callback", async (c) => {
    const keys = credentials(config),
      userId = c.get("identity").id;
    const state = c.req.query("state"),
      code = c.req.query("code");
    if (!state || !code || state.length > 128 || code.length > 4096)
      throw new ApiFailure("OAUTH_STATE_INVALID", "Invalid authorization response");
    const identifier = `workspace:${userId}:${await hashRequest("STATE", "", state)}`;
    const [proof] = await db
      .delete(schema.verification)
      .where(and(eq(schema.verification.identifier, identifier), gt(schema.verification.expiresAt, new Date())))
      .returning();
    if (!proof) throw new ApiFailure("OAUTH_STATE_INVALID", "Authorization expired or already used", 403);
    const claims = z
      .object({ verifier: z.string(), calendar: z.boolean(), drive: z.boolean() })
      .parse(JSON.parse(await decryptToken(proof.value, keys.key, userId)));
    const token = await exchangeGoogleCode({
      clientId: keys.clientId,
      clientSecret: keys.clientSecret,
      code,
      verifier: claims.verifier,
      redirectUri: `${new URL(config.APP_URL).origin}/api/v1/integrations/google/callback`,
    });
    const identity = await googleIdentity(token.access_token);
    if (!identity.email_verified) throw new ApiFailure("GOOGLE_IDENTITY_INVALID", "Google email must be verified", 403);
    const [old] = await db
      .select()
      .from(schema.googleWorkspaceConnections)
      .where(eq(schema.googleWorkspaceConnections.userId, userId))
      .limit(1);
    if (old && old.googleSubject !== identity.sub && old.status !== "disconnected")
      throw new ApiFailure("GOOGLE_ACCOUNT_CONFLICT", "Disconnect the current Workspace account first", 409);
    const refresh =
      token.refresh_token ??
      (old && old.googleSubject === identity.sub
        ? await decryptStored(old.encryptedRefreshToken, config, userId)
        : null);
    if (!refresh) throw new ApiFailure("GOOGLE_OFFLINE_ACCESS_REQUIRED", "Reconnect and grant offline access", 409);
    const scopes = token.scope?.split(" ") ?? [];
    const values = {
      googleSubject: identity.sub,
      email: identity.email,
      avatarUrl: identity.picture ?? null,
      encryptedRefreshToken: await encryptToken(refresh, keys.key, userId),
      encryptedAccessToken: await encryptToken(token.access_token, keys.key, userId),
      accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      scopes,
      calendarEnabled: claims.calendar && scopes.includes("https://www.googleapis.com/auth/calendar.events"),
      driveEnabled: claims.drive && scopes.includes("https://www.googleapis.com/auth/drive.file"),
      status: "connected",
      deletedAt: null,
      errorCode: null,
      updatedAt: new Date(),
    };
    await db
      .insert(schema.googleWorkspaceConnections)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: schema.googleWorkspaceConnections.userId, set: values });
    await db
      .insert(schema.auditLogs)
      .values({ actorUserId: userId, action: "google.connected", requestId: c.get("requestId") });
    return c.redirect(`${new URL(config.APP_URL).origin}/settings/integrations`);
  });
  app.delete("/api/v1/integrations/google", async (c) => {
    const userId = c.get("identity").id;
    const [connection] = await db
      .select()
      .from(schema.googleWorkspaceConnections)
      .where(eq(schema.googleWorkspaceConnections.userId, userId))
      .limit(1);
    if (connection && connection.status !== "disconnected") {
      try {
        await revokeGoogleToken(await decryptStored(connection.encryptedRefreshToken, config, userId));
      } catch (error) {
        if (!(error instanceof ProviderError && [400, 401, 403].includes(error.status)))
          throw new ApiFailure("GOOGLE_REVOCATION_FAILED", "Google could not be revoked; retry", 502);
      }
      await db.transaction(async (tx) => {
        await tx
          .update(schema.googleWorkspaceConnections)
          .set({
            status: "disconnected",
            encryptedRefreshToken: "",
            encryptedAccessToken: null,
            scopes: [],
            calendarEnabled: false,
            driveEnabled: false,
            updatedAt: new Date(),
          })
          .where(eq(schema.googleWorkspaceConnections.userId, userId));
        await tx.delete(schema.googleWatchChannels).where(eq(schema.googleWatchChannels.userId, userId));
        await tx.delete(schema.calendarEventMappings).where(eq(schema.calendarEventMappings.userId, userId));
        await tx.delete(schema.calendarSyncState).where(eq(schema.calendarSyncState.userId, userId));
        await tx.delete(schema.googleCalendars).where(eq(schema.googleCalendars.userId, userId));
        await tx
          .insert(schema.auditLogs)
          .values({ actorUserId: userId, action: "google.disconnected", requestId: c.get("requestId") });
      });
    }
    return c.json({ data: { disconnected: true } });
  });
  app.get("/api/v1/integrations/google/calendars", async (c) => {
    const userId = c.get("identity").id,
      client = new GoogleCalendarClient(await workspaceAccessToken(db, config, userId));
    const [connection] = await db
      .select()
      .from(schema.googleWorkspaceConnections)
      .where(eq(schema.googleWorkspaceConnections.userId, userId))
      .limit(1);
    if (!connection?.calendarEnabled)
      throw new ApiFailure("GOOGLE_CALENDAR_PERMISSION_REQUIRED", "Enable Calendar permission", 403);
    const remote = await client.calendars();
    for (const calendar of remote)
      await db
        .insert(schema.googleCalendars)
        .values({
          userId,
          connectionId: connection.id,
          externalCalendarId: calendar.id,
          name: calendar.summary,
          timezone: "Europe/Kyiv",
          accessRole: calendar.accessRole,
        })
        .onConflictDoUpdate({
          target: [schema.googleCalendars.userId, schema.googleCalendars.externalCalendarId],
          set: { name: calendar.summary, accessRole: calendar.accessRole, deletedAt: null, updatedAt: new Date() },
        });
    return c.json({
      data: await db
        .select()
        .from(schema.googleCalendars)
        .where(and(eq(schema.googleCalendars.userId, userId), isNull(schema.googleCalendars.deletedAt))),
    });
  });
  app.patch("/api/v1/integrations/google/calendars/:id", async (c) => {
    const id = parseCursor(c.req.param("id"))!;
    const parsed = calendarSelectionSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Invalid calendar selection");
    const [row] = await db
      .update(schema.googleCalendars)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(
        and(
          eq(schema.googleCalendars.id, id),
          eq(schema.googleCalendars.userId, c.get("identity").id),
          isNull(schema.googleCalendars.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new ApiFailure("NOT_FOUND", "Calendar not found", 404);
    return c.json({ data: row });
  });
  app.post("/api/v1/integrations/google/sync", async (c) => {
    const userId = c.get("identity").id;
    await rateLimitRequest(db, userId, "google_sync", 3);
    const calendars = await db
      .select()
      .from(schema.googleCalendars)
      .where(
        and(
          eq(schema.googleCalendars.userId, userId),
          eq(schema.googleCalendars.selected, true),
          isNull(schema.googleCalendars.deletedAt),
        ),
      );
    if (!calendars.length) throw new ApiFailure("GOOGLE_CALENDAR_REQUIRED", "Select a calendar first", 409);
    for (const calendar of calendars) await synchronizeCalendar(db, config, userId, calendar.id);
    return c.json({ data: { synced: true } });
  });
  app.get("/api/v1/integrations/google/conflicts", async (c) =>
    c.json({
      data: await db
        .select({
          id: schema.calendarEventMappings.id,
          eventId: schema.calendarEventMappings.eventId,
          calendarId: schema.calendarEventMappings.calendarId,
          googleUpdatedAt: schema.calendarEventMappings.googleUpdatedAt,
        })
        .from(schema.calendarEventMappings)
        .where(
          and(
            eq(schema.calendarEventMappings.userId, c.get("identity").id),
            eq(schema.calendarEventMappings.conflict, true),
          ),
        ),
    }),
  );
  app.post("/api/v1/integrations/google/conflicts/:id/resolve", async (c) => {
    const parsed = calendarConflictSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ApiFailure("VALIDATION_ERROR", "Choose a conflict resolution");
    const userId = c.get("identity").id,
      id = parseCursor(c.req.param("id"))!;
    const [mapping] = await db
      .select()
      .from(schema.calendarEventMappings)
      .where(
        and(
          eq(schema.calendarEventMappings.id, id),
          eq(schema.calendarEventMappings.userId, userId),
          eq(schema.calendarEventMappings.conflict, true),
        ),
      )
      .limit(1);
    if (!mapping) throw new ApiFailure("NOT_FOUND", "Conflict not found", 404);
    await db
      .update(schema.calendarEventMappings)
      .set({
        conflict: false,
        lastSyncedAt: parsed.data.choice === "google" ? null : new Date(),
        localSyncedAt: parsed.data.choice === "local" ? new Date(0) : new Date(),
      })
      .where(eq(schema.calendarEventMappings.id, id));
    await db
      .update(schema.calendarSyncState)
      .set({ syncToken: null })
      .where(
        and(eq(schema.calendarSyncState.userId, userId), eq(schema.calendarSyncState.calendarId, mapping.calendarId)),
      );
    await synchronizeCalendar(db, config, userId, mapping.calendarId);
    return c.json({ data: { resolved: true } });
  });
  app.get("/api/v1/integrations/google/drive/metadata", async (c) => {
    const value = c.req.query("file");
    if (!value || value.length > 1000) throw new ApiFailure("VALIDATION_ERROR", "Google file ID is required");
    const userId = c.get("identity").id;
    const [connection] = await db
      .select()
      .from(schema.googleWorkspaceConnections)
      .where(eq(schema.googleWorkspaceConnections.userId, userId))
      .limit(1);
    if (!connection?.driveEnabled)
      throw new ApiFailure("GOOGLE_DRIVE_PERMISSION_REQUIRED", "Enable Drive permission", 403);
    return c.json({
      data: await googleDriveMetadata(await workspaceAccessToken(db, config, userId), parseGoogleFile(value)),
    });
  });
}

function remoteValues(event: GoogleEvent) {
  const allDay = !!event.start?.date;
  const metadata = event as GoogleEvent & { location?: string; recurrence?: string[] };
  return {
    location: metadata.location ?? null,
    recurrenceRule: metadata.recurrence?.find((rule) => rule.startsWith("RRULE:")) ?? null,
    title: event.summary ?? "Untitled event",
    description: event.description ?? null,
    allDay,
    startDate: allDay ? (event.start?.date ?? null) : null,
    endDate: allDay ? (event.end?.date ?? null) : null,
    startsAt: !allDay && event.start?.dateTime ? new Date(event.start.dateTime) : null,
    endsAt: !allDay && event.end?.dateTime ? new Date(event.end.dateTime) : null,
    timezone: event.start?.timeZone ?? "Europe/Kyiv",
    deletedAt: event.status === "cancelled" ? new Date() : null,
  };
}
function localValues(event: typeof schema.calendarEvents.$inferSelect) {
  return {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    recurrence: event.recurrenceRule
      ? [event.recurrenceRule.startsWith("RRULE:") ? event.recurrenceRule : `RRULE:${event.recurrenceRule}`]
      : [],
    start: event.allDay
      ? { date: event.startDate }
      : { dateTime: event.startsAt?.toISOString(), timeZone: event.timezone },
    end: event.allDay ? { date: event.endDate } : { dateTime: event.endsAt?.toISOString(), timeZone: event.timezone },
    extendedProperties: { private: { lifeSyncId: event.id } },
  };
}
export async function synchronizeCalendar(db: Database, config: AppConfig, userId: string, calendarId: string) {
  const [calendar] = await db
    .select()
    .from(schema.googleCalendars)
    .where(
      and(
        eq(schema.googleCalendars.id, calendarId),
        eq(schema.googleCalendars.userId, userId),
        eq(schema.googleCalendars.selected, true),
        isNull(schema.googleCalendars.deletedAt),
      ),
    )
    .limit(1);
  if (!calendar) throw new ApiFailure("NOT_FOUND", "Selected calendar not found", 404);
  const acquired = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`sync:${calendarId}`},0))`);
    const [existing] = await tx
      .select()
      .from(schema.calendarSyncState)
      .where(and(eq(schema.calendarSyncState.userId, userId), eq(schema.calendarSyncState.calendarId, calendarId)))
      .limit(1);
    if (existing?.lockExpiresAt && existing.lockExpiresAt > new Date()) return null;
    const [state] = await tx
      .insert(schema.calendarSyncState)
      .values({ userId, calendarId, lockExpiresAt: new Date(Date.now() + 300000) })
      .onConflictDoUpdate({
        target: [schema.calendarSyncState.userId, schema.calendarSyncState.calendarId],
        set: { lockExpiresAt: new Date(Date.now() + 300000) },
      })
      .returning();
    return state;
  });
  if (!acquired) return;
  try {
    const client = new GoogleCalendarClient(await workspaceAccessToken(db, config, userId));
    const remote = await client.listEvents(calendar.externalCalendarId, acquired.syncToken ?? undefined);
    for (const incoming of remote.events) {
      await db.transaction(async (tx) => {
        const [mapping] = await tx
          .select()
          .from(schema.calendarEventMappings)
          .where(
            and(
              eq(schema.calendarEventMappings.userId, userId),
              eq(schema.calendarEventMappings.calendarId, calendarId),
              eq(schema.calendarEventMappings.externalEventId, incoming.id),
            ),
          )
          .limit(1);
        if (mapping) {
          const [local] = await tx
            .select()
            .from(schema.calendarEvents)
            .where(and(eq(schema.calendarEvents.id, mapping.eventId), eq(schema.calendarEvents.userId, userId)))
            .limit(1);
          if (!local) return;
          if (mapping.conflict) return;
          const decision = syncDecision({
            localUpdatedAt: local.updatedAt.toISOString(),
            remoteUpdatedAt: incoming.updated ?? new Date(0).toISOString(),
            lastSyncedAt: mapping.lastSyncedAt?.toISOString(),
          });
          if (decision === "conflict") {
            await tx
              .update(schema.calendarEventMappings)
              .set({
                conflict: true,
                etag: incoming.etag,
                googleUpdatedAt: incoming.updated ? new Date(incoming.updated) : null,
              })
              .where(eq(schema.calendarEventMappings.id, mapping.id));
            await tx
              .insert(schema.notifications)
              .values({
                userId,
                title: "Calendar sync conflict",
                body: "Choose which version to keep",
                kind: "sync_conflict",
                targetType: "calendarEvent",
                targetId: local.id,
                deliveryKey: `conflict:${mapping.id}:${incoming.etag}`,
              })
              .onConflictDoNothing();
          } else if (decision === "pull") {
            const syncedAt = new Date();
            if (incoming.status === "cancelled")
              await tx
                .update(schema.calendarEvents)
                .set({ deletedAt: syncedAt, updatedAt: syncedAt })
                .where(eq(schema.calendarEvents.id, local.id));
            else
              await tx
                .update(schema.calendarEvents)
                .set({ ...remoteValues(incoming), updatedAt: syncedAt })
                .where(eq(schema.calendarEvents.id, local.id));
            await tx
              .update(schema.calendarEventMappings)
              .set({
                etag: incoming.etag,
                googleUpdatedAt: incoming.updated ? new Date(incoming.updated) : null,
                lastSyncedAt: syncedAt,
                localSyncedAt: syncedAt,
                googleDeleted: incoming.status === "cancelled",
              })
              .where(eq(schema.calendarEventMappings.id, mapping.id));
          }
        } else if (incoming.status !== "cancelled" && incoming.start && incoming.end) {
          const syncedAt = new Date();
          const deterministic = incoming.extendedProperties?.private?.lifeSyncId;
          const [existing] =
            deterministic && z.uuid().safeParse(deterministic).success
              ? await tx
                  .select()
                  .from(schema.calendarEvents)
                  .where(and(eq(schema.calendarEvents.userId, userId), eq(schema.calendarEvents.id, deterministic)))
                  .limit(1)
              : [];
          const local =
            existing ??
            (
              await tx
                .insert(schema.calendarEvents)
                .values({ userId, ...remoteValues(incoming), updatedAt: syncedAt })
                .returning()
            )[0];
          if (local)
            await tx
              .insert(schema.calendarEventMappings)
              .values({
                userId,
                eventId: local.id,
                calendarId,
                externalEventId: incoming.id,
                etag: incoming.etag,
                lastSyncedAt: syncedAt,
                localSyncedAt: syncedAt,
                googleUpdatedAt: incoming.updated ? new Date(incoming.updated) : null,
              })
              .onConflictDoNothing();
        }
      });
    }
    const mappings = await db
      .select()
      .from(schema.calendarEventMappings)
      .where(
        and(eq(schema.calendarEventMappings.userId, userId), eq(schema.calendarEventMappings.calendarId, calendarId)),
      );
    const allMappings = await db
      .select()
      .from(schema.calendarEventMappings)
      .where(eq(schema.calendarEventMappings.userId, userId));
    const [defaultCalendar] = await db
      .select({ id: schema.googleCalendars.id })
      .from(schema.googleCalendars)
      .where(
        and(
          eq(schema.googleCalendars.userId, userId),
          eq(schema.googleCalendars.selected, true),
          isNull(schema.googleCalendars.deletedAt),
          sql`${schema.googleCalendars.accessRole} in ('writer','owner')`,
        ),
      )
      .orderBy(asc(schema.googleCalendars.createdAt), asc(schema.googleCalendars.id))
      .limit(1);
    const locals = await db.select().from(schema.calendarEvents).where(eq(schema.calendarEvents.userId, userId));
    for (const local of locals) {
      if (!["owner", "writer"].includes(calendar.accessRole)) break;
      const mapping = mappings.find((m) => m.eventId === local.id);
      if (!mapping && (allMappings.some((m) => m.eventId === local.id) || defaultCalendar?.id !== calendarId)) continue;
      if (mapping?.conflict) continue;
      if (mapping && mapping.localSyncedAt && local.updatedAt <= mapping.localSyncedAt) continue;
      if (local.deletedAt) {
        if (mapping && !mapping.googleDeleted) {
          await client.deleteEvent(calendar.externalCalendarId, mapping.externalEventId, mapping.etag ?? undefined);
          await db
            .update(schema.calendarEventMappings)
            .set({ googleDeleted: true, lastSyncedAt: new Date(), localSyncedAt: new Date() })
            .where(eq(schema.calendarEventMappings.id, mapping.id));
        }
        continue;
      }
      try {
        if (mapping?.googleDeleted) {
          const replacement = crypto.randomUUID().replaceAll("-", "");
          await db
            .update(schema.calendarEventMappings)
            .set({ externalEventId: replacement, etag: null, googleDeleted: false, localSyncedAt: new Date(0) })
            .where(
              and(
                eq(schema.calendarEventMappings.id, mapping.id),
                eq(schema.calendarEventMappings.googleDeleted, true),
              ),
            );
          mapping.externalEventId = replacement;
          mapping.etag = null;
          const restored = await client.putEvent(calendar.externalCalendarId, replacement, localValues(local));
          const syncedAt = new Date();
          await db
            .update(schema.calendarEventMappings)
            .set({
              externalEventId: restored.id,
              etag: restored.etag,
              lastSyncedAt: syncedAt,
              localSyncedAt: syncedAt,
              googleUpdatedAt: restored.updated ? new Date(restored.updated) : null,
            })
            .where(eq(schema.calendarEventMappings.id, mapping.id));
          continue;
        }
        const outgoing = mapping?.etag
          ? await client.updateEvent(
              calendar.externalCalendarId,
              mapping.externalEventId,
              localValues(local),
              mapping.etag ?? "*",
            )
          : await client.putEvent(
              calendar.externalCalendarId,
              mapping?.externalEventId ?? local.id,
              localValues(local),
            );
        const syncedAt = new Date();
        await db
          .insert(schema.calendarEventMappings)
          .values({
            userId,
            eventId: local.id,
            calendarId,
            externalEventId: outgoing.id,
            etag: outgoing.etag,
            lastSyncedAt: syncedAt,
            localSyncedAt: syncedAt,
            googleUpdatedAt: outgoing.updated ? new Date(outgoing.updated) : null,
          })
          .onConflictDoUpdate({
            target: [
              schema.calendarEventMappings.userId,
              schema.calendarEventMappings.eventId,
              schema.calendarEventMappings.calendarId,
            ],
            set: {
              externalEventId: outgoing.id,
              etag: outgoing.etag,
              lastSyncedAt: syncedAt,
              localSyncedAt: syncedAt,
              googleDeleted: false,
            },
          });
      } catch (error) {
        if (error instanceof ProviderError && error.status === 412 && mapping) {
          await db
            .update(schema.calendarEventMappings)
            .set({ conflict: true })
            .where(eq(schema.calendarEventMappings.id, mapping.id));
          continue;
        }
        throw error;
      }
    }
    await db
      .update(schema.calendarSyncState)
      .set({
        syncToken: remote.syncToken,
        lastSuccessfulAt: new Date(),
        lastReconciledAt: new Date(),
        errorCode: null,
        lockExpiresAt: null,
      })
      .where(eq(schema.calendarSyncState.id, acquired.id));
    await db
      .update(schema.googleWorkspaceConnections)
      .set({ lastSyncedAt: new Date(), errorCode: null })
      .where(eq(schema.googleWorkspaceConnections.userId, userId));
  } catch (error) {
    await db
      .update(schema.calendarSyncState)
      .set({ errorCode: "SYNC_FAILED", lockExpiresAt: null, lastReconciledAt: new Date() })
      .where(eq(schema.calendarSyncState.id, acquired.id));
    throw error;
  }
}

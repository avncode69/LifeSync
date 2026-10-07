import { effectiveEntitlement } from "@lifesync/config";
import { type ResourceName, resourceRegistry } from "@lifesync/contracts";
import type { Database } from "@lifesync/db";
import * as schema from "@lifesync/db";
import { nextOccurrences } from "@lifesync/domain";
import { validatePushEndpoint } from "@lifesync/integrations";
import { and, asc, eq, getTableColumns, gt, ilike, isNotNull, isNull, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";
import { ApiFailure, parseCursor } from "./security";

export type Executor = Pick<Database, "select" | "insert" | "update" | "delete" | "execute">;
function decimalUnits(value: unknown): bigint {
  const [integer, fraction = ""] = String(value).split(".");
  return BigInt(`${integer}${fraction.padEnd(4, "0")}`);
}
type ResourceTable = AnyPgTable & {
  id: AnyPgColumn;
  userId: AnyPgColumn;
  createdAt: AnyPgColumn;
  updatedAt: AnyPgColumn;
  deletedAt: AnyPgColumn;
};
export function tableFor(name: ResourceName): ResourceTable {
  return schema[name as keyof typeof schema] as unknown as ResourceTable;
}
export function ownerScope(table: ResourceTable, userId: string, id?: string, trash = false): SQL {
  return and(
    eq(table.userId, userId),
    id ? eq(table.id, id) : undefined,
    trash ? isNotNull(table.deletedAt) : isNull(table.deletedAt),
  )!;
}
export async function ownedRow(db: Executor, name: ResourceName, userId: string, id: string, trash = false) {
  const table = tableFor(name);
  const [row] = await db
    .select()
    .from(table)
    .where(ownerScope(table, userId, id, trash))
    .limit(1);
  if (!row) throw new ApiFailure("NOT_FOUND", "Resource not found", 404);
  if (name === "aiConversations" && !trash && row.expiresAt instanceof Date && row.expiresAt <= new Date())
    throw new ApiFailure("CHAT_EXPIRED", "This conversation expired", 410);
  return row as Record<string, unknown>;
}
export async function listRows(
  db: Executor,
  name: ResourceName,
  userId: string,
  query: Record<string, string | undefined>,
  trash = false,
) {
  const table = tableFor(name);
  const cols = getTableColumns(table);
  const limit = query.limit ? Number(query.limit) : 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiFailure("INVALID_LIMIT", "Invalid page size");
  const cursor = parseCursor(query.cursor);
  const conditions: (SQL | undefined)[] = [
    ownerScope(table, userId, undefined, trash),
    cursor ? gt(table.id, cursor) : undefined,
  ];
  if (query.search) {
    if (query.search.length > 200) throw new ApiFailure("INVALID_SEARCH", "Search is too long");
    const field = cols.title ?? cols.name ?? cols.note ?? cols.merchant ?? cols.content;
    if (!field) conditions.push(sql`false`);
    if (field) conditions.push(ilike(field, `%${query.search.replace(/[\\%_]/g, "\\$&")}%`));
  }
  if (name === "aiConversations" && !trash) conditions.push(gt(schema.aiConversations.expiresAt, new Date()));
  if (query.status && cols.status) conditions.push(eq(cols.status, query.status));
  const dateColumn = cols.transactionDate ?? cols.date ?? cols.startsAt ?? cols.createdAt;
  if (query.from || query.to) {
    for (const value of [query.from, query.to])
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiFailure("INVALID_DATE", "Invalid date range");
    if (query.from) conditions.push(sql`${dateColumn} >= ${query.from}::date`);
    if (query.to) conditions.push(sql`${dateColumn} < ${query.to}::date + interval '1 day'`);
  }
  for (const [key, value] of Object.entries(query)) {
    if (value && key.endsWith("Id") && cols[key]) conditions.push(eq(cols[key], parseCursor(value)));
  }
  const rows = await db
    .select()
    .from(table)
    .where(and(...conditions))
    .orderBy(asc(table.id))
    .limit(limit + 1);
  const more = rows.length > limit;
  const data = rows.slice(0, limit);
  return { data, ...(more ? { nextCursor: String(data.at(-1)?.id) } : {}) };
}
export async function validateRelations(
  db: Executor,
  name: ResourceName,
  userId: string,
  values: Record<string, unknown>,
  currentId?: string,
) {
  if (name === "pushSubscriptions")
    try {
      validatePushEndpoint(String(values.endpoint));
    } catch {
      throw new ApiFailure("INVALID_PUSH_ENDPOINT", "Unsupported push service");
    }
  if (values.recurrenceRule) {
    const anchor = values.startDate ?? values.dueDate ?? values.startsAt ?? values.dueAt;
    if (!anchor) throw new ApiFailure("RECURRENCE_ANCHOR_REQUIRED", "Recurring entries need a start date");
    const start = String(anchor).slice(0, 10) + "T00:00:00";
    try {
      nextOccurrences({
        rule: String(values.recurrenceRule),
        start,
        timezone: String(values.timezone ?? "Europe/Kyiv"),
        after: new Date().toISOString(),
        limit: 1,
      });
    } catch {
      throw new ApiFailure("INVALID_RECURRENCE", "Invalid recurrence rule");
    }
  }
  const config = resourceRegistry[name];
  const relations: Record<string, string> = { ...config.relations };
  if (name === "driveLinks" || name === "reminderRules")
    Object.assign(relations, {
      projectId: "projects",
      taskId: "tasks",
      eventId: "calendarEvents",
      transactionId: "financeTransactions",
      inboxItemId: "inboxItems",
      habitId: "habits",
    });
  for (const [field, parent] of Object.entries(relations)) {
    const id = values[field];
    if (typeof id === "string") {
      if (field === "parentTaskId" && id === currentId)
        throw new ApiFailure("INVALID_PARENT", "Task cannot be its own parent");
      await ownedRow(db, parent as ResourceName, userId, id);
      if (field === "parentTaskId" && currentId) {
        let ancestor: string | null = id;
        const visited = new Set<string>();
        for (let depth = 0; ancestor; depth++) {
          if (ancestor === currentId || visited.has(ancestor) || depth >= 100)
            throw new ApiFailure("INVALID_PARENT", "Task hierarchy contains a cycle or is too deep");
          visited.add(ancestor);
          const row = await ownedRow(db, "tasks", userId, ancestor);
          ancestor = typeof row.parentTaskId === "string" ? row.parentTaskId : null;
        }
      }
    }
  }
  if (name === "financeTransactions" || name === "recurringTransactions") {
    const account = await ownedRow(db, "financialAccounts", userId, String(values.accountId));
    if (account.currency !== values.currency)
      throw new ApiFailure("CURRENCY_MISMATCH", "Transaction currency must match its account");
    if (values.categoryId) {
      const category = await ownedRow(db, "financeCategories", userId, String(values.categoryId));
      if (values.type !== "transfer" && category.type !== values.type)
        throw new ApiFailure("CATEGORY_MISMATCH", "Category type does not match transaction");
    }
    if (values.destinationAccountId) {
      const destination = await ownedRow(db, "financialAccounts", userId, String(values.destinationAccountId));
      if (
        destination.currency === account.currency &&
        decimalUnits(values.destinationAmount) !== decimalUnits(values.amount)
      )
        throw new ApiFailure("UNBALANCED_TRANSFER", "Same currency transfers must have equal amounts");
    }
    if (values.exchangeRateId) {
      const [rate] = await db
        .select()
        .from(schema.exchangeRates)
        .where(eq(schema.exchangeRates.id, String(values.exchangeRateId)))
        .limit(1);
      if (!rate || rate.currency !== values.currency || rate.date > String(values.transactionDate))
        throw new ApiFailure("INVALID_RATE_REFERENCE", "Exchange rate does not match transaction date and currency");
    }
  }
  if (currentId && (name === "financialAccounts" || name === "savingsGoals")) {
    const current = await ownedRow(db, name, userId, currentId);
    if (current.currency !== values.currency) {
      const table = name === "financialAccounts" ? schema.financeTransactions : schema.savingsContributions;
      const relation =
        name === "financialAccounts"
          ? sql`(${schema.financeTransactions.accountId}=${currentId} or ${schema.financeTransactions.destinationAccountId}=${currentId})`
          : eq(schema.savingsContributions.goalId, currentId);
      const [history] = await db
        .select({ id: table.id })
        .from(table)
        .where(and(eq(table.userId, userId), relation))
        .limit(1);
      const [recurring] =
        name === "financialAccounts"
          ? await db
              .select({ id: schema.recurringTransactions.id })
              .from(schema.recurringTransactions)
              .where(
                and(
                  eq(schema.recurringTransactions.userId, userId),
                  eq(schema.recurringTransactions.accountId, currentId),
                ),
              )
              .limit(1)
          : [];
      if (history || recurring)
        throw new ApiFailure("CURRENCY_HAS_HISTORY", "Currency cannot be changed while financial history exists", 409);
    }
  }
  if (name === "savingsContributions") {
    const goal = await ownedRow(db, "savingsGoals", userId, String(values.goalId));
    if (goal.currency !== values.currency)
      throw new ApiFailure("CURRENCY_MISMATCH", "Contribution currency must match savings goal");
  }
}
export function databaseValues(name: ResourceName, values: Record<string, unknown>): Record<string, unknown> {
  const columns = getTableColumns(tableFor(name));
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      value !== null && typeof value === "string" && columns[key]?.dataType === "date" ? new Date(value) : value,
    ]),
  );
}
export async function enforceInboxLimit(db: Executor, userId: string) {
  await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
  const [entitlement] = await db
    .select()
    .from(schema.userEntitlements)
    .where(eq(schema.userEntitlements.userId, userId))
    .limit(1);
  const [total] = await db
    .select({ count: sql<number>`count(*)::integer` })
    .from(schema.inboxBoxes)
    .where(ownerScope(tableFor("inboxBoxes"), userId));
  const cap = effectiveEntitlement(entitlement, 100).inboxLimit;
  if ((total?.count ?? 0) >= cap)
    throw new ApiFailure("INBOX_LIMIT", "Your plan's inbox box limit has been reached", 409);
}

export async function rateLimitRequest(db: Database, userId: string, bucket: string, limit: number) {
  const now = Date.now(),
    windowStart = Math.floor(now / 60000) * 60000;
  const key = `api:${userId}:${bucket}`;
  const [row] = await db
    .insert(schema.rateLimit)
    .values({ id: crypto.randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: schema.rateLimit.key,
      set: {
        count: sql`case when ${schema.rateLimit.lastRequest}<${windowStart} then 1 else ${schema.rateLimit.count}+1 end`,
        lastRequest: now,
      },
    })
    .returning({ count: schema.rateLimit.count });
  if (row && row.count > limit) throw new ApiFailure("RATE_LIMITED", "Too many requests", 429);
}
export async function hashRequest(method: string, path: string, value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify({ method, path, value })),
  );
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

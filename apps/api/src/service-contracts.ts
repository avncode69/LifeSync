import { resourceRegistry, updateAiPermissionsSchema, updatePreferencesSchema } from "@lifesync/contracts";
import { z } from "zod";
export const calendarRangeSchema = z
  .strictObject({ from: z.iso.date(), to: z.iso.date() })
  .refine((value) => value.from <= value.to && Date.parse(value.to) - Date.parse(value.from) <= 366 * 86400000);
export const inboxConversionSchema = z.discriminatedUnion("resource", [
  z.strictObject({ resource: z.literal("tasks"), input: resourceRegistry.tasks.createSchema }),
  z.strictObject({ resource: z.literal("projects"), input: resourceRegistry.projects.createSchema }),
  z.strictObject({ resource: z.literal("calendarEvents"), input: resourceRegistry.calendarEvents.createSchema }),
  z.strictObject({ resource: z.literal("habits"), input: resourceRegistry.habits.createSchema }),
  z.strictObject({
    resource: z.literal("financeTransactions"),
    input: resourceRegistry.financeTransactions.createSchema,
  }),
]);
export const templateStartSchema = z.strictObject({ startsAt: z.iso.datetime() });
export const capturePreviewSchema = z.strictObject({ text: z.string().trim().min(1).max(2000) });
export const accountDeleteSchema = z.strictObject({
  confirmation: z.literal("DELETE"),
  password: z.string().min(1).max(128).optional(),
});
export const adminUserSchema = z
  .strictObject({ plan: z.enum(["FREE", "PRO"]).optional(), disabled: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0);
export const adminFlagSchema = z.strictObject({
  enabled: z.boolean(),
  description: z.string().trim().min(1).max(500).optional(),
});
export const aiChatSchema = z.strictObject({ conversationId: z.uuid(), message: z.string().trim().min(1).max(12000) });
export const aiConfirmationSchema = z.strictObject({ confirmationToken: z.uuid() });
export const workspaceConnectSchema = z
  .strictObject({ calendar: z.boolean(), drive: z.boolean() })
  .refine((value) => value.calendar || value.drive);
export const calendarSelectionSchema = z.strictObject({ selected: z.boolean() });
export const calendarConflictSchema = z.strictObject({ choice: z.enum(["local", "google"]) });
export const serviceBodies: Record<string, z.ZodType> = {
  "POST /api/v1/inbox/items/{id}/convert": inboxConversionSchema,
  "POST /api/v1/health/templates/{id}/start": templateStartSchema,
  "POST /api/v1/capture/preview": capturePreviewSchema,
  "DELETE /api/v1/account": accountDeleteSchema,
  "DELETE /api/v1/push/subscriptions/current": z.strictObject({
    endpoint: resourceRegistry.pushSubscriptions.createSchema.shape.endpoint,
  }),
  "PATCH /api/v1/admin/users/{id}": adminUserSchema,
  "PATCH /api/v1/admin/flags/{key}": adminFlagSchema,
  "POST /api/v1/ai/chat": aiChatSchema,
  "POST /api/v1/ai/actions/{id}/confirm": aiConfirmationSchema,
  "POST /api/v1/integrations/google/connect": workspaceConnectSchema,
  "PATCH /api/v1/integrations/google/calendars/{id}": calendarSelectionSchema,
  "POST /api/v1/integrations/google/conflicts/{id}/resolve": calendarConflictSchema,
  "PATCH /api/v1/preferences": updatePreferencesSchema,
  "PATCH /api/v1/ai/permissions": updateAiPermissionsSchema,
  "POST /api/v1/consent": z.strictObject({ accepted: z.literal(true) }),
  "POST /api/v1/onboarding": z.strictObject({ completed: z.literal(true) }),
  "PATCH /api/v1/me": z
    .strictObject({ name: z.string().trim().min(1).max(100).optional(), image: z.url().nullable().optional() })
    .refine((value) => Object.keys(value).length > 0),
};
export const serviceQueries: Record<string, z.ZodObject> = {
  "/api/v1/calendar/occurrences": calendarRangeSchema,
  "/api/v1/finance/rates": z.strictObject({ date: z.iso.date().optional() }),
  "/api/v1/finance/report": z.strictObject({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  }),
  "/api/v1/finance/summary": z.strictObject({ month: z.iso.date().optional() }),
  "/api/v1/health/summary": z.strictObject({ date: z.iso.date().optional() }),
  "/api/v1/search": z.strictObject({ q: z.string().trim().min(1).max(200) }),
  "/api/v1/integrations/google/callback": z.strictObject({ state: z.string(), code: z.string() }),
  "/api/v1/integrations/google/drive/metadata": z.strictObject({ file: z.string().min(1).max(1000) }),
  "/api/v1/admin/users": z.strictObject({
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.uuid().optional(),
  }),
};

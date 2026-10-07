import { z } from "zod";

export const uuidSchema = z.uuid();
export const dateSchema = z.iso.date();
export const instantSchema = z.iso.datetime({ offset: true });
export const moneySchema = z.string().regex(/^-?\d{1,16}(\.\d{1,4})?$/);
export const positiveMoneySchema = moneySchema.refine((v) => !v.startsWith("-") && /[1-9]/.test(v));
export const currencySchema = z.string().regex(/^[A-Z]{3}$/);
export const timezoneSchema = z
  .string()
  .max(100)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  });
const title = z.string().trim().min(1).max(240);
const note = z.string().max(20000);
const ref = uuidSchema.nullable().optional();
const decimal = z.string().regex(/^\d{1,8}(\.\d{1,4})?$/);
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .optional();
const recurrence = {
  recurrenceRule: z.string().max(1000).nullable().optional(),
  timezone: timezoneSchema.default("Europe/Kyiv"),
};
const target = { projectId: ref, taskId: ref, eventId: ref, transactionId: ref, inboxItemId: ref, habitId: ref };
function oneTarget(v: Record<string, unknown>) {
  return Object.keys(target).filter((k) => v[k] != null).length === 1;
}
function update<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [
      key,
      ((field instanceof z.ZodDefault ? field.removeDefault() : field) as z.ZodType).optional(),
    ]),
  ) as unknown as { [K in keyof T]: z.ZodOptional<T[K]> };
  return z.strictObject(shape).refine((v) => Object.keys(v).length > 0, "Empty update");
}
export const projectCreateSchema = z.strictObject({
  name: title,
  description: note.optional(),
  icon: z.string().max(80).optional(),
  color,
  status: z.enum(["active", "paused", "completed"]).default("active"),
  startDate: dateSchema.nullable().optional(),
  targetDate: dateSchema.nullable().optional(),
  archived: z.boolean().default(false),
});
export const taskCreateSchema = z.strictObject({
  title,
  description: note.optional(),
  projectId: ref,
  parentTaskId: ref,
  status: z.enum(["inbox", "todo", "in_progress", "done", "cancelled"]).default("todo"),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]).default("none"),
  startsAt: instantSchema.nullable().optional(),
  dueAt: instantSchema.nullable().optional(),
  dueDate: dateSchema.nullable().optional(),
  completedAt: instantSchema.nullable().optional(),
  position: z.number().int().min(0).default(0),
  ...recurrence,
});
export const taskChecklistItemCreateSchema = z.strictObject({
  taskId: uuidSchema,
  title,
  completed: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
});
export const tagCreateSchema = z.strictObject({ name: title, color });
export const taskTagCreateSchema = z.strictObject({ taskId: uuidSchema, tagId: uuidSchema });
export const habitCreateSchema = z.strictObject({
  name: title,
  description: note.optional(),
  schedule: z.enum(["daily", "weekdays", "weekly_goal"]).default("daily"),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  weeklyGoal: z.number().int().min(1).max(7).default(7),
  targetCount: decimal.default("1"),
  unit: z.string().max(40).default("count"),
  startDate: dateSchema,
  endDate: dateSchema.nullable().optional(),
  archived: z.boolean().default(false),
  ...recurrence,
});
export const habitEntryCreateSchema = z.strictObject({
  habitId: uuidSchema,
  date: dateSchema,
  count: decimal.default("1"),
  note: note.optional(),
});
export const inboxBoxCreateSchema = z.strictObject({
  name: title,
  color,
  position: z.number().int().min(0).default(0),
});
export const inboxItemCreateSchema = z.strictObject({
  boxId: uuidSchema,
  title,
  content: note.default(""),
  source: z.string().max(1000).optional(),
  pinned: z.boolean().default(false),
  archived: z.boolean().default(false),
});
const calendarBase = z.strictObject({
  title,
  description: note.optional(),
  projectId: ref,
  allDay: z.boolean().default(false),
  startDate: dateSchema.nullable().optional(),
  endDate: dateSchema.nullable().optional(),
  startsAt: instantSchema.nullable().optional(),
  endsAt: instantSchema.nullable().optional(),
  location: z.string().max(1000).optional(),
  ...recurrence,
});
export const calendarEventCreateSchema = calendarBase.refine(
  (v) =>
    v.allDay
      ? !!v.startDate && !!v.endDate && !v.startsAt && !v.endsAt && v.endDate > v.startDate
      : !!v.startsAt && !!v.endsAt && !v.startDate && !v.endDate && Date.parse(v.endsAt) > Date.parse(v.startsAt),
  "Invalid event interval",
);
export const driveLinkCreateSchema = z
  .strictObject({
    googleFileId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/),
    name: title,
    mimeType: z.string().max(200),
    webViewUrl: z.url().refine((v) => {
      const u = new URL(v);
      return u.protocol === "https:" && ["drive.google.com", "docs.google.com"].includes(u.hostname);
    }),
    icon: z.string().max(80).optional(),
    modifiedAt: instantSchema.optional(),
    ...target,
  })
  .refine(oneTarget, "Exactly one target required");
export const financialAccountCreateSchema = z.strictObject({
  name: title,
  currency: currencySchema,
  type: z.enum(["cash", "bank", "savings", "other"]).default("bank"),
  openingBalance: moneySchema.default("0"),
  archived: z.boolean().default(false),
  color,
});
export const financeCategoryCreateSchema = z.strictObject({
  name: title,
  type: z.enum(["income", "expense"]),
  color,
  icon: z.string().max(80).optional(),
});
const transactionBase = z.strictObject({
  accountId: uuidSchema,
  categoryId: ref,
  type: z.enum(["income", "expense", "transfer"]),
  amount: positiveMoneySchema,
  currency: currencySchema,
  transactionDate: dateSchema,
  note: note.optional(),
  merchant: z.string().max(240).optional(),
  destinationAccountId: ref,
  destinationAmount: positiveMoneySchema.nullable().optional(),
  exchangeRateId: ref,
  recurringTransactionId: ref,
  occurrenceDate: dateSchema.nullable().optional(),
});
export const financeTransactionCreateSchema = transactionBase.refine(
  (v) =>
    v.type === "transfer"
      ? !!v.destinationAccountId && !!v.destinationAmount && v.destinationAccountId !== v.accountId
      : !v.destinationAccountId && !v.destinationAmount,
  "Invalid transfer",
);
export const budgetCreateSchema = z.strictObject({
  name: title,
  categoryId: ref,
  month: dateSchema.refine((v) => v.endsWith("-01"), "Month must start on day 1"),
  amount: positiveMoneySchema,
  currency: currencySchema,
  warningThreshold: z.number().int().min(1).max(100).default(80),
});
export const savingsGoalCreateSchema = z.strictObject({
  name: title,
  targetAmount: positiveMoneySchema,
  currency: currencySchema,
  targetDate: dateSchema.nullable().optional(),
  archived: z.boolean().default(false),
});
export const savingsContributionCreateSchema = z.strictObject({
  goalId: uuidSchema,
  amount: positiveMoneySchema,
  currency: currencySchema,
  date: dateSchema,
  transactionId: ref,
  note: note.optional(),
});
export const recurringTransactionCreateSchema = z.strictObject({
  name: title,
  accountId: uuidSchema,
  categoryId: ref,
  type: z.enum(["income", "expense"]),
  amount: positiveMoneySchema,
  currency: currencySchema,
  recurrenceRule: z.string().min(1).max(1000),
  timezone: timezoneSchema,
  startDate: dateSchema,
  endDate: dateSchema.nullable().optional(),
  nextDate: dateSchema,
  enabled: z.boolean().default(true),
  note: note.optional(),
});
export const healthProfileCreateSchema = z.strictObject({
  heightCm: decimal.nullable().optional(),
  currentWeightKg: decimal.nullable().optional(),
  goalWeightKg: decimal.nullable().optional(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional(),
  calorieTarget: z.number().int().min(0).max(20000).optional(),
  proteinTarget: decimal.optional(),
  fatTarget: decimal.optional(),
  carbohydrateTarget: decimal.optional(),
  waterTargetMl: z.number().int().min(0).max(20000).optional(),
});
export const bodyMeasurementCreateSchema = z.strictObject({
  date: dateSchema,
  weightKg: decimal.nullable().optional(),
  waistCm: decimal.nullable().optional(),
  chestCm: decimal.nullable().optional(),
  hipCm: decimal.nullable().optional(),
  note: note.optional(),
});
export const customFoodCreateSchema = z.strictObject({
  name: title,
  calories: decimal,
  protein: decimal,
  fat: decimal,
  carbohydrates: decimal,
  servingGrams: decimal.default("100"),
  favorite: z.boolean().default(false),
});
export const mealEntryCreateSchema = z.strictObject({
  date: dateSchema,
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  note: note.optional(),
});
export const mealEntryItemCreateSchema = z.strictObject({
  mealEntryId: uuidSchema,
  foodId: ref,
  name: title,
  quantityGrams: decimal,
  calories: decimal,
  protein: decimal,
  fat: decimal,
  carbohydrates: decimal,
});
export const waterEntryCreateSchema = z.strictObject({
  date: dateSchema,
  amountMl: z.number().int().min(1).max(10000),
  loggedAt: instantSchema.optional(),
});
export const exerciseCreateSchema = z.strictObject({
  name: title,
  description: note.optional(),
  muscleGroup: z.string().max(100).optional(),
  type: z.enum(["strength", "cardio", "mobility", "other"]).default("strength"),
});
export const workoutTemplateCreateSchema = z.strictObject({ name: title, description: note.optional() });
export const workoutTemplateExerciseCreateSchema = z.strictObject({
  templateId: uuidSchema,
  exerciseId: uuidSchema,
  position: z.number().int().min(0),
  sets: z.number().int().min(1).max(100).default(3),
  reps: z.number().int().min(0).max(10000).nullable().optional(),
  loadKg: decimal.nullable().optional(),
  durationSeconds: z.number().int().min(0).nullable().optional(),
});
export const workoutSessionCreateSchema = z.strictObject({
  name: title,
  templateId: ref,
  startsAt: instantSchema,
  endsAt: instantSchema.nullable().optional(),
  note: note.optional(),
  caloriesEstimate: z.number().int().min(0).nullable().optional(),
});
export const workoutSetCreateSchema = z.strictObject({
  sessionId: uuidSchema,
  exerciseId: uuidSchema,
  position: z.number().int().min(0),
  reps: z.number().int().min(0).max(10000).nullable().optional(),
  loadKg: decimal.nullable().optional(),
  durationSeconds: z.number().int().min(0).nullable().optional(),
  distanceMeters: decimal.nullable().optional(),
  completed: z.boolean().default(false),
});
export const aiConversationCreateSchema = z.strictObject({ title: title.default("New conversation") });
export const notificationCreateSchema = z.strictObject({ readAt: instantSchema.nullable().optional() });
export const reminderRuleCreateSchema = z
  .strictObject({
    ...target,
    triggerType: z.enum(["offset", "exact"]),
    offsetMinutes: z.number().int().min(0).max(525600).nullable().optional(),
    exactAt: instantSchema.nullable().optional(),
    channels: z
      .array(z.enum(["in_app", "push"]))
      .min(1)
      .max(2),
    enabled: z.boolean().default(true),
  })
  .refine(oneTarget, "Exactly one target required")
  .refine(
    (v) =>
      v.triggerType === "offset" ? v.offsetMinutes != null && !v.exactAt : !!v.exactAt && v.offsetMinutes == null,
    "Invalid trigger",
  );
export const pushSubscriptionCreateSchema = z.strictObject({
  endpoint: z.url().refine((v) => new URL(v).protocol === "https:"),
  p256dh: z.string().min(20).max(200),
  auth: z.string().min(10).max(100),
  deviceName: z.string().max(240).optional(),
});
export const moduleSchema = z.enum([
  "dashboard",
  "inbox",
  "calendar",
  "projects",
  "tasks",
  "habits",
  "finance",
  "health",
  "ai",
  "workspace",
]);
export const aiPermissionsSchema = z.strictObject({
  tasks: z.boolean().default(false),
  calendar: z.boolean().default(false),
  habits: z.boolean().default(false),
  finance: z.boolean().default(false),
  health: z.boolean().default(false),
  drive: z.boolean().default(false),
  inbox: z.boolean().default(false),
  projects: z.boolean().default(false),
});
export const dashboardLayoutSchema = z.strictObject({
  version: z.literal(1),
  widgets: z
    .array(
      z.strictObject({
        id: z.string().max(100),
        visible: z.boolean(),
        size: z.enum(["small", "medium", "large"]),
        position: z.number().int().min(0),
      }),
    )
    .max(30),
});
export const preferencesSchema = z.strictObject({
  timezone: timezoneSchema.default("Europe/Kyiv"),
  locale: z.enum(["uk", "en"]).default("uk"),
  baseCurrency: currencySchema.default("UAH"),
  weekStart: z.union([z.literal(0), z.literal(1)]).default(1),
  dateFormat: z.enum(["DD.MM.YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).default("DD.MM.YYYY"),
  timeFormat: z.enum(["12h", "24h"]).default("24h"),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  hiddenModules: z.array(moduleSchema).max(10).default([]),
  webPushEnabled: z.boolean().default(false),
  notificationOffsets: z.array(z.number().int().min(0).max(525600)).max(10).default([10]),
  onboardingCompleted: z.boolean().default(false),
  dashboardLayout: dashboardLayoutSchema.optional(),
});
export const updatePreferencesSchema = update(preferencesSchema);
export const updateAiPermissionsSchema = update(aiPermissionsSchema);
export type Preferences = z.infer<typeof preferencesSchema>;
export type ApiResponse<T> = { data: T; nextCursor?: string };
export type ApiError = { error: { code: string; message: string; requestId: string } };
export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string() }),
});
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().max(500).optional(),
  search: z.string().max(240).optional(),
  status: z.string().max(40).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
const resource = <C extends z.ZodType, U extends z.ZodType>(
  table: string,
  path: string,
  createSchema: C,
  updateSchema: U,
  relations: Record<string, string> = {},
) => ({ table, path, createSchema, updateSchema, relations });
export const projectUpdateSchema = update(projectCreateSchema);
export const taskUpdateSchema = update(taskCreateSchema);
export const resourceRegistry = {
  projects: resource("projects", "/projects", projectCreateSchema, projectUpdateSchema),
  tasks: resource("tasks", "/tasks", taskCreateSchema, taskUpdateSchema, {
    projectId: "projects",
    parentTaskId: "tasks",
  }),
  taskChecklistItems: resource(
    "taskChecklistItems",
    "/tasks/checklist-items",
    taskChecklistItemCreateSchema,
    update(taskChecklistItemCreateSchema),
    { taskId: "tasks" },
  ),
  tags: resource("tags", "/tags", tagCreateSchema, update(tagCreateSchema)),
  taskTags: resource("taskTags", "/tasks/tags", taskTagCreateSchema, update(taskTagCreateSchema), {
    taskId: "tasks",
    tagId: "tags",
  }),
  habits: resource("habits", "/habits", habitCreateSchema, update(habitCreateSchema)),
  habitEntries: resource("habitEntries", "/habits/entries", habitEntryCreateSchema, update(habitEntryCreateSchema), {
    habitId: "habits",
  }),
  inboxBoxes: resource("inboxBoxes", "/inbox/boxes", inboxBoxCreateSchema, update(inboxBoxCreateSchema)),
  inboxItems: resource("inboxItems", "/inbox/items", inboxItemCreateSchema, update(inboxItemCreateSchema), {
    boxId: "inboxBoxes",
  }),
  calendarEvents: resource("calendarEvents", "/calendar/events", calendarEventCreateSchema, update(calendarBase), {
    projectId: "projects",
  }),
  driveLinks: resource("driveLinks", "/drive-links", driveLinkCreateSchema, update(driveLinkCreateSchema), {
    projectId: "projects",
    taskId: "tasks",
    eventId: "calendarEvents",
    transactionId: "financeTransactions",
    inboxItemId: "inboxItems",
    habitId: "habits",
  }),
  financialAccounts: resource(
    "financialAccounts",
    "/finance/accounts",
    financialAccountCreateSchema,
    update(financialAccountCreateSchema),
  ),
  financeCategories: resource(
    "financeCategories",
    "/finance/categories",
    financeCategoryCreateSchema,
    update(financeCategoryCreateSchema),
  ),
  financeTransactions: resource(
    "financeTransactions",
    "/finance/transactions",
    financeTransactionCreateSchema,
    update(transactionBase),
    {
      accountId: "financialAccounts",
      categoryId: "financeCategories",
      destinationAccountId: "financialAccounts",
      recurringTransactionId: "recurringTransactions",
    },
  ),
  budgets: resource("budgets", "/finance/budgets", budgetCreateSchema, update(budgetCreateSchema), {
    categoryId: "financeCategories",
  }),
  savingsGoals: resource(
    "savingsGoals",
    "/finance/savings-goals",
    savingsGoalCreateSchema,
    update(savingsGoalCreateSchema),
  ),
  savingsContributions: resource(
    "savingsContributions",
    "/finance/contributions",
    savingsContributionCreateSchema,
    update(savingsContributionCreateSchema),
    { goalId: "savingsGoals", transactionId: "financeTransactions" },
  ),
  recurringTransactions: resource(
    "recurringTransactions",
    "/finance/recurring",
    recurringTransactionCreateSchema,
    update(recurringTransactionCreateSchema),
    { accountId: "financialAccounts", categoryId: "financeCategories" },
  ),
  healthProfiles: resource(
    "healthProfiles",
    "/health/profiles",
    healthProfileCreateSchema,
    update(healthProfileCreateSchema),
  ),
  bodyMeasurements: resource(
    "bodyMeasurements",
    "/health/measurements",
    bodyMeasurementCreateSchema,
    update(bodyMeasurementCreateSchema),
  ),
  customFoods: resource("customFoods", "/health/foods", customFoodCreateSchema, update(customFoodCreateSchema)),
  mealEntries: resource("mealEntries", "/health/meals", mealEntryCreateSchema, update(mealEntryCreateSchema)),
  mealEntryItems: resource(
    "mealEntryItems",
    "/health/meal-items",
    mealEntryItemCreateSchema,
    update(mealEntryItemCreateSchema),
    { mealEntryId: "mealEntries", foodId: "customFoods" },
  ),
  waterEntries: resource("waterEntries", "/health/water", waterEntryCreateSchema, update(waterEntryCreateSchema)),
  exercises: resource("exercises", "/health/exercises", exerciseCreateSchema, update(exerciseCreateSchema)),
  workoutTemplates: resource(
    "workoutTemplates",
    "/health/templates",
    workoutTemplateCreateSchema,
    update(workoutTemplateCreateSchema),
  ),
  workoutTemplateExercises: resource(
    "workoutTemplateExercises",
    "/health/template-exercises",
    workoutTemplateExerciseCreateSchema,
    update(workoutTemplateExerciseCreateSchema),
    { templateId: "workoutTemplates", exerciseId: "exercises" },
  ),
  workoutSessions: resource(
    "workoutSessions",
    "/health/workouts",
    workoutSessionCreateSchema,
    update(workoutSessionCreateSchema),
    { templateId: "workoutTemplates" },
  ),
  workoutSets: resource("workoutSets", "/health/sets", workoutSetCreateSchema, update(workoutSetCreateSchema), {
    sessionId: "workoutSessions",
    exerciseId: "exercises",
  }),
  aiConversations: resource(
    "aiConversations",
    "/ai/conversations",
    aiConversationCreateSchema,
    update(aiConversationCreateSchema),
  ),
  notifications: resource(
    "notifications",
    "/notifications",
    notificationCreateSchema,
    update(notificationCreateSchema),
  ),
  reminderRules: resource("reminderRules", "/reminders", reminderRuleCreateSchema, update(reminderRuleCreateSchema), {
    projectId: "projects",
    taskId: "tasks",
    eventId: "calendarEvents",
    transactionId: "financeTransactions",
    inboxItemId: "inboxItems",
    habitId: "habits",
  }),
  pushSubscriptions: resource(
    "pushSubscriptions",
    "/push/subscriptions",
    pushSubscriptionCreateSchema,
    update(pushSubscriptionCreateSchema),
  ),
} as const;
export type ResourceName = keyof typeof resourceRegistry;
export const resourceNames = Object.keys(resourceRegistry) as ResourceName[];
export type CreateInput<K extends ResourceName> = z.infer<(typeof resourceRegistry)[K]["createSchema"]>;
export type UpdateInput<K extends ResourceName> = z.infer<(typeof resourceRegistry)[K]["updateSchema"]>;
export const taskChecklistItemUpdateSchema = resourceRegistry.taskChecklistItems.updateSchema;
export const tagUpdateSchema = resourceRegistry.tags.updateSchema;
export const taskTagUpdateSchema = resourceRegistry.taskTags.updateSchema;
export const habitUpdateSchema = resourceRegistry.habits.updateSchema;
export const habitEntryUpdateSchema = resourceRegistry.habitEntries.updateSchema;
export const inboxBoxUpdateSchema = resourceRegistry.inboxBoxes.updateSchema;
export const inboxItemUpdateSchema = resourceRegistry.inboxItems.updateSchema;
export const calendarEventUpdateSchema = resourceRegistry.calendarEvents.updateSchema;
export const driveLinkUpdateSchema = resourceRegistry.driveLinks.updateSchema;
export const financialAccountUpdateSchema = resourceRegistry.financialAccounts.updateSchema;
export const financeCategoryUpdateSchema = resourceRegistry.financeCategories.updateSchema;
export const financeTransactionUpdateSchema = resourceRegistry.financeTransactions.updateSchema;
export const budgetUpdateSchema = resourceRegistry.budgets.updateSchema;
export const savingsGoalUpdateSchema = resourceRegistry.savingsGoals.updateSchema;
export const savingsContributionUpdateSchema = resourceRegistry.savingsContributions.updateSchema;
export const recurringTransactionUpdateSchema = resourceRegistry.recurringTransactions.updateSchema;
export const healthProfileUpdateSchema = resourceRegistry.healthProfiles.updateSchema;
export const bodyMeasurementUpdateSchema = resourceRegistry.bodyMeasurements.updateSchema;
export const customFoodUpdateSchema = resourceRegistry.customFoods.updateSchema;
export const mealEntryUpdateSchema = resourceRegistry.mealEntries.updateSchema;
export const mealEntryItemUpdateSchema = resourceRegistry.mealEntryItems.updateSchema;
export const waterEntryUpdateSchema = resourceRegistry.waterEntries.updateSchema;
export const exerciseUpdateSchema = resourceRegistry.exercises.updateSchema;
export const workoutTemplateUpdateSchema = resourceRegistry.workoutTemplates.updateSchema;
export const workoutTemplateExerciseUpdateSchema = resourceRegistry.workoutTemplateExercises.updateSchema;
export const workoutSessionUpdateSchema = resourceRegistry.workoutSessions.updateSchema;
export const workoutSetUpdateSchema = resourceRegistry.workoutSets.updateSchema;
export const aiConversationUpdateSchema = resourceRegistry.aiConversations.updateSchema;
export const notificationUpdateSchema = resourceRegistry.notifications.updateSchema;
export const reminderRuleUpdateSchema = resourceRegistry.reminderRules.updateSchema;
export const pushSubscriptionUpdateSchema = resourceRegistry.pushSubscriptions.updateSchema;

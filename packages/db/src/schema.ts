import type { Preferences } from "@lifesync/contracts";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const money = (name: string) => numeric(name, { precision: 20, scale: 4 });
const quantity = (name: string) => numeric(name, { precision: 12, scale: 4 });
const times = () => ({
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
});
export const user = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: text("role").notNull().default("user"),
    disabled: boolean("disabled").notNull().default(false),
    termsAcceptedAt: instant("terms_accepted_at"),
    ...times(),
  },
  (t) => [
    check("user_role_check", sql`${t.role} in ('user','admin')`),
    uniqueIndex("user_email_lower_unique").on(sql`lower(${t.email})`),
  ],
);
export const session = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: instant("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...times(),
  },
  (t) => [index("session_owner_idx").on(t.userId), index("session_expiry_idx").on(t.expiresAt)],
);
export const account = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: instant("access_token_expires_at"),
    refreshTokenExpiresAt: instant("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    ...times(),
  },
  (t) => [
    uniqueIndex("account_provider_unique").on(t.providerId, t.accountId),
    index("account_owner_idx").on(t.userId),
  ],
);
export const verification = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: instant("expires_at").notNull(),
    ...times(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier), index("verification_expiry_idx").on(t.expiresAt)],
);
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull().default(0),
  lastRequest: numeric("last_request", { precision: 20, scale: 0, mode: "number" }).notNull(),
});
export const users = user;
export const sessions = session;
export const accounts = account;
export const verifications = verification;
const owned = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  ...times(),
  deletedAt: instant("deleted_at"),
});
const ownerIndexes = (
  name: string,
  t: { id: AnyPgColumn; userId: AnyPgColumn; createdAt: AnyPgColumn; deletedAt: AnyPgColumn },
) => [
  unique(`${name}_owner_id_unique`).on(t.userId, t.id),
  index(`${name}_owner_created_idx`).on(t.userId, t.createdAt, t.id),
  index(`${name}_trash_idx`).on(t.deletedAt).where(sql`${t.deletedAt} is not null`),
];
const parent = (name: string, owner: AnyPgColumn, id: AnyPgColumn, table: { userId: AnyPgColumn; id: AnyPgColumn }) =>
  foreignKey({ name, columns: [owner, id], foreignColumns: [table.userId, table.id] }).onDelete("no action");
const recurrence = () => ({
  recurrenceRule: text("recurrence_rule"),
  timezone: text("timezone").notNull().default("Europe/Kyiv"),
});
export const userProfiles = pgTable(
  "user_profiles",
  { ...owned(), displayName: text("display_name"), avatarUrl: text("avatar_url"), bio: text("bio") },
  (t) => [...ownerIndexes("profile", t), uniqueIndex("profile_user_unique").on(t.userId)],
);
export const userPreferences = pgTable(
  "user_preferences",
  {
    ...owned(),
    timezone: text("timezone").notNull().default("Europe/Kyiv"),
    locale: text("locale").notNull().default("uk"),
    baseCurrency: text("base_currency").notNull().default("UAH"),
    weekStart: integer("week_start").notNull().default(1),
    dateFormat: text("date_format").notNull().default("DD.MM.YYYY"),
    timeFormat: text("time_format").notNull().default("24h"),
    theme: text("theme").notNull().default("system"),
    hiddenModules: text("hidden_modules").array().notNull().default(sql`'{}'::text[]`),
    webPushEnabled: boolean("web_push_enabled").notNull().default(false),
    notificationOffsets: integer("notification_offsets").array().notNull().default(sql`ARRAY[10]`),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    dashboardLayout: jsonb("dashboard_layout").$type<Preferences["dashboardLayout"]>(),
  },
  (t) => [
    ...ownerIndexes("preferences", t),
    uniqueIndex("preferences_user_unique").on(t.userId),
    check("preferences_locale_check", sql`${t.locale} in ('uk','en')`),
    check("preferences_theme_check", sql`${t.theme} in ('light','dark','system')`),
    check("preferences_week_check", sql`${t.weekStart} in (0,1)`),
  ],
);
export const entitlementPlans = pgTable(
  "entitlement_plans",
  {
    code: text("code").primaryKey(),
    aiDailyLimit: integer("ai_daily_limit"),
    inboxBoxLimit: integer("inbox_box_limit").notNull(),
    ...times(),
  },
  (t) => [
    check("plan_limits_check", sql`(${t.aiDailyLimit} is null or ${t.aiDailyLimit} >= 0) and ${t.inboxBoxLimit} > 0`),
  ],
);
export const userEntitlements = pgTable(
  "user_entitlements",
  {
    ...owned(),
    plan: text("plan").notNull().default("FREE"),
    aiDailyLimit: integer("ai_daily_limit"),
    inboxBoxLimit: integer("inbox_box_limit").notNull().default(2),
    expiresAt: instant("expires_at"),
    grantedBy: uuid("granted_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    ...ownerIndexes("entitlement", t),
    uniqueIndex("entitlement_user_unique").on(t.userId),
    check(
      "entitlement_limits_check",
      sql`(${t.aiDailyLimit} is null or ${t.aiDailyLimit} >= 0) and ${t.inboxBoxLimit} > 0`,
    ),
  ],
);
export const dailyUsageCounters = pgTable(
  "daily_usage_counters",
  {
    ...owned(),
    date: date("date").notNull(),
    timezone: text("timezone").notNull(),
    successful: integer("successful").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    rejected: integer("rejected").notNull().default(0),
    providerErrors: integer("provider_errors").notNull().default(0),
  },
  (t) => [
    ...ownerIndexes("daily_usage", t),
    uniqueIndex("daily_usage_day_unique").on(t.userId, t.date),
    check(
      "daily_usage_nonnegative",
      sql`${t.successful} >= 0 and ${t.reserved} >= 0 and ${t.rejected} >= 0 and ${t.providerErrors} >= 0`,
    ),
  ],
);
export const projects = pgTable(
  "projects",
  {
    ...owned(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    color: text("color"),
    status: text("status").notNull().default("active"),
    startDate: date("start_date"),
    targetDate: date("target_date"),
    archived: boolean("archived").notNull().default(false),
  },
  (t) => [
    ...ownerIndexes("project", t),
    check("project_status_check", sql`${t.status} in ('active','paused','completed')`),
  ],
);
export const tasks = pgTable(
  "tasks",
  {
    ...owned(),
    title: text("title").notNull(),
    description: text("description"),
    projectId: uuid("project_id"),
    parentTaskId: uuid("parent_task_id"),
    status: text("status").notNull().default("todo"),
    priority: text("priority").notNull().default("none"),
    startsAt: instant("starts_at"),
    dueAt: instant("due_at"),
    dueDate: date("due_date"),
    completedAt: instant("completed_at"),
    position: integer("position").notNull().default(0),
    recurrenceSourceId: uuid("recurrence_source_id"),
    occurrenceDate: date("occurrence_date"),
    ...recurrence(),
  },
  (t) => [
    ...ownerIndexes("task", t),
    parent("task_project_fk", t.userId, t.projectId, projects),
    foreignKey({ name: "task_parent_fk", columns: [t.userId, t.parentTaskId], foreignColumns: [t.userId, t.id] }),
    foreignKey({
      name: "task_recurrence_fk",
      columns: [t.userId, t.recurrenceSourceId],
      foreignColumns: [t.userId, t.id],
    }),
    uniqueIndex("task_occurrence_unique").on(t.userId, t.recurrenceSourceId, t.occurrenceDate),
    index("task_owner_status_due_idx").on(t.userId, t.status, t.dueAt),
    index("task_project_idx").on(t.userId, t.projectId),
    check("task_status_check", sql`${t.status} in ('inbox','todo','in_progress','done','cancelled')`),
    check("task_priority_check", sql`${t.priority} in ('none','low','medium','high','urgent')`),
    check("task_not_self_parent", sql`${t.parentTaskId} is null or ${t.parentTaskId} <> ${t.id}`),
    check("task_due_exclusive", sql`${t.dueAt} is null or ${t.dueDate} is null`),
  ],
);
export const taskChecklistItems = pgTable(
  "task_checklist_items",
  {
    ...owned(),
    taskId: uuid("task_id").notNull(),
    title: text("title").notNull(),
    completed: boolean("completed").notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    ...ownerIndexes("checklist", t),
    parent("checklist_task_fk", t.userId, t.taskId, tasks),
    index("checklist_task_position_idx").on(t.userId, t.taskId, t.position),
  ],
);
export const tags = pgTable("tags", { ...owned(), name: text("name").notNull(), color: text("color") }, (t) => [
  ...ownerIndexes("tag", t),
  uniqueIndex("tag_name_unique").on(t.userId, t.name).where(sql`${t.deletedAt} is null`),
]);
export const taskTags = pgTable(
  "task_tags",
  { ...owned(), taskId: uuid("task_id").notNull(), tagId: uuid("tag_id").notNull() },
  (t) => [
    ...ownerIndexes("task_tag", t),
    parent("task_tag_task_fk", t.userId, t.taskId, tasks),
    parent("task_tag_tag_fk", t.userId, t.tagId, tags),
    uniqueIndex("task_tag_unique").on(t.userId, t.taskId, t.tagId),
  ],
);
export const habits = pgTable(
  "habits",
  {
    ...owned(),
    name: text("name").notNull(),
    description: text("description"),
    schedule: text("schedule").notNull().default("daily"),
    weekdays: integer("weekdays").array().notNull().default(sql`'{}'::integer[]`),
    weeklyGoal: integer("weekly_goal").notNull().default(7),
    targetCount: quantity("target_count").notNull().default("1"),
    unit: text("unit").notNull().default("count"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    archived: boolean("archived").notNull().default(false),
    ...recurrence(),
  },
  (t) => [
    ...ownerIndexes("habit", t),
    check("habit_schedule_check", sql`${t.schedule} in ('daily','weekdays','weekly_goal')`),
    check("habit_goal_check", sql`${t.weeklyGoal} between 1 and 7 and ${t.targetCount} > 0`),
    check("habit_weekdays_check", sql`${t.weekdays} <@ ARRAY[0,1,2,3,4,5,6]`),
    check("habit_dates_check", sql`${t.endDate} is null or ${t.endDate} >= ${t.startDate}`),
  ],
);
export const habitEntries = pgTable(
  "habit_entries",
  {
    ...owned(),
    habitId: uuid("habit_id").notNull(),
    date: date("date").notNull(),
    count: quantity("count").notNull().default("1"),
    note: text("note"),
  },
  (t) => [
    ...ownerIndexes("habit_entry", t),
    parent("habit_entry_habit_fk", t.userId, t.habitId, habits),
    uniqueIndex("habit_entry_day_unique").on(t.userId, t.habitId, t.date),
    check("habit_entry_count_check", sql`${t.count} >= 0`),
  ],
);
export const inboxBoxes = pgTable(
  "inbox_boxes",
  {
    ...owned(),
    name: text("name").notNull(),
    color: text("color"),
    position: integer("position").notNull().default(0),
  },
  (t) => [...ownerIndexes("inbox_box", t)],
);
export const inboxItems = pgTable(
  "inbox_items",
  {
    ...owned(),
    boxId: uuid("box_id").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    source: text("source"),
    pinned: boolean("pinned").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    convertedType: text("converted_type"),
    convertedId: uuid("converted_id"),
    convertedAt: instant("converted_at"),
  },
  (t) => [
    ...ownerIndexes("inbox_item", t),
    parent("inbox_item_box_fk", t.userId, t.boxId, inboxBoxes),
    index("inbox_item_box_idx").on(t.userId, t.boxId),
  ],
);
export const calendarEvents = pgTable(
  "calendar_events",
  {
    ...owned(),
    title: text("title").notNull(),
    description: text("description"),
    projectId: uuid("project_id"),
    allDay: boolean("all_day").notNull().default(false),
    startDate: date("start_date"),
    endDate: date("end_date"),
    startsAt: instant("starts_at"),
    endsAt: instant("ends_at"),
    location: text("location"),
    meetUrl: text("meet_url"),
    ...recurrence(),
  },
  (t) => [
    ...ownerIndexes("calendar_event", t),
    parent("calendar_event_project_fk", t.userId, t.projectId, projects),
    index("calendar_event_start_idx").on(t.userId, t.startsAt),
    index("calendar_event_date_idx").on(t.userId, t.startDate),
    check(
      "calendar_event_interval_check",
      sql`(${t.allDay} and ${t.startDate} is not null and ${t.endDate} is not null and ${t.endDate} > ${t.startDate} and ${t.startsAt} is null and ${t.endsAt} is null) or (not ${t.allDay} and ${t.startsAt} is not null and ${t.endsAt} is not null and ${t.endsAt} > ${t.startsAt} and ${t.startDate} is null and ${t.endDate} is null)`,
    ),
  ],
);
export const financialAccounts = pgTable(
  "financial_accounts",
  {
    ...owned(),
    name: text("name").notNull(),
    currency: text("currency").notNull(),
    type: text("type").notNull().default("bank"),
    openingBalance: money("opening_balance").notNull().default("0"),
    archived: boolean("archived").notNull().default(false),
    color: text("color"),
  },
  (t) => [
    ...ownerIndexes("financial_account", t),
    check("financial_account_currency_check", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("financial_account_type_check", sql`${t.type} in ('cash','bank','savings','other')`),
  ],
);
export const financeCategories = pgTable(
  "finance_categories",
  { ...owned(), name: text("name").notNull(), type: text("type").notNull(), color: text("color"), icon: text("icon") },
  (t) => [
    ...ownerIndexes("finance_category", t),
    check("finance_category_type_check", sql`${t.type} in ('income','expense')`),
  ],
);
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    currency: text("currency").notNull(),
    date: date("date").notNull(),
    rateToUah: numeric("rate_to_uah", { precision: 24, scale: 10 }).notNull(),
    source: text("source").notNull().default("NBU"),
    fetchedAt: instant("fetched_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("exchange_rate_date_unique").on(t.currency, t.date, t.source),
    check("exchange_rate_positive", sql`${t.rateToUah} > 0`),
  ],
);
export const recurringTransactions = pgTable(
  "recurring_transactions",
  {
    ...owned(),
    name: text("name").notNull(),
    accountId: uuid("account_id").notNull(),
    categoryId: uuid("category_id"),
    type: text("type").notNull(),
    amount: money("amount").notNull(),
    currency: text("currency").notNull(),
    recurrenceRule: text("recurrence_rule").notNull(),
    timezone: text("timezone").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    nextDate: date("next_date").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    note: text("note"),
  },
  (t) => [
    ...ownerIndexes("recurring_transaction", t),
    parent("recurring_account_fk", t.userId, t.accountId, financialAccounts),
    parent("recurring_category_fk", t.userId, t.categoryId, financeCategories),
    check("recurring_type_check", sql`${t.type} in ('income','expense')`),
    check("recurring_amount_check", sql`${t.amount} > 0`),
    index("recurring_due_idx").on(t.nextDate, t.enabled),
  ],
);
export const financeTransactions = pgTable(
  "finance_transactions",
  {
    ...owned(),
    accountId: uuid("account_id").notNull(),
    categoryId: uuid("category_id"),
    type: text("type").notNull(),
    amount: money("amount").notNull(),
    currency: text("currency").notNull(),
    transactionDate: date("transaction_date").notNull(),
    note: text("note"),
    merchant: text("merchant"),
    destinationAccountId: uuid("destination_account_id"),
    destinationAmount: money("destination_amount"),
    exchangeRateId: uuid("exchange_rate_id").references(() => exchangeRates.id),
    recurringTransactionId: uuid("recurring_transaction_id"),
    occurrenceDate: date("occurrence_date"),
  },
  (t) => [
    ...ownerIndexes("finance_transaction", t),
    parent("transaction_account_fk", t.userId, t.accountId, financialAccounts),
    parent("transaction_destination_fk", t.userId, t.destinationAccountId, financialAccounts),
    parent("transaction_category_fk", t.userId, t.categoryId, financeCategories),
    parent("transaction_recurrence_fk", t.userId, t.recurringTransactionId, recurringTransactions),
    uniqueIndex("transaction_occurrence_unique").on(t.userId, t.recurringTransactionId, t.occurrenceDate),
    index("transaction_owner_date_idx").on(t.userId, t.transactionDate),
    check("transaction_amount_check", sql`${t.amount} > 0 and ${t.currency} ~ '^[A-Z]{3}$'`),
    check("transaction_type_check", sql`${t.type} in ('income','expense','transfer')`),
    check(
      "transaction_transfer_check",
      sql`(${t.type} = 'transfer' and ${t.destinationAccountId} is not null and ${t.destinationAccountId} <> ${t.accountId} and ${t.destinationAmount} is not null and ${t.destinationAmount} > 0) or (${t.type} <> 'transfer' and ${t.destinationAccountId} is null and ${t.destinationAmount} is null)`,
    ),
  ],
);
export const budgets = pgTable(
  "budgets",
  {
    ...owned(),
    name: text("name").notNull(),
    categoryId: uuid("category_id"),
    month: date("month").notNull(),
    amount: money("amount").notNull(),
    currency: text("currency").notNull(),
    warningThreshold: integer("warning_threshold").notNull().default(80),
  },
  (t) => [
    ...ownerIndexes("budget", t),
    parent("budget_category_fk", t.userId, t.categoryId, financeCategories),
    check("budget_amount_check", sql`${t.amount} > 0 and ${t.warningThreshold} between 1 and 100`),
    check("budget_month_check", sql`extract(day from ${t.month}) = 1`),
    uniqueIndex("budget_category_month_unique")
      .on(t.userId, t.month, t.categoryId, t.currency)
      .where(sql`${t.deletedAt} is null`),
    uniqueIndex("budget_overall_month_unique")
      .on(t.userId, t.month, t.currency)
      .where(sql`${t.categoryId} is null and ${t.deletedAt} is null`),
  ],
);
export const savingsGoals = pgTable(
  "savings_goals",
  {
    ...owned(),
    name: text("name").notNull(),
    targetAmount: money("target_amount").notNull(),
    currency: text("currency").notNull(),
    targetDate: date("target_date"),
    archived: boolean("archived").notNull().default(false),
  },
  (t) => [...ownerIndexes("savings_goal", t), check("savings_target_positive", sql`${t.targetAmount} > 0`)],
);
export const savingsContributions = pgTable(
  "savings_contributions",
  {
    ...owned(),
    goalId: uuid("goal_id").notNull(),
    amount: money("amount").notNull(),
    currency: text("currency").notNull(),
    date: date("date").notNull(),
    transactionId: uuid("transaction_id"),
    note: text("note"),
  },
  (t) => [
    ...ownerIndexes("savings_contribution", t),
    parent("contribution_goal_fk", t.userId, t.goalId, savingsGoals),
    parent("contribution_transaction_fk", t.userId, t.transactionId, financeTransactions),
    check("contribution_amount_positive", sql`${t.amount} > 0`),
  ],
);
export const healthProfiles = pgTable(
  "health_profiles",
  {
    ...owned(),
    heightCm: quantity("height_cm"),
    currentWeightKg: quantity("current_weight_kg"),
    goalWeightKg: quantity("goal_weight_kg"),
    activityLevel: text("activity_level"),
    calorieTarget: integer("calorie_target"),
    proteinTarget: quantity("protein_target"),
    fatTarget: quantity("fat_target"),
    carbohydrateTarget: quantity("carbohydrate_target"),
    waterTargetMl: integer("water_target_ml"),
  },
  (t) => [
    ...ownerIndexes("health_profile", t),
    uniqueIndex("health_profile_user_unique").on(t.userId),
    check(
      "health_profile_targets_check",
      sql`coalesce(${t.heightCm},0) >= 0 and coalesce(${t.currentWeightKg},0) >= 0 and coalesce(${t.goalWeightKg},0) >= 0 and coalesce(${t.calorieTarget},0) >= 0 and coalesce(${t.waterTargetMl},0) >= 0`,
    ),
  ],
);
export const bodyMeasurements = pgTable(
  "body_measurements",
  {
    ...owned(),
    date: date("date").notNull(),
    weightKg: quantity("weight_kg"),
    waistCm: quantity("waist_cm"),
    chestCm: quantity("chest_cm"),
    hipCm: quantity("hip_cm"),
    note: text("note"),
  },
  (t) => [
    ...ownerIndexes("body_measurement", t),
    index("body_measurement_date_idx").on(t.userId, t.date),
    check(
      "body_measurement_values_check",
      sql`coalesce(${t.weightKg},0) >= 0 and coalesce(${t.waistCm},0) >= 0 and coalesce(${t.chestCm},0) >= 0 and coalesce(${t.hipCm},0) >= 0`,
    ),
  ],
);
const macros = () => ({
  calories: quantity("calories").notNull(),
  protein: quantity("protein").notNull(),
  fat: quantity("fat").notNull(),
  carbohydrates: quantity("carbohydrates").notNull(),
});
export const customFoods = pgTable(
  "custom_foods",
  {
    ...owned(),
    name: text("name").notNull(),
    ...macros(),
    servingGrams: quantity("serving_grams").notNull().default("100"),
    favorite: boolean("favorite").notNull().default(false),
  },
  (t) => [
    ...ownerIndexes("custom_food", t),
    check(
      "food_macros_check",
      sql`${t.servingGrams} > 0 and ${t.calories} >= 0 and ${t.protein} >= 0 and ${t.fat} >= 0 and ${t.carbohydrates} >= 0`,
    ),
  ],
);
export const mealEntries = pgTable(
  "meal_entries",
  { ...owned(), date: date("date").notNull(), meal: text("meal").notNull(), note: text("note") },
  (t) => [
    ...ownerIndexes("meal_entry", t),
    index("meal_day_idx").on(t.userId, t.date),
    check("meal_type_check", sql`${t.meal} in ('breakfast','lunch','dinner','snack')`),
  ],
);
export const mealEntryItems = pgTable(
  "meal_entry_items",
  {
    ...owned(),
    mealEntryId: uuid("meal_entry_id").notNull(),
    foodId: uuid("food_id"),
    name: text("name").notNull(),
    quantityGrams: quantity("quantity_grams").notNull(),
    ...macros(),
  },
  (t) => [
    ...ownerIndexes("meal_item", t),
    parent("meal_item_meal_fk", t.userId, t.mealEntryId, mealEntries),
    parent("meal_item_food_fk", t.userId, t.foodId, customFoods),
    check(
      "meal_item_macros_check",
      sql`${t.quantityGrams} > 0 and ${t.calories} >= 0 and ${t.protein} >= 0 and ${t.fat} >= 0 and ${t.carbohydrates} >= 0`,
    ),
  ],
);
export const waterEntries = pgTable(
  "water_entries",
  {
    ...owned(),
    date: date("date").notNull(),
    amountMl: integer("amount_ml").notNull(),
    loggedAt: instant("logged_at").notNull().defaultNow(),
  },
  (t) => [
    ...ownerIndexes("water_entry", t),
    index("water_day_idx").on(t.userId, t.date),
    check("water_amount_check", sql`${t.amountMl} > 0`),
  ],
);
export const exercises = pgTable(
  "exercises",
  {
    ...owned(),
    name: text("name").notNull(),
    description: text("description"),
    muscleGroup: text("muscle_group"),
    type: text("type").notNull().default("strength"),
  },
  (t) => [
    ...ownerIndexes("exercise", t),
    check("exercise_type_check", sql`${t.type} in ('strength','cardio','mobility','other')`),
  ],
);
export const workoutTemplates = pgTable(
  "workout_templates",
  { ...owned(), name: text("name").notNull(), description: text("description") },
  (t) => [...ownerIndexes("workout_template", t)],
);
export const workoutTemplateExercises = pgTable(
  "workout_template_exercises",
  {
    ...owned(),
    templateId: uuid("template_id").notNull(),
    exerciseId: uuid("exercise_id").notNull(),
    position: integer("position").notNull(),
    sets: integer("sets").notNull().default(3),
    reps: integer("reps"),
    loadKg: quantity("load_kg"),
    durationSeconds: integer("duration_seconds"),
  },
  (t) => [
    ...ownerIndexes("template_exercise", t),
    parent("template_exercise_template_fk", t.userId, t.templateId, workoutTemplates),
    parent("template_exercise_exercise_fk", t.userId, t.exerciseId, exercises),
    check(
      "template_exercise_values_check",
      sql`${t.sets} > 0 and coalesce(${t.reps},0) >= 0 and coalesce(${t.loadKg},0) >= 0 and coalesce(${t.durationSeconds},0) >= 0`,
    ),
  ],
);
export const workoutSessions = pgTable(
  "workout_sessions",
  {
    ...owned(),
    name: text("name").notNull(),
    templateId: uuid("template_id"),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at"),
    note: text("note"),
    caloriesEstimate: integer("calories_estimate"),
  },
  (t) => [
    ...ownerIndexes("workout_session", t),
    parent("session_template_fk", t.userId, t.templateId, workoutTemplates),
    check("workout_session_interval_check", sql`${t.endsAt} is null or ${t.endsAt} >= ${t.startsAt}`),
  ],
);
export const workoutSets = pgTable(
  "workout_sets",
  {
    ...owned(),
    sessionId: uuid("session_id").notNull(),
    exerciseId: uuid("exercise_id").notNull(),
    position: integer("position").notNull(),
    reps: integer("reps"),
    loadKg: quantity("load_kg"),
    durationSeconds: integer("duration_seconds"),
    distanceMeters: quantity("distance_meters"),
    completed: boolean("completed").notNull().default(false),
  },
  (t) => [
    ...ownerIndexes("workout_set", t),
    parent("set_session_fk", t.userId, t.sessionId, workoutSessions),
    parent("set_exercise_fk", t.userId, t.exerciseId, exercises),
    check(
      "workout_set_values_check",
      sql`coalesce(${t.reps},0) >= 0 and coalesce(${t.loadKg},0) >= 0 and coalesce(${t.durationSeconds},0) >= 0 and coalesce(${t.distanceMeters},0) >= 0`,
    ),
  ],
);
export const googleWorkspaceConnections = pgTable(
  "google_workspace_connections",
  {
    ...owned(),
    googleSubject: text("google_subject").notNull(),
    email: text("email").notNull(),
    avatarUrl: text("avatar_url"),
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    encryptedAccessToken: text("encrypted_access_token"),
    tokenKeyVersion: integer("token_key_version").notNull().default(1),
    accessTokenExpiresAt: instant("access_token_expires_at"),
    scopes: text("scopes").array().notNull(),
    calendarEnabled: boolean("calendar_enabled").notNull().default(false),
    driveEnabled: boolean("drive_enabled").notNull().default(false),
    status: text("status").notNull().default("connected"),
    lastSyncedAt: instant("last_synced_at"),
    errorCode: text("error_code"),
  },
  (t) => [
    ...ownerIndexes("google_connection", t),
    uniqueIndex("google_connection_owner_unique").on(t.userId),
    check("google_connection_status_check", sql`${t.status} in ('connected','reconnect_required','disconnected')`),
  ],
);
export const googleCalendars = pgTable(
  "google_calendars",
  {
    ...owned(),
    connectionId: uuid("connection_id").notNull(),
    externalCalendarId: text("external_calendar_id").notNull(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull(),
    selected: boolean("selected").notNull().default(false),
    accessRole: text("access_role").notNull(),
  },
  (t) => [
    ...ownerIndexes("google_calendar", t),
    parent("google_calendar_connection_fk", t.userId, t.connectionId, googleWorkspaceConnections),
    uniqueIndex("google_calendar_external_unique").on(t.userId, t.externalCalendarId),
  ],
);
export const calendarEventMappings = pgTable(
  "calendar_event_mappings",
  {
    ...owned(),
    eventId: uuid("event_id").notNull(),
    calendarId: uuid("calendar_id").notNull(),
    externalEventId: text("external_event_id").notNull(),
    etag: text("etag"),
    googleUpdatedAt: instant("google_updated_at"),
    localSyncedAt: instant("local_synced_at"),
    lastSyncedAt: instant("last_synced_at"),
    conflict: boolean("conflict").notNull().default(false),
    googleDeleted: boolean("google_deleted").notNull().default(false),
  },
  (t) => [
    ...ownerIndexes("event_mapping", t),
    parent("mapping_event_fk", t.userId, t.eventId, calendarEvents),
    parent("mapping_calendar_fk", t.userId, t.calendarId, googleCalendars),
    uniqueIndex("mapping_external_unique").on(t.userId, t.calendarId, t.externalEventId),
    uniqueIndex("mapping_local_unique").on(t.userId, t.eventId, t.calendarId),
  ],
);
export const calendarSyncState = pgTable(
  "calendar_sync_state",
  {
    ...owned(),
    calendarId: uuid("calendar_id").notNull(),
    syncToken: text("sync_token"),
    lastReconciledAt: instant("last_reconciled_at"),
    lastSuccessfulAt: instant("last_successful_at"),
    errorCode: text("error_code"),
    lockExpiresAt: instant("lock_expires_at"),
  },
  (t) => [
    ...ownerIndexes("calendar_sync", t),
    parent("sync_calendar_fk", t.userId, t.calendarId, googleCalendars),
    uniqueIndex("calendar_sync_unique").on(t.userId, t.calendarId),
  ],
);
export const googleWatchChannels = pgTable(
  "google_watch_channels",
  {
    ...owned(),
    calendarId: uuid("calendar_id").notNull(),
    channelId: text("channel_id").notNull().unique(),
    resourceId: text("resource_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: instant("expires_at").notNull(),
    lastMessageNumber: numeric("last_message_number", { precision: 30, scale: 0 }).notNull().default("0"),
  },
  (t) => [
    ...ownerIndexes("watch_channel", t),
    parent("watch_calendar_fk", t.userId, t.calendarId, googleCalendars),
    index("watch_expiry_idx").on(t.expiresAt),
  ],
);
const targets = () => ({
  projectId: uuid("project_id"),
  taskId: uuid("task_id"),
  eventId: uuid("event_id"),
  transactionId: uuid("transaction_id"),
  inboxItemId: uuid("inbox_item_id"),
  habitId: uuid("habit_id"),
});
const targetConstraints = (
  prefix: string,
  t: {
    userId: AnyPgColumn;
    projectId: AnyPgColumn;
    taskId: AnyPgColumn;
    eventId: AnyPgColumn;
    transactionId: AnyPgColumn;
    inboxItemId: AnyPgColumn;
    habitId: AnyPgColumn;
  },
) => [
  parent(`${prefix}_project_fk`, t.userId, t.projectId, projects),
  parent(`${prefix}_task_fk`, t.userId, t.taskId, tasks),
  parent(`${prefix}_event_fk`, t.userId, t.eventId, calendarEvents),
  parent(`${prefix}_transaction_fk`, t.userId, t.transactionId, financeTransactions),
  parent(`${prefix}_inbox_fk`, t.userId, t.inboxItemId, inboxItems),
  parent(`${prefix}_habit_fk`, t.userId, t.habitId, habits),
  check(
    `${prefix}_one_target_check`,
    sql`num_nonnulls(${t.projectId},${t.taskId},${t.eventId},${t.transactionId},${t.inboxItemId},${t.habitId}) = 1`,
  ),
];
export const driveLinks = pgTable(
  "drive_links",
  {
    ...owned(),
    googleFileId: text("google_file_id").notNull(),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    webViewUrl: text("web_view_url").notNull(),
    icon: text("icon"),
    modifiedAt: instant("modified_at"),
    ...targets(),
  },
  (t) => [
    ...ownerIndexes("drive_link", t),
    ...targetConstraints("drive_link", t),
    index("drive_file_idx").on(t.userId, t.googleFileId),
  ],
);
export const aiPermissions = pgTable(
  "ai_permissions",
  {
    ...owned(),
    tasks: boolean("tasks").notNull().default(false),
    calendar: boolean("calendar").notNull().default(false),
    habits: boolean("habits").notNull().default(false),
    finance: boolean("finance").notNull().default(false),
    health: boolean("health").notNull().default(false),
    drive: boolean("drive").notNull().default(false),
    inbox: boolean("inbox").notNull().default(false),
    projects: boolean("projects").notNull().default(false),
  },
  (t) => [...ownerIndexes("ai_permission", t), uniqueIndex("ai_permission_owner_unique").on(t.userId)],
);
export const aiConversations = pgTable(
  "ai_conversations",
  {
    ...owned(),
    title: text("title").notNull(),
    expiresAt: instant("expires_at").notNull().default(sql`now() + interval '7 days'`),
  },
  (t) => [...ownerIndexes("ai_conversation", t), index("ai_conversation_expiry_idx").on(t.expiresAt)],
);
export const aiMessages = pgTable(
  "ai_messages",
  {
    ...owned(),
    conversationId: uuid("conversation_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    expiresAt: instant("expires_at").notNull().default(sql`now() + interval '7 days'`),
  },
  (t) => [
    ...ownerIndexes("ai_message", t),
    parent("message_conversation_fk", t.userId, t.conversationId, aiConversations),
    check("ai_message_role_check", sql`${t.role} in ('user','assistant','tool')`),
    index("ai_message_expiry_idx").on(t.expiresAt),
  ],
);
export const aiActionLogs = pgTable(
  "ai_action_logs",
  {
    ...owned(),
    conversationId: uuid("conversation_id"),
    tool: text("tool").notNull(),
    targetType: text("target_type"),
    targetId: uuid("target_id"),
    status: text("status").notNull(),
    confirmationTokenHash: text("confirmation_token_hash"),
    confirmedAt: instant("confirmed_at"),
    idempotencyKey: text("idempotency_key").notNull(),
    expiresAt: instant("expires_at").notNull().default(sql`now() + interval '7 days'`),
    undoData: jsonb("undo_data").$type<{
      resource: string;
      fields: Record<string, unknown>;
    }>(),
    proposedData: jsonb("proposed_data").$type<{
      resource: string;
      operation: "create" | "update" | "delete";
      input: Record<string, unknown>;
      targetId?: string;
    }>(),
  },
  (t) => [
    ...ownerIndexes("ai_action", t),
    parent("action_conversation_fk", t.userId, t.conversationId, aiConversations),
    uniqueIndex("ai_action_idempotency_unique").on(t.userId, t.idempotencyKey),
    check("ai_action_status_check", sql`${t.status} in ('pending','confirmed','completed','failed','undone')`),
  ],
);
export const reminderRules = pgTable(
  "reminder_rules",
  {
    ...owned(),
    ...targets(),
    triggerType: text("trigger_type").notNull(),
    offsetMinutes: integer("offset_minutes"),
    exactAt: instant("exact_at"),
    channels: text("channels").array().notNull(),
    enabled: boolean("enabled").notNull().default(true),
  },
  (t) => [
    ...ownerIndexes("reminder", t),
    ...targetConstraints("reminder", t),
    check(
      "reminder_trigger_check",
      sql`(${t.triggerType} = 'offset' and ${t.offsetMinutes} >= 0 and ${t.exactAt} is null) or (${t.triggerType} = 'exact' and ${t.exactAt} is not null and ${t.offsetMinutes} is null)`,
    ),
    check("reminder_channels_check", sql`cardinality(${t.channels}) > 0 and ${t.channels} <@ ARRAY['in_app','push']`),
  ],
);
export const notifications = pgTable(
  "notifications",
  {
    ...owned(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    kind: text("kind").notNull(),
    targetType: text("target_type"),
    targetId: uuid("target_id"),
    readAt: instant("read_at"),
    deliveryKey: text("delivery_key"),
  },
  (t) => [
    ...ownerIndexes("notification", t),
    index("notification_unread_idx").on(t.userId, t.readAt),
    uniqueIndex("notification_delivery_unique").on(t.userId, t.deliveryKey),
  ],
);
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    ...owned(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    deviceName: text("device_name"),
    lastUsedAt: instant("last_used_at"),
  },
  (t) => [...ownerIndexes("push", t)],
);
export const reminderDeliveries = pgTable(
  "reminder_deliveries",
  {
    ...owned(),
    reminderId: uuid("reminder_id").notNull(),
    occurrenceAt: instant("occurrence_at").notNull(),
    channel: text("channel").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    deliveredAt: instant("delivered_at"),
    errorCode: text("error_code"),
  },
  (t) => [
    ...ownerIndexes("reminder_delivery", t),
    parent("delivery_reminder_fk", t.userId, t.reminderId, reminderRules),
    uniqueIndex("reminder_delivery_occurrence_unique").on(t.userId, t.reminderId, t.occurrenceAt, t.channel),
  ],
);
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    requestId: text("request_id").notNull(),
    networkHash: text("network_hash"),
    userAgent: text("user_agent"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_actor_created_idx").on(t.actorUserId, t.createdAt), index("audit_created_idx").on(t.createdAt)],
);
export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description").notNull(),
  ...times(),
});
export const dailyProductMetrics = pgTable(
  "daily_product_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    metric: text("metric").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [uniqueIndex("daily_metric_unique").on(t.date, t.metric), check("metric_count_check", sql`${t.count} >= 0`)],
);
export const backgroundJobs = pgTable(
  "background_jobs",
  {
    ...owned(),
    type: text("type").notNull(),
    status: text("status").notNull().default("pending"),
    idempotencyKey: text("idempotency_key").notNull(),
    targetId: uuid("target_id"),
    runAt: instant("run_at").notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    lockedUntil: instant("locked_until"),
    errorCode: text("error_code"),
    completedAt: instant("completed_at"),
  },
  (t) => [
    ...ownerIndexes("job", t),
    uniqueIndex("job_idempotency_unique").on(t.userId, t.idempotencyKey),
    index("job_run_idx").on(t.status, t.runAt),
  ],
);
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    ...owned(),
    key: text("key").notNull(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    requestHash: text("request_hash").notNull(),
    resourceId: uuid("resource_id"),
    statusCode: integer("status_code"),
    responseBody: jsonb("response_body").$type<{ data: unknown; nextCursor?: string }>(),
    status: text("status").notNull().default("pending"),
    expiresAt: instant("expires_at").notNull(),
  },
  (t) => [
    ...ownerIndexes("idempotency", t),
    uniqueIndex("idempotency_owner_key_unique").on(t.userId, t.key),
    index("idempotency_expiry_idx").on(t.expiresAt),
  ],
);

# Shared LifeSync contract

All resources use `/api/v1`, owner `userId` from session (never accepted in input), UUID ids, UTC ISO timestamps and numeric decimal strings for money. Responses `{data:T,nextCursor?:string}`; errors `{error:{code,message,requestId}}`. Lists GET, item GET/:id, create POST, update PATCH/:id, soft-delete DELETE/:id, restore POST/:id/restore. Pagination query `limit` (1..100), `cursor`, `search`, `status`, `from`, `to`.

Exports: `resourceRegistry` object keyed by table export name; each entry `{table,path,createSchema,updateSchema,relations}`. `relations` maps foreign-key field to parent table export. `resourceNames`, `ResourceName`, `ApiResponse<T>`, `ApiError`, `preferencesSchema`, `updatePreferencesSchema`, `dashboardLayoutSchema`. Every create/update schema is also exported under `<singular>CreateSchema` / `<singular>UpdateSchema`.

Table exports / paths:

| Table export | Path |
|---|---|
| projects | /projects |
| tasks | /tasks |
| taskChecklistItems | /tasks/checklist-items |
| tags | /tags |
| taskTags | /tasks/tags |
| habits | /habits |
| habitEntries | /habits/entries |
| inboxBoxes | /inbox/boxes |
| inboxItems | /inbox/items |
| calendarEvents | /calendar/events |
| driveLinks | /drive-links |
| financialAccounts | /finance/accounts |
| financeCategories | /finance/categories |
| financeTransactions | /finance/transactions |
| budgets | /finance/budgets |
| savingsGoals | /finance/savings-goals |
| savingsContributions | /finance/contributions |
| recurringTransactions | /finance/recurring |
| healthProfiles | /health/profiles |
| bodyMeasurements | /health/measurements |
| customFoods | /health/foods |
| mealEntries | /health/meals |
| mealEntryItems | /health/meal-items |
| waterEntries | /health/water |
| exercises | /health/exercises |
| workoutTemplates | /health/templates |
| workoutTemplateExercises | /health/template-exercises |
| workoutSessions | /health/workouts |
| workoutSets | /health/sets |
| aiConversations | /ai/conversations |
| notifications | /notifications |
| reminderRules | /reminders |
| pushSubscriptions | /push/subscriptions |

Auth tables exported `user`, `session`, `account`, `verification`, plus aliases `users`, `sessions`, `accounts`, `verifications`. Auth identifiers are UUID (configure Better Auth generateId accordingly). Database `createDatabase(connectionString)` returns Drizzle instance with `$client` pg Pool; shutdown via `$client.end()`. `Database` is its return type. Preferences/permissions/entitlements and integration secrets are service-managed tables, excluded from generic client writable registry.

Date fields stay YYYY-MM-DD. Instants are ISO strings in JSON and Date values in Drizzle. Recurrence `recurrenceRule` uses RFC5545 RRULE, separate `timezone`; service validates/generates instances. Money is a string with <=4 fraction digits; finance transfers use `type:transfer`, `destinationAccountId` and `destinationAmount` atomically in one transaction row. App entity ownership is checked by composite `(userId,parentId)` FKs; service checks parent active state/cycles and transaction currency consistency. Drive/reminder targets use explicit nullable foreign-key columns with exactly one target; no untyped entity blobs.

Permanent parent deletion uses NO ACTION to preserve active related rows; service must unlink optional associations or remove true owned children explicitly. Deleting the user cascades all directly owned application rows. Notifications may only be patched by clients (readAt); creation is server-owned. Idempotency records export `idempotencyKeys` with responseBody JSONB, status, requestHash, resourceId, statusCode and expiry. Stored response bodies may contain private values and must be excluded from ordinary admins/logs and purged on expiry.

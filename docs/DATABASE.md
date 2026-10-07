# Database

The Drizzle PostgreSQL schema covers auth, preferences/entitlements/usage, projects/tasks/checklists/tags, habits/logs, inbox, local calendars/Google state/mappings/watches, Drive links, accounts/categories/transactions/budgets/savings/recurring finance/historical rates, health profiles/food/meals/water/measurements/exercises/workouts, AI conversations/messages/actions/permissions, notifications/reminders/push, audit/features/jobs/idempotency.

UUID identifiers, UTC timestamptz, all-day date columns, numeric money and appropriate constraints/indexes enforce data shape. Composite owner references prevent cross-user associations; service logic validates active parent state and cycle constraints. Application rows have direct owner attribution. Flexible JSON is limited to versioned layouts, provider metadata and action proposals with validated transport schemas.

`packages/db/migrations` is the source of schema upgrades. Create an empty PostgreSQL database, set DATABASE_URL securely and run `pnpm db:migrate`. No implicit production migration/seed. Review every generated migration before deployment, keep it compatible with the rollback Worker and back up before changes. Use separate DB/schema for disposable tests. Do not apply staging fixtures to production.

Money calculations use PostgreSQL numeric or Decimal; currency/amount are stored separately. A transfer stores source and destination legs atomically and cannot alter another owner's wallet. Soft-deleted transactions no longer affect balances/reports. Historical rate records include currency/date/source/fetch time. Display-currency changes never mutate original amounts.

Trash retains major user records for 30 days; chats seven days. Parent purge can be rejected by references rather than silently delete unrelated active data. Account deletion cascades the owner data under explicit recent-auth confirmation. Export omits provider tokens, session credentials and push auth keys.

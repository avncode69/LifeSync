# LifeSync implementation plan

Binding specification: ../LifeSync_Master_TZ_AI.md (outside repository, D:/AW/site).
Execution: subagent implementation with explicit file ownership, controller integration and independent review. No repeated design approval: requested by owner and AW rules.

## Architecture and shared contracts
Next.js 16 / vinext web, Hono API, PostgreSQL through pg/Hyperdrive, Drizzle migrations, Better Auth. Studio Admin UI primitives retained without demo routes. All private APIs under /api/v1; auth under /api/auth. UTC instants, separate all-day dates, decimal strings for money, uk/en translations. No production seeds or mock providers.
Responses: {data:T, nextCursor?:string}; errors: {error:{code,message,requestId}}. Owner-scoped UUID resources, cursor pagination. Mutations require same-origin request and shared Zod validation. List API route names and schemas exported by @lifesync/contracts. Database exports schema tables and createDatabase(connectionString). API authentication uses server-managed verified sessions.

## Milestones and owners
- [x] 1. Bootstrap monorepo, exact upstream/license, pnpm/Turbo/Biome/strict TS, local and Cloudflare configurations (controller).
- [x] 2. Shared contracts and typed relational schema for all specification domains, migrations, database tooling (database agent: packages/contracts, packages/db).
- [x] 3. Hono security middleware, Better Auth, email, user lifecycle, real CRUD/services and OpenAPI (API agent: apps/api, packages/auth, packages/config; live mail/provider acceptance in milestone 12).
- [x] 4. Studio Admin LifeSync theme/shell, public/auth/onboarding pages, uk/en i18n and real API forms (web agent: apps/web, packages/i18n).
- [x] 5. Productivity: projects/tasks/subtasks/checklists/recurrence/Kanban, habits, inbox, capture, aggregate dashboard/layout/search.
- [x] 6. Google identity separated from incremental Workspace OAuth, encrypted tokens, Calendar mapping/conflicts/reconciliation/watch renewal and Drive links (implementation and local adapter/security tests; live Google acceptance in milestone 12).
- [x] 7. Finance accounts/categories/transactions/transfers, budgets/savings/contributions/recurrence, NBU historical rates and reports.
- [x] 8. Health profile/food/nutrition/water/measurements/exercises/workout templates/sessions/sets.
- [x] 9. Gemini abstraction/streaming, opt-in context/tool policy, explicit mutation confirmations, atomic quotas, 7-day retention (local implementation/tests; live provider validation belongs to milestone 12).
- [x] 10. Reminders/Web Push/PWA/offline read-only, notifications, trash/export/delete, private admin/metrics/audit (local implementation; live Push/PWA acceptance in milestone 12).
- [x] 11. Complete docs/env/CI/CD/deployment procedure, owner launch checklist and independent security/spec review. See RELEASE_SECURITY_REVIEW.md for operational release gates.
- [ ] 12. Run lint/format/typecheck/unit/integration/E2E/production build, responsive runtime tests, dependency audit; real staging/backup restore when credentials available.

## Verification focus
Cross-user IDs and foreign-parent references must reject access. Concurrent quota/inbox mutations and retried finance/sync/reminders cannot duplicate records. DST recurrence and scheduled habit days must preserve local-day semantics. Historical conversion never uses fabricated or current fallback rates silently. Module hiding cannot grant AI access or expose sensitive content to admins. Exercise these with domain unit and PostgreSQL/API integration tests plus Playwright user journeys.

## Execution record
2026-10-05: New workspace contained specification only; old D:/.fq inspected as behavioral reference. Upstream cloned at d3e280aa8aad90a2e89863bac7a4329364567359. Demo sources moved into sibling studio-admin-reference to remove them from product source without destructive deletion.

2026-10-07: Resumed implementation. Independent review produced executable regression cases for currency history, Calendar separation/disconnect/restore, local recurrence dates, per-device reminder retry, entitlements and AI confirmation/Undo. Scope audit closed Calendar occurrence rendering, large-list pagination, Dashboard filtering, Notification navigation/read states, Health latest measurement and Finance transfer/report UI. Final security fixes cover owner-constrained Push registration, logout cleanup, OAuth encryption, callback replay and Google webhook deduplication. Observed check results are recorded in VERIFICATION.md. External hosting/services are not configured by the owner; milestone 12 remains incomplete until real staging/provider acceptance and backup restore.

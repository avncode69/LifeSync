# API contract

Browser calls use `/api/v1` on the application's origin; Better Auth `/api/auth`. Responses: `{data:T,nextCursor?:string}`. Errors: `{error:{code,message,requestId}}`. See `/api/v1/openapi.json` for generated contracts and `packages/contracts/CONTRACT.md` for route names. Public configuration exposes only safe UI configuration at `/api/public/config`.

Lists accept bounded limit/cursor and supported search/status/date filters. Item IDs are UUIDs. POST creates, PATCH edits, DELETE moves to trash, POST `/:id/restore` restores. Idempotency-Key applies to retryable creates; finance creation requires it. Reusing a key with different input is a conflict.

All private routes require a verified session; client-supplied owner IDs are rejected. Mutations require the configured Origin; the Google webhook is narrowly exempted and independently verified with persisted channel credentials/replay controls. CORS never grants cross-user authorization. Body/field limits and typed error codes apply consistently.

Groups: me/preferences/entitlements/sessions, projects/tasks/habits/inbox, capture/search/dashboard, calendar/integrations/google/drive-links, finance/health, ai, reminders/notifications/push, trash/export/account, admin. Sensitive administrator content browsing is absent.

OpenAPI generation and UI use the same Zod resource schemas where possible. Auth provider routes follow Better Auth's documented API. See automated integration/E2E tests for executable request examples without real credentials.

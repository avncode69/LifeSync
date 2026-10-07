# Testing LifeSync

Run checks from the monorepo root with the committed lockfile and Node 22.12 or newer. `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` are separate gates. Production bundling does not establish that a deployed integration works.

## Database integration tests

Without `TEST_DATABASE_URL`, tests start a disposable PGlite PostgreSQL engine and apply every committed SQL migration. Better Auth verification and session cookies are real; only email transport and explicitly supplied AI test providers are substituted. PGlite uses one pg connection because its backend cannot multiplex unnamed statement portals. Concurrent API requests still run, but this cannot prove native multi-session race safety.

Set `TEST_DATABASE_URL` to a **dedicated disposable PostgreSQL test server** to run with native PostgreSQL and a pool of five connections. Each harness creates a database named `lifesync_test_<random UUID>`, applies the same migrations, then drops only that generated database on close. The test principal needs CREATE DATABASE permission. Never point this variable at production. CI provisions PostgreSQL 17 and uses this mode. A terminated test process can leave an isolated test database; inspect its generated name before removing it.

`pnpm test:integration` runs the authentication/API and AI integration suites. Their checks cover owner isolation, foreign parents, registration consent and verification, origin rejection, sessions/reset/account deletion, trash/export boundaries, decimal transfers, inbox caps, quota races, and confirmation-time permissions. Domain suites cover local days, scheduled habits, DST recurrence, money, capture parsing, encryption, provider parsing and push failures.

The load smoke creates ten verified, independent users and concurrently requests fifty owner-scoped lists. It asserts isolation and successful responses and records elapsed time/backend type. Local PGlite results measure only the single-session development engine; native PostgreSQL and deployed Worker measurements remain separate acceptance evidence.

## Browser tests

Install Chromium once using `pnpm exec playwright install chromium`. `pnpm test:e2e` starts an isolated database/API mailbox harness on 8787 and web on 3000. Those ports must be free. No test mailbox route is included in the production API. Browser tests exercise real registration, verification, login, onboarding, CRUD, and session lifecycle. Responsive checks use 360, 390, 768, 1024, 1440, 1920 and 3840 pixels. Add journeys for each behavior change rather than asserting implementation details.

The seven-width private-page sweep performs 84 rapid navigations. The loopback-only harness resets the general API rate window before each viewport burst; production limits stay unchanged and auth limits are never reset. The browser sweep fails on runtime exceptions, HTTP 429 and server errors, preventing error screens from passing as responsive product pages. Screenshots are written to ignored .local output rather than modifying production assets.

## External integration acceptance

Use a separate staging tenant and user-owned test calendars/files. Verify Google identity and incremental Workspace permissions separately; choose existing private Drive files through Picker; reconcile two calendars, edits, conflicts, token expiry, disconnect and watch renewal. Test Gemini streaming, quotas, explicit confirmations and undo without including private context before opt-in. Test Web Push acceptance/denial, subscription expiry, transient retry and notification clicks in an actual browser. Exercise offline reads, disabled writes and logout cache clearing.

Measure backup restore into an isolated staging database before launch. Record commands, actual exit codes, dates, environment and remaining limitations in VERIFICATION.md. Missing credentials or an unavailable runner must remain an explicit unverified item.

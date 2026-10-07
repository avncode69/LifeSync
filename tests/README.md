# Integration harness

For the current full procedure, see ../docs/TESTING.md. When TEST_DATABASE_URL is set, the harness uses native PostgreSQL with a five-connection pool and isolated generated databases instead of PGlite. CI configures that mode. The following PGlite limits apply only to the default local mode.

`pnpm test` runs `api.integration.test.ts` against a fresh in-memory PostgreSQL engine (PGlite) exposed by the PostgreSQL wire protocol. Requests use the production Hono app, Better Auth configuration, `pg` driver and Drizzle tables. All committed migrations are applied. Email delivery is the explicitly supported test-only capturing provider; signup, verification, sign-in, password reset and cookie handling remain real.

Fixtures only exist inside the disposable test engine and are closed after the suite. No production database/environment is accessed. Actors use separate RFC5737 test network addresses to avoid unrelated builtin auth rate limits sharing one IP.

PGlite has a single backend PostgreSQL session. The harness limits the `pg` pool to one connection because multiple wire-protocol clients otherwise overwrite unnamed statement portals. The concurrent Inbox test submits parallel API requests and checks its final database invariant, but cannot establish independent PostgreSQL transaction-session concurrency. Run equivalent multi-connection stress tests on a separate staging PostgreSQL instance before launch.

The suite verifies terms consent, email verification, real persistence, ownership of tasks/finance/health and foreign parents, Origin rejection, admin denial, partial update preservation, Inbox limits, idempotency replay, exact transfers, trash/restore, safe export, immediate session revocation, anti-enumeration, single-use password reset and account deletion.

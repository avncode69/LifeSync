# Architecture

LifeSync separates the Studio Admin based Next.js/vinext web application from the Hono API Worker. Shared Zod contracts define transport validation, Drizzle describes relational PostgreSQL records, Better Auth owns identity and sessions. Standard pg connects through Hyperdrive in deployed Workers. Browser requests use the public application origin under /api; no browser auth token storage.

Web renders product routes with reusable upstream UI primitives. State from the server remains API data, while dialog/navigation/theme state is client state. Ukrainian and English text live in the i18n package. Money is decimal text across the API and PostgreSQL numeric in storage. Local calendar dates are distinct from UTC instants. Recurrence is calculated using wall clock dates in the configured IANA timezone.

Private CRUD always scopes by session owner; related entity ownership is validated on the server and supported by composite foreign keys. Sensitive domains have no admin content endpoints. Google identity scopes are separate from Workspace incremental OAuth. Provider tokens are authenticated-encrypted with owner identity as associated data. AI permission checks happen in code independently from model output.

Local database verification can use PGlite PostgreSQL WASM with the official TCP adapter where native PostgreSQL is unavailable. This is a development/test dependency only and never selected in production. Its connection multiplexing does not substitute for native PostgreSQL concurrency verification; CI runs PostgreSQL 17.

Decisions and deviations from the binding specification are recorded in IMPLEMENTATION_PLAN.md and release verification. Connecting a real provider does not permit fabricated exchange rates, demo database data or unconditional service success responses.

References: https://github.com/cloudflare/vinext ; https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/ ; https://pglite.dev/docs/pglite-socket

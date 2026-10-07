# Release security review — 2026-10-07

This is the specification section 69 review, including independent read-only review. Local evidence is separate from live release acceptance. No production or staging service is provisioned yet.

| Requirement | Observed status |
| --- | --- |
| Secrets server-only; no auth token in localStorage | Source review: secrets stay in API configuration; HttpOnly sessions. Browser receives only public Picker/Turnstile/VAPID configuration and an in-memory, narrowly scoped Picker grant. Local storage holds preferences and push owner marker, not credentials. |
| Password reset and email verification | Real Better Auth integration tests cover reset single use, session invalidation and verification; browser registration/verification/login passed. Email transport captured locally; live delivery pending. |
| Google OAuth state and incremental scopes | Callback integration tests cover foreign owner, expiry, single use before exchange and replay. Scope/PKCE tests cover selected Calendar/drive.file grants. Live Google identity/Workspace consent pending. |
| Cross-user IDOR and admin authorization | Integration tests deny foreign resources/parents and normal-user admin requests. Admin routes expose operational metadata rather than private Health/Finance/AI content. |
| Rate limits and Turnstile | Auth/API database-backed limits configured. Auth trusts cf-connecting-ip only; integration test confirms rotating spoofed X-Forwarded-For cannot bypass the limiter, and distinct trusted IPs have separate counters. Turnstile handler and UI implemented; real site/secret keys and hosted hostname validation remain pending. |
| CSP/CORS/SQL | Headers and same-origin restrictions reviewed; production CSP excludes unsafe-eval. Queries use parameterized Drizzle/pg, with internally generated identifiers only in isolated test database creation. |
| Arbitrary URL fetching | Push endpoint allowlist, fixed Google/NBU/Gemini/Turnstile destinations and provider metadata validation reviewed. No public arbitrary fetch proxy. |
| Google token encryption | Workspace AES-GCM uses owner AAD; encryption tests pass. Better Auth identity account.encryptOAuthTokens enabled explicitly. No pre-existing plaintext live provider accounts were present. |
| Logs/analytics and source maps | Request logs use route pattern, method, code and request ID; no bodies, provider tokens or private domain content. Metrics use counts/feature usage. Source map publication is not enabled in application configuration; review hosted artifacts and Cloudflare logging access before launch. |
| Dependency audit | Zero critical, moderate and low; one unresolved high braces advisory in trusted development/build glob tooling. See SECURITY.md; a full audit intentionally returns nonzero while this remains unresolved. |
| Backups and staging restore | Procedure and retention expectations documented in BACKUPS_AND_RESTORE.md. Provider backups, scheduling and a measured staging restore are not configured/tested. |
| Account deletion and session revocation | Authenticated integration tests exercise password-confirmed cascading deletion and immediate session revocation. |
| Push cleanup and retries | Owner-scoped registration/deletion and browser repeated-enable/conflict/logout cleanup tests. Per-device delivery records isolate retries; stable notification tag identifies each delivery. Real VAPID/browser delivery acceptance remains pending. |
| Webhook/idempotency | Google channel/resource/token/expiry checks and monotonically increasing message claims reviewed. Integration tests cover concurrent duplicate/stale Google notifications, wrong token and exactly one queued job, including message numbers above JavaScript's safe integer range. Mutation idempotency tests cover finance, Inbox, workouts and AI; real Google watch delivery remains pending. |

Local tests use PostgreSQL through PGlite. Native PostgreSQL with multiple sessions is configured in CI, but that CI run has not been observed here. Successful local builds and tests do not constitute staging deployment verification.

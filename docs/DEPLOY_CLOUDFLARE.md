# Cloudflare deployment

LifeSync runs as a web Worker and a Hono API Worker, with provider-independent PostgreSQL reached through Hyperdrive. Provision independent staging and production resources. Repository dry runs do not provision databases, domains, credentials or deploy a live application.

## Configure the target

For a first free staging database, Neon provides standard PostgreSQL and a free plan. Connect Cloudflare Hyperdrive to its direct PostgreSQL endpoint and keep the application independent of Neon's proprietary API. Supabase PostgreSQL is another option, but free projects may pause after seven days of low activity. Free plans have usage/retention limits; confirm the current plan and arrange the required backups before a public launch. Cloudflare D1 is a different database engine and cannot replace this PostgreSQL schema without a separate migration project.

Provider references checked 2026-10-07: [Neon free plan](https://neon.com/blog/neon-free-plan-1-gb-per-project), [Supabase pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Cloudflare PostgreSQL connection](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/).

Create Hyperdrive with query caching disabled for this application: authenticated sessions, limits and read-after-write UI must use fresh records. Do not enable global query caching for private owner-scoped state.

1. Create PostgreSQL databases with backups, connection limits and restricted application credentials. Review committed migrations and apply them explicitly with `pnpm db:migrate` using the intended protected DATABASE_URL. Keep migration credentials separate from the runtime account where possible.
2. Create Hyperdrive configurations for each database. In each API Wrangler environment add the real Hyperdrive ID under a binding named `HYPERDRIVE`. The API entry reads `HYPERDRIVE.connectionString`; a plain DATABASE_URL is for local/test fallback. Confirm database TLS and connectivity with your provider.
3. Set API environment vars APP_ENV, APP_URL and BETTER_AUTH_URL to the actual matching HTTPS origin; set EMAIL_PROVIDER=resend and a verified EMAIL_FROM. Wrangler environment vars do not inherit parent vars. Configure a five-minute cron for scheduled jobs in each deployed API environment.
4. Configure the web Worker environment and the API service binding described by its Wrangler configuration. The web origin must proxy `/api/*` to the matching API Worker; do not mix production web with staging API. Enable browser-public Turnstile and Picker configuration only for the real origin.
5. Store server secrets with `wrangler secret put NAME --env staging` (or production) from apps/api. Supply BETTER_AUTH_SECRET, RESEND_API_KEY, TURNSTILE_SECRET_KEY, configured Google client secrets and encryption keys, GEMINI_API_KEY and VAPID_PRIVATE_KEY. Do not place secret values in Wrangler vars, git, browser bundles, screenshots or chat. The complete variable catalog is .env.example.
6. Configure Google identity and Workspace callback URLs for this exact origin. Enable Picker API and restrict GOOGLE_PICKER_API_KEY to Picker and the allowed HTTP referrers; GOOGLE_PICKER_APP_ID is the Google Cloud project number. Follow GOOGLE_INTEGRATION.md for minimal scopes and token rotation. Configure Turnstile allowed hosts, Resend DNS and the VAPID public key/contact.

## Release

Run all checks listed in TESTING.md before deployment. Build the Cloudflare web target with its `build:cloudflare` script and inspect both Worker dry runs. Root deployment scripts deploy the API before web and require an already configured, authorized target. Keep the previous Worker versions and a compatible database rollback plan. No production auto-migration or seed is executed by an HTTP request.

After staging deployment, verify health, database access, registration mail, email verification/reset, cookies, both languages, private API origin rejection, admin restrictions, Google identity/Workspace/Picker/two-calendar reconciliation, Gemini streaming and action confirmation/undo, notification delivery/retry and offline logout. Test backup restore into another isolated database. Record real results before deploying publicly.

## Launch checklist

- Owner approves privacy/terms, actual support contacts, account deletion and provider data processing disclosures.
- No critical dependency advisory; document the applicability and mitigation of any remaining advisory.
- Separate staging and production database, Hyperdrive, secrets, OAuth redirects and notification destinations.
- Verified operational alerts, rate limits, cron execution, backup retention and measured restore.
- Bootstrap admin from an existing verified account using the explicit local script; no public promotion endpoint.
- Confirm logs exclude passwords, cookies, OAuth tokens, health/finance/chat contents and exported data.
- Record rollback Worker versions, migration compatibility and the responsible operator.

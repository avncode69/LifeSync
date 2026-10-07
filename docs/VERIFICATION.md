# Observed verification

This file records observations rather than inferring completion from configured scripts.

## 2026-10-07, local Windows / Node 24

- Final complete Vitest run including Push/OAuth/webhook/proxy-IP security changes: **20 suites, 116 tests passed**, exit 0 (106.03s while browser/build checks also ran). Includes ten-user/fifty-request owner-isolation load smoke using PGlite; this is not a production performance measurement. The auth regression proves rotating X-Forwarded-For cannot bypass a trusted CF IP's limiter.
- Narrow dependency overrides installed successfully; subsequent frozen-lockfile installation passed. Current audit: **zero critical/moderate/low, one high braces advisory**. No published patched braces version was available; see SECURITY.md for applicability.
- API production Worker dry run passed after dependency overrides. Schema generation reported 58 tables and no changes to migrate.
- Final strengthened Playwright run: **3/3 tests passed**, exit 0 (3.7m). Covers real registration/email verification/login/onboarding, project/task creation/completion, logout/login, habit logging, water tracking and Calendar data. Public/auth/legal and twelve private product pages were checked at 360/390/768/1024/1440/1920/3840px. The private sweep asserts no browser exceptions, HTTP 429 or server errors; the isolated layout harness resets only general API windows between viewport bursts. Dashboard preview was captured after actual account data loaded.

- Final monorepo TypeScript: **9/9 tasks passed**, exit 0. Tests' separate TypeScript check passed. Final root Biome check passed, exit 0, with 52 non-blocking warnings and two informational diagnostics; formatting/import organization has no errors. git diff --check passed.
- Final web normal production build (31.041s) and Cloudflare staging build (54.418s) passed sequentially, exit 0. Generated staging Worker binding points to lifesync-api-staging; preview image hash matches its source. Build configuration is apps/web/wrangler.web.jsonc; the generated deployment configuration is dist/server/wrangler.json.
- API Cloudflare Worker production/staging dry runs passed. Final production bundle is 3960.70 KiB / 714.48 KiB gzip. No live deployment occurred. Environment-specific vars still require actual HTTPS origins/provider configuration.
- Independent reviews identified and drove regression fixes for historical currencies, Calendar separation/disconnect/restore, local recurrence, per-device reminder retry, entitlements, AI confirmations/Undo, notification navigation and browser pagination. Final review additionally closed push registration/account switching and identity OAuth token encryption; callback and webhook regression tests pass.

## Remaining evidence

Native PostgreSQL multi-session testing is configured in CI but has not been observed locally. Live Google/Gemini/Resend/Turnstile/Web Push, Cloudflare staging/Hyperdrive and a measured staging backup restore require provider configuration and have not been claimed as tested. Local Web Push adapter tests cannot prove that a real browser receives a notification. Mocked OAuth exchange tests cannot prove a Google Cloud project's live configuration.

The owner confirmed that no external database/domain/Cloudflare staging is configured. The deployment guide describes a free PostgreSQL option and required provider configuration. Live integration and restore checks remain pending that setup.

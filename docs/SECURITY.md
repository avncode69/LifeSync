# Security model

## Dependency review, 2026-10-07

The current lockfile uses narrow overrides for esbuild 0.18.20 → 0.25.12, fflate 0.7.3 → 0.8.3 and sharp 0.35.4 → 0.35.5. Frozen installation succeeds. After these updates, pnpm audit reports zero critical/moderate/low findings and one high finding: [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The registry's latest braces is 3.0.3; the advisory requests 3.0.4, which was not published at this check. Do not invent a patched version or silently suppress the advisory.

braces is reached through fast-glob/micromatch in development/code generation/build tooling (shadcn and vinext dynamic import analysis). Public application endpoints do not accept glob patterns. Keep repository inputs trusted, avoid exposing development servers or code-generation tools, and recheck the registry/advisory before release. This applicability assessment is not a claim that the dependency is patched.

Every application API requires a verified server session except explicitly public health/auth endpoints. Cookies are HttpOnly, Secure in production and same-site/host-only. State changing requests enforce the configured origin. Request body and field limits reject abuse. Better Auth implements password hashing and expiring verification/reset tokens; no custom password crypto.

UUIDs do not authorize access: owner predicates and parent ownership apply to every resource query. Finance/health/private chats never have admin browsing or impersonation routes. Admin views expose safe operational metadata and audited role/entitlement operations only. Export omits hashes, sessions, provider credentials, encryption keys and internal privileged metadata.

Google OAuth identity scopes never include Calendar/Drive. Incremental Workspace credentials are separate. State is expiring/single-use, PKCE binds the callback, and token encryption uses AES-GCM with random IV and owner identity. Keep keys in Worker secrets; retain the previous decrypt key during controlled rotation and re-encrypt records before removing it.

AI sees only opt-in modules. Stored text/Drive metadata is untrusted data, never a policy authority. The model cannot issue SQL, arbitrary fetches or arbitrary tools. Server checks permission, ownership, entitlement and confirmation independently. Financial/destructive/ambiguous writes require explicit confirmation.

Logs contain request IDs and error codes without request bodies, passwords, chat/finance/health content or OAuth tokens. Private responses use no-store. Static service worker cache excludes private finance/health endpoints. Logout clears per-user cached data. Headers include CSP, frame ancestors, MIME protection, referrer/permissions policy and production HSTS.

Release requires authorization tests, dependency audit, configured anti-abuse controls, live OAuth/email/push checks and a tested staging restore. See the actual verification report for observed results; this document is a design, not proof that deployment is configured.

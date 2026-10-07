# AI

The provider-neutral AIProvider supports chat, structured responses, tool calls and streaming. Gemini uses a server-side API key sent in a header to the fixed provider origin. Provider/model selection is configuration, not a client-provided endpoint. Tests may inject a provider only in APP_ENV=test; production rejects injected test providers.

Context is constructed exclusively from owner-scoped records and opt-in module permissions. Hidden modules also stop context/tool access. Stored records are explicitly untrusted content. Independent tool authorization validates resource schema, ownership, current permissions and confirmation state; model output never chooses SQL or arbitrary network destinations.

Streaming uses SSE text/action/done/error events. Each proposed write produces a structured action card with a single-use, expiring confirmation and audit metadata. Confirm checks permissions again so revocation between suggestion and execution blocks the write. Actions support audited undo where possible. Financial mutations/destructive operations always require confirmation.

Free daily quota is three successful requests/actions, using the user's timezone day. Reservation is atomic under a PostgreSQL transaction and database update; meaningful provider completion consumes quota, empty/provider failure releases reservation. Usage metadata separates success/rejection/provider error; no prompt content in analytics. Pending requests have bounded cleanup to recover from Worker termination.

Conversations/messages expire after seven days; scheduled cleanup deletes expired content. Usage/action metadata is minimized and excludes provider credentials. Health suggestions are organizational information, never diagnosis or medical compliance claims.

Staging verification needs a configured real Gemini account; deterministic test adapters validate quota/tool policy without charging an external provider.

# Google Workspace

Identity sign-in requests OpenID/email/profile only. Workspace OAuth starts from an authenticated, verified user's Integrations page, after explaining selected Calendar and Drive access. Separate credentials and an expiring one-use state record bind user, requested scopes and PKCE verifier. Callback exchanges the code, verifies identity and encrypts tokens at application level with AES-GCM and owner-associated data.

Calendar scope: calendar.events plus calendar.calendarlist.readonly. Drive: drive.file; file metadata/linking, not document content mirroring or an editor. Link endpoints accept validated Google file IDs/Google URLs, fetch metadata from a fixed Google API URL and attach to owner-validated entities. They never fetch arbitrary user-supplied hosts.

Existing private files must first be granted to this app through Google Picker. Configure browser-public GOOGLE_PICKER_API_KEY (restricted to Picker API and the application HTTP referrers) and GOOGLE_PICKER_APP_ID (Cloud project number). The client obtains an in-memory, short-lived drive.file token through Google Identity Services with previously granted scopes excluded, then opens Picker. It never stores that token in browser storage or sends it as a URL parameter. Metadata linking still runs through the authenticated, owner-scoped server API. Select the same Google account as the connected Workspace account. A pasted URL alone does not authorize a previously unshared private file. See [Google scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) and [Picker overview](https://developers.google.com/workspace/drive/picker/guides/overview).

Calendar maps external IDs/calendar IDs/ETags to local events. Incremental sync persists the next sync token only after completing pagination. Google 410 triggers a full reconciliation; deterministic local event IDs and unique mappings prevent duplicate creation after retry. ETag preconditions protect updates. Both-sided updates after last sync produce a conflict instead of silent overwrite; the owner chooses resolution.

Watch callbacks require known channel/resource/token and replay checks. They schedule reconciliation rather than trusting event payloads. Cron renews channels before expiry and performs periodic reconciliation. The webhook URI must be public HTTPS for Google. Local development uses manual sync; watch registration cannot be verified without a reachable HTTPS staging origin.

Refresh/revocation failures mark reconnect state. Disconnect revokes credentials where possible and removes local credentials/selected integration state. Tokens are never returned by application APIs or exports. Rotation uses GOOGLE_TOKEN_PREVIOUS_ENCRYPTION_KEY only during re-encryption.

Live setup verification is separate from mock-provider mapping tests. Required staging evidence: identity login, incremental consent, create/update/delete both directions, duplicate webhook retry, conflict resolution, external permission revocation/reconnect and watch renewal.

References: https://developers.google.com/identity/protocols/oauth2/web-server ; https://developers.google.com/workspace/calendar/api/guides/sync

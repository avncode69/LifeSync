# Google sign-in and Drive

Requested: configure Google OAuth sign-in and Google Drive connection for the existing LifeSync deployment.

Reuse Better Auth identity login and the separate Workspace OAuth flow. Identity requests openid/email/profile. Drive requests drive.file, with Google Picker granting access to specific user-selected files. Calendar remains an independent opt-in.

Google Cloud project: LifeSync (silver-retina-511521-v6). Separate web clients LifeSync Sign-in and LifeSync Drive. Production origin https://lifesync.swagworld.fun. Redirects /api/auth/callback/google and /api/v1/integrations/google/callback. Branding uses the existing home/privacy/terms pages and swagworld.fun authorized domain. Google Drive and Google Picker APIs enabled; Picker key restricted to these APIs and https://lifesync.swagworld.fun/*. User approved API User Data Policy, credential creation/storage on Oracle VM, and Production audience.

Credentials stored only in Oracle env (mode 600), preserving the existing token encryption key. No plaintext credentials in source or documentation.

Fix integration UI to determine connection from status instead of retained email, default to Drive, and fetch/show Calendar controls only when Calendar is enabled.

Local verification: web TypeScript and production build passed; scoped Biome check passed with existing img warning; 7 integration library unit tests passed. Read-only browser fixture with disconnected status and retained email shows disconnected, Calendar unchecked, Drive checked, no Calendar section.

Production verification: locally built web artifact SHA-256 verified on Oracle, image update exited 0, API/jobs healthy. Public config reports Google identity, Workspace client, Picker key/project configured; /_health responds ok. Better Auth social initiation returns accounts.google.com with the correct identity client and /api/auth/callback/google redirect. Existing avn.hwl@gmail.com Workspace connection displays connected. User completed the Google token popup; the Drive Picker opened and displayed files. No file link was created during verification. A full new-account Google sign-in and saving a selected file to a specific LifeSync record were not exercised.

Calendar follow-up (2026-10-14): the connection had both Calendar scopes, but Calendar API was disabled in the Cloud project. A redacted provider diagnostic confirmed HTTP 403 / SERVICE_DISABLED / calendar-json.googleapis.com. Enabled Google Calendar API without changing account grants or credentials. Fresh production integration page successfully loaded three available calendars with no error state. No calendar was automatically selected for synchronization.

# Glass login

Scope: redesign standalone /login around the supplied centered glass-card reference. Preserve authentication, validation, recovery links and embedded homepage registration.

1. Add scoped neutral background, soft light, glass card and white primary action; localize supporting copy.
2. Check TypeScript, production build, scoped lint and browser rendering, both themes and empty-form validation.
3. Publish to GitHub and Oracle, then verify the live login and API health.

Local verification: TypeScript and production build passed. Scoped Biome lint passed with two existing reduced-motion warnings. Dark/light browser rendering and empty-form field errors verified. A 651px-wide browser view had no horizontal overflow. Development mode has a React useContext runtime error; production rendering passed.

Follow-up: use the supplied LS PNG unchanged for shared branding, the login card, browser icon and PWA/notification icons. Bump the offline shell cache for the new asset.

Publication: commits 960aa06 and 6679b31 pushed and deployed on Oracle. Both server builds returned exit 0. Live login rendered the card and loaded the supplied logo; browser icon points at it. Empty-form validation checked live. Public homepage header/footer logos loaded and embedded registration retained its layout. API health returned ok; API, jobs and database containers healthy. Login with real credentials and PWA installation were not exercised.

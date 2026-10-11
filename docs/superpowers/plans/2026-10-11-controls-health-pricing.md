# LifeSync controls, wellbeing route and pricing

User requests: styled dropdown/date controls consistent with the neutral dark theme;
restore the wellbeing page; pricing cards based on the supplied tall-card reference.

- [x] Replace native dropdowns and date pickers through reusable LifeSync wrappers, keeping form values, localization and keyboard operation.
- [x] Fix Oracle Caddy route collision: /health serves the web page; /_health probes the API. Internal container probes stay unchanged.
- [x] Redesign Free/Pro comparison with actual features and truthful administrator-granted Pro state.
- [x] Typecheck, scoped lint, relevant tests, production build and browser interaction checks; independent review.
- [ ] Push, deploy to the existing Oracle VM and verify public wellbeing HTML, probe JSON, controls and pricing.

Ownership: controls agent owns LifeSync controls and CSS; pricing agent owns public.tsx and pricing translations; root owns Caddy routing, integration and deployment.

Additional authorized scope: two-column homepage with the existing registration form embedded on the right (user confirmed), complete Ukrainian terms/privacy/security documents naming Premiere, and a flex layout placing the public footer at the viewport bottom on short pages.

Verification on final sources: all 9 package typechecks passed; 85 existing unit tests and 13 targeted date-control tests passed; production web build and scoped Biome lint passed. Browser checks covered dropdown styling, date change, nested hour selection in task modal, pricing layout and wellbeing UI. Independent controls/public/auth/legal review completed; the missing AI history seven-day retention was added after review. No production registration or private records were created by these checks. Mobile viewport emulation was unavailable; mobile layout still requires a real-device check.

Routing commit e7bbc0c was deployed and verified: /health renders the application and /_health returns API probe JSON. Remaining frontend deployment requires renewing the expired Oracle browser session.

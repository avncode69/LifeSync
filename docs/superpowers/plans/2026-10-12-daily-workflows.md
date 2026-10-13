# Everyday workflows

User brief: make dashboard, calendar, habits, nutrition and finance comfortable; hide Drive links in module screens; move Google connection into profile; separate profile/personalization/settings; retain session on public pricing/login navigation.

Owners: dashboard/calendar agent owns those components; nutrition/finance agent owns finance-health and meal UI; settings agent owns settings/shell/profile menu/routes; root owns habits, shared resource refresh, removing other Drive panels, public auth continuity and i18n.

Design: compact daily overview with useful empty CTAs; full-cell calendar creation keeps event editing; habits have three tabs. Health groups nutrition/water/body/workouts, meal-first food entry. Finance has transactions/planning/accounts with secondary choices. Distinct account screens keep existing API/actions. Session detection returns signed-in users to dashboard instead of presenting another login.

Checks: inspect contracts first, targeted business-logic tests where applicable; TypeScript, scoped lint, production build; browser empty/data states, navigation, session reuse, narrow/wide pages, calendar clicked date. Review before GitHub/Oracle publication; production private records remain untouched during verification.

Additional user steering: shared site-styled palette replaces native color input for all existing color fields. Add optional validated color to calendar events via additive migration; preserve recurrence/occurrence colors. Publish API after migration, then web/jobs. Existing record data remains unchanged.

Local verification: web/API/database TypeScript passed; 120 unit tests and 3 isolated integration tests passed. Final production build passed. Browser checked compact dashboard, 375px finance layout, three keyboard-switchable habit tabs, isolated profile/personalization fields, meal portions default 100g, selected calendar day with exclusive next end date, palette with no native color inputs, and pricing/account login redirect using an existing session. Independent reviews fixed shared widget defaults, Google status, stored optional nulls and scoped meal filters. No production data mutations used in UI tests.

Publication: e4d7bb4 deployed to Oracle successfully (deploy exit 0); API and jobs reported healthy on 2026-10-14. Follow-up 9624dc9 is included in the Google integration deployment.

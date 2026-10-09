# Restore the original LifeSync style

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the visual identity of `D:/.fq/фронт` across the hosted LifeSync application, as requested by the owner.

**Architecture:** Keep the existing authenticated API, resources, navigation, preferences and dashboard customization. Port the original theme, typography, ambient background and compact glass surfaces into shared CSS. Adjust the shell and dashboard composition using the existing components; do not replace working features with the old prototype's local storage or sample data.

**Tech stack:** React 19, vinext, TypeScript, Tailwind 4, pnpm; existing local UI wrappers.

**Reference:** `D:/.fq/фронт/src/index.css`, `src/context/ThemeContext.tsx`, `src/components/{Sidebar,Header,Dashboard}.tsx`; user instruction to match source style.

## Constraints and review focus

- Preserve real data, authentication and all enabled modules, including admin.
- Match the original color values explicitly requested by the user; support light and dark themes.
- Do not modify shared primitive components under `components/ui`.
- Use locally served fonts so typography does not depend on a third-party font service at runtime.
- Preserve widget visibility, order and sizes; avoid giant empty cards.
- Keep Russian/English/Ukrainian text, mobile navigation, keyboard search and dialog focus usable.

## Tasks

- [x] Restore original tokens, Outfit/Inter fonts, glass surfaces and ambient background in `globals.css`, plus logo styling in `public.tsx`.
- [x] Match the original sidebar/header density in `shell.tsx`, retaining all routes, account controls, unread notifications and search.
- [x] Restore dashboard visual hierarchy and compact card contents in `dashboard.tsx`; retain customization and existing data contracts.
- [x] Check types, lint, production CSS/build, desktop/mobile and dark/light screenshots; obtain independent review.
- [ ] Commit and push the verified change to the existing repository; rebuild and restart only app services on Oracle; verify the live result.

## Execution notes

- The current working tree was clean before this task.
- The old screenshot supplied by the user is a visual problem report; the actual reference is the original source in `D:/.fq`.
- The repository's template AGENTS mentions npm and no tests, but the actual monorepo is pnpm with scripts. Follow the actual manifests and parent AW verification instructions.
- A shadcn skill was not present in the installed skill catalog or filesystem search. Preserve the existing wrappers and apply styling at usage sites; no component generation or dependency changes are needed.

- Verification: web TypeScript check passed; production build passed; scoped Biome check has no errors (the existing raw image performance advisory remains).
- Browser: actual fonts Inter/Outfit and 1280px desktop / 390px mobile dark dashboard inspected, without horizontal overflow; light desktop theme inspected. Header theme reset reproduced and corrected by applying each fetched preference object only once.
- Independent review: contrast, responsive header shrink and saved greeting widget size corrected. Saved widget order retained. Defaults now place tasks and capture first.
- Preview uses local demonstration fixtures solely to capture the real UI, not production data or API configuration. Fixtures remain ignored under .local.

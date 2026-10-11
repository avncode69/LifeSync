# Tables, account menu and controls

User references define the existing UI changes; keep the neutral dark theme and functional APIs.

1. Tasks owner: tasks.tsx and task helpers. Replace list cards with filterable paginated table; retain editor, completion, deletion and kanban. Remove parent/subtask UI.
2. Admin owner: operations.tsx Admin section and admin helpers. Searchable user table with real role, plan, email verification, disabled state and joined date; retain authorized plan/account actions.
3. Shell owner: shell.tsx and account menu. Move settings/trash to account dropdown, admin link to upper-right, preserve mobile access and logout.
4. Root: resource editor hides parent task relations, removes duplicate empty priority choice; select focus styling keeps readable text; display UA without changing uk locale. Own i18n integration.
5. Verify TypeScript, relevant tests, build, keyboard/dropdown and table behavior locally; independent review, then publish GitHub and Oracle and verify public runtime. No private production data mutations for testing.

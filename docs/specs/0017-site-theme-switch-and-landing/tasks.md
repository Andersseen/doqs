# Tasks — 0017 site theme switch and landing

- [x] T-001 [REQ-001, AC-001] Replace the header's icon button with the `app-theme-toggle` atom whose state is CSS-driven by `.dark`; add E2E-035.
- [x] T-002 [REQ-002, AC-002] Serialise the client and SSR environment builds in `apps/site/vite.config.ts`; add CONTRACT-035 and repeat builds to confirm.
- [x] T-003 [REQ-003, AC-003] Redesign the landing with Volt atoms, new site atoms and Angular Movement; keep COMP-020 and E2E-030/033 passing, fix mobile overflow.
- [x] T-004 [REQ-004, AC-004] Freeze CSS transitions while the theme changes; make the E2E theme checks wait for `.dark` instead of racing the view transition.

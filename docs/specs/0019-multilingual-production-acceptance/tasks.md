# Tasks — 0019 multilingual production acceptance

<!-- Format: - [ ] T-001 [REQ-001, AC-001] concrete, finishable step. Every requirement needs at least one task. -->

- [x] T-001 [REQ-001, AC-001] Add a compact English/Spanish/Arabic current-version fixture, a Spanish archive, explicit direction and canonical origin in Showcase A while preserving all existing English files.
- [x] T-002 [REQ-002, AC-002] Add a reactive URL-derived host adapter and browser cases for locale switching, missing translations and absent locale/version combinations.
- [x] T-003 [REQ-003, AC-003] Add Playwright assertions against the built Showcase A Pagefind index for locale/version results and untranslated content isolation.
- [x] T-004 [REQ-004, AC-004] Assert rendered localized metadata, RTL direction, hydration-visible content and single-prefix routes in browser acceptance.
- [x] T-005 [REQ-005, AC-005] Add sticky TOC and sidebar geometry assertions plus internal overflow and horizontal overflow checks.
- [x] T-006 [REQ-006, AC-006] Run an actual Analog SSR HTTP server and record known, missing, localized-missing and delegated host route status results, including the 200-status limitation.
- [x] T-007 [REQ-007, AC-007] Add official and package documentation; record the 0015 revalidation, public API, static checks and remaining release blockers.
- [x] T-008 [REQ-003, REQ-006, AC-003, AC-006] Integrate new multilingual checks into CI and complete real packed-consumer verification; record external adoption failures caused by upstream consumer drift.

# Tasks — 0021 browser accessibility hardening

<!-- Format: - [ ] T-001 [REQ-001, AC-001] concrete, finishable step. Every requirement needs at least one task. -->

- [x] T-001 [REQ-001, AC-001] Use the Playwright 1.64.1 maintained Linux image for the Firefox/WebKit job and keep its browser launch and journey failures fatal.
- [x] T-002 [REQ-002, AC-002] Add focused Windows Chromium production-browser acceptance and trace upload in CI extended.
- [x] T-003 [REQ-003, REQ-004, AC-003] Audit existing journeys and axe states; add only missing regressions, confirm failures before fixes, and implement minimal UI corrections.
- [x] T-004 [REQ-005, AC-004] Verify permissions, caching, timeouts and the current CI performance budget.
- [x] T-005 [REQ-006, AC-005] Document platform evidence, manual VoiceOver/NVDA protocol, release decision and remaining 1.0 blockers.
- [ ] T-006 [REQ-001, REQ-002, REQ-003, REQ-005, AC-001, AC-002, AC-004] Run local supported checks, trigger extended GitHub Actions, inspect results, and record exact evidence and unavailable checks.

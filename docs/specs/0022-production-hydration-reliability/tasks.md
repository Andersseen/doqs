# Tasks — 0022 production hydration reliability

- [x] T-001 [REQ-004, REQ-006, AC-004, AC-008] Reproduce the failure, compare Analog 2.9.0/2.9.1/2.9.2 and a Doqs-free host, force the race deterministically, classify it.
- [x] T-002 [REQ-004, AC-004] Add the `build.aot` finding to `doq doctor --build` with unit tests for PASS, FAIL and WARN.
- [x] T-003 [REQ-004, REQ-005, AC-005] Add `assertAotBuild()` and call it from the consumer and adoption build scripts.
- [x] T-004 [REQ-001, REQ-002, REQ-003, REQ-005, AC-001, AC-002, AC-003, AC-006, AC-007] Extend the initialized-consumer E2E to three cells with hydration, navigation, history and Pagefind assertions; add the Angular 22 consumer to the E2E launcher and Playwright config.
- [x] T-005 [REQ-004, AC-004] Show that the new E2E fails against the preserved broken build.
- [ ] T-006 [REQ-006, AC-008] Update the changelog, readme, readiness record, contributor and onboarding documentation with verified versions and the three kinds of success.
- [ ] T-007 [REQ-007, AC-009] Run public API, performance and bundle-impact checks and bump the package to 0.13.0 with its API reports.
- [ ] T-008 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007] Run the full verification, the pinned adoption proofs and open the pull request.

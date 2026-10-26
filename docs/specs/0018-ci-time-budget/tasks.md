# Tasks — 0018 CI time budget

- [x] T-001 [REQ-001, AC-001] Lower every `ci.yml` job timeout to 10–20 minutes.
- [x] T-002 [REQ-002, AC-002] Add the `playwright-browsers` composite action (cache, man-db skip, bounded retries) and use it in both workflows.
- [x] T-003 [REQ-003, AC-003] Remove `needs: build` from `acceptance`, `determinism`, `compat` and `scale`.
- [x] T-004 [REQ-004, AC-004] Move the Firefox/WebKit job to `ci-extended.yml` (weekly, manual, `full-ci` label) and document it.
- [x] T-005 [REQ-001, REQ-002, REQ-003, REQ-004] Add UNIT-177..180 and confirm it fails against the previous workflow.
- [x] T-006 [REQ-005, AC-005] Kill and clean up Chrome when harness startup fails, detect an early exit, wait up to 60 s for a cold start; add UNIT-181/182.

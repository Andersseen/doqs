# Tasks — 0020 adoption release readiness

- [x] T-001 [REQ-004, AC-004] Add `scripts/adoption-lib.ts` (pinned/overridable upstream, SHA-verified checkout, disposable-directory guard, stdin-closed runner) and move the three scripts onto it.
- [x] T-002 [REQ-001, AC-001] Pin the legacy onboarding and route proofs to the pre-integration Angular Movement SHA and run them.
- [x] T-003 [REQ-002, AC-002, AC-008] Add `adoption-existing` (script, spec, Playwright server, package script) and teach `docs:check` and the preview server the `x.html` layout.
- [x] T-004 [REQ-003, AC-003] Reproduce the Volt UI prerender error against an unmodified control, classify it in the harness and pin the revision.
- [x] T-005 [REQ-004, AC-004] Add the isolated `external-adoption` job to `ci-extended.yml`.
- [x] T-006 [REQ-005, AC-005] Run the packed-package, public API, determinism, portability, compat and performance checks on the final tarball.
- [x] T-007 [REQ-006, AC-006] Reproduce the Analog SSR status limitation and update readiness, adoption, README, changelog and site docs.
- [x] T-008 [REQ-007, AC-007] Raise the version to 0.12.0, rerun the gate on the versioned artifact and record the release decision.

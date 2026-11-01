# Verification — 0023 in place document hydration

<!-- Update only with commands actually run. Record PASS / FAIL / NOT RUN / BLOCKED. -->

## Baseline

| Check                                       | Result | Evidence                                                                                                                                                                                                                                                |
| ------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local branch based on current `origin/main` | PASS   | `36079b48259fb0d82080a002b1ab2e38193f4dc4`; clean at start                                                                                                                                                                                              |
| PR #39 merged; main CI                      | PASS   | GitHub PR #39 merged; CI run `41037349905` succeeded                                                                                                                                                                                                    |
| 0.13.0 release                              | PASS   | Release run `41038440235` attempt 2: release eligibility, Trusted Publishing and GitHub Release succeeded; `npm view` confirms 0.13.0 is published and `latest`.                                                                                        |
| DOM replacement baseline                    | PASS   | Before the fix, Chromium captured `removed=["MAIN"]` on `/docs/installation` (showcase A), `/guides/sdk/quickstart` (showcase B) and `/docs/operations/troubleshooting` (official site). The marker check still passed and final markup looked correct. |

## Test cases

| Case         | Acceptance                     | Check                                                                                                                                                                                         | Result |
| ------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| E2E-102      | AC-001, AC-002, AC-008         | Identity of prerendered root/article/heading; negative control rejects recreated root; no loading placeholder, consumed markers, clean Chromium console on showcase, site, locale and archive | PASS   |
| E2E-101      | AC-002, AC-003, AC-005         | Packed Angular 21 embedded/docs-first and Angular 22 embedded direct hydration, document navigation, Back/Forward, focus, unknown `/about` state, one h1/root and no console errors           | PASS   |
| COMP-070     | AC-004                         | No-fallback versus configured default-locale fallback component behavior                                                                                                                      | PASS   |
| E2E-164      | AC-004                         | Complete multilingual and missing-translation browser journeys                                                                                                                                | PASS   |
| E2E-110      | AC-003, AC-004, AC-005, AC-006 | TOC/fragments, version combinations, host routing, metadata and interactive Markdown journeys                                                                                                 | PASS   |
| CONTRACT-001 | AC-007                         | Packed Angular 21/22 initialized consumers and public API verification                                                                                                                        | PASS   |
| E2E-133      | AC-008                         | Deterministic heading identity and performance, bundle, accessibility budgets                                                                                                                 | PASS   |

## Executed commands

- `git fetch origin --prune --tags` → PASS; `main` and `origin/main` both `36079b48259fb0d82080a002b1ab2e38193f4dc4`.
- `pnpm --filter @doqs/analog build` → PASS.
- `pnpm typecheck:scripts` → PASS.
- `pnpm --filter @doqs/analog test:components` → PASS (196 tests).
- `pnpm --filter showcase-a build`, `pnpm --filter showcase-b build`, `pnpm --filter site build` → PASS, sequential; no new upstream build-race mitigation.
- `PW_CHANNEL=chrome pnpm exec playwright test e2e/document-hydration.spec.ts --project=chromium --workers=1` → PASS (initial implementation, 4 tests).
- `pnpm pack:doq` → PASS (`artifacts/doqs-analog-0.14.0.tgz`, built from current source).
- `pnpm verify:init` → PASS on 0.13 source packaging earlier; the final 0.14.0 packed matrix is running after the version bump.
- `PW_CHANNEL=chrome pnpm exec playwright test e2e/consumer-init.spec.ts e2e/document-hydration.spec.ts --project=chromium --workers=1` → PASS (15 tests after locale/archive cases were added).
- `pnpm format:check` → PASS.
- `pnpm sdd:check` → PASS (23 specs structurally valid).
- `pnpm verify:public-api` → PASS on 0.14.0 (228 exports across six entry points; compatible with 0.7.0).
- `pnpm bundle:impact --check` → PASS. Landing initial JavaScript 109,952 B (main) / 109,955 B (config); documentation initial JavaScript same; total delta 6 B gzip. Config entry imports only `@angular/core` and loads in plain Node. The pre-existing root-entry plain-Node JIT limitation remains.
- `pnpm perf:check` → PASS; initial/all JS and CSS budgets remain within limits for all three production sites.
- `pnpm api:check`, `pnpm content:check`, `pnpm agentyx:check`, `pnpm docs:check`, `pnpm verify:negative-controls` → PASS.
- `npm view @doqs/analog versions dist-tags --json` → PASS: 0.13.0 is published; latest is 0.13.0.
- GitHub Release run `41038440235` attempt 1 → failed at npm transparency-log creation (`TLOG_CREATE_ENTRY_ERROR`, 409). Retried through GitHub Actions; attempt 2 succeeded for Trusted Publishing and GitHub Release. No direct publish was run.

- `PW_CHANNEL=chrome pnpm verify:change` → PASS (exit 0): format, types, SDD, API/content checks, Agentyx lock, unit (567), components (196), builds, package and contract tests. `DETECTED` lines in its log are the intentional negative controls.
- `PW_CHANNEL=chrome pnpm test:e2e` (Chromium, full suite, 267 tests) → PASS (exit 0). This covers E2E-164 (multilingual), E2E-110 (versions, TOC, playgrounds) and E2E-133 (determinism). The `ELIFECYCLE` lines in its log come from fixtures that deliberately check stale-content detection.
- `pnpm quality:gate` (tarball consumer, CDP harness) → NOT RUN locally; left to hosted CI.

The broad CI gate, external adoption checks, VoiceOver/Safari and NVDA/Windows must each be reported separately; do not infer them from related checks.

## Remaining limitations

Keep the upstream Analog build-race, live SSR 404, expanded playground overlay, and untested assistive-technology limitations separate from this fix. Full quality gate and external adoption proof results are pending; no 1.0 readiness claim is made.

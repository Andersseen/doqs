# Verification — 0022 production hydration reliability

<!-- Written after running the tests. A case is PASS only when you ran it and read the result. -->

## Test cases

<!-- Row format: | <KIND>-NNN | AC ids | what it checks | PASS / FAIL / NOT RUN |
     KIND is UNIT, COMP, E2E, CONTRACT, SDD or MANUAL. Non-MANUAL ids must appear in a test source file. -->

| Case       | Acceptance                                     | Checks                                                                                                                       | Result  |
| ---------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------- |
| UNIT-074   | AC-004                                         | `doq doctor --build` `build.aot`: PASS on a clean build, FAIL naming the file, WARN when the compiler is bundled on purpose  | PASS    |
| UNIT-183   | AC-005                                         | `assertAotBuild` accepts a clean build, stops a JIT-dependent one naming the file, never treats an unreadable report as pass | PASS    |
| E2E-101    | AC-001, AC-002, AC-003, AC-006, AC-007         | Initialized consumers (21 embedded, 21 docs-first, 22 embedded) in Chrome: hydration, navigation, Back/Forward, no Pagefind  | PASS    |
| MANUAL-001 | AC-004                                         | The same E2E against the preserved broken build fails with the browser's `JIT compiler unavailable` (3 of 3 embedded tests)  | PASS    |
| MANUAL-002 | AC-008                                         | Analog 2.9.0/2.9.1/2.9.2 and Doqs-free comparison, deterministic repro (design.md); docs updated                             | PASS    |
| MANUAL-003 | AC-009                                         | `verify:public-api`, `perf:check`, `bundle:impact --check` (see commands)                                                    | PASS    |
| SDD-001    | AC-001, AC-002, AC-003, AC-005, AC-006, AC-007 | `pnpm sdd:check`                                                                                                             | PASS    |
| MANUAL-004 | AC-006                                         | VoiceOver/Safari and NVDA sessions                                                                                           | NOT RUN |

## Executed commands

Baseline: `git fetch origin --prune --tags`; local `main` = `origin/main` = `f9f3ff566660bdfffeaa781dd6df73090a313f10`; main CI, Release and Deploy site green for #30; npm and GitHub serve 0.12.0; open PRs #31, #33, #34 are Dependabot bumps with no overlap. Branch `feat/doqs-0.13-hydration-onboarding`. Installed: Angular 21.2.25, `@analogjs/*` 2.9.2, `@angular/build` 21.2.28/21.2.29, Vite 8.3.5; the Angular 22 cell resolved `^22.0.0`.

Reproduction (Phase 2–4), all from the 0.12.0 tarball: the leftover consumer from the failing 0021 run reproduced the failure with `PW_CHANNEL=chrome pnpm exec playwright test e2e/consumer-init.spec.ts`; its `dist` held decorator output for `index.page` and Angular's JIT-unavailable path. Clean rebuilds of identical sources: 6/6 correct, plus two in that directory. Parallel builds (3 per round, JIT path counted in client output): 2.9.2 first run 2/6 then 2/24; 2.9.0 2/24; 2.9.1 3/24; Angular 22 1/7; Doqs-free bare host 0/30; bare host with the client page transform delayed past SSR 3/3; with `fastCompile: true` 0/1; with `experimental.useAngularCompilationAPI` build error TS5103. No warning in any bad build's log; exit code 0.

Checks on the final tree (macOS, `PW_CHANNEL=chrome`, sequential): `pnpm install --frozen-lockfile` PASS. `pnpm format:check` PASS. `pnpm typecheck:scripts` PASS. `pnpm api:check` PASS. `pnpm content:check` PASS. `pnpm agentyx:check` PASS. `pnpm test:unit` PASS (565). `pnpm test:components` PASS (196 + 27). `pnpm build` PASS. `pnpm docs:check` PASS. `pnpm perf:check` PASS. `pnpm pack:doq` PASS (`doqs-analog-0.13.0.tgz`). `pnpm verify:public-api` PASS (228 exports, compatible with 0.7.0; the report differs only in its version). `pnpm test:contract` PASS (128). `pnpm verify:negative-controls` PASS. `pnpm consumer:build` PASS. `pnpm verify:init` PASS. `pnpm test:e2e` PASS (260). `pnpm test:e2e:browsers` PASS (341). `pnpm verify:mvp` PASS (17/0, `MVP_CONSUMER_ROOT` set to the E2E consumer). `pnpm verify:portable` PASS. `pnpm verify:compat --angular=21` PASS (7/7). `pnpm verify:compat --angular=22` PASS (7/7). `pnpm bundle:impact --check` PASS (config entry imports only Angular core; the root entry's plain-Node JIT limitation is the expected, pre-existing one). `pnpm perf:scale --sizes=20,200 --navigations=0 --check` PASS (53 B gzip per document, budget 70). `pnpm verify:determinism --builds=5 --docs=60` PASS; `--builds=3 --docs=60 --control` PASS (the unguarded build is detected).

A first chained run passed `verify:compat`, `bundle:impact`, `perf:scale` and `verify:determinism` as a single quoted argument, which pnpm rejected (exit 254); those are not results. They were rerun with separate arguments, as listed above.

Pinned adoption (disposable checkouts under the OS temp dir; no external repository changed): `pnpm verify:adoption` PASS (26) at Angular Movement `4e71e2f75be3c82ec4f10ca80dc91d08562efa1b`; `verify:adoption:routes` PASS (14) at the same SHA; `verify:adoption:existing` PASS (120) at `ce9b03d547bc774268768e5f57c028452e70b9ad` with `@doqs/analog` 0.13.0; `verify:adoption:volt` PASS (18) at Volt UI `7c76ef3b8aa6e3d6c4da578b0be22939556d53af`. The first run of three of them failed in their own post-integration `doq doctor` check, `@analogjs/content` 2.9.1 does not satisfy `^2.9.2`: the pinned revisions predate the peer floor raised by PR #30, so this is pre-existing and not caused by 0.13.0. The scripts now apply doctor's own fix (`@analogjs/content@^2.9.2`) in the disposable checkout; the peer range is unchanged.

`PW_CHANNEL=chrome pnpm verify:change` PASS (exit 0). `PW_CHANNEL=chrome pnpm quality:gate --adoption` PASS (exit 0), one uninterrupted run on the final tree including the four pinned adoption proofs. Hosted CI results are in the pull request.

## Remaining limitations

- **Upstream, open:** the Analog build race is detected, not prevented. The shared-state explanation is supported by the forced repro and by reading `@analogjs/vite-plugin-angular`; it was not confirmed against the plugin's own debug output and no upstream issue was filed from here. Doqs-free parallel builds did not fail in 30 attempts, so the failure rate depends on load and build duration.
- **Doqs, open:** documentation pages are re-rendered on the client instead of hydrated in place; recorded in design.md and the readiness record, asserted by E2E-101 as a known limitation, not fixed.
- Angular 22 docs-first was not added: its generated code and routes are identical to the Angular 21 docs-first cell, and no compatibility difference was observed.
- Analog 2.9.0 and 2.9.1 were built only as diagnostics; `doq doctor` rejects them by design. Analog above 2.9, Vite < 8 and Zone.js on Angular 22 remain unverified.
- Firefox and WebKit ran only the existing cross-browser specs (`test:e2e:browsers`); the new initialized-consumer cells are Chromium-only. Windows was not run locally. VoiceOver/Safari and NVDA are NOT RUN.
- The dev-server SSR 404 limitation (Analog ignores `RESPONSE_INIT`) is unchanged and unresolved; expanded playground overlays are unchanged.

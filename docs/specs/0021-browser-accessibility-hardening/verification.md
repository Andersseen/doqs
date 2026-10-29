# Verification — 0021 browser accessibility hardening

<!-- Written after running the tests. A case is PASS only when you ran it and read the result. -->

## Test cases

<!-- Row format: | <KIND>-NNN | AC ids | what it checks | PASS / FAIL / NOT RUN |
     KIND is UNIT, COMP, E2E, CONTRACT, SDD or MANUAL. Non-MANUAL ids must appear in a test source file. -->

| Case       | Acceptance     | Checks                                                                                                        | Result  |
| ---------- | -------------- | ------------------------------------------------------------------------------------------------------------- | ------- |
| E2E-021    | AC-002, AC-003 | Five focused production journeys in macOS Chrome and hosted Windows Chromium                                  | PASS    |
| E2E-164    | AC-001, AC-003 | Firefox/WebKit keyboard, focus, RTL, hydration and axe journeys on macOS and in hosted Linux Playwright image | PASS    |
| E2E-130    | AC-003         | Reduced-motion style assertions wait for the hydrated region; regression evidence below                       | PASS    |
| SDD-001    | AC-004         | `pnpm sdd:check`; read-only permissions and fixed workflow timeouts                                           | PASS    |
| MANUAL-001 | AC-005         | VoiceOver and Safari protocol/session                                                                         | NOT RUN |
| MANUAL-002 | AC-005         | NVDA and supported Windows browser protocol/session                                                           | NOT RUN |

## Executed commands

Baseline: `git fetch origin --prune --tags` PASS. `origin/main` was `dd636dc7ecfa1434a3a8fa4e5c94334079f94709`; clean and synchronized before branch creation. The release audit confirmed GitHub v0.12.0, npm `@doqs/analog@0.12.0`, `latest=0.12.0`, and successful #37 CI, release and deploy workflows. Four unrelated Dependabot PRs are open.

`pnpm install --frozen-lockfile` PASS. `pnpm verify:change` PASS: format, script types, SDD, API/content checks, Agentyx, 561 unit tests, 223 component tests, builds, docs/perf checks, package validation, 228-export public API, 128 contract tests, negative controls and package gate. `pnpm build && pnpm pack:doq` PASS; artifact remains 0.12.0. `pnpm typecheck:scripts` PASS.

`E2E_WINDOWS_ACCEPTANCE=1 PW_CHANNEL=chrome pnpm test:e2e --skip-consumer e2e/windows-browser.spec.ts` PASS (5/5) on macOS Chrome; this is not Windows evidence. `PW_CHANNEL=chrome pnpm test:e2e:browsers --skip-consumer` PASS (319 passed, 7 skipped) on macOS in 1.5 minutes. Axe serious/critical checks ran as part of these suites.

The first hosted Windows run built the package and installed Chromium, then exited before Playwright printed its runner output. The cause was `scripts/e2e.ts` spawning the `pnpm` `.CMD` shim with Node's non-shell `spawnSync`. It now invokes pnpm's `npm_execpath` through `process.execPath`; all five journeys pass on the refreshed hosted Windows runner.

The first Linux image run launched WebKit and passed 170 journeys, but Firefox could not launch because the job container ran as root and `CanCreateUserNamespace()` returned EPERM (171 Firefox launch failures). The container now runs as UID 1001, matching Playwright's maintained image CI usage. The final hosted run passes 341 Firefox/WebKit journeys (one skipped) in 5.1 minutes.

The first `PW_CHANNEL=chrome pnpm quality:gate` reached full Chromium E2E (253 passed, 1 failed): the existing reduced-motion test evaluated `.doq-root` before hydration added it. The failure was captured in `test-results/hardening-E2E-130-reader-e-9f907-from-documentation-controls-chromium/error-context.md`; the test now waits for the root to be visible before reading computed styles, and `PW_CHANNEL=chrome pnpm test:e2e --skip-consumer e2e/hardening.spec.ts` passes (7/7).

The second `PW_CHANNEL=chrome pnpm quality:gate` reached full Chromium E2E and stopped at an existing packed initialized-consumer journey (253 passed, 1 failed). The home page's prerendered heading did not hydrate because its lazy chunk threw Angular's `JIT compiler unavailable` exception (`test-results/consumer-init-E2E-101-newl-8a4fa-the-generated-starter-pages-chromium/error-context.md`). `pnpm verify:init` itself passes; targeted `pnpm test:e2e e2e/consumer-init.spec.ts` reproduces the failure in local Chrome. This blocks calling the local full gate green. Later quality-gate steps, including determinism, compatibility, MVP, portability, bundle impact and adoption proofs, were not reached.

## Remaining limitations

Remaining gates were then run directly. `pnpm perf:scale --sizes=20,200 --navigations=0 --check` PASS (initial JS grows 53 B gzip/document; budget 70 B). `pnpm verify:determinism --builds=5 --docs=60` PASS (5 builds, one fingerprint, zero docs-check failures); `pnpm verify:determinism --builds=3 --docs=60 --control` PASS as a negative control (all three deliberately unguarded builds were detected). `pnpm verify:portable` PASS (6 checks). `pnpm bundle:impact --check` PASS (13 B gzip delta; config entry imports only Angular core; root entry's plain Node JIT limitation is expected).

Pinned adoption: `PW_CHANNEL=chrome pnpm verify:adoption` PASS (26/26); the first run's browser-process-closed errors did not reproduce when using installed Chrome. `PW_CHANNEL=chrome pnpm verify:adoption:routes` PASS (14/14); `PW_CHANNEL=chrome pnpm verify:adoption:existing` PASS (120/120 against the recorded checkout); `PW_CHANNEL=chrome pnpm verify:adoption:volt` PASS (18/18). Angular compatibility commands were initially overlapped and failed in the browser phase with Chromium `icudtl.dat not found`/closed-page errors; NOT PASS. The initial Angular 21 and Angular 22 runs collided on port 4290; those results are invalid as product results. Sequential Chrome reruns: `PW_CHANNEL=chrome pnpm verify:compat --angular=21` PASS (7/7) and `PW_CHANNEL=chrome pnpm verify:compat --angular=22` PASS (7/7).

`MVP_CONSUMER_ROOT=/private/var/folders/ts/f4hpy9v97b5gj4llxm_wl55r0000gn/T/doq-e2e-consumer/dist/analog/public pnpm verify:mvp` PASS (17/0) when run with loopback binding permission. Two earlier attempts without that permission timed out waiting for the local preview server; they were sandbox failures, not product results.

Hosted final commit (`6c09a1e`) checks: standard CI run 97 PASS, including full Chromium E2E, MVP/CDP, Angular 21/22 compatibility, determinism, contracts and Windows tooling. Extended CI run 43 PASS: Windows Chromium 5/5; Linux Firefox/WebKit 341 passed, 1 skipped; pinned adoption proofs all passed (Angular Movement onboarding, routes, integrated checkout and Volt UI 18/18).

Hosted Windows Chromium and Linux Firefox/WebKit checks pass. VoiceOver/NVDA remain NOT RUN; automated axe/Playwright checks do not replace those sessions. No package version bump is justified for CI and test-harness changes alone. No publication, tag or deploy was made.

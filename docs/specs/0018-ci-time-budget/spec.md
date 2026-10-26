# 0018 — CI time budget

## Problem

Pull request CI regularly took 40–50 minutes although the checks themselves finish in about 10. Job timings from the Actions API:

- Run 40320533784 (PR, 2026-10-26): every job finished within 9 minutes except **Playwright cross-browser (Firefox, WebKit)**, whose `playwright install --with-deps firefox webkit` step stalled for 45 minutes until the job timeout cancelled it. Nothing had been tested.
- Run 40323956067 (push to `main`): `playwright install --with-deps chromium` in **Angular 21 compatibility** took 11.5 minutes (21 s in the same run's Angular 22 job), which held the whole run (and so the release and site deploy, which wait for CI) to 14 minutes.
- Run 40340288399 (PR #27): the cross-browser job again ran past 40 minutes in its install step.

The browsers were downloaded again in every job, the install step had no bound of its own, and four jobs that build their own package still waited for the `build` job.

## Consumer impact

None. Only repository workflows and their tests change; the package, its contract and the published tarball are untouched.

## Scope

- A composite action `.github/actions/playwright-browsers` that caches the browsers per Playwright version, skips the runner's man-db rebuild and retries a bounded (7-minute) install up to three times.
- `ci.yml`: `acceptance`, `determinism`, `compat` and `scale` start without `needs: build` (none of them downloads its artifact); every job timeout is lowered to what it needs (10–20 minutes).
- The Firefox/WebKit matrix moves to a new `ci-extended.yml` workflow: weekly on `main` (Monday 04:17 UTC), on demand (`workflow_dispatch`) and on pull requests labelled `full-ci`.

- The CDP harness (`scripts/verification/lib/chrome.ts`) cleans up a Chrome that failed to start. The first run of this change (run 40349223219) showed why: the runner's Chrome did not write `DevToolsActivePort` within 15 s, the harness reported `0 PASS / 1 FAIL`, and the spawned Chrome kept Node alive until the new 20-minute timeout cancelled the job.

## Non-goals

- No change to what any test checks, and no test is skipped: the cross-browser suite runs unchanged, on a different trigger.
- No change to `release.yml` or `deploy-site.yml`; they keep gating on the `CI` workflow only.
- No splitting of the acceptance job (≈8 minutes, now the critical path) or reuse of the `builds` artifact by it.

## Requirements

- **REQ-001** Every job of `ci.yml` has a timeout such that, including a wait for `build`, no job can keep a pull request running past about 30 minutes.
- **REQ-002** Browsers are installed only through the cached, time-bounded composite action.
- **REQ-003** A `ci.yml` job waits for `build` only when it downloads the `builds` artifact.
- **REQ-004** The Firefox/WebKit matrix runs weekly, on demand and on labelled pull requests, read-only, and is not a release or deploy gate.
- **REQ-005** When the CDP harness cannot start Chrome, it fails within its startup timeout and exits instead of leaving Chrome running; a cold first launch gets up to 60 s.

## Acceptance cases

- **AC-001** [REQ-001] For each `ci.yml` job, `timeout-minutes` plus 15 when it `needs: build` is at most 35.
- **AC-002** [REQ-002] Neither CI workflow contains `playwright install`; both use `./.github/actions/playwright-browsers`, which wraps `playwright install --with-deps` in `timeout`, caches and keeps `PLAYWRIGHT_BROWSERS_PATH=0`.
- **AC-003** [REQ-003] Every `ci.yml` job with `needs: build` downloads the artifact named `builds`.
- **AC-004** [REQ-004] `ci.yml` no longer runs `test:e2e:browsers`; `ci-extended.yml` does, with a schedule, `workflow_dispatch`, the `full-ci` label condition and `contents: read`, and neither release nor deploy names it.
- **AC-005** [REQ-005] A Chrome that never writes `DevToolsActivePort` is killed when startup times out; one that exits during startup is reported at once with its exit code.

## Public API impact

None.

## Compatibility

GitHub-hosted `ubuntu-latest`. Browsers stay inside `node_modules` (`PLAYWRIGHT_BROWSERS_PATH=0`), as `scripts/e2e.ts` and `scripts/compat.ts` expect. Branch protection that lists "Playwright cross-browser (Firefox, WebKit)" as a required check must drop it (owner setting).

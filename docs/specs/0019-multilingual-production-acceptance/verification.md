# Verification — 0019 multilingual production acceptance

<!-- Written after running the tests. A case is PASS only when its result was inspected. -->

## Test cases

| Case       | Acceptance                     | Checks                                                                                                      | Result |
| ---------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------ |
| E2E-164    | AC-001, AC-002, AC-003, AC-004 | Real prerendered Showcase A locale routes, metadata, switcher, Pagefind index and search                    | PASS   |
| E2E-165    | AC-005                         | Real-browser sticky TOC/sidebar geometry, internal rail scrolling, no horizontal overflow                   | PASS   |
| MANUAL-001 | AC-006                         | Analog SSR HTTP status for known/missing/localized/delegated routes; records status propagation limitation  | PASS   |
| MANUAL-002 | AC-007                         | Repository quality gate, packed consumers, Angular matrix, browser matrix, adoption and public API evidence | FAIL   |

Repository and packed-consumer gates pass. External adoption probes are not green because upstream consumer repos changed after the adoption scripts were authored; details are recorded below. No CI run is claimed before the PR exists.

## Executed commands

| Command                                                                         | Result                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm quality:gate` with `PW_CHANNEL=chrome`                                    | PASS; complete gate. Includes formatting, script types, 19-spec SDD check, API/content/Agentyx checks, builds, package/public API, 128 contract tests, negative controls, seven packed consumer builds, init/compat checks, Chromium E2E, Firefox/WebKit, determinism, MVP, portable smoke and bundle impact. |
| `pnpm test:unit` (within gate)                                                  | PASS; 557 tests.                                                                                                                                                                                                                                                                                              |
| `pnpm test:components` (within gate)                                            | PASS; 196 library tests and 27 site tests.                                                                                                                                                                                                                                                                    |
| `PW_CHANNEL=chrome pnpm test:e2e` (within gate)                                 | PASS; 254 tests.                                                                                                                                                                                                                                                                                              |
| `PW_CHANNEL=chrome pnpm test:e2e:browsers` (within gate)                        | PASS; 341 passed, 1 skipped.                                                                                                                                                                                                                                                                                  |
| `pnpm perf:scale --check` (within gate)                                         | PASS; 53 bytes gzip initial JS per document at tested sizes, below the 70-byte budget.                                                                                                                                                                                                                        |
| `pnpm verify:determinism` and `pnpm verify:determinism --control` (within gate) | PASS; five identical build fingerprints; deliberate guard removal detected.                                                                                                                                                                                                                                   |
| `pnpm verify:compat --angular=21` and `--angular=22` (within gate)              | PASS; seven real-consumer Chromium smoke checks each.                                                                                                                                                                                                                                                         |
| `pnpm verify:mvp` with packed external consumer (within gate)                   | PASS; 17 PASS / 0 FAIL.                                                                                                                                                                                                                                                                                       |
| `pnpm verify:portable` (within gate)                                            | PASS; six portability checks, including CRLF, Unicode/spaces, path containment and JSON CLI output.                                                                                                                                                                                                           |
| `pnpm bundle:impact --check` (within gate)                                      | PASS; config entry adds 8 gzip bytes to initial JS and 13 bytes overall; config entry imports only Angular core and works as a plain Node import.                                                                                                                                                             |
| `pnpm verify:adoption`                                                          | FAIL against Angular Movement checkout `ce9b03d547bc774268768e5f57c028452e70b9ad`: its current tree already has a complete Doqs integration and `doq doctor` reports 30 PASS / 0 FAIL, while the onboarding proof assumes an unintegrated tree with four failures.                                            |
| `pnpm verify:adoption:routes`                                                   | FAIL against the same checkout: the script expects `src/app/pages/docs/get-started.page.ts`, which no longer exists at that upstream revision.                                                                                                                                                                |
| `pnpm verify:adoption:volt`                                                     | INTERRUPTED after the current upstream Volt UI prerender emitted `MutationObserver is not defined` from Volt UI code; no Doqs assertion result was reached. Checkout `7c76ef3b8aa6e3d6c4da578b0be22939556d53af`.                                                                                              |

## SSR observation

A live Analog dev SSR server returned HTTP 200 for known, unknown, localized-unknown and delegated-host routes. The missing-route content rendered and set Angular `RESPONSE_INIT.status=404`, but the dev server did not propagate that status. Production static preview returned 200 for known docs and host routes and 404 for unknown and localized-unknown paths. No client-side status simulation was added.

The downloaded Playwright Chromium binary could not start (`icudtl.dat` missing); the same browser suite passed with the installed Chrome using `PW_CHANNEL=chrome`.

## Public API and release scope

`pnpm verify:public-api` passes: 228 exports, compatible with the 0.7 baseline. The package version remains `0.11.0`; no publish, deploy, or release tag was performed. The Etyma investigation found that its published adapter owns route localization and metadata, which would compete with Doqs/host ownership; no bridge or dependency was added.

## Remaining limitations

Analog dev SSR currently renders the not-found view but responds with HTTP 200. The external adoption scripts need updates for current upstream Angular Movement and Volt UI layouts/behavior before they can prove those live integrations. No release-readiness or 1.0-readiness claim is made.

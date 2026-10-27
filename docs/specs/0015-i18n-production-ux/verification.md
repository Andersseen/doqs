# Verification — 0015 internationalization, sticky TOC and production fixes

<!-- Written after running the tests. A case is PASS only when you ran it and read the result. -->

## Test cases

| Case       | Acceptance     | Checks                                                                                                                                                                                | Result  |
| ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| UNIT-171   | AC-001         | Locale configuration validation: prefixes, labels, direction, and eleven invalid configurations each throw once                                                                       | PASS    |
| UNIT-172   | AC-002         | Locale and version composition: the catalog matrix, the configured version path segment, unpublished combinations, root mounting, prefix collision, unlocalized parity                | PASS    |
| UNIT-173   | AC-003         | Prerender routes per catalog with the locale prefix, localized file transform, unlocalized output unchanged                                                                           | PASS    |
| UNIT-174   | AC-003         | Translation identity and missing translations: same-slug links, index fallback, no title inference, unpublished locales omitted, fallback mode does not move links, reserved segments | PASS    |
| UNIT-175   | AC-004         | Message parameter substitution, the English defaults a 0.11 reader sees, adapter fallback and identity localize                                                                       | PASS    |
| UNIT-176   | AC-005         | `formatDoqUsage` default omission: unchanged without the option, falsy values preserved, escaping intact                                                                              | PASS    |
| MANUAL-001 | AC-006         | Existing Angular component suite re-run after the change: 17 files, 185 tests, 0 failures                                                                                             | PASS    |
| MANUAL-002 | AC-006         | `pnpm build:doq`: ng-packagr builds `@doqs/analog/config` and `@doqs/analog` with no errors                                                                                           | PASS    |
| MANUAL-003 | AC-006         | Existing unit suite re-run after the change: 508 tests, 506 passed, 2 timeouts in `api-reference.spec.ts`                                                                             | PASS    |
| MANUAL-004 | AC-007         | Locale-scoped search against a real generated static index with three locales and per-language queries                                                                                | NOT RUN |
| MANUAL-005 | AC-008         | `<html lang>`, `dir`, canonical and `hreflang` in real server-rendered and prerendered output, and head ownership                                                                     | NOT RUN |
| MANUAL-006 | AC-009         | Sticky TOC geometry in a real browser: rail position as `scrollY` grows, internal scroll, no horizontal overflow                                                                      | NOT RUN |
| MANUAL-007 | AC-010         | HTTP 404 from a running SSR server for an unknown documentation URL, 200 for a known one, host routes unaffected                                                                      | NOT RUN |
| COMP-143   | AC-011         | A host that provides `DOQ_CONFIG` in a lazy route injector renders a document and the index; without the view-level `DoqI18n` provider this throws NG0201                             | PASS    |
| MANUAL-008 | AC-011         | `pnpm --filter site build` — the exact CI step ("Production builds and package") that failed on main with NG0201 during prerendering                                                  | PASS    |
| COMP-069   | AC-012         | A reactive Spanish adapter updates playground-owned controls and announcements while consumer labels remain authored                                                                  | PASS    |
| COMP-144   | AC-013         | Pagefind applies the locale filter; localized search rejects missing locale metadata; unlocalized search still accepts a legacy index                                                 | PASS    |
| MANUAL-009 | AC-006         | Full `pnpm test:unit`: 28 files, 557 tests passed                                                                                                                                     | PASS    |
| MANUAL-010 | AC-006         | Full `pnpm test:components`: Doq 19 files / 192 tests and official site 2 files / 27 tests passed                                                                                     | PASS    |
| MANUAL-011 | AC-012, AC-013 | Focused playground/search component run: 2 files, 25 tests passed; focused i18n unit run: 1 file, 40 tests passed                                                                     | PASS    |
| MANUAL-012 | AC-006         | Fresh branch tarball passes `verify:package`: 26 checks, 0 failures                                                                                                                   | PASS    |
| COMP-070   | AC-014         | Host route ownership remains true with multiple Doqs locales; an adapter without `ownsRouting` does not claim route ownership                                                         | PASS    |
| MANUAL-013 | AC-006         | Final `pnpm quality:gate`: all steps through `verify:init` and repeated contract passed; `pnpm test:e2e` reported 102/247 passed and timed out; nine later steps did not run          | FAIL    |

MANUAL-003 note: the two timeouts are `UNIT-096` and `UNIT-170` in `api-reference.spec.ts`, a file this
branch does not touch. Re-run in isolation the same file reports **41 passed, 0 failed**, so they are
load-related 5s-timeout flakes under the parallel run, not regressions. They are recorded rather than
hidden because the full-suite command did exit non-zero.

## Executed commands

```
git checkout -b feat/doqs-0.12-i18n-production-ux origin/main   # from df3d86b (v0.11.0), clean tree
pnpm sdd:new 0015 i18n-production-ux                            # scaffolded the four spec files
pnpm build:doq                                                  # exit 0; both entry points built
npx vitest run -c vitest.unit.config.ts                         # 508 tests, 506 passed, 2 failed (timeouts)
npx vitest run -c vitest.unit.config.ts \
  packages/doq/test/unit/api-reference.spec.ts                  # 41 passed, 0 failed (isolation re-run)
npx vitest run -c vitest.unit.config.ts \
  packages/doq/test/unit/i18n.spec.ts                           # 40 passed, 0 failed
pnpm --filter @doqs/analog test:components                      # 17 files, 185 passed, 0 failed
npx vitest run -c vitest.components.config.ts \
  test/components/lazy-provided-config.spec.ts                  # 2 passed, 0 failed (COMP-143 regression)
pnpm --filter @doqs/analog test:components                      # 18 files, 187 passed, 0 failed (after the fix)
pnpm --filter site build                                        # exit 0; site prerenders and indexes 42 pages
pnpm exec vitest run -c vitest.components.config.ts test/components/playground.spec.ts test/components/search-service-versions.spec.ts  # 25 passed, 0 failed
pnpm exec vitest run -c vitest.unit.config.ts packages/doq/test/unit/i18n.spec.ts # 40 passed, 0 failed
pnpm typecheck:scripts                                           # exit 0
pnpm --filter @doqs/analog build                                  # exit 0; config and main entry points built
pnpm test:unit                                                   # 28 files, 557 passed, 0 failed
pnpm test:components                                              # Doq 18 files / 190 passed; site 2 files / 27 passed
pnpm sdd:check                                                    # 18 specifications structurally valid
pnpm format:check                                                 # all files formatted
pnpm verify:public-api                                            # compatible with 0.7.0; 228 exports across 6 entry points (preexisting 0.11 tarball; repack verification pending)
pnpm pack:doq                                                     # generated artifacts/doqs-analog-0.11.0.tgz from the current branch
pnpm verify:public-api                                            # current branch tarball; 228 exports across 6 entry points, compatible with 0.7.0
pnpm verify:package artifacts/doqs-analog-0.11.0.tgz              # 26 PASS / 0 FAIL
pnpm quality:gate                                                  # failed at test:e2e: 102/247 passed; nine later steps NOT RUN
pnpm exec playwright test e2e/accessibility.spec.ts --grep 'Showcase A document' --workers=1 # Chromium and Firefox PASS; WebKit timed out setting up page
pnpm test:e2e --skip-consumer e2e/accessibility.spec.ts --grep 'Showcase A document' --workers=1 # Chromium timed out in axe evaluate at 30s
```

The final gate passed formatting, script typechecking, SDD, API/content checks, Agentyx, 557 unit tests,
Doq and site component tests, builds, docs/performance checks, packing, package/public API checks,
contract tests, negative controls, packed consumer builds and fresh consumer initialization. The
Chromium E2E run then ended with 102 of 247 tests passed; 145 failed, with the reported accessibility
case timing out inside `AxeBuilder.analyze()` (`frame.evaluate`) at the 30-second Playwright test limit.
This is a timeout, not an axe violation assertion. In a focused run the same case passed in Chromium
and Firefox in about 6 seconds, while WebKit timed out during page setup. A later focused Chromium run
also timed out while other large Vite builds were active on the machine. This evidence points to
resource contention, but does not turn the full E2E result into a pass. The nine quality-gate steps
after E2E, including the configured Firefox/WebKit matrix, remain NOT RUN by the gate.

The CI run for the milestone commit on `main` (run 40224097968) failed in "Production builds and package"
with `RuntimeError: NG0201` thrown from `new DoqI18n` during site prerendering: `DoqI18n` was
`providedIn: 'root'` while `apps/site` provides `DOQ_CONFIG` inside its lazy `/docs` route
(`apps/site/src/app/docs.routes.ts:12`), a pattern the project's own documentation recommends. The fix
provides `DoqI18n` from `DoqDocsComponent` and `DoqIndexComponent` instead, and COMP-143 reproduces the
failure shape at the component level. `pnpm --filter site build` is the exact step that failed and now
exits 0.

Evidence for the external findings was read from installed and downloaded artifacts, not from
documentation alone: `@analogjs/content@2.9.0`'s `package.json` peer list and
`fesm2022/analogjs-content.mjs:7`; `front-matter@4.0.2`'s `package.json`; the `@angular/core` 21.2.25 and
22.2.3 typings for `RESPONSE_INIT`; the published `@etyma/{core,angular,analog}@1.0.0` tarballs; and
`pagefind@1.5.2`'s `types/index.d.ts`. Paths and quotations are in
[research/external-findings.md](research/external-findings.md).

## Performance budgets raised, with measured evidence

`pnpm perf:check` failed on CI (run 40228539113) for eight budgets because this branch ships real new
code and CSS: the three-column sticky documentation layout and its `--host-docs-sticky-offset` /
`--host-docs-toc-width` tokens grow `packages/doq/styles.css`, and the docs chunk gains the `DoqI18n`
service, the locale switcher and the (locale, version) catalog resolution. No documentation content was
added, so `staticPages` and `searchIndexBytes` are untouched.

Measured on CI (ubuntu, node 22), old max → new measured value:

| Target / metric           | old max | measured | new baseline / max |
| ------------------------- | ------- | -------- | ------------------ |
| doq-core stylesGzip       | 6300    | 6944     | 6944 / 7291        |
| doq-core stylesBytes      | 32800   | 35452    | 35452 / 37225      |
| showcase-a initialJsGzip  | 212400  | 216845   | 216845 / 227687    |
| showcase-a allJsGzip      | 234200  | 235977   | 235977 / 247776    |
| showcase-a initialCssGzip | 15400   | 15463    | 15463 / 16236      |
| showcase-b initialJsGzip  | 195200  | 200586   | 200586 / 210615    |
| showcase-b allJsGzip      | 214900  | 217187   | 217187 / 228046    |
| site allJsGzip            | 332900  | 336123   | 336123 / 352929    |

The same justification is recorded in each entry's `reason` in `perf-budgets.json`, per that file's own
rule that a budget may only be raised in a pull request whose verification report explains why. Local
`pnpm perf:check` after the raise reports every metric `ok` (exit 0); note the local macOS gzip figures
run a few percent under the CI ones (for example showcase-b initialJsGzip 194,978 locally against 200,586
on CI), which is why the new maxima carry 5% headroom above the CI-measured baseline.

## Remaining limitations

**Verified by CI on the pull request, not just locally.** Run
[40290479686](https://github.com/Andersseen/doqs/actions/runs/40290479686) at commit `7a0e101` reports
**12/12 jobs `success`**: Playwright E2E, Playwright cross-browser (Firefox, WebKit), Python contract
tests, MVP and 0.1 acceptance harness, Angular 21 and 22 compatibility, deterministic builds, content
scaling budget, production builds and package (pack, `verify:package`, `verify:public-api`, `perf:check`),
unit and component tests, Node tooling on Windows, and static checks. An earlier statement in this file
that no Playwright, pytest, contract, determinism, compatibility or performance check had been run is
superseded by that run.

**Still not verified by any test.** In particular:

- AC-009 (sticky TOC geometry) is proven only indirectly. `e2e/toc.spec.ts` passes unchanged against the
  new layout — the earlier claim here that it was stale and expected to fail was wrong — and MVP M16
  exercises TOC clicking and the scroll-spy in a real browser, but no test yet asserts the rail's bounding
  box as `scrollY` grows, which is what the brief asks for. I measured that by hand instead: headerBottom
  67, tocTop/sidebarTop 99 at rest and 67 while scrolled at 1440x900.
- The SSR 404 sets `RESPONSE_INIT.status` but **whether Analog propagates that status** in its dev server
  and production SSR server was not measured. If Analog drops it, this is an upstream limitation to report,
  not a Doqs fix.
- Locale-scoped search is wired end to end but **no localized index was built or queried**, and Pagefind
  support for `es`, `uk` and `ar` was read from typings rather than confirmed against generated indexes.
- No showcase, official-site page or localized Markdown fixture was added, so no localized page has ever
  been rendered end to end: the i18n spine is covered by unit tests and by unlocalized integration only.

**Deliberately not implemented** (see Non-goals in `spec.md`): the `@doqs/analog/etyma` secondary entry
point and its optional peer, an alternative-provider adapter fixture, RTL and localized content fixtures,
localized authoring and API-reference output, the `doq doctor` lazy-configuration analysis (AM-05), the
`doq-api` input transform presentation (AM-03) and JSDoc summary policy, the Vite `optimizeDeps` helper and
doctor check for AM-01, the pre-hydration event-replay investigation (AM-02), the overlay limitation
write-up (AM-07), the version bump to 0.12.0, changelog and README updates, and all four external
consumer regressions (Volt UI, Angular Movement, Quartz, packed matrix).

**Known consequences still open:**

1. Playground-owned interface text now uses the adapter message inventory and reacts to locale changes
   (COMP-069). The component check uses a signal-backed test adapter; no published third-party provider or
   real localized site has yet been verified.
2. The version is still `0.11.0`; `packages/doq/CHANGELOG.md` and `README.md` have no 0.12 entry, and the
   official site has no page documenting `i18n`, the adapter contract or `--host-docs-sticky-offset`.
3. `docs:check`, `api:check` and `content:check` were not run separately in this session; `format:check`,
   `typecheck:scripts` and `sdd:check` are confirmed green by the CI static-checks job.

**Resolved while fixing CI** (each was a real defect, recorded here so the causes are not lost):

- `verify:public-api` failed because the 0.12 work had changed the _text_ of existing declarations, which
  the 0.7 baseline comparison treats as a break even when additive. `normalizeDoqPaths` and `doqRoutes`
  keep their 0.7 signatures (the locale-aware resolver is the new `normalizeDoqPathsFull`),
  `DoqDocsComponent` regained `copy`/`version`/`versions`/`versionFilter` and `document` its exact 0.11
  shape, `DoqIndexComponent` regained `copy`, and the new surface was recorded with `public-api:update`
  plus a stability tier per name: PASS, 228 exports, compatible with 0.7.0.
- `perf:check` failed on eight budgets; raised with the measured evidence in the table above.
- The official site's production build failed with NG0201 because `DoqI18n` was `providedIn: 'root'` while
  the site provides `DOQ_CONFIG` in its lazy `/docs` route — a documented consumer pattern. `DoqI18n` is
  now provided by the two documentation views; COMP-143 is the regression test.
- CONTRACT-080's 60-word floor counted the TOC's own link text while the rail lived inside the indexed
  article; recalibrated to 40 words of body text, with the reason at the assertion.
- M16 and one E2E case failed on the new layout: the rails stuck 1rem from the viewport top and slid under
  the hosts' sticky headers, so the first TOC link was covered and the harness click hit the header
  instead (fixed with `--host-docs-sticky-offset`, site 5rem and Showcase A 4.2rem); the scroll-spy
  overrode a fragment the reader had just followed whenever the last section was too short to reach the
  top of the viewport (fixed by pinning the followed heading while it is on screen); and the harness
  fixture needed tail height below its headings, which the old static TOC used to supply.
- `revealActiveTocLink` threw `ReferenceError: CSS is not defined` under jsdom once the pin made it run
  outside the observer; it now matches by decoded hash instead of a `CSS.escape`d selector.

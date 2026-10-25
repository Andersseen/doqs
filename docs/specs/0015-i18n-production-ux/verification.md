# Verification — 0015 internationalization, sticky TOC and production fixes

<!-- Written after running the tests. A case is PASS only when you ran it and read the result. -->

## Test cases

| Case       | Acceptance | Checks                                                                                                                                                                                | Result  |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| UNIT-171   | AC-001     | Locale configuration validation: prefixes, labels, direction, and eleven invalid configurations each throw once                                                                       | PASS    |
| UNIT-172   | AC-002     | Locale and version composition: the catalog matrix, the configured version path segment, unpublished combinations, root mounting, prefix collision, unlocalized parity                | PASS    |
| UNIT-173   | AC-003     | Prerender routes per catalog with the locale prefix, localized file transform, unlocalized output unchanged                                                                           | PASS    |
| UNIT-174   | AC-003     | Translation identity and missing translations: same-slug links, index fallback, no title inference, unpublished locales omitted, fallback mode does not move links, reserved segments | PASS    |
| UNIT-175   | AC-004     | Message parameter substitution, the English defaults a 0.11 reader sees, adapter fallback and identity localize                                                                       | PASS    |
| UNIT-176   | AC-005     | `formatDoqUsage` default omission: unchanged without the option, falsy values preserved, escaping intact                                                                              | PASS    |
| MANUAL-001 | AC-006     | Existing Angular component suite re-run after the change: 17 files, 185 tests, 0 failures                                                                                             | PASS    |
| MANUAL-002 | AC-006     | `pnpm build:doq`: ng-packagr builds `@doqs/analog/config` and `@doqs/analog` with no errors                                                                                           | PASS    |
| MANUAL-003 | AC-006     | Existing unit suite re-run after the change: 508 tests, 506 passed, 2 timeouts in `api-reference.spec.ts`                                                                             | PASS    |
| MANUAL-004 | AC-007     | Locale-scoped search against a real generated static index with three locales and per-language queries                                                                                | NOT RUN |
| MANUAL-005 | AC-008     | `<html lang>`, `dir`, canonical and `hreflang` in real server-rendered and prerendered output, and head ownership                                                                     | NOT RUN |
| MANUAL-006 | AC-009     | Sticky TOC geometry in a real browser: rail position as `scrollY` grows, internal scroll, no horizontal overflow                                                                      | NOT RUN |
| MANUAL-007 | AC-010     | HTTP 404 from a running SSR server for an unknown documentation URL, 200 for a known one, host routes unaffected                                                                      | NOT RUN |
| COMP-143   | AC-011     | A host that provides `DOQ_CONFIG` in a lazy route injector renders a document and the index; without the view-level `DoqI18n` provider this throws NG0201                             | PASS    |
| MANUAL-008 | AC-011     | `pnpm --filter site build` — the exact CI step ("Production builds and package") that failed on main with NG0201 during prerendering                                                  | PASS    |

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
```

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

## Remaining limitations

**Not verified by any test on this branch.** AC-007 through AC-010 are implemented but unproven. No
Playwright, pytest, contract, determinism, compatibility, performance, packed-tarball or consumer check
was run, and no showcase, official-site page or localized Markdown fixture was added. In particular:

- The sticky TOC has **no geometry test**. Per the brief, a `position: sticky` declaration is not evidence;
  AC-009 needs a real browser asserting the rail's bounding box as `scrollY` grows. `e2e/toc.spec.ts` still
  carries its 0.11 comment that the TOC is not sticky and still uses DOM clicks in the history tests, so
  that suite is now **stale and expected to fail** against the new layout. It was not updated.
- The SSR 404 sets `RESPONSE_INIT.status` but **whether Analog propagates that status** in its dev server
  and production SSR server was not measured. If Analog drops it, this is an upstream limitation to report,
  not a Doqs fix.
- Locale-scoped search is wired end to end but **no index was built or queried**, and Pagefind support for
  `es`, `uk` and `ar` was read from typings rather than confirmed against generated indexes.

**Deliberately not implemented** (see Non-goals in `spec.md`): the `@doqs/analog/etyma` secondary entry
point and its optional peer, an alternative-provider adapter fixture, RTL and localized content fixtures,
localized authoring and API-reference output, the `doq doctor` lazy-configuration analysis (AM-05), the
`doq-api` input transform presentation (AM-03) and JSDoc summary policy, the Vite `optimizeDeps` helper and
doctor check for AM-01, the pre-hydration event-replay investigation (AM-02), the overlay limitation
write-up (AM-07), the version bump to 0.12.0, changelog and README updates, and all four external
consumer regressions (Volt UI, Angular Movement, Quartz, packed matrix).

**Known consequences to resolve before this is mergeable:**

1. `pnpm verify:public-api` will report the new exports and the changed `doqRoutes`,
   `DoqSearchService.search` and error-wording declarations. The report and baseline need
   `pnpm public-api:update` plus a stability-tier entry for each new name; neither was run.
2. The playground component still renders English literals. It reads chrome from its own template rather
   than from `DoqI18n`, so playground strings are **not** localized despite being inventoried in
   `DOQ_DEFAULT_MESSAGES`.
3. `perf-budgets.json` was not re-measured against the new grid layout.
4. `sdd:check`, `format:check`, `docs:check`, `api:check` and `content:check` were not run after the final
   edit, so the branch is not yet gate-clean.

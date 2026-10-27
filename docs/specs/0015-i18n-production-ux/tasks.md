# Tasks — 0015 internationalization, sticky TOC and production fixes

<!-- Format: - [x] T-001 [REQ-001, AC-001] concrete, finishable step. Every requirement needs at least one task. -->

- [x] T-001 [REQ-001, AC-001] Add `doq-i18n.ts` with `DoqI18nConfig`/`DoqLocaleConfig`, BCP 47 id validation, per-locale content directories, direction, fallback mode and one actionable error per invalid configuration.
- [x] T-002 [REQ-001, REQ-010, AC-001, AC-002] Wire optional `i18n` through `DoqPaths`, `normalizeDoqPaths` and `DoqResolvedPaths`, resolving versioning first so locale archive directories validate against declared archive ids.
- [x] T-003 [REQ-002, AC-002] Add `getDoqCatalogs()`/`findDoqCatalog()` producing the (locale, version) matrix, with the default locale inheriting `versioning.archives` directories and unpublished combinations omitted.
- [x] T-004 [REQ-002, AC-003] Extend `doqPrerenderRoutes()` to emit one index URL and one content route per catalog, leaving unlocalized output unchanged.
- [x] T-005 [REQ-002, AC-002, AC-003] Generate routes per catalog in `doqRoutes()`, listing prefixed locales before the default locale and reserving locale ids and the archive prefix against current-version slugs.
- [x] T-006 [REQ-002, REQ-003, AC-002] Make the catalog layer locale-aware: `injectDoqDocuments(config, versionId, localeId)`, `injectDoqCatalogs(config, localeId)`, `injectDoqLocaleCatalogs`, `injectDoqCatalog`, `injectDoqLocale`.
- [x] T-007 [REQ-004, AC-004] Add `doq-i18n-adapter.ts` with `DoqI18nAdapter`, `DOQ_I18N_ADAPTER`, `provideDoqI18n`, `DOQ_DEFAULT_MESSAGES`, `formatDoqMessage` and `createDoqStaticI18nAdapter`.
- [x] T-008 [REQ-004, REQ-006, AC-004] Add the `DoqI18n` service: locale derived from the adapter or the router URL, `t()` with presentation overrides, `localize()`, `hostOwnsHead`.
- [x] T-009 [REQ-004, REQ-010, AC-004, AC-006] Replace chrome literals in the document, index, search and version-switcher views with `i18n.t()`, keeping the English defaults identical to 0.11.
- [x] T-010 [REQ-003, AC-003] Add `DoqLocaleSwitcherComponent` rendering real links with `hreflang`/`lang`, plus `doqLocaleLinks()` that never infers identity from a translated title.
- [x] T-011 [REQ-003, AC-003] Implement the documented missing-translation behaviour: `fallback: 'none'` renders not-found, `'default-locale'` serves the default locale's document under a visible notice.
- [x] T-012 [REQ-005, AC-007] Add the `doqsLocale` Pagefind filter to the article and pass a fifth `localeId` argument through `DoqSearchService.search`, ignoring the filter when the index carries none.
- [x] T-013 [REQ-006, AC-008] Add `DoqPageMetadata.setLocale()` and `setAlternates()`, and drive them from an effect that no-ops when the host owns the head or the site is unlocalized.
- [x] T-014 [REQ-007, AC-009] Replace the absolutely positioned TOC with a three-column grid: move the `aside` out of the article, add `data-toc`, and make both rails sticky with a viewport-aware max height.
- [x] T-015 [REQ-007, AC-009] Add `--host-docs-sticky-offset` and `--host-docs-toc-width` tokens, feed the sticky offset into `--doq-scroll-offset`, and add internal TOC scrolling with a conditional tab stop and active-link reveal.
- [x] T-016 [REQ-007, AC-009] Use logical properties for the TOC indent so an RTL rail indents on the correct side, and preserve the mobile drawer and `sidebar: 'right' | 'hidden'` placements.
- [x] T-017 [REQ-008, AC-010] Set HTTP 404 through an optional `RESPONSE_INIT` injection, decided synchronously from the route snapshot and catalog, and never when `unmatched: 'continue'` delegates to the host.
- [x] T-018 [REQ-009, AC-005] Add the optional `defaults` entry to `formatDoqUsage`, omitting only values identical by `Object.is` to a declared default.
- [x] T-019 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-009, AC-001, AC-002, AC-003, AC-004, AC-005] Add `test/unit/i18n.spec.ts` covering validation, the catalog matrix, prerender routes, translation identity, message formatting and default omission.
- [x] T-020 [REQ-010, AC-006] Update the component tests for the additive search argument and the broadened error wording, and re-run the unit, component and library-build gates.
- [x] T-021 [REQ-001, REQ-010, AC-001, AC-006] Record the external findings that constrain the deferred work (Analog's `front-matter` peer, Etyma's route and head ownership, Pagefind's per-language splitting) in `research/external-findings.md`.
- [x] T-022 [REQ-011, AC-011] Provide `DoqI18n` from the documentation views instead of the root injector, so a host that scopes `provideDoq()` to a lazy route (the official site's pattern) resolves it; add `test/components/lazy-provided-config.spec.ts` reproducing the NG0201 that broke the site's production build.
- [x] T-023 [REQ-012, AC-012] Route remaining playground-owned text, validation feedback, copy states, expanded preview labels and live announcements through the existing message catalog; prove reactive locale changes in a component test.
- [x] T-024 [REQ-013, AC-013] Fail closed when a localized search request uses a Pagefind index without locale metadata, preserve unlocalized legacy-index behavior, and cover both paths in the service test.
- [x] T-025 [REQ-012, REQ-013, AC-012, AC-013] Run focused component and unit tests and record actual results here and in `verification.md`.
- [x] T-026 [REQ-014, AC-014] Add explicit optional route ownership to `DoqI18nAdapter`, stop inferring it from locale count, and cover both explicit ownership and adapter-only defaults in a component test.

# 0015 — internationalization, sticky documentation TOC and production fixes

## Problem

Doqs 0.11 renders one language. Every reader-facing string is a literal in a component template, every
catalog is keyed by version alone, and every URL is unprefixed, so a product that ships documentation in
more than one language has to fork the documentation region or hand-write its own. Volt UI, the primary
multilingual adoption candidate, was recorded as BLOCKED on localized documentation in the 0.11 parity
report for exactly this reason.

At the same time Angular Movement reported six concrete defects from a real production adoption
(Angular 22.2.3, Analog 2.9.1, Vite 8.3.5, pnpm 10.30, zoneless, Cloudflare Pages), and the maintainer
identified that the right-hand table of contents scrolls away with the article instead of persisting like
the left sidebar. Reading `packages/doq/styles.css` confirms why: `.doq-toc` was `position: absolute`
against `.doq-article`, which is `position: relative`, so the TOC was anchored to the article box and left
the viewport with it, and below 1450px it became `position: static`.

Investigation for this milestone established three external facts, recorded with file evidence in
[research/external-findings.md](research/external-findings.md):

- The Vite dev-server failure is an **Analog packaging defect**, not a Doqs one: `@analogjs/content`
  declares `front-matter` as a non-optional peer while its browser bundle does `import fm from
"front-matter"`, and `front-matter@4.0.2` is CommonJS-only. This repo never reproduced it because all
  three apps declare `front-matter` as a direct dependency.
- Etyma 1.0.0 already owns localized route composition (`withLocalizedRoutes()`, no arguments) and, with
  `provideEtymaAnalog()`, owns `<html lang>`, `dir`, canonical and `hreflang`. Doqs must cooperate with
  both rather than duplicate them.
- Pagefind splits one bundle into per-language sub-indexes from the detected page language, but the
  browser API merges results across them, so locale scoping needs an explicit filter.

## Consumer impact

Additive for every 0.11 configuration. New optional configuration `i18n` on `DoqPaths`/`DoqConfig`; a new
optional `defaults` entry on `formatDoqUsage`'s options; new optional CSS tokens
`--host-docs-sticky-offset` and `--host-docs-toc-width`.

Two visible changes for existing consumers, both deliberate:

1. **The documentation layout is now a three-column grid.** At viewports of 1280px and wider the TOC is a
   persistent sticky right rail; between 721px and 1279px it is an inline box above the article in the
   content column; at 720px and below the existing mobile drawer behaviour is unchanged. The article no
   longer reserves `contentWidth + 14rem` of width for an absolutely positioned TOC, so the centre column
   is sized by the grid and the whole documentation block is capped and centred.
2. **Two contract details changed.** The reserved-prefix error now reads "reserved URL prefix" because it
   covers locale prefixes as well as the archive prefix, and `DoqSearchService.search` takes a fifth
   optional `localeId` argument.

## Scope

Delivered on this branch:

1. Optional locale configuration on `DoqPaths`, validated at configuration time, with BCP 47 ids that
   double as URL prefixes, per-locale content directories, text direction and a default locale.
2. A (locale, version) catalog matrix that composes with the existing versioning feature, drives route
   generation and prerendering, and keeps catalogs isolated by content directory.
3. Locale-aware routing: the default locale keeps its unprefixed URLs, other locales are prefixed,
   archive segments are honoured inside every locale, and `unmatched: 'continue'` still delegates to the
   host.
4. A provider-agnostic i18n adapter contract and the complete inventory of Doqs-owned interface strings
   with their English defaults.
5. Localized chrome in the document, index, search and version-switcher views, plus a new language
   selector rendered as real links.
6. Locale-scoped Pagefind filtering, additive to the existing version filter.
7. Localized SEO: `<html lang>`, `<html dir>` and `hreflang` alternates with `x-default`, written only
   when the host has not taken ownership of the document head.
8. The three-column sticky documentation layout with a host-configurable sticky offset, internal
   scrolling for a tall TOC, and logical properties for RTL.
9. A real HTTP 404 for unknown documentation URLs under SSR, through `RESPONSE_INIT`.
10. Optional default-omission in `formatDoqUsage`.

## Non-goals

The remaining 0.12 items, deliberately not attempted on this branch and enumerated in `verification.md`
under remaining limitations: the optional `@doqs/analog/etyma` secondary entry point, an
alternative-provider adapter fixture, RTL and localized content fixtures in the showcases, localized
authoring and API-reference output, the `doq doctor` lazy-configuration analysis, the `doq-api` input
transform presentation, the Vite `optimizeDeps` helper and doctor check, the pre-hydration event-replay
investigation, and the four external consumer regressions.

Also out of scope: a translation framework, machine translation, a new Markdown parser, a new UI
component library, any change to the default non-localized route model, and publishing.

## Requirements

- **REQ-001** An optional `i18n` block configures locales with BCP 47 ids, labels, text direction and per-locale content directories; invalid configuration fails at configuration time with one actionable message.
- **REQ-002** Documentation identity is (locale, version, slug): the same slug is valid across locales and across versions, and a (locale, version) combination nobody publishes has no routes and no prerendered pages.
- **REQ-003** Translation identity is never inferred from a translated title, and a localized URL never silently serves another locale's content.
- **REQ-004** A host can supply translations and locale state through one small adapter contract without Doqs depending on any i18n package, and an absent or partial adapter degrades to Doqs's English defaults.
- **REQ-005** Search results are scoped to the locale being read, additively to the existing version scoping, and an unlocalized site issues no locale filter.
- **REQ-006** A localized page declares its language, direction and `hreflang` alternates, and leaves all of them alone when the host owns the document head.
- **REQ-007** The right-hand TOC persists while a long article scrolls, keeps a host-configurable distance from the top of the viewport, scrolls internally when taller than the viewport, and never forces a page-wide horizontal scrollbar.
- **REQ-008** An unknown documentation URL answers HTTP 404 when a server response exists, and behaves safely when it does not.
- **REQ-009** A usage snippet can omit values identical to a default the caller declared, without changing output for any caller that declares none.
- **REQ-010** Every 0.11 configuration that sets no `i18n` keeps its URLs, its rendered strings, the meaning of its search arguments and its error semantics.

## Acceptance cases

- **AC-001** [REQ-001] Given `i18n` with `en`, `es` and `uk`, then normalization yields prefixes `''`, `/es`, `/uk`, labels defaulting to the id, `dir` defaulting to `ltr`, and the default locale using the top-level content directory; and given an empty locale list, a malformed or duplicate id, an unknown default locale, a non-default locale with no directory, two locales sharing or nesting one directory, a traversal, an invalid `dir`, an invalid `fallback`, or a locale id equal to `versioning.pathSegment`, then one actionable error is thrown.
- **AC-002** [REQ-002] Given localized and versioned configuration, then catalogs are produced for each published pair using the configured version path segment inside each locale, a locale that declares no archive directory yields no catalog for that archive, a root-mounted tree yields `/`, `/es`, `/uk`, and an unlocalized tree yields exactly what `getDoqVersions` produced.
- **AC-003** [REQ-002, REQ-003] Given `doqPrerenderRoutes` with `i18n`, then each catalog contributes its own index URL and its own `contentDir` and a file transforms to its localized public URL, while an unlocalized site still emits only `/docs`; and given a slug, the language selector links to that slug in a locale that publishes it and to that locale's own index in a locale that does not, never matching a differently-named translation by title.
- **AC-004** [REQ-004] Given a message with `{name}` placeholders, then substitution fills known names and leaves unknown ones intact; the English defaults equal the strings a 0.11 reader sees; and a static adapter returns the fallback for a key it does not translate and resolves links unchanged.
- **AC-005** [REQ-009] Given `formatDoqUsage` with `defaults`, then only values identical to a declared default are omitted, `0` and `false` survive for inputs with no declared default, escaping and unset-input behaviour are unchanged, and omitting `defaults` reproduces 0.11 output byte for byte.
- **AC-006** [REQ-010] Given the existing component and unit suites and a library build, then every test that passed on 0.11 still passes with no `i18n` configured and ng-packagr still builds both entry points.
- **AC-007** [REQ-005] Given a prerendered site with three locales, then a query unique to one language returns rows only from that language and the result URLs carry the locale prefix.
- **AC-008** [REQ-006] Given a localized page rendered by a real server, then the HTML carries the right `lang`, `dir` for an RTL locale, one canonical and an `hreflang` set including `x-default` with no duplicate elements; and given a host that owns the head, Doqs writes none of them.
- **AC-009** [REQ-007] Given a long article at 1440px, then after `window.scrollY` increases past the first screen the TOC's bounding box still starts at its sticky offset, the left sidebar does too, the article has scrolled, and nothing overflows the viewport horizontally; and given a TOC taller than the viewport, it scrolls inside its own rail.
- **AC-010** [REQ-008] Given a running SSR server, then an unknown documentation URL answers 404, a known one answers 200, and a host route below the same prefix with `unmatched: 'continue'` is unaffected.

## Public API impact

Additive. New exports from `@doqs/analog/config`, re-exported from `@doqs/analog`: `normalizeDoqI18n`,
`getDoqCatalogs`, `findDoqCatalog`, `doqLocaleLinks`, `doqReservedSegments`, `assertDoqSlugAvailable`,
`unlocalizedLocale`, `joinDoqLocalePath`, `DOQ_LOCALE_FILTER`, `DOQ_I18N_ADAPTER`, `provideDoqI18n`,
`DOQ_DEFAULT_MESSAGES`, `formatDoqMessage`, `createDoqStaticI18nAdapter`; types `DoqI18nConfig`,
`DoqLocaleConfig`, `DoqResolvedI18n`, `DoqResolvedLocale`, `DoqCatalog`, `DoqLocaleLink`,
`DoqTextDirection`, `DoqI18nAdapter`, `DoqMessageKey`, `DoqMessageParams`, `DoqResolvedPaths`; plus the
`DoqI18n` service and `DoqLocaleSwitcherComponent`.

New optional members: `DoqPaths.i18n`, `formatDoqUsage` options `defaults`,
`DoqPageMetadata.setAlternates` and `setLocale`. New optional CSS tokens `--host-docs-sticky-offset` and
`--host-docs-toc-width`; new `data-toc` and `data-doq-locale` attributes on the documentation region.

Changed declarations: `doqRoutes` now takes `Pick<DoqConfig, 'basePath' | 'routeParam' | 'versioning' |
'i18n' | 'unmatched'>` (a widening; every 0.11 call site still type-checks), `DoqSearchService.search`
gains a fifth optional parameter, and the reserved-prefix error message changed as described above.
`assertDoqSlugNotReserved` is unchanged and still exported.

## Compatibility

Angular `^21.2.2 || ^22.0.0`, Analog `^2.9.0`, Node as declared. `RESPONSE_INIT` is used through an
optional injection and is present in both supported Angular majors (verified in the installed 21.2.25 and
22.2.3 typings), so no peer range widens. Etyma is not a dependency, an optional peer, or an import of
the core: nothing on this branch references it. Static prerendering, SSR and hydration paths are
unchanged for unlocalized sites, and `unmatched: 'continue'` keeps delegating to the host.

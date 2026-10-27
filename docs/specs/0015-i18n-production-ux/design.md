# Design — 0015 internationalization, sticky TOC and production fixes

## Existing implementation

Three layers already separate cleanly, and this milestone extends each without collapsing them:

- **Build-safe configuration** (`packages/doq/config/src/lib/`): `doq-paths.ts` validates
  `contentDirectory`/`basePath` and delegates to `doq-versions.ts`, which resolves `versioning` into a
  list of `DoqVersion` records — `{ id, label, contentDirectory, basePath, current }` — through
  `getDoqVersions()`. `doqPrerenderRoutes()` maps that list to Analog prerender entries. Nothing here
  imports Angular beyond the `DOQ_CONFIG` injection token, so `vite.config.ts` can call it.
- **Runtime** (`packages/doq/src/lib/`): `doq-catalog.ts` turns Analog's `injectContentFiles` glob into a
  sorted catalog per version by filtering on the content directory substring; `doq-routes.ts` builds
  `UrlMatcher` routes per version, writing `doqVersion` into route data and guarding the archive prefix;
  `doq-docs.component.ts` renders the article, the absolutely positioned TOC and the scroll-spy.
- **Chrome** was literals in templates, with `resolveDoqCopy()` supplying only the four
  `presentation` overrides.

`DoqSearchService.search()` already scopes a query by a `doqsVersion` Pagefind filter read from
`data-pagefind-filter` on the article, and `DoqPageMetadata` already claims and restores the host's
title, description and canonical link.

## Proposed implementation

**Locales are the same shape as versions, so they compose instead of nesting.** A locale resolves to
`{ id, label, dir, prefix, contentDirectory, archives, default }` and the renderable unit becomes the
_catalog_: one (locale, version) pair with its own `contentDirectory` and locale-prefixed `basePath`.
`getDoqCatalogs()` returns that matrix — default locale first, current version first — and routes,
prerender entries, search filters, canonical URLs and switcher links are all derived from it, so document
identity is always (locale, version, slug). `getDoqVersions()` is untouched, which is what keeps
unlocalized output byte-identical: `getDoqCatalogs()` on a configuration without `i18n` returns exactly
one catalog per version, with a synthetic empty-id locale from `unlocalizedLocale()`.

The default locale keeps `prefix: ''` and inherits the archive directories `versioning` already declared,
so adding `i18n` to an existing versioned site cannot silently drop its archives. A non-default locale
must name its own current directory and each archive it serves; omitting one means that combination
publishes nothing rather than borrowing another language's Markdown.

**The adapter is the whole provider boundary.** `DoqI18nAdapter` asks for four things — a `locale` signal,
a `direction` signal, `translate(key, fallback, params)` and `localize(path, locale?)` — plus two optional
capabilities, `switchLocale` and `ownsHead`. `DOQ_DEFAULT_MESSAGES` holds every Doqs-owned string, so a
host translates keys it cares about and Doqs supplies the rest; `translate()` is contractually required to
return `fallback` for an unknown key, which is what makes a partial catalog degrade to readable text.

`DoqI18n` never stores locale state. With an adapter it reads the adapter's signal; without one it
derives the locale from the router URL through `toSignal(router.events)`, so the URL stays the single
source of truth and server and client agree without a transfer key. `hostOwnsRouting` reflects the
adapter's explicit optional `ownsRouting` capability; adapter presence and Doqs locale count do not
imply who owns route composition. `localize()` delegates URL composition to an adapter when present.

**Search scoping is one more Pagefind filter.** Research showed a single bundle already splits into
per-language sub-indexes from the detected page language, but the browser API merges across them, so the
locale is passed as `doqsLocale` alongside `doqsVersion`. A localized request fails closed if the index
has no locale metadata or does not include the requested locale; an unlocalized request stays compatible
with legacy indexes.

**Head ownership is explicit.** `setLocale()` and `setAlternates()` only ever touch elements Doqs created
or attributes it recorded, and both are skipped when `adapter.ownsHead` is true — the flag
`provideEtymaAnalog()` implies, since it manages `lang`, `dir`, canonical and `hreflang` by default.
`hreflang` alternates are emitted only for locales that actually publish the document, plus `x-default`,
and only when a `canonicalOrigin` exists to make them absolute.

**The layout becomes a real grid instead of an absolute overlay.** `.doq-root` is a CSS grid whose DOM
order is sidebar, TOC, article. At 1280px and wider it is three columns with each rail
`position: sticky; top: var(--doq-sticky-offset); align-self: start`, so a rail sticks inside its own grid
area — which spans the article's full height — and therefore stops at the article's end instead of sliding
over the footer. Below that the TOC is a static inline box above the article in the content column, where
visual order still matches DOM order. `max-height` uses `100dvh` under `@supports` with a `100vh`
fallback, and `overscroll-behavior: contain` keeps an internal TOC scroll from chaining to the page.

The sticky offset is a host token (`--host-docs-sticky-offset`, defaulting to `1rem`) and also feeds
`--doq-scroll-offset`, so a host with a 64px sticky header reserves space for both the rails and fragment
scrolling without touching a library selector. A TOC that actually overflows gets `tabindex="0"` from the
same browser-side enhancement pass that already handles scrollable tables, so keyboard users can scroll it
without adding a pointless tab stop to a short one; the active link is centred by scrolling the rail only.

**The 404 is decided synchronously.** `RESPONSE_INIT` is `InjectionToken<ResponseInit | null>`, so it is
injected optionally and written only on the server, from the route snapshot and the catalog rather than
from async content resolution — which is what makes it safe under SSG, route extraction and client
rendering, and keeps it off any shared mutable state.

## Tradeoffs and alternatives

- **Locale as a dimension of the catalog versus a parallel routing tree.** Deriving everything from one
  (locale, version) matrix means versions, prerendering, search and canonicals compose for free. The
  rejected alternative — a separate localized route builder wrapping the existing one — would have needed
  every downstream consumer to learn about locales independently, and would have made "archive inside a
  locale" a special case.
- **One Pagefind bundle plus a filter versus a bundle per locale.** Per-locale bundles would give
  physically separate indexes and smaller downloads, but they cost an indexer run per locale, a
  `bundlePath` per locale, and a runtime decision about which bundle to load — and two bundles on one
  page is not a documented Pagefind pattern. The filter is additive to a mechanism already in production.
- **Deriving locale from the URL versus a provided writable signal.** A writable signal would be simpler
  to read, but it is exactly the duplicated mutable locale state the brief forbids, and it would need a
  transfer key to keep SSR and hydration agreeing. Deriving from the router costs one `toSignal` and
  cannot disagree with the URL.
- **Grid with sticky rails versus `position: fixed` or a scroll listener.** Fixed positioning would escape
  the documentation region and overlap a host footer, and a scroll listener would add per-frame layout
  reads; sticky rails are declarative, compositor-friendly and stop naturally at the end of their grid
  area.
- **Changing the reserved-prefix error wording versus keeping two messages.** One message covering locale
  and archive prefixes is more accurate than a message that says "archive" when a locale collided. It
  breaks a test that asserted the old wording, which was updated; the wording is not part of the
  documented public contract.
- **Deferring the `@doqs/analog/etyma` entry point.** Shipping an adapter package without a real consumer
  build to prove its peer ranges and its secondary-entry packaging would have added an unverified public
  surface. The contract it will implement (`DoqI18nAdapter`) is in place and tested, so the entry point is
  additive work rather than a redesign.

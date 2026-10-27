# 0019 — multilingual production acceptance

## Problem

Spec 0015 delivered the locale/version routing, adapter, Pagefind filters, metadata, RTL layout and SSR 404 behavior. Its verification explicitly left real localized output and browser behavior unverified. Host authors cannot rely on a contract that has only unit and mocked-index evidence.

## Consumer impact

Showcase A gains a compact English, Spanish and Arabic fixture alongside its existing English content and archive. Its current English routes remain unchanged. A signal-backed host adapter translates selected interface labels and derives locale from the URL. No public API is changed.

## Scope

Close the production-evidence gaps from 0015: build and query a real multilingual Pagefind index; verify localized prerendered documents, routing, search, RTL, metadata, missing translations and sticky TOC behavior in Chromium; record SSR response status behavior; and document the existing integration contract. Keep independent showcase consumers and CI commands as the reproducible acceptance path.

## Non-goals

No new routing, i18n, search, metadata or RTL implementation; no Etyma bridge without a verified, non-competing integration path; no translation of all showcase content; no search backend or Pagefind replacement; no 1.0 readiness claim; no publish, deploy, or release tag. External adoption repositories are read-only and may be reported NOT RUN if their environment is unavailable.

## Requirements

- **REQ-001** Showcase A must render distinct English, Spanish and Arabic Markdown catalogs with default unprefixed URLs, locale-prefixed routes, a Spanish archive, and no Arabic archive, while preserving the existing English URLs.
- **REQ-002** Locale switching and missing-translation behavior must preserve document/version identity where available and must never infer a translation from titles or silently render another language.
- **REQ-003** The real generated Pagefind index must filter by locale and version, return correctly localized result URLs, omit missing translations, and demonstrate Arabic query behavior for the pinned Pagefind version.
- **REQ-004** Prerendered and hydrated localized pages must carry the correct language and direction, unique canonical and available hreflang links, and the provider-neutral host adapter must keep interface text reactive without duplicate route prefixes.
- **REQ-005** A real-browser assertion must prove sticky TOC geometry below the host header and internal rail scrolling, with responsive, keyboard and accessibility checks for localized content.
- **REQ-006** Real SSR and static HTTP requests must verify known docs, unknown docs, unknown localized docs and a host route delegated by `unmatched: 'continue'`; if Analog does not propagate the not-found status, the runtime, response and static-host distinction must be recorded accurately.
- **REQ-007** User-facing docs must explain locale directories, route/version composition, adapter ownership, search indexing, SSR/SSG, RTL and fallback behavior, and verification must preserve the existing public API and unlocalized consumer contracts.

## Acceptance cases

<!-- Format: - **AC-001** [REQ-001] observable behavior that proves the requirement. -->

- **AC-001** [REQ-001] Given the built Showcase A, then `/docs/guides/localization`, `/es/docs/guides/localization`, `/ar/docs/guides/localization`, and `/es/docs/v/1/guides/localization` contain their own distinct document bodies; pre-existing `/docs/...` pages remain generated, and Arabic has no version 1 catalog.
- **AC-002** [REQ-002] Given the language switcher, then available current-version translations link to the same slug, an absent Spanish translation returns Doqs not-found output, and an unavailable Arabic archive is not offered as a route/translation.
- **AC-003** [REQ-003] Given the actual Pagefind bundle emitted by the Showcase A build, then unique English, Spanish and Arabic queries return only the matching locale; Spanish archive and current results differ by version; cross-locale, cross-version and untranslated English-only searches return no localized result.
- **AC-004** [REQ-004] Given localized prerendered pages after hydration, then html `lang`/`dir`, canonical and alternate metadata match the active locale and configured origin without duplicates; adapter-owned chrome reacts to navigation and generated Doqs paths contain only one locale prefix.
- **AC-005** [REQ-005] Given a tall localized documentation TOC in a 1440px browser viewport, then after page scrolling the TOC and sidebar remain aligned beneath the host header, the TOC scrolls internally, and the page has no horizontal overflow; axe has no serious or critical findings in localized search UI.
- **AC-006** [REQ-006] Given running Analog development SSR and the static prerender output, known documentation returns 200; not-found content renders for unknown docs and unknown localized docs; the observed SSR status behavior is recorded; static files return 404 for absent pages; and a host route delegated by `unmatched: 'continue'` keeps its 200 response.
- **AC-007** [REQ-007] Given the docs, API report, fixture checks and consumer suite, then docs explain the existing public contract, API verification remains additive, unlocalized showcases and search-disabled consumers retain their behavior, and all actual check results are recorded without relabeling previous results.

## Public API impact

None. This milestone adds fixtures, tests and documentation around the existing Doq 0.12 development API. No package export, configuration key, route contract, token, dependency or version is changed.

## Compatibility

Angular 21/22, Analog 2.9 and Node ranges remain those declared by the package. Unlocalized routes and legacy search behavior must remain unchanged. Static output verifies generated localized HTML; Analog SSR status propagation is measured separately because the existing 0015 implementation only sets `RESPONSE_INIT`.

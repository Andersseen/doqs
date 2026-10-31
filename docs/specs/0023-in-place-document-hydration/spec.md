# 0023 — in place document hydration

## Problem

Production SSR/SSG emits a fully rendered Doqs article, but `DoqDocsComponent` initially renders a loading placeholder in the browser while it asynchronously imports and renders the Markdown module. Angular therefore removes the prerendered document tree and creates a second tree. The final page looks correct, hiding the lost in-place hydration. This is a Doqs-owned runtime defect recorded as blocker 14 in the 1.0 readiness document.

## Consumer impact

Direct documentation loads retain server-rendered DOM and avoid a second document render. Client navigation continues to resolve the selected document before updating the view.

## Scope

Resolve one document at the Angular Router activation boundary using the existing catalog, content aliases, Markdown parser and renderer. Keep resolver internals private, preserve public routes and configuration, and add DOM identity checks in browser tests, including packed consumers.

## Non-goals

No 1.0 declaration, Analog build-race workaround, dev-server 404 change, skip-hydration or warning suppression, eager Markdown bundling, new network dependency, fallback-policy change, playground overlay work, or manual publication/deployment.

## Requirements

- **REQ-001** A direct documentation load preserves the existing SSR document root, headings and content nodes through client hydration.
- **REQ-002** The selected Markdown document, including parsed attributes and rendered TOC, is ready before `DoqDocsComponent` creates its initial view on both server and client.
- **REQ-003** Client navigation, Back/Forward, focus, fragments and scroll restoration continue to work without stale document content.
- **REQ-004** Locale/version catalog selection, configured default-locale fallback, missing translation, archive and unknown-version behavior remain unchanged.
- **REQ-005** Host-owned routes, unknown routes, unmatched modes and SSR/SSG output, status and metadata contracts remain compatible.
- **REQ-006** Rich Markdown, registered demos, playgrounds, controls, slots, authored content and generated API pages continue to render and operate.
- **REQ-007** Packed Angular 21 and Angular 22 consumers retain public API and Zone.js compatibility.
- **REQ-008** Loading does not eagerly bundle all documents or regress determinism, accessibility, SSR parity or existing performance budgets.

## Acceptance cases

- **AC-001** [REQ-001, REQ-002] On direct loads of supported docs pages in showcase A, showcase B and the official site, capture the prerendered `.doq-root`, article and first `h1` before application scripts execute; after hydration each same DOM node remains connected, no loading placeholder was inserted, hydration markers are consumed, and no hydration warning is logged.
- **AC-002** [REQ-001, REQ-002, REQ-007] For Angular 21 embedded, Angular 21 docs-first and Angular 22 embedded consumers built from the packed tarball, assert identity of the server-rendered documentation root and heading after hydration; an original-behavior negative control must fail this assertion.
- **AC-003** [REQ-003] Browser journeys cover index → document, document → document, document → index, Back, Forward, fragment/TOC navigation, focus restoration and saved scroll restoration, including navigation while a document is resolving.
- **AC-004** [REQ-004] Component and browser cases cover default, Spanish and Arabic RTL documents; translation present/missing with and without configured fallback; current and archived versions; unavailable locale/version combinations; unknown versions; custom route parameter; and both unmatched policies.
- **AC-005** [REQ-005] Contract and browser cases verify root-mounted and `/docs` routes, host route delegation, direct SSG pages, page title/description/canonical/hreflang ownership, and existing 404 behavior.
- **AC-006** [REQ-006] Rich-content browser cases prove Markdown, highlighting, callouts, tabs, steps, demos, playground controls/events, copy, slots and generated/authored pages initialize once and remain usable after hydration and navigation.
- **AC-007** [REQ-007] Packed artifact tests prove Angular 21/22, embedded/docs-first, legacy unversioned, search-disabled, localized/versioned and existing Zone.js consumer compatibility, and `verify:public-api` passes.
- **AC-008** [REQ-008] SSR text remains deterministic and parity is preserved; performance, lazy chunk/bundle budgets, accessibility and console checks pass without preloading every Markdown module.

## Public API impact

None intended. `doqRoutes()` keeps its signature; resolver and resolved document shape remain internal. Package version and release metadata may change only after 0.13.0 publication is resolved and all release evidence passes.

## Compatibility

Preserve Angular 21.2/22, Analog `^2.9.2`, supported Node and Pagefind ranges, and all existing route/config/catalog behavior. SSR and static prerender must begin with the same resolved document state as client hydration.

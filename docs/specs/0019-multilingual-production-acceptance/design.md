# Design — 0019 multilingual production acceptance

## Existing implementation

Spec 0015 owns the behavior: `packages/doq/config/src/lib/doq-i18n.ts` normalizes locale/version catalogs; `doq-routes.ts` builds localized routes; `doq-docs.component.ts` renders route-scoped documents, metadata and filter attributes; `doq-i18n.ts` reads the provider adapter; `doq-search.service.ts` applies fail-closed Pagefind filters; and `styles.css` implements logical RTL layout and sticky rails. Existing unit/component coverage has no generated localized site. Showcase A already builds static output and indexes it with Pagefind, so it is the smallest real host that exercises an embedded docs region and archived versions.

## Proposed implementation

Add only a handful of Markdown pages in the existing English content directory and new Spanish, Arabic and Spanish-archive directories. Extend `doq.paths.ts` with the existing `i18n` configuration. A Showcase A adapter derives its signal from `Router` navigation events, explicitly leaves route ownership to Doqs, and translates representative chrome. A Playwright suite reads the actual generated Pagefind module and checks real prerendered/hydrated routes, metadata, filters, RTL and keyboard-visible localized UI. Add a geometry assertion to the existing TOC suite. Run a separate Analog dev server for HTTP status checks; do not simulate statuses in the browser. Document the tested contract in the official site's Markdown and package README.

## Tradeoffs and alternatives

The suite queries Pagefind in the browser because inspecting filter attributes alone does not prove index inclusion, language segmentation or URL correctness. It uses one shared index because that is the existing product architecture. No Etyma bridge is planned: package version metadata can be checked, but route and SEO ownership must not be combined with Doqs prefixes without a reproducible real host test. Keep 0.12 unreleased until the full required gates and adoption checks establish release readiness.

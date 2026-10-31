---
title: Migration and compatibility
description: What has been verified, what has not, and how upgrades behave.
group: Reference
order: 30
---

## Verified environments

| Environment | Evidence |
| --- | --- |
| Angular 21.2, TypeScript 5.9, Analog 2.9 | Unit, component, contract, end-to-end and tarball-consumer suites |
| Angular 22.2, TypeScript 6.0, Analog 2.9 | A focused smoke suite against the packed tarball: strict peers, `doq-api check`, `doq-search`, prerender, hydration, navigation, search, versions |
| Zoneless Angular | Both environments run without Zone.js |
| Zone.js (Angular 21) | The embedded consumer with `zone.js` and `provideZoneChangeDetection()`: routing, playground inputs and outputs, search, versions, hydration |
| Real sites | Angular Movement and Volt UI, built with Doqs pages at their original URLs (disposable clones, Angular 22, zoneless) |
| Windows (Node tooling) | Content generation and API checks on CRLF sources, junctions and paths with spaces, in CI; browsers on Windows are not tested |
| Chromium, Firefox, WebKit | Engine-dependent journeys; the full suite runs in Chromium |

Node.js `^20.19 || ^22.12 || >=24`.

## Documentation hydration

Since 0.14, the document route resolves its Markdown before `DoqDocsComponent` creates its first view. On a direct production load, Angular hydrates the prerendered documentation root, article and heading in place; the browser tests verify node identity rather than only comparing final HTML. The checks cover Showcase A and B, the official site, Spanish and Arabic RTL catalogs, an archived version, and packed Angular 21 embedded/docs-first and Angular 22 embedded consumers. Client navigation, Back/Forward, focus and the unknown-page state are covered separately.

Hydration does not prevent the intermittent upstream Analog client/SSR compilation race described in the changelog. `doq doctor --build` detects a bundle that needs an unavailable Angular JIT compiler. The Analog live SSR 404 limitation also remains unchanged.

## Not verified

- Zone.js on Angular 22.
- Unsupported Angular/Analog/Vite combinations beyond the tested matrix.
- Screen-reader output, Windows high-contrast themes and WCAG certification.
- Mobile browsers beyond viewport emulation.

Peer ranges are not widened without testing. `doq doctor` reports a version outside the declared range as a failure and a range it cannot evaluate as `UNKNOWN`.

## Upgrading

Configuration objects from earlier releases keep working unchanged. Search, versioning, API generation and the Vite helper are opt-in. Each release's changes are in the [changelog](https://github.com/Andersseen/doqs/blob/main/packages/doq/CHANGELOG.md).

## Migrating an existing documentation area

Either mount Doqs under a different `basePath` (for example `/handbook`) while existing `/docs` routes keep working and switch later, or mount it on the existing prefix with `unmatched: 'continue'` and replace pages at their own URLs one by one. See _Adopting Doqs in an existing library site_. The repository's migration guide walks through an Angular Movement example.

## Stability

Doqs is pre-1.0. The public surface is listed on the [public API page](/docs/reference/public-api) with its stability intent; removals are preceded by deprecation and noted in the changelog.

---
title: Deployment and CI
description: Build a static documentation site, index it for search and run checks in CI.
group: Operations
order: 21
---

Doqs output is static HTML, so any static host works. No permanent server is required.

## Build

```json
"scripts": {
  "build": "vite build && doq-search index dist/analog/public"
}
```

`vite build` prerenders every route that `doqPrerenderRoutes()` returns; `doq-search index` then adds the Pagefind bundle next to the pages. Skip the second command if search is off.

## Static hosting

Serve `dist/analog/public`. Each prerendered route is an `index.html` in its own folder (or `route.html` when Nitro's `prerender.autoSubfolderIndex` is `false`, as Cloudflare Pages prefers), so direct links and refreshes work on any static host. `docs:check` and `doq doctor --build` understand both layouts. URLs that were not generated must answer 404; unknown documentation URLs then show a "page not found" view after in-app navigation.

## Checks for CI

:::steps

1. `pnpm exec doq doctor --strict` fails on missing wiring, bad frontmatter, duplicate slugs and unresolved checks.
2. `pnpm build` produces the static site.
3. `pnpm exec doq doctor --build` confirms every documentation route has static HTML and, with search enabled, that the Pagefind bundle exists.
4. If you generate API pages, run `pnpm exec doq-api check ...` so a stale reference fails the pull request.

:::

## Canonical URLs

Doqs does not know your origin. This site reads `DOQ_SITE_ORIGIN` at build time and writes a canonical link and sitemap only when it is set. For versioned sites, `versioning.canonicalOrigin` lets each documentation page declare its own canonical URL.

## Publishing the package

Releases of `@doqs/analog` itself use npm Trusted Publishing from GitHub Actions; no token is stored. The site is deployed to Cloudflare Pages by a separate workflow that uploads the exact static output CI verified.

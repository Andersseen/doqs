---
title: Versioned documentation
description: Keep the documentation of older releases readable at stable URLs.
group: Guides
order: 16
---

Versioning is optional. Without a `versioning` setting nothing changes. This site does not use it, because Doqs documents only its latest release, so the example below is illustrative.

```ts
export const doqPaths = {
  contentDirectory: 'docs', // the CURRENT documentation
  basePath: '/docs',
  versioning: {
    current: { id: 'latest', label: 'Latest' },
    archives: [
      { id: '1.3', label: 'v1.3', contentDirectory: 'docs-v1-3' },
      { id: '1.2', label: 'v1.2', contentDirectory: 'docs-v1-2' },
    ],
  },
} as const;
```

## Layout and URLs

Each version is an independent folder; nothing is copied or synchronized for you.

```text
src/content/docs/        → /docs, /docs/installation
src/content/docs-v1-3/   → /docs/v/1.3, /docs/v/1.3/installation
src/content/docs-v1-2/   → /docs/v/1.2, /docs/v/1.2/installation
```

The current version has exactly one URL per page, so existing links keep working. With `basePath: '/'` the archives are `/v/1.3`.

## Rules

- Version ids are unique and use letters, numbers, `.`, `_` and `-`.
- Content folders must not equal or contain one another (`docs` and `docs-v1` are fine; `docs` and `docs/v1` are not).
- The first slug segment `v` is reserved in the current version; change `versioning.pathSegment` if you need it.
- An archive without Markdown files is an error rather than an empty version.

## Selector and switching

With more than one version, a native selector appears in the sidebar. Switching keeps context by public slug: the same document if the target version has it, otherwise that version's index. Archived pages show a notice linking to the latest documentation.

## Search and SEO

One index serves all versions; the dialog filters to the version being read. Archive titles end with the version label. Set `versioning.canonicalOrigin` to an origin to let each page declare its own canonical URL.

## Archiving a release

:::steps

1. Copy the current folder: `cp -R src/content/docs src/content/docs-v2`.
2. Fix absolute links in the snapshot (`/docs/…` becomes `/docs/v/2/…`).
3. Add `{ id: '2', label: 'v2', contentDirectory: 'docs-v2' }` to `archives`.
4. Build; every version is prerendered and the search index is rebuilt.

:::

`doq doctor` checks archive ids, overlapping folders and missing archive directories.

## Localized documentation

Give each locale an independent Markdown directory. The default locale keeps its URLs; other locales get a prefix, and archives are listed only for locales that publish them. Doqs matches translations by slug, never title.

```ts
// src/doq.paths.ts
export const doqPaths = {
  contentDirectory: 'docs', basePath: '/docs',
  versioning: { current: { id: 'latest' }, archives: [{ id: '1', contentDirectory: 'docs-v1' }] },
  i18n: { defaultLocale: 'en', fallback: 'none', locales: [
    { id: 'en', label: 'English' },
    { id: 'es', label: 'Español', contentDirectory: 'docs-es', archives: { '1': 'docs-es-v1' } },
    { id: 'ar', label: 'العربية', dir: 'rtl', contentDirectory: 'docs-ar' },
  ] },
} as const;
```

A complete Analog host adapter derives its state from the Router and is registered with Doqs:

```ts
// src/app/app.config.ts
import { computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { provideContent, withMarkdownRenderer } from '@analogjs/content';
import { provideFileRouter, withExtraRoutes } from '@analogjs/router';
import { defineDoqConfig, doqRoutes, provideDoq, DOQ_I18N_ADAPTER } from '@doqs/analog';
import { doqPaths } from '../doq.paths';
const config = defineDoqConfig(doqPaths);
const hostI18n = { provide: DOQ_I18N_ADAPTER, useFactory: () => {
  const router = inject(Router);
  const url = toSignal(router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => router.url)),
    { initialValue: router.url });
  const locale = computed(() => url().split('/').filter(Boolean)[0] ?? 'en');
  return { locale, direction: computed(() => locale() === 'ar' ? 'rtl' : 'ltr'),
    translate: (_key: string, fallback: string) => fallback, localize: (path: string) => path,
    ownsRouting: false, ownsHead: false };
} };
export const appConfig = { providers: [provideContent(withMarkdownRenderer()),
  provideFileRouter(withExtraRoutes(doqRoutes(config))), provideDoq(config), hostI18n] };
```

Put matching slugs in `src/content/docs-es` or `docs-ar`; the Spanish archive uses `docs-es-v1`. `fallback: 'default-locale'` is an alternative that shows a notice. After prerendering, run `doq-search index`; locale and version filters compose, and localized search fails closed without locale metadata. Pagefind stays optional.

Set `ownsRouting: true` only when the host creates localized routes; set `ownsHead: true` only when it owns language, direction, canonical and alternate metadata. Use the same URL-derived locale for SSR and hydration. Vite SSR currently renders not-found content with HTTP 200, while static missing routes return 404. Set `dir: 'rtl'` for Arabic and verify keyboard and sticky-TOC behavior against the host header.

# 0015 research — verified external findings

The historical sections below record artifacts and installed packages inspected on 2026-10-25. Evidence
paths are given so those claims can be re-checked. The 2026-10-27 recheck at the end supersedes the Etyma
version and source-status claims where they differ; no current Etyma declaration is inferred from a README.

This file is the **decision summary**. Three companion files in this directory carry the full traces, and
where they go further than a section below, they are authoritative:

- [`etyma-public-api.md`](etyma-public-api.md) — complete Etyma 1.0.0 surface, declarations and peer analysis.
- [`vite-front-matter-dev-server.md`](vite-front-matter-dev-server.md) — full AM-01 mechanism, upstream status and ranked remediations.
- [`angular-replay-and-response-init.md`](angular-replay-and-response-init.md) — source-level trace of the event-replay contract and of `RESPONSE_INIT`.

## Recheck on 2026-10-27

The published-version detail in §4 is stale for a new integration. npm package listings currently surfaced
`@etyma/angular` **0.1.0**, `@etyma/core` **0.1.0**, and `@etyma/analog` **0.2.0**. This differs from the 1.0.0
tarballs captured on 2026-10-25. The GitHub API could not be reached in this environment, and the current
published tarballs could not be fetched by the local package client, so the current declaration files, peer ranges,
and route/head ownership contract remain **unverified**. Do not implement or claim an Etyma adapter from §4 alone;
reinspect the current published tarballs and source when registry access is available.

Two sections below were written before those traces finished and are deliberately conservative: §3 records
that _this_ pass did not finish the replay trace (the companion file carries the source-level reading, which
still stops short of the empirical A–F matrix), and §5 resolved Pagefind from typings rather than from a
generated index.

## 1. AM-01 — Vite dev server, `front-matter` default export

**Root cause: an Analog packaging defect that Doqs surfaces, not a Doqs defect.**

| Fact                                                                                                                                           | Evidence                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@analogjs/content@2.9.0` declares `front-matter: "^4.0.2"` as a **non-optional peer dependency**                                              | `node_modules/.pnpm/@analogjs+content@2.9.0_*/node_modules/@analogjs/content/package.json` → `peerDependencies`; `peerDependenciesMeta` marks only `@nx/devkit`, `satori`, `satori-html`, `sharp` optional |
| Its **browser** bundle uses a **default import** of it                                                                                         | `.../@analogjs/content/fesm2022/analogjs-content.mjs:7` → `import fm from "front-matter";`                                                                                                                 |
| `front-matter@4.0.2` is **CommonJS-only**                                                                                                      | `node_modules/.pnpm/front-matter@4.0.2/node_modules/front-matter/package.json` → `{ "main": "index.js" }`, no `type`, no `module`, no `exports`                                                            |
| `DoqDocsComponent` calls `parseRawContentFile` **at runtime in the browser**, which is what pulls `front-matter` into the browser module graph | `packages/doq/src/lib/doq-docs.component.ts` (import of `parseRawContentFile` from `@analogjs/content`, used inside the `document()` signal)                                                               |
| All three doq apps declare `front-matter` as a **direct dependency**, which masks the bug in this repo                                         | `apps/showcase-a/package.json:12`, `apps/showcase-b/package.json:12`, `apps/site/package.json:34`                                                                                                          |

Mechanism: under pnpm's isolated layout a peer that the consumer does not declare directly is not
resolvable from the application root, so Vite's dep optimizer cannot pre-bundle it into ESM. In **dev**
the browser then loads the raw CJS file through native ESM and rejects the default import
("does not provide an export named 'default'"). In `vite build`, Rollup performs CJS interop, so
production is unaffected — matching the consumer's report exactly.

Consequences for this milestone:

1. This repo **cannot reproduce AM-01** while the apps keep `front-matter` as a direct dependency. Any
   regression test must use a consumer that does not declare it (the packed-tarball consumer matrix).
2. The correct remediations, in order of safety, are: documented `optimizeDeps.include`
   guidance; a Doqs-owned opt-in Vite helper that **merges** into an existing `optimizeDeps.include`
   (`packages/doq/bin/vite.mjs` is the existing home for it); and an actionable `doq doctor` check.
   Removing the runtime `parseRawContentFile` call would fix it outright but changes the public
   rendering path, so it is out of scope for 0.12.
3. `front-matter` being a non-optional peer of a package Doqs peers on means Doqs's own docs should
   tell consumers to install it — this is an upstream ownership question for Analog.

## 2. `RESPONSE_INIT` (AM-04 — SSR soft 404)

Public and present in both supported majors:

```ts
declare const RESPONSE_INIT: InjectionToken<ResponseInit | null>;
```

- Angular 21.2.25: `node_modules/.pnpm/@angular+core@21.2.25_*/node_modules/@angular/core/types/core.d.ts:9416`, exported by name in the same file's export list.
- Angular 22.2.3: `node_modules/.pnpm/@angular+core@22.2.3_*/node_modules/@angular/core/types/core.d.ts:3062`, likewise exported.

The type is `ResponseInit | null`, so a null-check is mandatory: it is null for client rendering and
for any context that has no server response (SSG, build, route extraction). Mutating `status` on the
injected per-request object is the supported shape; the token is provided per request by the SSR
engine, so it does not leak across requests as long as Doqs never caches it beyond the request.

Whether **Analog** propagates that status to the HTTP response in dev and in its production SSR server
was **not proven** by reading artifacts in this session. It must be measured against a running SSR
server before the fix is claimed; if Analog drops it, that is an upstream limitation to report, not a
Doqs defect to hide.

## 3. Event replay before hydration (AM-02)

Verified from the installed Angular packages:

- `withEventReplay` is **private in core** (`ɵwithEventReplay` in the `@angular/core` export list, both 21.2.25 and 22.2.3) and public through `@angular/platform-browser`.
- Core ships an inline dispatcher script at the package root: `event-dispatch-contract.min.js` (present in both 21.2.25 and 22.2.3).
- Related internals in the same export list: `EVENT_REPLAY_QUEUE` (as `ɵEVENT_REPLAY_QUEUE`) and `JSACTION_BLOCK_ELEMENT_MAP` (as `ɵJSACTION_BLOCK_ELEMENT_MAP`).
- `annotateForHydration` and `readHydrationInfo` are exported privately, i.e. the SSR pass annotates elements for hydration.

The presence of `JSACTION_BLOCK_ELEMENT_MAP` and `annotateForHydration` indicates the replay contract is
driven by **SSR-time annotation of the hydrated view graph** rather than by a blanket document-level
listener for arbitrary elements. That is consistent with the reported symptom (a host navbar button
replays, a button inside a lazily loaded documentation region does not), but this session did **not**
complete a source-level trace of `collectDomEventsInfo` / `invokeListeners`, so the precise ownership
verdict is still open. It must be settled by the isolated A–F test matrix with a deliberately delayed
JS asset, and reported as either a Doqs defect or an upstream Angular limitation — never assumed.

## 4. Etyma 1.0.0 public API

Read from the published tarballs (`npm pack @etyma/{core,angular,analog}`, extracted to
`/tmp/etyma-research`). All three are ESM (`"type": "module"`) with a **single** `.` entry point — there
are no secondary entry points to import selectively.

### `@etyma/core` (`core/dist/index.d.ts`)

Portable engine, no Angular/DOM/Node built-ins; depends on `messageformat@4.0.0`. Exports include
`assertWellFormedLocale`, `isWellFormedLocale`, `localeDirection`, `Locale`, `TextDirection`,
`defineI18n`, `defineMessages`, `createLocaleRouter`, `createTranslator`, `createCatalogRegistry`,
`createMessageFormatter`, `createHttpMessageLoader`, `loadMessageCatalog`, `defineRemoteI18n`.

### `@etyma/angular` (`angular/types/etyma-angular.d.ts`)

```ts
declare class EtymaI18n<TKey extends string = string, TParams extends MessageParamsMap = Record<never, never>> {
  get locales(): readonly Locale[];
  get sourceLocale(): Locale;
  readonly locale: Signal<Locale>;
  readonly direction: Signal<TextDirection>;
  readonly ready: Signal<boolean>;
  readonly t: TranslateFn<TKey, TParams>;
  readonly parts: PartsFn<TKey, TParams>;
  readonly has: (key: TKey) => boolean;
  readonly path: (to: string, locale?: Locale) => string;
  isLoaded(locale: Locale): boolean;
  load(locale: Locale): Promise<void>;
  activate(locale: Locale): Promise<void>;
  setLocale(locale: Locale): Promise<void>;
}
declare function provideEtyma<TKey extends string>(definition: I18nDefinition<TKey>, options?: EtymaOptions): EnvironmentProviders;
declare function injectI18n<TKey extends string = string, TParams extends MessageParamsMap = Record<never, never>>(definition?: I18nDefinition<TKey, TParams>): EtymaI18n<TKey, TParams>;
declare function injectT<...>(definition?: I18nDefinition<TKey, TParams>): TranslateFn<TKey, TParams>;
declare const ETYMA_DEFINITION: InjectionToken<I18nDefinition<string, Record<never, never>>>;
declare const ETYMA_LOCALE_SWITCH: InjectionToken<(locale: Locale) => Promise<void>>;
```

Documented in the shipped JSDoc: state is per-application-injector (one per request on a server), the
locale is the only signal input and `t` is derived from it, hydration state is transferred
(`transferState` / `writeHydrationState` private members), and `setLocale()` delegates to
`ETYMA_LOCALE_SWITCH` when provided so the URL stays the single source of truth.

### `@etyma/analog` (`analog/types/etyma-analog.d.ts`)

```ts
declare const ETYMA_LOCALE_PARAM = 'etymaLocale';
declare function withLocalizedRoutes(): RouterFeatures;
declare function provideEtymaAnalog(options?: EtymaAnalogOptions): EnvironmentProviders;
interface EtymaAnalogOptions {
  readonly origin?: string;
  readonly seo?: boolean;
}
```

Decisive facts for the Doqs integration:

- `withLocalizedRoutes()` takes **no arguments** and returns `RouterFeatures` for `provideFileRouter`. Its JSDoc states it "serves every file-based page under both `/` and `/<locale>/`", inserting the prefixed branch **ahead of** the file-based routes so `/es/docs` cannot be mistaken for a page called `es`, and that both branches share one `Routes` array. **Etyma therefore already owns localized route composition for an Analog host.** Doqs must not emit a competing prefix in that mode.
- `provideEtymaAnalog({ seo })` — **on by default** — manages `<html lang>`, `dir`, the canonical link and the `hreflang` set. Its JSDoc says to turn it off in an application that writes its own head. **This fixes the SEO ownership boundary: when the host uses `provideEtymaAnalog()` with SEO on, Doqs must not write `lang`/`dir`/`hreflang`.**
- `provideEtymaAnalog()` resolves the locale from the request path during application initialization, before the router navigates, and never reads `localStorage`.
- `EtymaI18n.path(to, locale?)` is the locale-aware link resolver Doqs should delegate to rather than reimplementing.

### Peer compatibility

| Package          | peerDependencies                                                                                                                                                    | Verdict for Angular 22.2.3 / Analog 2.9.1 / Vite 8.3.5                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `@etyma/core`    | none                                                                                                                                                                | Unconstrained.                                                                        |
| `@etyma/angular` | `@angular/common`, `@angular/core`: `^21.0.0 \|\| ^22.0.0`                                                                                                          | Satisfied by 22.2.3.                                                                  |
| `@etyma/analog`  | `@analogjs/router`: `>=2.6.0 <3`; `@angular/common`, `@angular/core`: `^21.0.0 \|\| ^22.0.0`; `@angular/router`: `^21.0.0 \|\| ^22.0.0`; `@etyma/angular`: `^1.0.0` | Satisfied by Analog 2.9.1. **No Vite peer at all**, so Vite 8.3.5 raises no conflict. |

No `peerDependenciesMeta` in any of the three, so `@etyma/angular` is a hard peer of `@etyma/analog`.
pnpm reports no conflict for the Angular Movement stack. Nothing needs `--force` or
`--legacy-peer-deps`, and Doqs must not add Etyma to its own dependencies or peers.

## 5. Pagefind multilingual — resolved: one bundle plus a locale filter

Read from the pinned `pagefind@1.5.2` typings
(`node_modules/.pnpm/pagefind@1.5.2/node_modules/pagefind/types/index.d.ts`) and from Doqs's own indexer:

- `createIndex` accepts `forceLanguage?: string`, documented as _"Ignore any detected languages and index the whole site as a single language. Expects an ISO 639-1 code."_ (line 30). The existence of an override proves language is otherwise **detected per page**, from the document language.
- `addCustomRecord`'s `language` field is documented as _"What language is this record written in. **Multiple languages will be split into separate indexes.** Expects an ISO 639-1 code."_ (line 139).
- The written bundle therefore carries a per-language map: `indexDoqSearch` already reads `pagefind-entry.json` and sums `Object.values(entry.languages).page_count` (`packages/doq/bin/search-index.mjs`), which only makes sense because one bundle holds several language sub-indexes.

**Conclusion.** A single Pagefind bundle is the right architecture: it detects each page's language and
splits it into the correct per-language sub-index, so stemming and segmentation stay right for `es`, `uk`
and `ar` without Doqs running one indexer per locale. What a single bundle does _not_ do on its own is
restrict a query to one language — the browser API merges results across the sub-indexes.

So locale scoping must be an explicit filter, exactly like the version scoping Doqs already ships:
`data-pagefind-filter="doqsLocale:<id>"` on the indexed element, passed as
`search(query, { filters: { doqsLocale, doqsVersion } })`. This is additive to the proven
`doqsVersion` mechanism (`config/src/lib/doq-search.ts`, `doq-search.service.ts`), needs no second
bundle, no second HTTP round trip and no new search engine, and preserves unlocalized behaviour because a
site without `i18n` simply emits no `doqsLocale` filter.

Precondition this creates for search correctness: every prerendered page must carry the right
`<html lang>`, which is the same requirement the SEO work imposes. Still to confirm empirically against
real generated indexes (not from typings): that `es`, `uk` and `ar` are among Pagefind's supported
language codes, and that a query unique to one language returns no rows from the others once the filter
is applied. That is what the multilingual Pagefind test must assert.

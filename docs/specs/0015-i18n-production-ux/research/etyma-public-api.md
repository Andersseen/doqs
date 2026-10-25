# Etyma public API — verified research

Research for the optional `@doqs/analog/etyma` adapter. Every fact below was read from the
**packed npm tarballs** of `@etyma/core@1.0.0`, `@etyma/angular@1.0.0`, `@etyma/analog@1.0.0`
(extracted to `/tmp/etyma-research/{core,angular,analog}`) and from a shallow clone of
`https://github.com/Andersseen/etyma` at `main` (`/tmp/etyma-src`, HEAD `b865f3a`).

Method: static only. Declarations (`.d.ts`), bundled ESM sources (`fesm2022/*.mjs`),
`package.json` manifests, READMEs and the upstream playground app. **No application was
built or run**, so every behavioural claim below is derived from shipped source, not observed
at runtime. Anything that could not be established is in [Unclear / not found](#unclear--not-found).

---

## 1. Verified facts

### 1.1 Package inventory and entry points

| Package          | Version | Entry points (`exports` keys) | Secondary entry points |
| ---------------- | ------- | ----------------------------- | ---------------------- |
| `@etyma/core`    | 1.0.0   | `.`, `./package.json`         | **none**               |
| `@etyma/angular` | 1.0.0   | `.`, `./package.json`         | **none**               |
| `@etyma/analog`  | 1.0.0   | `.`, `./package.json`         | **none**               |

Evidence: `core/package.json`, `angular/package.json`, `analog/package.json` (packed tarballs).

**Correction to a likely assumption:** `@etyma/angular` and `@etyma/analog` are _separate npm
packages_, not Angular secondary entry points of one library. Neither is ng-packagr
`secondary-entrypoint`-shaped; each ships a single `fesm2022/*.mjs` + `types/*.d.ts` pair
(`angular/module`, `angular/typings`, `analog/module`, `analog/typings`). Only `@etyma/tooling`
in the monorepo uses real subpaths — `.`, `./vite`, `./source`, `./angular`, `./astro`,
`./package.json` (evidence: `/tmp/etyma-src/packages/tooling/package.json`) — and
`@etyma/cli` exposes **only** `./package.json` (no importable entry point).

Layout of the runtime trio (evidence: tarball file listings):

- `core/dist/{index,locale,messages,define-i18n,remote-i18n,routing,format,loader,translator,catalog-registry,errors}.{js,d.ts}` — plain `tsc` output, ESM, `.js` extensions in imports.
- `angular/fesm2022/etyma-angular.mjs` + `angular/types/etyma-angular.d.ts` (319 lines of JS).
- `analog/fesm2022/etyma-analog.mjs` + `analog/types/etyma-analog.d.ts` (389 lines of JS).

All three set `"type": "module"`, `"sideEffects": false`, `"engines": { "node": ">=22.22.0" }`.
`@etyma/angular` and `@etyma/analog` are compiled with partial-Ivy declarations
(`ɵɵngDeclareFactory`, `minVersion: "12.0.0"`, `version: "21.2.25"` — evidence:
`angular/fesm2022/etyma-angular.mjs:204-209`).

### 1.2 The four symbols the integration will touch — all CONFIRMED, with corrections

| Believed symbol         | Verdict       | Actual location / signature                                                |
| ----------------------- | ------------- | -------------------------------------------------------------------------- |
| `EtymaI18n`             | **CONFIRMED** | class, exported from `@etyma/angular`                                      |
| `withLocalizedRoutes()` | **CONFIRMED** | `@etyma/analog`, takes **zero** arguments                                  |
| `provideEtymaAnalog()`  | **CONFIRMED** | `@etyma/analog`, optional `EtymaAnalogOptions`                             |
| `defineI18n()`          | **CONFIRMED** | exported from **`@etyma/core`**, not from `@etyma/angular`/`@etyma/analog` |

Correction worth flagging for the adapter design: registration is **`provideEtyma(definition, options?)`
from `@etyma/angular`**, and it is _required alongside_ `provideEtymaAnalog()`. There is no
`provideEtymaAnalog()`-only wiring; `provideEtymaAnalog()` injects `ETYMA_DEFINITION` and
`EtymaI18n`, both of which only `provideEtyma()` supplies.

Full export list of `@etyma/analog` (evidence: last line of `analog/fesm2022/etyma-analog.mjs`):

```js
export { ETYMA_LOCALE_PARAM, provideEtymaAnalog, withLocalizedRoutes };
```

Nothing else. In particular **the route guards are not exported** — `isLocalePrefix`,
`isSourceLocalePrefix`, `redirectSourceLocalePrefix`, `activatePrefixedLocale` and
`activateSourceLocale` are module-private `const`s (`analog/fesm2022/etyma-analog.mjs:20-68`).

Full export list of `@etyma/angular` (evidence: `angular/types/etyma-angular.d.ts`, final export line):

```ts
export { ETYMA_DEFINITION, ETYMA_LOCALE_SWITCH, EtymaI18n, injectI18n, injectT, provideEtyma };
export type { EtymaOptions, PartsFn, TranslateFn };
```

`@etyma/core`'s entry point re-exports ten modules (evidence: `core/dist/index.d.ts`); the
symbols relevant here are `defineI18n`, `defineMessages`, `defineMessageContract`,
`defineRemoteI18n`, `createLocaleRouter`, `localeDirection`, `isWellFormedLocale`,
`createHttpMessageLoader`, `loadMessageCatalog`, `createTranslator`, `createCatalogRegistry`,
`EtymaError`, and the types `Locale`, `TextDirection`, `I18nDefinition`, `I18nOptions`,
`MessageSource`, `MessageCatalog`, `MessageContract`, `LocaleRouter`, `MessageLoader`.

### 1.3 `withLocalizedRoutes()` — exact declaration

Evidence: `analog/types/etyma-analog.d.ts`.

````ts
/**
 * The route parameter the locale prefix is captured in.
 *
 * Prefixed rather than `locale` so it cannot collide with a parameter an application's own
 * page happens to use.
 */
declare const ETYMA_LOCALE_PARAM = 'etymaLocale';

/**
 * Serves every file-based page under both `/` and `/<locale>/`.
 *
 * ```ts
 * provideFileRouter(withLocalizedRoutes())
 * ```
 * ...
 */
declare function withLocalizedRoutes(): RouterFeatures;
````

Implementation (evidence: `analog/fesm2022/etyma-analog.mjs:86-109`, verbatim):

```js
function withLocalizedRoutes() {
  const localized = [
    {
      path: `:${ETYMA_LOCALE_PARAM}`,
      canMatch: [isSourceLocalePrefix],
      canActivate: [redirectSourceLocalePrefix],
      children: routes,
    },
    {
      path: `:${ETYMA_LOCALE_PARAM}`,
      canMatch: [isLocalePrefix],
      canActivate: [activatePrefixedLocale],
      // The prefix changes without the branch being rebuilt when switching between two
      // prefixed locales, so the guard has to run on every navigation, not only the first.
      runGuardsAndResolvers: 'always',
      children: routes,
    },
    {
      path: '',
      canActivate: [activateSourceLocale],
      runGuardsAndResolvers: 'always',
      children: routes,
    },
  ];
  return withExtraRoutes(localized);
}
```

`routes` and `withExtraRoutes` are imported from `@analogjs/router`
(`analog/fesm2022/etyma-analog.mjs:3`). Answers to the specific questions:

- **Takes:** nothing. **Returns:** `RouterFeatures` (an `@angular/router` type) — specifically
  whatever `withExtraRoutes()` returns, which in Analog 2.9.0 is `{ ɵkind: 100, ɵproviders: [{ provide: ROUTES, useValue: routes, multi: true }] }`
  (evidence: `node_modules/.pnpm/@analogjs+router@2.9.0_24546a77ba939628f06afe968f5a7ee2/node_modules/@analogjs/router/fesm2022/analogjs-router.mjs:52-61`).
  It is a router feature for `provideFileRouter()`, **not** a `Routes` array.
- **Does it wrap Angular `Routes`?** It wraps **Analog's file-based `routes` export only**, three
  times over, sharing one array instance (the three branches' `children` are the _same_
  `routes` reference, which is why a lazy page component is fetched once).
- **Default locale unprefixed?** Yes. `sourceLocale` is served unprefixed; every other locale is
  prefixed. A source-locale prefix such as `/en/docs` is matched by branch 1 and **redirected**
  to `/docs` preserving query and hash (`redirectSourceLocalePrefix` →
  `router.parseUrl(definition.router.strip(location.path(true)))`).
- **How are localized route trees declared?** They are not declared by the consumer. There is no
  per-locale tree and no translation of paths: one tree, N URL shapes. Locale is a route
  _param_ (`etymaLocale`), read by `activatePrefixedLocale` from `route.paramMap`.
- **Unmatched routes?** No catch-all is added — there is no `**` route anywhere in
  `analog/fesm2022/etyma-analog.mjs`. Branch 1 and 2 are gated by `canMatch`, so a first
  segment that is not a locale falls through to branch 3 (`path: ''`), whose children are the
  file routes; if no child matches, Angular backtracks to the next `ROUTES` entry. 404 handling
  stays entirely with the host application.
- **Prefix vs. a page named like a locale:** matching is at `canMatch` (match) time, not
  activation time, precisely so `/docs` cannot be swallowed when `docs` is a page
  (`analog/fesm2022/etyma-analog.mjs:16-25`).

### 1.4 Active locale state — exact API

Evidence: `angular/types/etyma-angular.d.ts` and `angular/fesm2022/etyma-angular.mjs:40-185`.

The locale lives on the **`EtymaI18n` service class** (an `@Injectable()` with no
`providedIn`; it is registered explicitly by `provideEtyma()` as `EtymaI18n` in the
environment providers — evidence: `angular/fesm2022/etyma-angular.mjs:253-263`). It is _not_ a
bare injection token and _not_ a standalone signal.

```ts
declare class EtymaI18n<TKey extends string = string, TParams extends MessageParamsMap = Record<never, never>> {
  readonly definition: _etyma_core.I18nDefinition<string, Record<never, never>>;
  constructor();
  /** Every locale this application publishes. */
  get locales(): readonly Locale[];
  /** The locale the source catalog is written in, and the fallback for every other one. */
  get sourceLocale(): Locale;
  /** The locale currently rendering. */
  readonly locale: Signal<Locale>;
  /** The text direction of {@link locale}, for `<html dir>`. */
  readonly direction: Signal<TextDirection>;
  /** Whether the catalog for {@link locale} is in memory. False means messages fall back. */
  readonly ready: Signal<boolean>;
  readonly t: TranslateFn<TKey, TParams>;
  readonly parts: PartsFn<TKey, TParams>;
  readonly has: (key: TKey) => boolean;
  readonly path: (to: string, locale?: Locale) => string;
  isLoaded(locale: Locale): boolean;
  load(locale: Locale): Promise<void>;
  activate(locale: Locale): Promise<void>;
  setLocale(locale: Locale): Promise<void>;
  static ɵfac: i0.ɵɵFactoryDeclaration<EtymaI18n<any, any>, never>;
  static ɵprov: i0.ɵɵInjectableDeclaration<EtymaI18n<any, any>>;
}
```

- **Locale value type:** `Locale` is a **plain `string`** — a BCP 47 tag, deliberately _not_
  branded. Verbatim from `core/dist/locale.d.ts`:

  ```ts
  /**
   * A BCP 47 language tag, such as `en`, `es`, `pt-BR`.
   *
   * Deliberately a plain string rather than a branded type: the value comes from a URL, a
   * config file or an HTTP header, and a brand would only add casts at every one of those
   * boundaries without catching anything a runtime check does not already catch.
   */
  export type Locale = string;
  export type TextDirection = 'ltr' | 'rtl';
  ```

- **Read-only, not writable.** `locale` is `this.activeLocale.asReadonly()`
  (`angular/fesm2022/etyma-angular.mjs:112`). There is **no `WritableSignal`** in the public
  API; `direction` and `ready` are `computed()`.
- **Setting the locale programmatically (host language switcher):** three methods, in order of
  preference — `setLocale(locale)`, `activate(locale)`, `load(locale)`. `setLocale()` is the
  documented application-facing one and it **delegates to the `ETYMA_LOCALE_SWITCH` token when
  provided** (verbatim, `angular/fesm2022/etyma-angular.mjs:174-180`):

  ```js
  async setLocale(locale) {
      this.assertKnown(locale);
      if (this.switchLocale !== null) {
          await this.switchLocale(locale);
          return;
      }
      await this.activate(locale);
  }
  ```

  `assertKnown()` throws `EtymaError` for a locale outside `definition.locales`.
  `activate()` loads then sets, guarded by an `activationVersion` counter so a stale concurrent
  activation cannot win, and writes hydration state when on the server
  (`angular/fesm2022/etyma-angular.mjs:156-166`). `load()` prefetches without switching;
  concurrent calls share one load.

- **Injection helpers:** `injectI18n(definition?)` and `injectT(definition?)`, both accepting an
  optional `I18nDefinition` purely for key typing.
- **`path(to, locale?)`** localizes an in-app path — `i18n.path('/docs/button')` — which is the
  documented way to build links (README: "Links are localized explicitly").

### 1.5 The two integration tokens (the actual adapter surface)

Evidence: `angular/types/etyma-angular.d.ts`, verbatim.

```ts
declare const ETYMA_DEFINITION: InjectionToken<I18nDefinition<string, Record<never, never>>>;
declare const ETYMA_LOCALE_SWITCH: InjectionToken<(locale: Locale) => Promise<void>>;
```

The `@etyma/angular` README names these explicitly as the extension point
(`/tmp/etyma-research/angular/README.md`, "Advanced: integration tokens"): _"Applications do not
need these; a routing integration does. `@etyma/analog` is built on exactly these two, and a
custom router integration can be too."_

`ETYMA_LOCALE_SWITCH` is injected `{ optional: true }`
(`angular/fesm2022/etyma-angular.mjs:50`). `provideEtymaAnalog()` provides it with a factory
that turns a locale switch into a `router.navigateByUrl()`
(`analog/fesm2022/etyma-analog.mjs:349-388`). **This is the token a third-party adapter would
contest** — see §1.9.

### 1.6 SSR hydration state transfer

Mechanism: **Angular's `TransferState` + `makeStateKey`**. Evidence:
`angular/fesm2022/etyma-angular.mjs:2` (imports `TransferState`, `PLATFORM_ID`,
`makeStateKey`, `isPlatformServer` from `@angular/core`/`@angular/common`) and lines 48-53:

```js
transferState = inject(TransferState);
isServer = isPlatformServer(inject(PLATFORM_ID));
switchLocale = inject(ETYMA_LOCALE_SWITCH, { optional: true });
stateKey = makeStateKey(`${this.definition.id}.hydration`);
transferredState = this.readTransferredState();
activeLocale = signal(this.transferredState?.locale ?? this.definition.sourceLocale, ...);
```

- Key: `` `${definition.id}.hydration` `` — namespaced by the definition's `id`, which is why
  `I18nOptions.id` exists ("Distinguishes this definition's SSR transfer payload from
  another's", `core/dist/define-i18n.d.ts`).
- Payload: `{ locale, catalogs }` where `catalogs` is `registry.dehydrate()`, i.e. a
  `CatalogSnapshot = Readonly<Record<Locale, Readonly<Record<string, string>>>>`
  (`core/dist/catalog-registry.d.ts`). The **source catalog is excluded** — README: "The source
  catalog is left out: it is already in the JavaScript bundle."
- Write: on the server, in `activate()` and on every registry change
  (`angular/fesm2022/etyma-angular.mjs:88-96`, `163-165`, `198-203`).
- Read: in the constructor on the browser only; the key is **removed after reading** and the
  payload is discarded unless `state.locale` passes `definition.router.isLocale()`
  (`angular/fesm2022/etyma-angular.mjs:187-197`).
- Per-request isolation: state is per-instance, one instance per application injector, so
  concurrent SSR requests share nothing. No module-level mutable state.
- No `localStorage`/cookie persistence anywhere — explicitly a non-goal (README "Non-goals"),
  and `provideEtymaAnalog()`'s doc comment states nothing is read from or written to
  `localStorage`.

### 1.7 SEO / metadata

There is **no exported SEO helper**. It is internal to `@etyma/analog` and switched on by
`provideEtymaAnalog()`. Evidence: `analog/types/etyma-analog.d.ts` +
`analog/fesm2022/etyma-analog.mjs:180-290`.

```ts
interface EtymaAnalogOptions {
  /** The absolute origin for canonical and `hreflang` URLs. ... */
  readonly origin?: string;
  /** Manage `<html lang>`, `dir`, the canonical link and the `hreflang` set. On by default. ... */
  readonly seo?: boolean;
}
declare function provideEtymaAnalog(options?: EtymaAnalogOptions): EnvironmentProviders;
```

What `installLocalizedSeo()` sets, inside an `effect()` re-run on every navigation
(`analog/fesm2022/etyma-analog.mjs:196-212`):

- `document.documentElement.setAttribute('lang', locale)`
- `document.documentElement.setAttribute('dir', definition.directionOf(locale))`
- one `<link rel="canonical">` with an absolute href
- one `<link rel="alternate" hreflang=…>` per locale **plus `x-default`** pointing at the
  source-locale URL (`alternatesFor()`, lines 218-233)

Details that matter for cooperation:

- Everything is derived from the **URL**, not from the locale signal — deliberately, because
  during a language switch the two disagree for a moment (comment at line 197-199).
- Owned elements are tagged with the attribute `data-etyma` (`const OWNED = 'data-etyma'`,
  line 176).
- **`setCanonical()` reuses any pre-existing `link[rel="canonical"]` regardless of ownership**
  (lines 238-249): it queries `link[rel="canonical"]` and overwrites its `href` if found,
  creating a `data-etyma="canonical"` element only when none exists. By contrast
  `setAlternates()` touches **only** `link[data-etyma="alternate"]`. So a host- or doq-written
  canonical **will be rewritten by Etyma**, while host-written alternates will not.
  (`seo: false` disables the whole block.)
- Query strings and fragments are stripped from the canonical path (`pathnameOf()`, lines 240-244).
- Origin resolution order (`resolveOrigin()`, lines 152-172): explicit `options.origin` →
  `injectBaseURL()` from `@analogjs/router/tokens` → `DOCUMENT.defaultView?.location.origin` →
  `''`, with a `console.warn` in dev mode only. Absolute hrefs are built with
  `location.prepareExternalUrl(path)`, so `base href` is respected.

### 1.8 Translation catalogs, message shape, MessageFormat

Evidence: `core/dist/define-i18n.d.ts`, `core/dist/messages.d.ts`, `core/dist/format.d.ts`,
`core/dist/loader.d.ts`.

```ts
export declare function defineI18n<
  const TSource extends MessageSource,
  const TLocales extends LocaleTuple,
  TKey extends MessageKey<TSource> = MessageKey<TSource>,
  TParams extends MessageParamsMap = Record<never, never>,
>(
  options: I18nOptions<TSource, TLocales, TKey, TParams>,
): I18nDefinition<TKey, StaticParams<TSource, TParams>> & {
  readonly sourceCatalog: MessageCatalog;
};
```

`I18nOptions` fields: `locales` (`LocaleTuple = readonly [Locale, ...Locale[]]`, non-empty),
`sourceLocale` (must be one of `locales`), `source` (`MessageSource`, **statically imported**),
`contract?`, `loaders?` (`Readonly<Partial<Record<TLocales[number], MessageLoader>>>` —
"Required for all of them" i.e. every non-source locale), `textDirection?`,
`onMissingMessage?`, `formatting?`, `id?`.

Catalog shape (verbatim, `core/dist/messages.d.ts`):

```ts
export interface MessageSource {
  readonly [key: string]: MessageValue;
}
export type MessageValue = string | MessageSource | readonly string[];
export type MessageCatalog = ReadonlyMap<string, string>;
```

Nested objects of strings; a non-empty `readonly string[]` is shorthand for numbered keys
(`{"steps":["a","b"]}` → `steps.0`, `steps.1`). `flattenMessages()` produces dotted keys and
**rejects a key that already contains a dot**. `defineMessages()` is a pure authoring
identity helper ("the object it returns is the object it was given").

**MessageFormat 2 is supported** — via the hard dependency `messageformat@4.0.0` (exact pin,
`core/package.json`), imported in `core/dist/format.js:1-2` as `MessageFormat` and
`DraftFunctions` from `messageformat/functions`. `MessageFormatterOptions`:

- `bidiIsolation?: 'default' | 'none'` — **Etyma defaults to `'none'`, which is not the
  MessageFormat spec default**, so `t('welcome', { name: 'World' })` returns a string with no
  invisible U+2068/U+2069 wrappers. Documented rationale in `core/dist/format.d.ts`.
- `draftFunctions?: boolean` — on by default; registers `:date`, `:time`, `:datetime`,
  `:currency`, `:percent`, `:unit`. The stable subset (`:string`, `:number`, `:integer`,
  `:offset`) is always registered.
- `functions?: MessageFunctions` — custom MF2 handlers merged over built-ins.
- `onIssue?` — formatting **never throws**; issues are reported. In dev mode
  `provideEtyma`'s service installs a `console.warn` reporter
  (`angular/fesm2022/etyma-angular.mjs:216-223`); production is silent.

**Loading is lazy for every non-source locale and eager only for the source.** The source
catalog is a static import because its _type_ is where typed keys come from and its _value_ is
the fallback. Non-source locales go through `MessageLoader = (locale) => MessageLoaderResult |
Promise<MessageLoaderResult>`, typically `() => import('./es.json')`;
`createHttpMessageLoader(url | (locale) => url, init?)` covers CDN/CMS fetches with plain
`fetch` and no retry/cache/auth. `defineRemoteI18n()` is the all-remote variant and **requires
an explicit `MessageContract`** (there is no static catalog to read a shape from).

Typed keys come from the literal source shape (`MessageKey<T>` → a string-literal union) and
typed params from reading MF2 variables out of the literal message text
(`MessageParamsOf`, `MessageVariables`). `t()` requires params exactly for keys whose message
declares variables, optional-and-untyped otherwise (`MessageArgs`).

Real upstream usage (evidence: `/tmp/etyma-src/apps/playground/src/app/i18n/i18n.ts`, verbatim):

```ts
import { defineI18n, defineMessages } from '@etyma/core';
import en from './en.json';

const seo = defineMessages({
  siteName: 'Etyma playground',
  tagline: 'Internationalization for Angular and AnalogJS',
});

export const i18n = defineI18n({
  locales: ['en', 'es', 'uk'],
  sourceLocale: 'en',
  source: { ...en, seo },
  loaders: {
    es: () => import('./es.json'),
    uk: () => import('./uk.json'),
  },
});

export type MessageId = (typeof i18n.keys)[number];
```

### 1.9 RTL / `dir` support

Yes, first-class:

- `localeDirection(locale: Locale): TextDirection` in `@etyma/core` — asks the runtime first
  (`Intl.Locale.prototype.getTextInfo()`, then the older `textInfo` accessor) and falls back to
  the script of the maximized locale (`core/dist/locale.d.ts`).
- Per-locale override via `defineI18n({ textDirection: { ar: 'rtl' } })` — "Only needed where
  the runtime's own answer is missing and Etyma's fallback table is wrong".
- `I18nDefinition.directionOf(locale)` and `EtymaI18n.direction: Signal<TextDirection>`.
- `<html dir>` is written automatically **only by `provideEtymaAnalog()`** (`seo` option).
  `@etyma/angular` alone does not touch the DOM.
- MF2 bidi isolation is configurable (`formatting.bidiIsolation`), default `'none'`.

### 1.10 Minimal documented wiring

From `analog/README.md` and confirmed identical in the upstream playground
(`/tmp/etyma-src/apps/playground/src/app/app.config.ts`):

```ts
// app.config.ts
import { provideFileRouter } from '@analogjs/router';
import { provideEtymaAnalog, withLocalizedRoutes } from '@etyma/analog';
import { provideEtyma } from '@etyma/angular';
import { i18n } from './i18n/i18n';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideFileRouter(withLocalizedRoutes()),
    provideClientHydration(withEventReplay()),
    provideEtyma(i18n),
    provideEtymaAnalog(),
  ],
};
```

The playground additionally uses `provideBrowserGlobalErrorListeners()` and the comment
_"Zone.js is not installed in this application at all. Etyma never asks for it."_ Zoneless is
not required — `@etyma/angular` is "zoneless-first" and "still works inside a Zone-based
application, it just never needs one" (`angular/README.md`).

**`vite.config.ts`: nothing is documented as required.** The playground's config contains only
optional/incidental items (`/tmp/etyma-src/apps/playground/vite.config.ts`):
`etymaRemoteContract(...)` from `@etyma/tooling/vite` (only for the remote-catalog demo), a
`manualChunks` function giving each non-source locale a stable chunk name (a testability aid,
client build only), `resolve: { mainFields: ['module'] }`, and `analog({ ssr: true, prerender:
{ routes: [] } })`. See §3 for the prerender consequence.

---

## 2. Peer compatibility

### 2.1 Declared peers (verbatim from packed `package.json`)

`@etyma/core` — **no `peerDependencies` at all**, no `peerDependenciesMeta`:

```json
"dependencies": { "messageformat": "4.0.0" },
"devDependencies": { "vitest": "5.0.3" }
```

`@etyma/angular`:

```json
"peerDependencies": {
  "@angular/common": "^21.0.0 || ^22.0.0",
  "@angular/core": "^21.0.0 || ^22.0.0"
},
"dependencies": { "tslib": "^2.8.1", "@etyma/core": "^1.0.0" }
```

`@etyma/analog`:

```json
"peerDependencies": {
  "@analogjs/router": ">=2.6.0 <3",
  "@angular/common": "^21.0.0 || ^22.0.0",
  "@angular/core": "^21.0.0 || ^22.0.0",
  "@angular/router": "^21.0.0 || ^22.0.0",
  "@etyma/angular": "^1.0.0"
},
"dependencies": { "tslib": "^2.8.1", "@etyma/core": "^1.0.0" }
```

**No package in the trio declares `peerDependenciesMeta`.** Every peer above is therefore
**required**, not optional. (Contrast `@etyma/tooling`, which does declare
`peerDependenciesMeta` marking `@astrojs/compiler`, `@astrojs/compiler-rs` and
`@angular/compiler` all optional — evidence: `/tmp/etyma-src/packages/tooling/package.json`.)

Direct answers to the asked questions:

- **Angular ranges:** `^21.0.0 || ^22.0.0` for `@angular/core`, `@angular/common`
  (both packages) and `@angular/router` (`@etyma/analog` only).
- **Analog ranges:** `@analogjs/router` `>=2.6.0 <3` — this is the _only_ `@analogjs/*` peer.
  `@analogjs/content`, `@analogjs/platform` and `@analogjs/vite-plugin-angular` are **not**
  peers, even though the bundle imports `@analogjs/router/tokens`.
- **rxjs:** **not a peer of any package, and not imported anywhere.** `grep -n rxjs` over both
  `fesm2022` bundles returns nothing; `angular/README.md` states "no RxJS in the public API".
  (Internally it does subscribe to `router.events`, but that is the router's own Observable and
  nothing RxJS-shaped escapes.)
- **Vite:** **no Vite peer and no Vite constraint anywhere in the trio.** `@etyma/tooling/vite`
  is the only Vite-aware entry point and it is dev tooling, not a runtime dependency
  ("no package in the runtime trio depends on it" — root README, "Package boundaries").

### 2.2 Verdict against the versions in the brief

The brief specified **Angular 22.2.3, Analog 2.9.1, Vite 8.3.5, pnpm 10.30**. Those do **not**
match what this repository actually resolves — see §2.3. Verdict for the _stated_ set anyway:

| Requirement        | Declared range         | Stated version | Satisfied?                                |
| ------------------ | ---------------------- | -------------- | ----------------------------------------- |
| `@angular/core`    | `^21.0.0 \|\| ^22.0.0` | 22.2.3         | ✅                                        |
| `@angular/common`  | `^21.0.0 \|\| ^22.0.0` | 22.2.3         | ✅                                        |
| `@angular/router`  | `^21.0.0 \|\| ^22.0.0` | 22.2.3         | ✅                                        |
| `@analogjs/router` | `>=2.6.0 <3`           | 2.9.1          | ✅ (range) / ⚠️ (untested upstream, §2.4) |
| `@etyma/angular`   | `^1.0.0`               | 1.0.0          | ✅                                        |
| rxjs               | not a peer             | —              | ✅ no constraint                          |
| Vite               | not a peer             | 8.3.5          | ✅ no constraint                          |

**pnpm peer-conflict verdict: no peer conflict.** With `auto-install-peers` (pnpm ≥8 default),
installing `@etyma/core @etyma/angular @etyma/analog` together satisfies every declared peer at
both the stated versions and the actually-resolved ones. The required `@etyma/angular` peer of
`@etyma/analog` is satisfied by installing the trio together, which is also what both READMEs
instruct (`pnpm add @etyma/core @etyma/angular @etyma/analog`).

**The real blocker is the Node engine, not a peer.** All three packages declare
`"engines": { "node": ">=22.22.0" }`, while `packages/doq/package.json` declares
`"engines": { "node": "^20.19.0 || ^22.12.0 || >=24.0.0" }`. A doq consumer on **Node 20.19–20.x
or 22.12–22.21** is inside doq's supported range but outside Etyma's. This repo's `.nvmrc` is
`22.23.1` and the local Node is `v22.23.1`, so local development is fine. doq's root has no
`.npmrc` setting `engine-strict`, so pnpm would emit a warning rather than fail — but the
ranges are genuinely incompatible and should be called out in the adapter's docs.

Also note the transitive runtime dependency: `@etyma/core` hard-pins `messageformat@4.0.0`
(exact, not a range). Adopting Etyma adds it to a doq consumer's runtime tree.

### 2.3 What this repository actually resolves (correction to the brief)

Evidence: `pnpm-lock.yaml` snapshots and `apps/*/package.json`.

| Dependency                            | Brief said | Repo actually resolves                                                       |
| ------------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| `@angular/core` / `common` / `router` | 22.2.3     | **21.2.25** (`pnpm-lock.yaml:677,699,742`)                                   |
| `@analogjs/router` / `content`        | 2.9.1      | **2.9.0** (`pnpm-lock.yaml:514,572`)                                         |
| `vite`                                | 8.3.5      | **7.3.6** (library devDep) and **8.3.4** (apps) (`pnpm-lock.yaml:5621,5661`) |
| pnpm                                  | 10.30      | **10.18.3** (`package.json:5` `packageManager`)                              |

Angular **21.2.25** satisfies `^21.0.0`, and `@analogjs/router` **2.9.0** satisfies `>=2.6.0 <3`,
so the verdict in §2.2 is unchanged — but any spec text quoting 22.2.3 / 2.9.1 / 8.3.5 / 10.30
for this repo is wrong and should be corrected.

Two Analog-specific checks against the _installed_ 2.9.0:

- `@analogjs/router@2.9.0` **does** export the `./tokens` subpath, and it declares
  `injectBaseURL(): string | null` — evidence:
  `node_modules/.pnpm/@analogjs+router@2.9.0_…/node_modules/@analogjs/router/package.json`
  (`exports` keys: `./package.json`, `.`, `./i18n`, `./server`, `./server/actions`,
  `./tanstack-query`, `./tanstack-query/server`, `./tokens`) and
  `types/analogjs-router-tokens.d.ts:26`. So `@etyma/analog`'s
  `import { injectBaseURL } from '@analogjs/router/tokens'` resolves on Analog 2.9.0 even
  though upstream only tests 2.6/2.7.
- `withExtraRoutes(routes: Routes): RouterFeatures` exists at
  `types/analogjs-router.d.ts:139`, and `provideFileRouter()` registers extra-route providers
  **before** `provideRouter(routes, …)` (`fesm2022/analogjs-router.mjs:28-51`), which is what
  makes Etyma's "inserted ahead of the file-based routes" claim true on 2.9.0.

### 2.4 Tested matrix vs. declared range (upstream)

The declared peer allows `<3`, but upstream's verified matrix is narrower:

- `analog/README.md`: _"Requires AnalogJS 2.6.x or 2.7.x on Angular 21. Angular 22 is verified
  with AnalogJS 2.7.x."_
- `V1.md` hard gate: _"Framework matrix verified against packed tarballs. Angular 21/22,
  Analog 2.6/2.7, Astro 6/7…"_
- `/tmp/etyma-src/tools/compat/` contains `angular-21`, `angular-22`, `angular-21-analog-26`,
  `astro-6`, `astro-7`, `consumer`, `consumer-astro`, `consumer-core`, `core-large-catalog`.
  The pinned Analog versions are `@analogjs/router: 2.7.0` (angular-21, angular-22) and
  `2.6.0` (angular-21-analog-26).

So **Analog 2.9.x satisfies the semver range but is outside upstream's tested matrix**. There is
a `dependabot/npm_and_yarn/analog-551bde6c27` branch open upstream, i.e. the Analog bump is
in flight but not merged at `main`.

---

## 3. Conflict analysis for a third-party localized route tree

This is the most decision-relevant section: **`withLocalizedRoutes()` cannot localize doq's
routes, and there is no supported way to make it.**

1. **It hard-codes Analog's file routes.** All three branches use `children: routes`, where
   `routes` is the `@analogjs/router` file-based export
   (`analog/fesm2022/etyma-analog.mjs:3,87-108`). It takes no arguments, so a consumer cannot
   substitute or extend the children.

2. **doq registers its routes through a _separate_ `withExtraRoutes`.** Evidence:
   `apps/showcase-a/src/app/app.config.ts:52` —
   `provideFileRouter(withExtraRoutes(doqRoutes(doqConfig)))` — and
   `packages/doq/src/lib/doq-routes.ts:15`, `doqRoutes(config): Routes`, which returns routes
   built from custom `matcher` functions against `basePath` (default `/docs`), not file pages.

   Composing both features yields `ROUTES = [etyma's 3 branches, doqRoutes, fileRoutes]`
   (`provideFileRouter` filters `ɵkind >= 100` features and registers their providers in
   argument order, then `provideRouter(routes, …)`). For a URL like `/es/docs/button`:
   branch 2's `canMatch` (`isLocalePrefix`) succeeds, its `children` are the _file_ routes, no
   child matches `docs/button`, Angular backtracks, `doqRoutes`' matchers test
   `segments[0] === 'docs'` against `'es'` and fail → **no match**. Prefixed doq URLs 404.
   (Derived from shipped source and Angular's documented matching/backtracking; **not verified
   by running an app** — see §4.)

3. **The guards are not exported**, so doq cannot reuse them. The only public building blocks
   are `ETYMA_DEFINITION` (to read `definition.router` / `locales` / `sourceLocale`),
   `createLocaleRouter()` from `@etyma/core`, `ETYMA_LOCALE_PARAM`, and
   `EtymaI18n.activate()`/`load()`. An adapter that wants `/es/docs/...` must build its own
   three-branch wrapper with `children: doqRoutes(cfg)` and its own `canMatch`/`canActivate`
   guards.

4. **`ETYMA_LOCALE_SWITCH` is a single-value token, and `provideEtymaAnalog()` already provides
   it.** A doq adapter that provides it too would silently override Etyma's navigation-based
   switch (last provider wins), or be overridden. Since Etyma's own implementation
   (`createLocaleSwitch`) is generic — it navigates to `definition.router.localize(here, locale)`
   using `Location.path(true)` — it already does the right thing for a doq URL _provided the
   doq route tree is reachable under the prefix_. Prefer leaving it alone.

5. **Canonical URL ownership.** `setCanonical()` overwrites the `href` of _any_ existing
   `link[rel="canonical"]`, not just ones tagged `data-etyma` (§1.7). If doq or the host emits
   its own canonical, Etyma wins. Host-written `link[rel="alternate"]` elements are safe.

6. **Prerendering needs an explicit `origin`.** The upstream playground deliberately disables
   prerendering — `prerender: { routes: [] }` with the comment _"Nothing is prerendered. Every
   response is a real server render of a real request, which is the only way the canonical and
   hreflang URLs can carry the origin the visitor actually asked for"_
   (`/tmp/etyma-src/apps/playground/vite.config.ts`). doq's site is a **static prerendered**
   build (`doqPrerenderRoutes()`), where there is no request. `resolveOrigin()` would fall
   through `injectBaseURL()` → `document.defaultView.location.origin` → `''` and emit relative
   canonical/hreflang URLs (plus a dev-mode `console.warn`). A doq adapter must therefore pass
   `provideEtymaAnalog({ origin: 'https://…' })`, or set `seo: false` and manage the head
   itself. This is a hard requirement, not a nicety, for doq's static output.

7. **Route-param collision: none.** Etyma uses `etymaLocale`, deliberately prefixed "so it
   cannot collide with a parameter an application's own page happens to use"; doq's default
   `routeParam` is `slug`. No conflict.

8. **No catch-all.** `withLocalizedRoutes()` adds no `**` route, so it does not steal doq's
   unmatched-URL handling or doq's `unmatched: 'continue'` behaviour
   (`packages/doq/src/lib/doq-routes.ts`).

---

## 4. Unclear / not found

Everything below could **not** be verified from the shipped artifacts or the cloned repo. Do not
assume any of it.

1. **No runtime verification at all.** No app was built, served or prerendered during this
   research. Every behavioural claim (route backtracking to a 404 for `/es/docs/...`, the SEO
   effect firing per navigation, hydration avoiding a catalog refetch, transfer-state payload
   contents on the wire) is inferred from shipped source and upstream docs. The §3.2 conclusion
   in particular should be confirmed with a real build before the adapter design is locked.
2. **Why the playground sets `resolve: { mainFields: ['module'] }`** is not documented. Both
   Angular packages ship a proper `exports` map with `"default"` pointing at the fesm2022
   bundle, so this looks incidental rather than required — but nothing states it, and no
   `vite.config.ts` requirement is documented anywhere for `@etyma/analog`.
3. **Whether Analog 2.8/2.9 actually work** is untested upstream (§2.4). `./tokens` and
   `withExtraRoutes` were confirmed present in 2.9.0, but no other 2.9-specific behaviour was
   checked, and no upstream issue/PR about 2.9 support was found.
4. **No documented third-party / library-author integration path.** The root README mentions
   adapters only as first-party packages and says a new adapter is "additive rather than a
   rewrite"; there is no guidance, no exported hook and no example for a _third-party library_
   that needs its own routes localized. `grep` for `third-party|adapter|library author|doq|@doqs`
   in the root README returns only the four first-party-adapter lines.
5. **`@etyma/analog` in a prerendered (non-SSR) build is undocumented.** `ssr: true` is set in
   the only example app, and `prerender: { routes: [] }` disables prerendering there. Whether
   `provideAppInitializer(activateRequestLocale)` behaves correctly during Analog prerender —
   where `Location.path()` may not reflect the route being rendered — is not stated and was not
   tested.
6. **Whether two `I18nDefinition`s can coexist** (e.g. a host app's Etyma plus a doq-internal
   one) is explicitly _not_ supported by the token design: `ETYMA_DEFINITION` is a single-value
   token, so the second `provideEtyma()` wins. `I18nOptions.id` exists to disambiguate
   _transfer-state payloads_ for "the rare application that provides two catalogs side by
   side", but no mechanism for two simultaneously-active definitions was found. The playground's
   `remote-demo.page.ts` provides a second `provideEtyma(remoteI18n)` at _route_ level and its
   comments warn about shadowing — evidence the pattern is delicate, not supported for library
   authors.
7. **No published `@etyma/*` typings for `messageformat` re-exports.** `MessagePart` is
   re-exported as `Mf2MessagePart<string>` from `messageformat`, so a doq adapter touching
   `i18n.parts()` needs `messageformat` types resolvable. Whether that resolves cleanly under
   pnpm's strict `node_modules` without hoisting was not checked.
8. **Bundle-size / tree-shaking impact** of adding `@etyma/core` + `messageformat@4.0.0` to a
   doq consumer was not measured. `sideEffects: false` is declared on all three packages, but no
   measurement was taken.
9. **`@etyma/tooling`'s static source analysis** (mentioned in the changelog as scanning "JS/TS,
   Angular templates and …") was not investigated; the changelog line is truncated in the packed
   file and the tooling package was not extracted. It is dev tooling and out of scope for a
   runtime adapter, but it may matter if doq wants catalog validation in CI.
10. **No `dir`/RTL handling exists in `@etyma/angular` alone.** If the adapter avoids
    `@etyma/analog` (e.g. to keep prerendered output under doq's control), doq must set
    `<html lang>`/`dir` itself from `i18n.locale()` / `i18n.direction()`. Whether doq already
    owns `<html lang>` was not checked in this research.

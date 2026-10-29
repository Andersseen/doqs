# Changelog

## Unreleased — browser verification tooling

- **Extended browser CI.** Linux Firefox/WebKit use the Playwright-maintained image pinned to `@playwright/test` 1.64.1, with GTK 4, Graphene and GStreamer runtime libraries and a non-root user for Firefox's sandbox. A focused production-browser Chromium suite is added for `windows-latest`. Windows acceptance passes; Linux Firefox is pending its non-root rerun, so local macOS runs do not count as Linux evidence.
- **Accessibility test stability.** The reduced-motion E2E check now waits for the hydrated documentation root before reading computed styles. Targeted keyboard, drawer, search, playground, locale and RTL checks pass; the separate initialized-consumer hydration failure recorded in spec 0021 remains under investigation. VoiceOver/Safari and NVDA/Windows remain NOT RUN; see the manual protocol.
- **Windows test runner portability.** The production E2E launcher now invokes pnpm's JavaScript entrypoint through Node, so the Windows `.CMD` shim works with `spawnSync`; the first hosted Windows run exposed this before tests could start.
- No package API, route, CSS token, dependency or runtime behavior changed. No version bump or publication is proposed for CI and test-harness changes alone.

## 0.12.0

Multilingual documentation, accepted in production builds. Additive: no exported type, function, configuration key, frontmatter key, route or `--host-docs-*` token was removed or changed (`pnpm verify:public-api` passes against the 0.7 baseline). The release is driven by the existing workflow after merge; nothing is published by hand.

### Highlights

- **Locale-aware catalogs and routes.** `DoqPaths.i18n` declares independently authored Markdown directories per locale and version archive; the default locale keeps its URLs, other locales get locale-prefixed routes, and a missing translation is never inferred from another language.
- **Provider-neutral translation adapter.** `provideDoqI18n()` and `DoqI18nAdapter` connect the host's own locale lifecycle (a signal in the host) to Doqs-owned text. Doqs does not ship a competing translation provider; `ownsRouting` and `ownsHead` state what the host owns.
- **Localized interface and playgrounds.** Playground controls, validation, copy states, dialog labels and announcements use the same `DOQ_DEFAULT_MESSAGES` catalog.
- **Localized Pagefind.** Locale and version filters compose; a locale-scoped query fails closed with a rebuild message when the index has no locale metadata.
- **RTL and SEO ownership.** `dir`, `lang`, canonical and `hreflang` alternates are written by Doqs, or left to the host with `ownsHead`.
- **Sticky table of contents.** The sidebar and TOC stay below the host header and scroll internally on tall pages.
- **Compatibility and adoption hardening.** The packed tarball is proven outside the monorepo on Angular 21 and 22, with localized, unlocalized, docs-first, embedded, versioned, search-disabled, playground, API-reference and source-authoring consumers. Repository-only adoption proofs now pin their upstream revisions, separate onboarding of an unintegrated application from rebuilding an already integrated one, and run in an isolated extended CI job.

### Added and fixed

#### Added
- **Multilingual production fixture.** Showcase A exercises isolated English, Spanish and Arabic documentation catalogs, a Spanish archive, a route-derived signal adapter and real Pagefind filtering. Production acceptance is recorded in spec 0019; 0.12.0 was published through the release workflow.

- **Playground localization.** Playground-owned controls, validation feedback, copy states, dialog labels and live announcements now use the existing `DOQ_DEFAULT_MESSAGES` adapter contract, so a host can translate the complete interactive surface without translating consumer-owned labels or code.
- **Explicit route ownership.** `DoqI18nAdapter.ownsRouting` lets a host state that it owns localized route composition independently of the number of locales configured for Doqs.

#### Fixed
- **Localized index and version links.** Host-owned `/es/docs` and `/ar/docs` index routes now resolve the locale catalog from the active URL; version selectors omit archives a locale does not publish, and locale links keep their explicit target locale. Doqs-owned paths are prefixed once. No exported API changed.
- **Localized search fails closed.** A locale-scoped query now reports a rebuild message when Pagefind has no locale metadata or the requested locale is absent. Unlocalized sites keep searching legacy indexes without locale metadata.

- **Table-of-contents highlight during smooth scrolling.** Following a fragment (TOC link, search result, deep link) pins the followed heading as active, but the pin was released while the page was still scrolling towards it when the host sets `scroll-behavior: smooth`, so the previous section stayed highlighted (`/docs/guides/rich-markdown#rules` lit "Titled code"). The pin is now held until the scroll ends (`scrollend`, with a 1.5 s fallback for engines without it) and only then checked against the viewport. No export, option, route or token changed.

#### Repository tooling (not part of the package)

- `pnpm verify:adoption:existing` rebuilds Angular Movement, which already integrates Doqs, against the packed tarball and checks every Markdown route it derives from the real tree; `verify:adoption` and `verify:adoption:routes` are pinned to the last pre-integration revision, `verify:adoption:volt` to a pinned Volt UI revision, each with an `*_REF` override. `docs:check` and the static preview understand `route.html` output (`prerender.autoSubfolderIndex: false`).

#### Known limitations

- **Live SSR status.** Doqs sets `RESPONSE_INIT.status = 404` for a documentation URL it claims, but Analog 2.9's server handler never reads it, so an Analog SSR server (including the dev server) answers 200 for a missing page. Prerendered output on a static host answers 404. Doqs does not simulate a status or ship a server.
- Screen readers and browsers on Windows are untested; Zone.js applications, Vite < 8 and Analog > 2.9 are unverified.
- A real localized site grows its static Pagefind index with its content; that is not a runtime cost (the index is fetched only when search opens).

## 0.11.0

Real-world adoption and 1.0 contract hardening. Additive: no exported type, function, configuration key, frontmatter key, route or `--host-docs-*` token was removed or changed. The release is driven by two real adoption proofs (Angular Movement and Volt UI, built from the packed package) and fixes the generic blockers they exposed.

### Added
- **`@doqs/analog/config`**: a configuration-only entry point (`defineDoqConfig`, `provideDoq`, `doqPrerenderRoutes`, `DOQ_CONFIG`, the configuration types). Its compiled file imports only `@angular/core`; the main entry re-exports every name it exported before. Importing the main entry in plain Node (a `vite.config.ts`, a script) fails without the Angular compiler; the config entry loads. In a Vite 8 production build of a host that loads the documentation lazily both entries produced identical initial JavaScript (`pnpm bundle:impact`), so the benefit is tooling contexts and builders that do not tree-shake, not a smaller bundle.
- **`DoqConfig.landmark`** (`'document'` default, `'host'`): who renders the page's `main`. Documentation index, document and not-found views render exactly one `main` by default and none with `'host'`; the decision is configuration, never DOM inspection, so server HTML and hydrated DOM agree.
- **`DoqShellComponent`** renders a plain container instead of `main` when a Doqs configuration owns the landmark (it used to nest a second `main` around the index view), and has a `mainLandmark` input to override that when `provideDoq` is scoped below the shell.
- **`DoqConfig.unmatched`** (`'not-found'` default, `'continue'`) and the same option for `doqRoutes()`: with `'continue'` Doqs claims only URLs it has a document for, so host-owned pages below the same prefix keep working and unknown URLs reach the host's 404. The current version's bare base path is then left to the host. This is what lets a site migrate pages one at a time without changing a URL.
- **`--host-docs-primary-text`** (optional token) and an internal derived default: text in the primary colour on tinted surfaces (active navigation item, links, pressed toggles) is a slightly darker mix of the primary colour and the foreground, which brings medium brand colours (found with Volt UI's `#3467f5`, 3.96:1 to 4.24:1 before) to at least 4.5:1.
- `public-api.stability.json` classifies every export of the browser entries as stable, advanced, internal or deprecated; a unit test keeps it in step with `public-api.report.json`.
- Repository: `pnpm verify:adoption:routes` (Angular Movement at its original URLs), `pnpm verify:adoption:volt` (Volt UI), `pnpm verify:portable` (CRLF, junction, path smoke, also run on Windows in CI), `pnpm bundle:impact`, a Zone.js consumer (`scripts/consumer.ts --zone`), `docs/adoption/consumer-parity.md`, `docs/adoption/migration-findings.md` and a guide, _Adopting Doqs in an existing library site_.

### Fixed
- **Generated pages with Windows line endings.** `doq content check` reported a page checked out with CRLF as "edited after it was generated", and `doq-api` leaked `\r` from CRLF sources into the generated pages. Both generators now compare and render independently of the checkout's line endings.
- Not-found views no longer replace the `main` role with `role="status"`.
- The public API report now lists every export of the root entry although the declarations moved to the config entry (`scripts/public-api.ts` follows re-exports between sibling entries).

### Deprecated
- `DoqButtonDemoComponent`: an example component of the pilot, not a Doqs feature. Register your own with `DoqConfig.demos`. It keeps working and is removed only in a major release.

### Known limitations
- Localization: one content tree, English chrome, one search index. Pages migrated to Doqs lose their locale-prefixed variants (the prefixed URL falls through to Analog's own Markdown route). See `docs/adoption/consumer-parity.md`.
- Overlays that components append to `<body>` can render beneath the expanded playground's top-layer `<dialog>`; use the inline preview. See `docs/adoption/migration-findings.md`.
- Zone.js is verified on Angular 21 only. Windows is verified for the Node tooling in CI, not for browsers. Screen readers were not tested.

## 0.10.0

Advanced content authoring: source-backed code, reusable Markdown and links to the generated API reference, resolved at build time into ordinary Markdown. Additive and opt-in: no exported type, function, configuration key, frontmatter key, route or `--host-docs-*` token was removed or changed, nothing is added to the browser entry, and every 0.9 (and earlier) project builds and renders as before without any new file or step.

### Added
- **`doq content generate | check | watch`** (and `@doqs/analog/content`: `generateContent`, `checkContent`, `buildContent`, `loadContentConfig`, `formatDiagnostic`, `doqContent()` Vite plugin, `DoqContentError`, `EXIT_CODES`, types `DoqContentTarget`, `DoqContentOptions`, `DoqContentDiagnostic` and results). Node-only, dependency-free, never executes or fetches anything. Configured by `doq.content.json` (one target per documentation version).
- **`::source{file="…" region="…"}`**: a highlighted code block read from a real file, as a whole, a named region (`// #region doqs:name`, `# …`, `/* … */`, `<!-- … -->`; nesting allowed, markers removed) or a line range, with `lang`, `title` and an optional "View source" link built from `sourceUrl`/`revision` (never guessed). Fences are longer than any backtick run in the code, so a snippet cannot end its own block or become a directive.
- **`::include{file="…"}`**: Markdown fragments (a file or directory whose name starts with `_`, so never a route), nested up to five levels, cycles detected, no frontmatter, heading levels kept as written, `/path` from the authoring root and other paths from the including file.
- **`[[api:Name]]`, `[[api:Name|Label]]`, `[[api:Name@target]]`**: links to the generated API page of a public symbol using the symbol index `doq-api` now records in its manifest. A target resolves against its own index, so archived guides link archived pages and a missing symbol is an error, never a fallback to the current version.
- **`doq-api` symbol index**: `.doq-api.json` gains `symbols` (public export → route, with collisions and `--base-path` applied by the generator). Regenerate once with `doq-api generate`. `doq-api` also documents an entry that is itself a declaration file (a `.d.ts`/`.d.mts` entry).
- Ownership like `doq-api`: a manifest (`.doq-content.json` in the authoring directory) with SHA-256 hashes; hand-written or edited files are conflicts and never overwritten, `check` writes nothing, output has no timestamps or absolute paths. Diagnostics name the page, line, directive, reference, reason and fix; exit codes 1 stale, 2 configuration, 3 conflict, 4 invalid authoring.
- Safety: only text files below the configured `sourceRoots`, checked on real paths (traversal and symbolic links), never `node_modules`, `.git`, build output, `.env*`, keys, credential-like names, binaries, non-UTF-8 or files above 256 KiB.
- Repository: authored pages in Showcase A (embedded, with a Volt UI playground next to its source), Showcase B (docs-first, nested routes), both archives and the official documentation (_Content authoring_, _Content tooling_ and a generated _Content tooling API_ reference); the Angular Movement adoption proof; tarball consumers with and without authoring.

### Changed
- `doq-api`'s manifest has a new `symbols` member; `doq-api check` reports a manifest written by 0.9 as stale until `doq-api generate` is run.
- Budgets for content-proportional metrics of the showcases and the official site are raised for the added pages, with the reason in `perf-budgets.json`. Initial JavaScript and stylesheet budgets are unchanged.

### Known limitations
- Directives are line-level: they are not recognised inside block quotes, lists or tables (they stay literal). Source and include errors inside a fragment point at the fragment, not at the including page.
- Links inside a fragment are not rewritten; use absolute routes. A new authored page needs a `doq content generate` (the Vite plugin does it on start and on change).
- Archived documentation needs its own source snapshot and API index; Doqs never fetches an old tag.
- `watch` and the plugin watch the files read by the last successful run.

## 0.9.0

Interactive component playgrounds. Additive: no exported type, function, configuration key, frontmatter key, route or `--host-docs-*` token was removed or changed, `::demo[id]` and every 0.8 (and earlier) configuration build and render as before, and `pnpm verify:public-api` passes against the 0.7.0 baseline.

### Added
- **`::playground[id]`** Markdown directive, recognised like `::demo[id]` (its own paragraph; literal inside code, lists, quotes, tables and tab bodies).
- **`DoqConfig.playgrounds`**: a registry of `{ component, title?, description?, controls?, outputs?, code?, previewSizes? }`. `defineDoqConfig` reports every problem in one readable error (duplicate controls, bad ids, select `initial` outside the options, invalid ranges, required controls without an initial value…).
- **`DoqPlaygroundComponent`** (rendered for you): `boolean`, `string`, `number` (`min`, `max`, `step`) and `select` controls; inputs are bound with Angular's public `createComponent({ bindings })` by their public (alias) name, so signal inputs, required inputs, transforms and legacy `@Input` work and a control change never recreates the component; selected `output()`/`EventEmitter`/`model` change events are listed (latest 20, safely formatted); Reset (restores controls, clears events, recreates the component); preview widths (Responsive, Mobile 320px, Tablet 768px; customisable or `false`); an Expand view in a native modal `<dialog>` that keeps the same component instance; code tabs with exact copy and a polite status message.
- Helpers `formatDoqUsage()` (template usage with correct escaping), `formatDoqEventPayload()`, `validateDoqPlaygrounds()`, `parseDoqDocument()` and the constants `DOQ_INLINE_PLAYGROUND_PATTERN`, `DOQ_DEFAULT_PREVIEW_SIZES`, `DOQ_PLAYGROUND_EVENT_LIMIT`; `DoqDocsComponent.parts`.
- Two optional tokens, `--host-docs-playground-surface` and `--host-docs-playground-preview`; `forced-colors` and `prefers-reduced-motion` rules.
- Repository: playground fixtures in Showcase A (real Volt UI button), Showcase B (two independent SDK playgrounds), the official documentation (real Angular Movement) and the Angular Movement adoption proof; the _Interactive playgrounds_ guide.

### Fixed
- **The 0.8.0 release could not run.** The _Release eligibility_ job executed `scripts/verification/package.ts` (which imports TypeScript) before installing dependencies and failed with `ERR_MODULE_NOT_FOUND`; npm still served 0.7.0. The job now installs the workspace first (`--ignore-scripts`, SHA-pinned action), with a regression test.

### Changed
- `parseDoqContent`, `DoqRichSegment` and `DoqDocsComponent.segments` are deliberately unchanged (they never contain playgrounds); the document view renders `parts` (`parseDoqDocument`).
- Stylesheet +6.3 KB source / +0.9 KB gzip; budgets in `perf-budgets.json` raised for exactly that, with the reason recorded. JavaScript budgets are unchanged.

### Known limitations
- Overlays that a component appends to `<body>` (CDK overlays, popovers outside the top layer) render below the Expand dialog.
- Controls are written by hand; they are not inferred from `doq-api` metadata (planned for later). Object-graph inputs need a wrapper component.
- Code examples are text you provide; importing source files into Markdown is planned for 0.10.
- The playground is client-interactive only after hydration; a component that cannot render on the server must guard browser APIs like any SSR component.

## 0.8.0

Integration developer experience and public API stabilization. Additive: no exported type, function, configuration key, frontmatter key, route or `--host-docs-*` token changed, and every 0.7 (and earlier) configuration builds and renders as before. The browser bundle (`fesm2022`) is byte-for-byte unaffected by the new tooling.

### Added
- **`doq` command-line tool** (Node-only, dependency-free; loads neither Angular nor TypeScript nor Vite):
  - `doq init [--mode embedded|docs-first] [--content-dir <name>] [--base-path <path>] [--dry-run] [--json]` scaffolds `src/doq.paths.ts` and two starter Markdown pages in an existing Angular/Analog application. It never overwrites a file (files are created exclusively), cancels every write when a conflict exists, validates paths against traversal and symbolic-link escapes, skips the starter pages when the content folder already holds Markdown, and is repeatable. It reports **Scaffold complete** and **Integration complete** separately, inspects `vite.config.*`, the Angular providers and the stylesheet by reading them, and prints the exact snippets for whatever is missing instead of rewriting your configuration. The deterministic Markdown plugin is listed as a recommended step.
  - `doq doctor [--build] [--strict] [--json]` classifies each Doqs integration check as `PASS`, `WARN`, `FAIL` or `UNKNOWN`, each with what was checked, what was found, why it matters, how to fix it and the file concerned: Node version, the installed Doqs version and each of its peer ranges against the packages actually installed, the paths file, `contentDirectory`, `basePath`, content folder, frontmatter, duplicate and invalid slugs, version archives, providers, Markdown renderer, stylesheet, prerender routes, highlighter, the deterministic plugin and, only when search is enabled, `pagefind` and the indexing step. `--build` also inspects an existing static output (it never builds). Doctor does not execute project code: computed values are `UNKNOWN`, never a guessed `PASS`. `--json` prints exactly one document on stdout; usage errors go to stderr with exit code 2; exit code 1 means a failed check.
  - `doq`, `doq-search` and `doq-api` stop with a one-line message and exit code 2 on an unsupported Node.js (outside `^20.19.0 || ^22.12.0 || >=24.0.0`).
- **Public API compatibility check** (repository tool): `pnpm verify:public-api` compares the packed declarations of every entry point with the committed `packages/doq/public-api.report.json` and with the 0.7.0 baseline (`public-api.baseline.json`): a removed export, a removed or retyped member, a changed function signature or alias, a new required interface member or a removed binary fails. `pnpm public-api:update` records an intended change.
- **Official documentation at `/docs`** (apps/site, not shipped in the package): 18 pages rendered by Doqs itself — lazy region, Pagefind search, a consumer-owned Angular demo, `doqDeterministicMarkdown()`.
- Repository verification: bare Analog applications adopt the packed tarball through `doq doctor` / `doq init` (Angular 21 embedded, Angular 21 docs-first, Angular 22; `pnpm verify:init`), and the Angular Movement adoption proof now starts with `doq doctor` and `doq init` on the real checkout.

### Fixed
- **"On this page" overflowed the viewport on wide screens.** The table of contents was positioned relative to the right edge of the (centered) article box instead of the space the article reserves for it, so it was cut off at the window edge. It is now anchored beside the content column (`left: calc(var(--doq-content-width) + 2rem)`); layouts at or below 1450px are unchanged.

### Changed
- The package README is a short entry point; the guides moved to the official documentation (`apps/site/src/content/docs`). The stale "Version 0.3.0" line is gone and README anchors that no longer exist were replaced by the documentation pages.
- Documentation (README, official docs) no longer ships setup snippets that omit `provideContent(withMarkdownRenderer())` or the Markdown highlighter.

### Known limitations (unchanged upstream facts)
- `doqDeterministicMarkdown()` contains an upstream Analog/marked concurrency problem; it does not fix it.
- Applications that load Zone.js, Vite below 8, screen-reader output and WCAG conformance are not verified.
- The document view renders an `article` without a `main` landmark (the index view renders one); hosts without `DoqShellComponent` must supply the landmark. Recorded as a 1.0 blocker candidate in `docs/roadmap/1.0-readiness.md`.

## 0.7.0

Production hardening. Additive: no exported type, configuration key, frontmatter key, route or `--host-docs-*` token changed, and every 0.6 (and 0.5-style) configuration builds and renders as before.

### Added
- **`@doqs/analog/vite` → `doqDeterministicMarkdown()`** (Node-only, opt-in). `@analogjs/platform` renders each Markdown file in the `load` hook of its `analogjs-content-file` plugin; Vite runs those hooks concurrently, all of them share one `marked` instance, and `marked-gfm-heading-id` keeps its slugger in module state. With an asynchronous marked step (Shiki or any async highlighter) two files interleave and receive each other's duplicate-heading suffixes (`usage-2` where `usage-1` belongs), and the wrong ids are baked into the bundle. The plugin calls Analog's own hook through the resolved plugin list, one file at a time, so the output equals a sequential build. Nothing is patched or copied; it throws at config time when Analog's plugin is missing. Add it next to `analog()` in `vite.config.ts`. See [Deterministic builds](https://github.com/Andersseen/doqs/blob/main/apps/site/src/content/docs/operations/deterministic-vite-plugin.md).
- **Static integrity check** `pnpm docs:check` (repository tool, not shipped): for every prerendered page it compares heading ids with a strictly sequential render of that page, rejects duplicate ids, empty pages, a missing or repeated `h1`, table-of-contents links to missing ids, broken same-site links and fragments (navigation, version switcher, Markdown, generated API pages), several or foreign canonical links, Markdown sources without a route and documentation pages without a source. External links are never fetched.
- **Measured budgets** `pnpm perf:check` (initial JavaScript, all JavaScript, stylesheet, search index, page count, core CSS; `perf-budgets.json`) and `pnpm perf:scale` (generated 20/200/1000-document fixtures).
- **Compatibility matrix** `pnpm verify:compat --angular=21|22`: the packed tarball in a docs-first consumer on Angular 21.2 and on Angular 22.2 with TypeScript 6 (strict peers, no Zone.js), with `doq-api check`, `doq-search`, `docs:check` and an Angular-integration smoke suite.
- **Cross-browser matrix** `pnpm test:e2e:browsers`: the journeys that depend on the engine run in Firefox and WebKit on the production builds (the complete suite stays in Chromium).

### Fixed
- **Back/Forward in WebKit.** WebKit restores the destination's scroll position before `popstate`, so Doqs recorded the wrong position for the entry being left and Forward to a fragment entry kept the previous scroll. The position the reader is leaving from is now tracked from scroll events and frozen during a traversal.
- **Forced colors (high contrast).** The selected tab and the current navigation, table-of-contents and version links were distinguishable only by colour and weight; they now also use `Highlight` and an underline when `forced-colors: active`.

### Changed
- Tests: the copy tests read the clipboard back only where the engine can grant `clipboard-read` (Chromium); Firefox and WebKit assert the visible confirmation. Keyboard tests use the engine's "visit everything" chord where Safari's default skips links (WebKit on macOS). Engine-specific wording of a legitimate 404 is accepted, nothing else.
- The Angular Movement adoption proof builds once with `doqDeterministicMarkdown()` and validates with `docs:check` instead of rebuilding until the ids happened to be canonical.

### Compatibility and limits
- Angular `^21.2.2 || ^22.0.0` (unchanged). Verified: Angular 21.2.x (every suite) and Angular 22.2.x with TypeScript 6.0 (smoke suite), both zoneless. **Not verified:** applications that load Zone.js, Analog above 2.9.x, Vite below 8 with the new plugin.
- Browsers verified on production builds: Chromium (complete suite), Firefox and WebKit (focused matrix). Clipboard read-back is verified in Chromium only.
- The first-loaded JavaScript grows by about 46–52 B (gzip) per document of any version: Analog bundles the frontmatter and a loader of every Markdown file, and there is no supported Analog API to defer it. Measured: 20 documents 186.8 KB, 200 documents 200.8 KB, 1,000 documents (+500 archived) 254.9 KB; navigation between documents stays at 14–39 ms.
- Accessibility is checked with axe and keyboard journeys; this is not a WCAG certification (see the README).

## 0.6.0

Versioned documentation. Additive and opt-in: a 0.5 configuration (no `versioning`) produces the same routes, the same markup, the same search calls and the same prerendered files as before; this is verified with a 0.5-style consumer built from the packed tarball.

### Added
- **`versioning` in `DoqPaths`/`DoqConfig`**: `{ current: { id, label }, archives: [{ id, label, contentDirectory }], pathSegment?, canonicalOrigin? }`. The top-level `contentDirectory` stays the current version at its existing URLs; every archive is an independent catalog in its own folder, mounted at `<basePath>/<pathSegment>/<id>` (`/docs/v/1.3`, or `/v/1.3` for a docs-first site). Validated with one-line diagnostics: id syntax, duplicates (case-insensitive), overlapping or unsafe content directories, the reserved URL segment, empty archives and origins.
- **Routing**: `doqRoutes()` adds an index and a document route per archive (before the current routes), never lets the current routes capture the reserved prefix, and sends unknown versions to the not-found view. Route data carries the version; no second router.
- **Prerendering**: `doqPrerenderRoutes()` returns an index and a content route for every version, with the same slug rules; the reserved prefix is rejected for current documents.
- **Catalogs**: `injectDoqDocuments(config, versionId?)` reads only that version's folder; sidebar, index cards, breadcrumbs, previous/next and counts follow the active version. Content is resolved by version and public slug (Analog's slug-keyed content map), so equal slugs in two versions never load each other's Markdown.
- **`DoqVersionSwitcherComponent`** and `doqVersionLinks()`: native `<details>` selector of real links in the sidebar/drawer (top bar when the sidebar is hidden, and on index pages); `aria-current`, current/archived labels, Escape returns focus; switching keeps the public slug or opens the target version's index; archived pages show a notice.
- **Search**: indexed pages carry `data-pagefind-filter="doqsVersion:<id>"`; the dialog filters at Pagefind search time with the version being read and reports a version that was never indexed. Unversioned sites use no filter.
- **SEO**: archive titles end with the version label; optional `canonicalOrigin` makes each page declare its own canonical URL (a host-authored canonical link is never replaced, Doqs's link is removed with the last Doqs page). No origin is hard-coded.
- **API reference**: no generator change was needed; `--content-dir`, `--out` and `--base-path` already produce independent archived references with independent manifests (verified, including that regenerating the current reference cannot touch an archive).
- Showcase A (embedded `/docs`, archive `v1.x` with its own generated reference), Showcase B (docs-first, archive `1.x`) and the Angular Movement adoption proof (archive built from the real upstream tag `v0.9.0`) exercise the same public API.

### Changed
- `normalizeDoqPaths()` additionally returns the resolved `versioning` when configured. New exports: `DOQ_VERSION_FILTER`, `doqVersionLinks`, `DoqVersionSwitcherComponent` and the version types.
- `DoqSearchService.search()` takes an optional `versionId` (fourth parameter) and rejects with `DoqVersionNotIndexedError` when the index has no such version.
- CSS: new selectors `.doq-version*` and `.doq-version-notice`; no token was added or changed.

### Fixed
- `scripts/preview-static.ts` crashed on a directory without `index.html` (such as the bare `/docs/v` prefix) because it had already sent a 200 header when reading failed; it now answers 404.

### Compatibility and limits
- Node and peer ranges unchanged; no new dependency. Frontmatter of all versions is in the browser bundle (Analog's content list), bodies load lazily per page.
- Not included: localization, automatic snapshots, remote content, per-version themes, semantic API diffing.

## 0.5.0

Angular API reference generation. Additive and opt-in: nothing changes for a project that does not run `doq-api`; no configuration option, route, frontmatter key read by the runtime or CSS token was added or changed, and the Angular entry point imports neither Node nor TypeScript.

### Added
- **`doq-api generate` / `doq-api check`** (Node-only CLI) and **`@doqs/analog/api-reference`** (`generateApiReference`, `checkApiReference`, `buildApiReference`, `DoqApiError`, typed in `api-reference.d.mts`). They read a library's public entry point with the project's own TypeScript (optional peer `^5.5.0 || ^6.0.0`, resolved from the project, never bundled) and write deterministic Doqs Markdown: an index plus one page per public symbol, as tables and fenced code, with frontmatter (`title`, `description`, `group`, `order`, `generated`, `category`).
- **Angular-aware extraction**: components, directives, pipes and services (selector, `exportAs`, pipe name, `providedIn`); signal `input()` / `input.required()` with aliases, defaults, transforms and both the accepted and the read type; `model()` with its change output; `output()`; legacy `@Input()` / `@Output()` with `EventEmitter`; public methods and properties. Computed metadata is reported, never guessed.
- **TypeScript extraction**: functions with overloads, arrow-function constants, interfaces, type aliases, enums, classes, constants; readable signatures (generics, optional/rest parameters, unions, readonly arrays) without absolute paths; links to other documented symbols; JSDoc (`@param`, `@returns`, `@example`, `@deprecated`, `@since`, `@see`, `@stability`, `@experimental`, `{@link}`) with HTML and Doqs directives neutralised.
- **Safe ownership**: output only inside a sub-directory of the content directory, a `.doq-api.json` manifest with file hashes, no overwrite of hand-written or hand-edited files, removal only of unchanged generated files, nothing written when a conflict exists.
- **Check mode**: exits 1 and names added, modified and removed pages when the committed reference is stale; never writes. Exit code 2 marks usage and configuration errors. `--strict` fails on warnings and undocumented symbols.
- Options: `--entry`, `--project`, `--out`, `--content-dir`, `--base-path`, `--group`, `--title`, `--order-start`, `--source-url`, `--include`, `--exclude`, `--strict`, `--cwd`.
- Showcase A documents a standalone Angular component and directive (`apps/showcase-a/vanta-ui`); Showcase B documents a non-Angular SDK (`apps/showcase-b/forge-sdk`); both commit their generated pages and check them in `pnpm verify:change` / CI (`pnpm api:check`). The disposable Angular Movement proof generates and verifies the reference of its real public API.

### Fixed
- A long unbroken title (a generated API page named `VantaAlertComponent`) overflowed a 375 px viewport on Linux fonts; document and index titles now wrap anywhere (`overflow-wrap`).
- Release workflow: `verify-published` waited two minutes for npm to list a fresh version, but the registry took about six minutes to list `@doqs/analog@0.4.0` (published 09:51 UTC, visible 09:57 UTC on 2026-10-22), so the GitHub Release `v0.4.0` was not created. The window is now ten minutes or more (`PUBLISH_VISIBILITY`, regression test `UNIT-100`). The missing `v0.4.0` release is not created retroactively; see `docs/operations/release-and-deployment.md`.

### Compatibility and limits
- Node `^20.19.0 || ^22.12.0 || >=24.0.0`; tested with TypeScript 5.9 (this repository) and 6.0 (Angular Movement). No Angular peer range was widened.
- Links inside Markdown are ordinary anchors (Analog does not intercept them), so following a reference link is a normal navigation to a prerendered page.
- Not included: a TypeDoc replacement, API versioning, template analysis, runtime reflection, a browser-side analyser.

## 0.4.0

Rich documentation authoring. Additive: every 0.3 configuration, document, route and `::demo[id]` directive works unchanged, and a document without rich blocks renders as one Markdown region exactly as before. No configuration option was added; the blocks are always on and only recognise the exact syntax below.

### Added
- **Callouts**: GitHub-style alerts, `> [!NOTE]`, `TIP`, `IMPORTANT`, `WARNING` and `CAUTION` (case-insensitive, marker alone on the first line of a blockquote). They render as `div.doq-callout[role="note"]` with a visible title and a distinct glyph per kind, so meaning never depends on colour alone, and work at any nesting depth (including inside steps and tabs). Ordinary blockquotes, unknown markers (`[!DANGER]`) and markers in code stay as written.
- **Tabs**: `:::tabs [label]`, `:::tab Label` per tab, `:::` to close. WAI-ARIA tabs (`tablist` / `tab` / `tabpanel`, `aria-selected`, `aria-controls` / `aria-labelledby`, roving tabindex) with Arrow, Home and End keys. Every panel is in the prerendered HTML (inactive ones `hidden`); each group keeps its own selection and ids are stable between server and browser. A group whose tabs only contain code renders as a **code group** with flush code panels, using the same component.
- **Steps**: `:::steps` around an ordered list renders a native `<ol>` with a rail and styled markers (`::marker`, no custom counters), so numbering stays real list semantics. Nested code, links and callouts work.
- **Code presentation**: a visible language label on every fenced block (`data-language`, drawn by CSS so it is not searchable text) and `:::code file.ts` before a fence for a titled block (`figure.doq-code` + `figcaption`). The copy button copies the block's exact text.
- **Search policy**: callout bodies, steps, titled code and the content of inactive tab panels are indexed; the tab strip and callout titles are `data-pagefind-ignore`.
- **CSS tokens** (optional, all with defaults): `--host-docs-callout-note`, `-tip`, `-important`, `-warning`, `-caution`.
- Exports: `parseDoqContent`, `DOQ_CALLOUT_TYPES`, `DoqRichSegment`, `DoqTab`, `DoqCalloutType`, `DoqTabsComponent`.
- A fragment that points at a heading inside an inactive tab activates that tab before scrolling.
- `basePath: '/'` mounts the documentation at the application root, for sites that are documentation only. The index is served at `/` and documents at `/<slug>`; `doqRoutes`, `doqPrerenderRoutes`, document routes, pagination and search result URLs all honour it. `basePath: ''` is still rejected.
- Export `joinDoqPath(basePath, slug)`, the single place that builds public document URLs.

### Changed
- Markdown lists inside `.doq-markdown` now restore `list-style` (`disc` / `decimal`) and a left padding, so a host reset such as Tailwind's preflight no longer removes bullets and numbers.
- The copy button reads `textContent` of the code element (identical text in browsers, and testable without layout).

### Fixed
- Release workflow: `npm publish artifacts/<file>.tgz` was parsed by npm 11 as a GitHub repository spec and failed before publishing. The tarball is now passed as an absolute path by `scripts/release/cli.ts publish` (regression test `UNIT-070`). The 0.3.0 publication never reached npm; see `docs/operations/release-and-deployment.md`.

### Compatibility and limits
- Directive lines (`:::...`) must be paragraphs of their own: put a blank line (or a code fence) before and after them. Text glued to a marker, an unclosed group, a `:::tab` outside `:::tabs`, nested `:::tabs`, or a steps group without an ordered list leave the original text on the page; nothing is dropped.
- `::demo[id]` is recognised at the top level of the article, not inside a tab or step. `:::code` titles apply at the top level, in tabs and in steps' top-level paragraphs, not inside a list item.
- Fence metadata (`ts title="x"`) is dropped by Analog before Doqs sees the HTML, which is why a title is a `:::code` line rather than part of the fence.

## 0.3.0

Interactive Markdown. Additive: every 0.2 configuration, document, route and `demo:` frontmatter key works unchanged, and documents without a directive render the same single Markdown region as before.

### Added
- `::demo[id]` directive: a line containing only this text places a component registered in `config.demos` at that position in the Markdown. Multiple occurrences, repeated ids and different ids are supported; each is an independent Angular instance that is server-rendered, hydrated and destroyed on navigation.
- Safe by construction: Doq cuts Analog's already-rendered HTML at top-level directive paragraphs only. Directives in code blocks, inline code, lists, blockquotes, tables or running text stay literal; heading ids, duplicate-heading suffixes, the table of contents, highlighting and search anchors are unchanged. No evaluation, no HTML injection, no template compilation.
- Unknown ids render an accessible `role="status"` notice instead of failing the page. A frontmatter `demo:` that is also placed inline renders once.
- Exports: `splitDoqInlineDemos`, `DOQ_INLINE_DEMO_PATTERN`, `DoqContentSegment`.
- Search: demo markup is `data-pagefind-ignore`; Markdown before and after a demo is indexed.
- `docs/guides/angular-movement-migration.md` and `pnpm verify:adoption`, an opt-in proof against a disposable checkout of the real Angular Movement site (Angular 22, zoneless, Tailwind 4, `SmoothScrollService`).

### Changed
- The document body is wrapped in `.doq-content` (`min-width: 0`); inline demo wrappers are `.doq-region.doq-inline-demo` (block, `overflow-x: auto`). Markdown remains in `.doq-markdown`.
- The copy buttons, heading observation and fragment lookup consider Markdown-rendered nodes only, so markup inside a consumer demo is never decorated or matched by id.

## 0.2.0

Documentation search and navigation. Additive: configuration from 0.1 works unchanged and search is off unless enabled.

### Added
- Optional static full-text search: `search: { enabled, bundlePath }` in `defineDoqConfig()`, a Doq-owned search dialog (native modal `<dialog>`, Ctrl/Cmd+K inside documentation views, keyboard result navigation, loading/empty/unavailable states, plain-text excerpts) and a lazy Pagefind data layer. No backend; the index is requested on the first query.
- `doq-search index <siteDir>` and `@doqs/analog/search-index` (`indexDoqSearch`): build the Pagefind index from the prerendered output. Node-only, not part of the browser entry point. `pagefind` is an optional peer dependency.
- Doq markup is annotated for Pagefind (`data-pagefind-body` on the article, `data-pagefind-ignore` on chrome, demos and slots) so only documentation content is indexed.
- Exports: `normalizeDoqSearchConfig`, `normalizeSearchResultUrl`, `DoqSearchConfig`, `DoqResolvedSearchConfig`, `DoqSearchResult`, `DoqExcerptSegment`.
- `--host-docs-scroll-offset` token (default `2rem`) for heading `scroll-margin-top`.

### Fixed
- Table-of-contents links, direct `#fragment` loads, reloads and client-side fragment navigation now scroll the heading into view after the Markdown renders; Back/Forward restore the reader's scroll position.
- After the mobile drawer, previous/next, search or a card link changes the document, the page starts at the top and keyboard focus moves to the article heading instead of falling back to `<body>`.

### Changed
- The document `<h1>` (and the index `<h1>`) carry `tabindex="-1"` as a programmatic focus target; they are not tab stops.
- The document view gains a `.doq-topbar` wrapper around the breadcrumb (and the search button) and `.doq-region` wrappers (`display: contents`) around demos and slots.
- `@doqs/analog` now ships `bin/` and a `bin` entry.

## 0.1.0

First versioned release. Existing 0.0.0-pilot configuration keeps working.

### Added
- `doqPrerenderRoutes(paths)` — Analog `prerender.routes` entries (index + recursive content route with canonical slug transform) from one `{ contentDirectory, basePath }` object.
- `DoqPaths`, `normalizeDoqPaths()` and `defineDoqConfig()` — one shared, validated, build-safe path contract for Vite and Angular.
- `slots.indexAfterIntro` and `slots.documentAfterContent` — optional host-owned standalone components rendered with `NgComponentOutlet`.
- `presentation` — `documentationLabel`, `indexTitle`, `indexDescription`, `pageTitleSuffix`.
- Scoped page metadata: host title and description are captured (on the server and transferred to the client) and restored on leaving the docs; documents without a description no longer keep the previous document's; unknown docs routes get a `Page not found` title.
- `pnpm verify:package` (tarball and installed-consumer checks) and the `v01` browser check in `pnpm verify:mvp`.

### Changed
- The index and document components share one document catalog (`injectDoqDocuments`) instead of duplicating discovery.
- The docs index now sets the page title (previously left untouched).
- `contentDirectory` and `basePath` are normalized by `provideDoq()`.

### Unchanged
Routing, canonical and custom slugs, navigation order, heading IDs, mobile drawer, TOC, code copy and the demo registry.

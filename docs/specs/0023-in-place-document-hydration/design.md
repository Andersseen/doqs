# Design — 0023 in place document hydration

## Existing implementation

### Evidence and root cause

PR #39 / spec 0022 intentionally left this Doqs defect open. `DoqDocsComponent.document` subscribes to `ActivatedRoute.paramMap`, uses `switchMap` to find a catalog file, dynamically imports it, parses frontmatter, awaits `ContentRenderer.render()`, and prepends `undefined` with `startWith`. Its initial `toSignal` value is also `undefined`. On the browser's initial navigation, the server already has the resolved article, but the client view is the `doq-loading` placeholder. Hydration cannot reconcile those shapes and the prerendered `main.doq-root` is replaced.

The document identity uses the configured route parameter plus route data for locale and version. `injectDoqDocuments()` owns normalization and catalog lookup; the component also implements the explicit default-locale fallback when configured. The intended boundary is an internal `ResolveFn` attached by `doqRoutes()`: resolve content before component activation on both server and client, rerun on route parameter changes, and return `null` for existing not-found states. The resolver must reuse `injectContentFilesMap()`, the existing file alias matching, `parseRawContentFile()` and `ContentRenderer`.

## Proposed implementation

### Design constraints

- First obtain baseline DOM-replacement evidence on the existing showcase and site production builds; hydration markers alone do not prove reuse.
- Determine Angular's installed router/hydration order through focused tests on Angular 21 and 22 rather than relying on older router assumptions.
- Keep the public `doqRoutes()` call shape and do not export resolver types or helpers.
- Centralize document identity/catalog/fallback resolution if sharing existing injection helpers would otherwise duplicate semantics.
- The resolver result is route data. `DoqDocsComponent` consumes it while preserving current `routeSlug`, metadata, navigation and `document` signal shape. Verify route reuse when params change and rapid-navigation cancellation.
- Do not add TransferState unless measured evidence shows a second Markdown import/render is necessary and the mechanism works for static prerender; keep one lazy document chunk, never all docs.
- Resolver errors keep the existing `console.error` and not-found result behavior. Verify whether router cancellation changes this behavior.

## Tradeoffs and alternatives

- Keep component-level loading and suppress/remove hydration: rejected because it masks the lost prerender DOM.
- Eagerly import every Markdown document: rejected because it increases the initial application bundle.
- TransferState: deferred pending direct evidence; a route resolver may naturally resolve the same deterministic document on each runtime without transferring rendered state.
- New public resolver/configuration option: rejected absent a consumer requirement.

## Risks to prove

Angular initial navigation and hydration must wait for resolver completion in both current supported majors; the official site uses lazy routes and must retain the correct route-scoped `DOQ_CONFIG`. Reused component instances must not retain an old resolver result. Locale fallback must remain explicit and catalog-specific. Existing `PendingTasks` and metadata timing may need adjustment if SSR waits on Router but not Angular stability. Final correctness includes node identity, interactions, direct loads, client transitions and packed-consumer compatibility.

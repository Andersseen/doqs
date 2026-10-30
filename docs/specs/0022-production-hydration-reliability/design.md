# Design — 0022 production hydration reliability

## Existing implementation

`scripts/init-consumer.ts` builds a bare Analog host from the packed tarball, runs `doq doctor`/`doq init`, applies the printed snippets, builds, and runs `doq doctor --build`. `e2e/consumer-init.spec.ts` then loads two pages. Both Doctor and the build exit 0 even when a component was left uncompiled, so the only detector was an incidental console-error assertion in a later E2E.

## Investigation

The failure reproduced from a reused build directory left by the failing run (`dist` built the day before: host `index.page` chunk contained `__decorate([Component(...)])` and the bundle retained Angular's `JIT compiler unavailable` path), while a clean rebuild of the same sources, versions and tarball was correct (6/6 sequential rebuilds, also of that very directory).

Controlled experiments, all with the same packed 0.12.0 tarball, Angular 21.2.25, three builds in parallel per round, JIT fallback counted in the client output:

| Setup                                                                                 | Result         |
| ------------------------------------------------------------------------------------- | -------------- |
| Analog 2.9.0 (peer-relaxed, diagnostics)                                              | 2 of 24 builds |
| Analog 2.9.1                                                                          | 3 of 24 builds |
| Analog 2.9.2 (current)                                                                | 2 of 24 builds |
| Angular 22 + Analog 2.9.2                                                             | 1 of 7 builds  |
| Bare Analog 2.9.2 host, no Doqs, parallel                                             | 0 of 30 builds |
| Same bare host, client transform of the host page held until the SSR environment ends | 3 of 3 builds  |

`vite build` runs the client and SSR environments concurrently against one `@analogjs/vite-plugin-angular` instance. The plugin's `buildEnd` calls `releaseCompilation()`, which clears the `outputFiles` map that `fileEmitter()` reads. Any module the slower environment transforms after that point is not in the emit map, the plugin returns without transforming it, and the bundler's plain TypeScript transform emits decorators. No warning is printed, the exit code is 0. The deterministic Doqs-free reproduction above forces exactly that order. The failing module is always host code (a `*.page.ts`), never Doqs: the package ships partially compiled declarations that the linker compiles.

Classification: **UPSTREAM** (`@analogjs/vite-plugin-angular`, all of 2.9.0–2.9.2), exposed by machine load and build timing. Not DOQS_RUNTIME, not DOQS_CLI generated output (the generated config is identical in good and bad builds), not the 2.9.1 class-metadata change, not the 2.9.2 update. The shared-map explanation is established by the deterministic repro and by reading the plugin; it has not been confirmed against the plugin's own debug output, and nothing here claims upstream has acknowledged it.

`analog({ vite: { fastCompile: true } })` made the deterministic repro pass, but it selects a different, experimental compiler path; adopting it needs its own evidence and is out of scope. `experimental.useAngularCompilationAPI` failed to build (TS5103) in the same host.

## Proposed implementation

- `packages/doq/bin/cli/doctor.mjs`: a `build.aot` finding with `--build`. It reads the built `.js` files (not `pagefind/`) as text. A file containing Angular's `JIT compiler unavailable` message and no assignment to `ɵcompilerFacade` (the compiler publishing itself) means a component needs the JIT compiler the bundle does not have: FAIL. The same message with the facade assignment means the runtime compiler was bundled on purpose: WARN. Neither: PASS. In every AOT build measured the message is tree-shaken out entirely.
- `scripts/aot-guard.ts`: `assertAotBuild()` runs that finding from the repository CLI; `scripts/consumer.ts`, `adoption.ts`, `adoption-routes.ts` and `adoption-volt.ts` call it after their build (`adoption-existing.ts` and `init-consumer.ts` already run `doctor --build` and fail on a FAIL finding).
- `scripts/init-consumer.ts`: `--analog=<version>` pins the Analog packages exactly for diagnostics (strict peers off, only `peer.*` doctor failures tolerated), so the comparison needs no lockfile change.
- `e2e/consumer-init.spec.ts`, `e2e/fixtures.ts`, `playwright.config.ts`, `scripts/e2e.ts`: three cells (Angular 21 embedded, Angular 21 docs-first, Angular 22 embedded) with direct-load hydration, one-document client navigation, Back/Forward and search-disabled assertions.

## Finding recorded, not fixed: documentation pages re-render on the client

On every Doqs documentation page the prerendered `<main class="doq-root">` is discarded and rendered again. `DoqDocsComponent.document` is a `toSignal` over a dynamic import of the Markdown module with `startWith(undefined)`, so the first client render is the `doq-loading` placeholder while the server markup holds the document; Angular cannot reuse the nodes and, in production, silently recreates them. Hydration markers are consumed and the final DOM is correct (single root, single `<h1>`), but the prerendered content is replaced. This reproduces on `showcase-b` and the initialized consumers and predates this milestone. A real fix means resolving the document before the component is created (a route resolver sharing the catalog, locale and fallback logic of a 623-line component), a change with public-route and i18n risk that deserves its own spec. The E2E asserts the exact current behavior (`only MAIN may be recreated`, annotated `known-limitation`) so it cannot worsen unnoticed, and the host page and documentation index are asserted to reuse their nodes.

## Tradeoffs and alternatives

- **Retry the build when the guard fails**: rejected; it would hide an upstream race and the task forbids it. A loud, specific failure is the goal.
- **Serialize the client and SSR builds in generated config**: would change the host's build architecture and was not shown to be safe for Analog's prerender pipeline.
- **Default `fastCompile`**: experimental path, changes the compiler for every consumer, different from the Angular compiler Doqs's partial output is linked by in 2.9.x; rejected without evidence.
- **Scan for `Reflect.decorate`** instead of Angular's message: decorator helpers legitimately exist in some dependencies; the JIT-unavailable path is specific and is absent from every AOT build.
- **Import the doctor scan into the scripts**: TypeScript scripts cannot import the untyped `.mjs`; running the CLI keeps one implementation.

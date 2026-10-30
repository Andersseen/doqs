# 0022 — production hydration reliability

## Problem

Spec 0021 recorded a packed, newly initialized consumer whose production build exited 0, was reported healthy by `pnpm verify:init` and `doq doctor --build`, and then failed in a real browser: the host's home page never hydrated because a lazy chunk threw Angular's `JIT compiler unavailable`. The failure was not reproducible on the next clean build, so it was neither fixed nor explained. Investigation for this milestone (see `design.md`) classified it as an intermittent **upstream** defect in `@analogjs/vite-plugin-angular`: when the client and SSR builds overlap, the first environment to finish clears the plugin's shared compilation output, and a component transformed afterwards is emitted with plain decorators, silently, with exit code 0. The defect is independent of Doqs and of the Analog 2.9.1/2.9.2 update, and it is not fixed upstream. What Doqs owns is that its onboarding checks reported such a build as healthy.

## Consumer impact

`doq doctor --build` gains one finding, `build.aot`, so an application whose bundles cannot run is no longer reported as passing. No exported API, option, route, frontmatter key or token changes. Applications that already build correctly see one more `PASS` line.

## Scope

Reproduce and classify the failure; make `doq doctor --build` fail a build that needs the JIT compiler it does not contain; make every repository script that builds a consumer, and the initialized-consumer browser journeys, fail loudly and specifically instead of at an unrelated assertion; extend the existing initialized-consumer E2E from "pages load" to "pages hydrate, navigate and go Back/Forward" for Angular 21 embedded, Angular 21 docs-first and Angular 22 embedded; document verified versions and the difference between CLI success, build success and browser hydration success.

## Non-goals

No change to Doqs rendering, routing, the generated `doq init` output, the Analog peer range, or the Angular compiler setup of consumers. No `@angular/compiler` in browser bundles, no disabled lazy loading, SSR or hydration, no retry or sleep to hide the race, no experimental Analog option adopted by default. No restructuring of how documentation pages obtain their Markdown (recorded as a finding below, not fixed here). No 1.0 declaration, publication, tag or deploy by hand.

## Requirements

- **REQ-001** A bare Analog application that adopts Doqs in embedded mode with `doq init` and the printed snippets, built from the packed tarball, hydrates its host page, the documentation index and documentation pages in a real browser with no uncaught error, console error or warning.
- **REQ-002** The same holds in docs-first mode, where Doqs owns the root and every other URL is a documentation 404.
- **REQ-003** The journeys run on Angular 21 and Angular 22 against the same packed tarball, and prove the Angular major that was built (`ng-version`).
- **REQ-004** Lazy documentation routes load and render without a runtime compiler error, and a production build that ships components compiled for the JIT compiler without bundling it is reported as a failure by `doq doctor --build` (`build.aot`) and stops the repository scripts that build consumers.
- **REQ-005** Onboarding acceptance exercises a real browser after `doq init`: hydration markers consumed, one application root and one `<h1>`, client-side navigation inside one document, Back/Forward, and no Pagefind request while search is disabled. CLI success and build success are not presented as hydration success.
- **REQ-006** Upstream and environmental limits are reported as such: the intermittent Analog build race and the documentation-page re-render are recorded with evidence and classification, and Analog versions other than the supported range are never claimed to work.
- **REQ-007** Public API, bundle size and performance budgets are unchanged apart from the CLI check; the browser entry gains no import of `@angular/compiler`, and the Node-only CLI stays dependency-free.

## Acceptance cases

- **AC-001** [REQ-001, REQ-005] Given the embedded initialized consumer, when `/`, `/docs`, `/docs/getting-started` and `/docs/introduction` are loaded directly, every page shows its heading, has consumed every `ngh` marker, has exactly one `app-root` and one `<h1>`, and the browser reports nothing; the host page and the documentation index keep their prerendered nodes.
- **AC-002** [REQ-002, REQ-005] Given the docs-first consumer, `/`, `/getting-started` and `/introduction` hydrate the same way and `/about` is a documentation 404 that also hydrates.
- **AC-003** [REQ-003] Given the Angular 22 embedded consumer built from the same tarball, the AC-001 journeys pass and the root's `ng-version` starts with `22.`; the Angular 21 cells report `21.`.
- **AC-004** [REQ-004] Given a build whose client chunk contains Angular's `JIT compiler unavailable` path and no compiler, `doq doctor --build` reports `build.aot` FAIL and exits 1; given a clean build it reports PASS; given a bundle that includes the compiler on purpose it reports WARN; and the same fixture of the broken build makes the E2E journeys fail with the browser's JIT error.
- **AC-005** [REQ-004, REQ-005] Given `scripts/consumer.ts` and the adoption scripts, when a build they produced fails `build.aot`, they stop with a message naming the cause instead of continuing to a later, unrelated assertion.
- **AC-006** [REQ-005] Given a reader opens an initialized consumer and follows Docs → Getting started → Introduction, then Back and Forward, the document is never reloaded after the first documentation page (a window marker survives), the URL and heading follow each step, and the Introduction heading takes focus.
- **AC-007** [REQ-005] Given search is not enabled, no request to a Pagefind resource is made and no search control is rendered.
- **AC-008** [REQ-006] Given the changelog, readiness record and this spec, the Analog race (all of 2.9.0, 2.9.1 and 2.9.2, with and without Doqs) and the documentation-page re-render are recorded with their classification; the supported peer range is unchanged.
- **AC-009** [REQ-007] Given `pnpm verify:public-api`, `pnpm perf:check` and `pnpm bundle:impact --check`, the public API report differs only in the version, budgets hold, and the root and config entries import no `@angular/compiler`.

## Public API impact

None. The version in the public API report changes with the release; no export, signature, option or token does. `doq doctor --json` gains one finding with a new id, `build.aot`, which only appears with `--build`.

## Compatibility

Angular 21.2 and 22, Analog `^2.9.2` (unchanged), Node and Pagefind ranges unchanged. `doq doctor` stays Node-only, dependency-free and read-only; it reads built scripts as text and never executes project code.

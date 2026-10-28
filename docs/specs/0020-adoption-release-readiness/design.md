# Design — 0020 adoption release readiness

## Existing implementation

`scripts/adoption.ts` (onboarding with a separate `/handbook` region), `scripts/adoption-routes.ts` (four Angular Movement pages replaced in place) and `scripts/adoption-volt.ts` (Volt UI pages replaced in place) clone a public repository, install the packed tarball, build and run a Playwright spec (`e2e/adoption*.spec.ts`). They duplicated their helpers and cloned the moving default branch.

## Proposed implementation

- `scripts/adoption-lib.ts` holds the shared helpers: `upstream()` (pinned ref unless `<PREFIX>_REF`/`_REPO` override), `checkout()` (fetches exactly one commit by id, verifies the resolved SHA, logs it, writes `.doq-adoption-sha` outside the host's `git status`), `assertDisposable()` (never inside this repository, never a non-empty directory the harness did not create), `runner()`/`capture()` (stdin closed so a build tool can never stall a background run), `editor()` (a patch that changes nothing fails loudly).
- Legacy onboarding (`adoption.ts`, `adoption-routes.ts`) is pinned to Angular Movement `4e71e2f75be3c82ec4f10ca80dc91d08562efa1b`, the last revision before it integrated Doqs. Volt UI is pinned to `7c76ef3b8aa6e3d6c4da578b0be22939556d53af`.
- `scripts/adoption-existing.ts` + `e2e/adoption-existing.spec.ts` are the new existing-integration proof, pinned to `ce9b03d547bc774268768e5f57c028452e70b9ad`. It refuses a checkout that does not depend on `@doqs/analog`, installs the consumer's own lockfile, swaps only the Doqs package for the tarball, runs the consumer's own build, `doq doctor --build` and `docs:check`, derives the route list from the real content tree and page files, and hands it to the browser spec.
- Volt UI: the build output is captured and every `[uncaughtException]` block is classified. The known one (`MutationObserver is not defined` from `setupOrTeardownObserver`, ng-primitives) is reported as upstream; anything else, or the same error with a Doqs frame, fails the run.
- `docs-check` resolves `docs/x.html` as well as `docs/x/index.html` (`routeOfHtmlFile`), and `preview-static` serves the same layout, because the integrated consumer sets `prerender.autoSubfolderIndex: false`.
- `ci-extended.yml` gains an `external-adoption` job (weekly, manual, or `full-ci` label); `ci.yml` is untouched so the established time budget holds.

## Tradeoffs and alternatives

A global `MutationObserver` polyfill or disabling SSR would have turned the Volt UI proof green while hiding a real upstream defect; rejected. Running adoption in every pull request job would break the 30-minute budget from spec 0018; rejected in favour of the extended workflow. Following upstream HEAD by default was rejected because it makes a failure ambiguous; HEAD stays one environment variable away.

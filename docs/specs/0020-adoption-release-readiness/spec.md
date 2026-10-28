# 0020 — adoption release readiness

## Problem

The 0.12 production acceptance gate (spec 0019) passed locally, but the three external adoption probes did not. Two of them failed because their assumptions were written when Angular Movement had no Doqs integration: the onboarding proof expected `doq doctor` to fail on an already-correct installation, and the route proof deleted `src/app/pages/docs/get-started.page.ts`, which no longer exists. The Volt UI proof stopped during upstream prerendering with `MutationObserver is not defined`, before any Doqs assertion ran. All three cloned the moving default branch of the upstream repositories, so the result changed whenever upstream changed, and an upstream change could not be told apart from a Doqs regression. The 1.0 readiness document still carries claims from before the multilingual acceptance work.

## Consumer impact

None for consumers of `@doqs/analog`: no export, configuration key, route shape, token or dependency changes. Maintainers get adoption proofs that are reproducible (pinned revisions, logged SHA), classify failures, and cover both onboarding of an unintegrated application and compatibility of an application that already uses Doqs. The release moves the package to 0.12.0.

## Scope

Pin and log upstream revisions; separate legacy onboarding acceptance from existing-integration acceptance; diagnose the Volt UI prerender failure against an unmodified upstream control; keep current-upstream probing available through explicit overrides; share the small helpers the three scripts duplicated; add an isolated, least-privileged extended workflow job; re-run the packed-package, public-API, performance and SSR-status checks; update the release documentation and changelog; prepare version 0.12.0.

## Non-goals

No new multilingual fixture or E2E duplication; no Etyma-specific integration (the host owns its locale lifecycle and the provider-neutral adapter stays the public contract); no global `MutationObserver` mock and no SSR opt-out to hide an upstream failure; no custom server to force an SSR 404; no change to any external repository; no manual publish, tag, release or deploy; no 0.13 or 1.0 work.

## Requirements

- **REQ-001** An unintegrated Angular Movement revision, pinned by full commit SHA, must be onboarded with the packed tarball and the documented `doq` workflow, and the SHA must be logged and recorded.
- **REQ-002** An Angular Movement revision that already integrates Doqs must be rebuilt against the packed tarball without scaffolding or overlay, and its documentation, host routes, navigation, search and accessibility must be proven in a browser, from routes derived from the real tree.
- **REQ-003** The Volt UI proof must build and pass against a pinned revision, and its prerender diagnostics must classify any server-side error as upstream or Doqs-originated against an unmodified-upstream control, failing on anything unclassified.
- **REQ-004** Upstream drift must be detectable and classified: revisions are overridable per project (`AM_REF`, `AM_EXISTING_REF`, `VU_REF`, `*_REPO`), an override is reported as such, and a pinned run never depends on upstream HEAD. Harness code must never write inside this repository or into a directory it did not create.
- **REQ-005** The packed 0.12 package must keep passing the existing outside-the-monorepo contracts: consumer build, Angular 21 and 22 matrix, public API inventory, determinism, portability, bundle impact and performance budgets.
- **REQ-006** Release documentation (1.0 readiness, adoption reports, README, changelog, site guides) must state current evidence only, keep historical evidence, record the Analog SSR 404 limitation precisely, and keep optional enhancements apart from blockers.
- **REQ-007** Publication must stay automated: the version is raised to 0.12.0 on the branch, no token, tag, release or deploy is created by hand, and the release decision is recorded with the evidence it rests on.

## Acceptance cases

- **AC-001** [REQ-001] Given `pnpm verify:adoption` and `pnpm verify:adoption:routes`, then the log names the pinned SHA `4e71e2f75be3c82ec4f10ca80dc91d08562efa1b`, `doq doctor` reports the expected gaps before `doq init` and none after, and the browser suites pass against that checkout.
- **AC-002** [REQ-002] Given `pnpm verify:adoption:existing` at `ce9b03d547bc774268768e5f57c028452e70b9ad`, then the installed `@doqs/analog` equals the packed version, `doq doctor --build` reports no FAIL, `docs:check` passes on the checkout's `docs/x.html` layout, and every Markdown route renders as one Doqs article with one `h1`, while `/` and every demo route stay host-owned.
- **AC-003** [REQ-003] Given the unmodified Volt UI checkout with only a prerender route list, the same `MutationObserver is not defined` line is printed, prerendering completes, and the adoption build with Doqs prints the same single occurrence; `pnpm verify:adoption:volt` passes its browser suite and fails if any other uncaught exception, or this one with a Doqs frame, appears.
- **AC-004** [REQ-004] Given an override variable, then the log marks the revision as an override; given none, the pinned SHA is fetched by id and verified; given a non-empty directory without the harness marker, the script refuses to replace it.
- **AC-005** [REQ-005] Given the final 0.12.0 tarball, then `consumer:build`, `verify:compat` for Angular 21 and 22, `verify:public-api`, `verify:determinism`, `verify:portable`, `perf:check` and `bundle:impact --check` pass without budget changes.
- **AC-006** [REQ-006] Given the readiness document, adoption reports and changelog, then no current-state statement contradicts a verified result, the SSR limitation is reproduced against the installed Analog version, and historical rows stay as history.
- **AC-007** [REQ-007] Given the branch, then `packages/doq/package.json` is 0.12.0, the tarball is `doqs-analog-0.12.0.tgz`, `release.yml` and `deploy-site.yml` are unchanged, and `verification.md` records the release decision.
- **AC-008** [REQ-002, REQ-004] Given a static output that uses `prerender.autoSubfolderIndex: false`, then `docs:check` and the preview server resolve `/docs/x` from `docs/x.html`, including routes that also have child directories.

## Public API impact

None. No export, configuration key, frontmatter key, route shape or `--host-docs-*` token changes. The inventory is recalculated and compared with `public-api.report.json`.

## Compatibility

Angular 21 and 22, Analog 2.9, Node ranges and static/SSR behavior are those declared by the package. The adoption tooling is repository-internal and not part of the tarball.

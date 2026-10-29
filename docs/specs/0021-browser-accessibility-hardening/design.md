# Design — 0021 browser accessibility hardening

<!-- Keep it proportional: a few sentences are fine for a small change. -->

## Existing implementation

`ci-extended.yml` runs Firefox/WebKit on `ubuntu-latest` and installs browsers through `.github/actions/playwright-browsers`, which deliberately avoids apt dependency installation. Playwright is pinned at 1.64.1. The same workflow has no Windows browser job. Existing `e2e` specs already cover most requested interaction and axe behavior; avoid duplicating those assertions. `docs/roadmap/1.0-readiness.md` records Windows browser and manual screen-reader gaps.

## Proposed implementation

Run the Linux browser job inside the Playwright-maintained `v1.64.1-noble` container so its engine binaries and supported native libraries match the package version without apt races. Add a focused Windows Chromium spec against the existing Showcase A/B production output and run it in extended CI on `windows-latest`, using the existing build/preview scripts and trace-on-failure settings. Audit the existing interaction tests in Chromium, Firefox and WebKit; change Doqs UI only when an assertion reproduces a defect. Update readiness, CONTRIBUTING, changelog and verification evidence. Add a concise VoiceOver/Safari and NVDA/Windows manual protocol, keeping results NOT RUN until performed.

## Tradeoffs and alternatives

The Playwright Linux container is preferred over apt installation because it provides the exact supported native runtime without the previously observed apt locks or dependency drift. A dedicated focused Windows spec prevents the entire Chromium suite and tarball matrix from extending every PR. Automated axe and browser tests do not substitute for VoiceOver or NVDA.

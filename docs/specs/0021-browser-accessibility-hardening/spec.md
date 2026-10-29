# 0021 — browser accessibility hardening

## Problem

The 0.12.0 production package already has broad Chromium, Firefox and WebKit journeys, keyboard checks and serious/critical axe checks. However, the Linux extended job installs browser binaries without guaranteeing WebKit's native runtime libraries, and Windows CI only verifies Node tooling. The 1.0 readiness record identifies Windows browser and screen-reader evidence as open blockers. This milestone closes the automated platform gap and provides an explicit manual screen-reader protocol without claiming assistive-technology results that have not been run.

## Consumer impact

No public API change is planned. Consumers gain verified Windows Chromium support and any small UI corrections found by the added browser journeys.

## Scope

Pin Linux extended browser execution to the Playwright-maintained image matching the lockfile version; add a bounded Windows Chromium run against production builds; exercise keyboard, focus, dialog, search and localized/RTL flows; fix only reproduced Doqs defects; document platform evidence and the manual VoiceOver/NVDA protocol.

## Non-goals

No 1.0 declaration, new overlay system, new browser support claim beyond tested platforms, mandatory assistive technology framework, public API change, package release, manual publish/deploy/tag, or unrelated redesign. Expanded-playground overlay limitations remain out of scope unless a new test demonstrates a supported behavior regression.

## Requirements

- **REQ-001** Linux Firefox and WebKit jobs use matching Playwright browser binaries and native libraries, launch the browsers, and execute real journeys within a fixed job timeout.
- **REQ-002** Extended CI runs a representative Chromium browser suite on `windows-latest` against production builds, with bounded duration and failure traces.
- **REQ-003** Real-browser keyboard/focus journeys cover docs navigation, search, mobile navigation, interactive playgrounds, dialogs and localized documentation in the engines/platforms declared by the workflow.
- **REQ-004** Every accessibility defect fixed by this milestone has an observable regression test that fails before the fix and passes after it; serious and critical axe violations remain asserted in relevant states.
- **REQ-005** Extended browser workflows remain separate from fast CI, least-privileged, reproducible, cached where useful, and inside existing time budgets.
- **REQ-006** Readiness and contributor documentation distinguish tested Chromium, Firefox, WebKit and Windows coverage from unrun manual VoiceOver/NVDA checks.

## Acceptance cases

<!-- Format: - **AC-001** [REQ-001] observable behavior that proves the requirement. -->

- **AC-001** [REQ-001] Given the extended Linux job, when Firefox/WebKit tests run in the image matching `@playwright/test`, both engines launch and selected production browser journeys pass; the workflow fails if launch or tests fail.
- **AC-002** [REQ-002] Given `windows-latest`, when the focused browser job builds and serves the showcase production assets, Chromium executes docs navigation, search, drawer, playground/dialog and locale journeys on Windows itself and retains traces on failure.
- **AC-003** [REQ-003, REQ-004] Given the affected browser journey, the regression assertion fails against the original defect and passes after the smallest fix; relevant axe scans have no serious or critical violations.
- **AC-004** [REQ-005] Given the extended workflows, browser versions match the lockfile, job timeouts remain bounded, permissions remain read-only, and no browser is treated as passed without executed tests.
- **AC-005** [REQ-006] Given the readiness guide and browser instructions, platform-specific automation and manual assistive-technology evidence are stated accurately; VoiceOver/NVDA remains NOT RUN unless actually executed.

## Public API impact

None. Exports, configuration, route and CSS token contracts remain unchanged.

## Compatibility

Angular 21/22 and existing Analog/Node ranges remain unchanged. Browser journeys use the existing prerendered production output and verify hydration; host ownership, SSR/SSG, Pagefind and RTL contracts remain intact.

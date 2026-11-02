# Verification — 0024 playground overlay interoperability

## Test cases

| Case       | Acceptance             | Checks                                                                                                 | Result  |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------ | ------- |
| UNIT-177   | AC-005, AC-007         | `expandedPreview` accepts modal/overlay-compatible, rejects other values                               | PASS    |
| COMP-145   | AC-001, AC-003, AC-004 | default opens via `showModal()`; opt-in via `show()`; same instance and state; focus returns to Expand | PASS    |
| COMP-146   | AC-005                 | route change while expanded removes the stage                                                          | PASS    |
| E2E-167    | AC-001, AC-002         | default modal: real Volt select list attached but not hit-testable (control)                           | PASS    |
| E2E-168    | AC-002, AC-003         | opt-in: real Volt select list hit-testable, pointer selection, `Changed` event, state survives restore | PASS    |
| E2E-169    | AC-004                 | opt-in: keyboard-only select; Escape closes the list not the preview; Close restores focus             | PASS    |
| E2E-170    | AC-006                 | opt-in: real Volt popover, Escape closes it only, trigger works after restore                          | PASS    |
| E2E-171    | AC-006                 | opt-in: real Volt dialog above the panel, own controls close it, focus restored                        | PASS    |
| E2E-172    | AC-001                 | default button playground still expands as a native modal                                              | PASS    |
| E2E-173    | AC-002, AC-004         | Firefox/WebKit: opt-in select hit-testable by pointer, focus restored                                  | PASS    |
| E2E-174    | AC-001                 | Firefox/WebKit: default modal control not hit-testable                                                 | PASS    |
| MANUAL-002 | AC-008                 | guide, README, changelog, readiness and findings describe both modes and limits                        | PASS    |
| MANUAL-001 | AC-004                 | VoiceOver / NVDA on the overlay-compatible panel                                                       | NOT RUN |

## Executed commands

- `pnpm test:unit`: 568 passed; `pnpm test:components`: 198 + 27 passed (before the z-index default change, re-run in CI).
- `pnpm verify:adoption:volt` (pinned Volt UI 7c76ef3b8aa6e3d6c4da578b0be22939556d53af, system Chrome): the build succeeded; local Chrome intermittently failed to launch ("browser has been closed") on every second test, so each test was run in its own invocation: 23/23 PASS afterwards.
- `playwright test e2e/adoption-volt-browsers.spec.ts --project=firefox`: 6 passed.
- `pnpm format:check`, `pnpm public-api:update`: ran.

## Remaining limitations

- E2E-168..172 ran in Chromium and E2E-173/174 in Firefox only; WebKit and Windows Chromium were not run locally; they depend on CI.
- Not verified: other overlay libraries, manual screen readers (NOT RUN), axe in the expanded overlay-compatible state beyond the existing suite.
- The overlay-compatible panel is not modal: no focus trap, inert background or Doqs Escape handling. Overlays appear above it only if their container stacks at or above `--doq-playground-expanded-z-index` (default 50) or is appended later.
- A host sticky header with a z-index above 50 can cover the top of the panel; raise the token.

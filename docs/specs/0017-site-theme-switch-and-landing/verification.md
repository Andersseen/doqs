# Verification — 0017 site theme switch and landing

Run in the cloud sandbox (Linux, Node 22.22.0, pnpm 10.18.3). Playwright 1.64.1 expects Chromium 1248; the sandbox has Chromium 1243, so the E2E runs used a throwaway local config that only sets `launchOptions.executablePath` for the `chromium` project (not committed). Firefox, WebKit, the tarball consumers and the adoption checks were not run here (see "Remaining limitations").

## Test cases

| Case         | Acceptance     | Checks                                                                                                                                                    | Result |
| ------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| E2E-035      | AC-001         | One opaque icon per theme, `.dark` and `aria-pressed` flip on click, choice survives a reload, Enter switches back (fails on the old markup)              | PASS   |
| COMP-062     | AC-001         | The switch is a named pressed-state button that applies Volt's dark class and remembers the choice                                                        | PASS   |
| CONTRACT-035 | AC-002         | No client chunk carries raw `selector: 'app-…'` metadata (the uncompiled `index.page` chunks seen before the fix contain exactly that)                    | PASS   |
| E2E-030      | AC-002, AC-003 | Prerendered hero and preview, calls to action, copy, code tabs, and no hydration, console or network problems                                             | PASS   |
| COMP-020     | AC-003         | One `h1`, calls to action, differentiators as articles, capabilities as a list, preview, code tabs, Volt and Lumen markup                                 | PASS   |
| E2E-033      | AC-003, AC-004 | Theme on every route, no horizontal overflow at 320–1920 px on `/` and `/examples`, axe in light and dark, every internal link resolves                   | PASS   |
| E2E-100      | AC-004         | Official documentation: axe after switching to dark, now waiting for `.dark` (4 repeated runs of the theme and axe tests: 22/22 each)                     | PASS   |
| MANUAL-001   | AC-002         | Repeated `pnpm build` in `apps/site`: before the fix 3 of 8 builds shipped an uncompiled landing chunk; after it 5 of 5 builds were fully AOT-compiled    | PASS   |
| MANUAL-002   | AC-003         | Screenshots reviewed at 1440 px light and dark and 390 px mobile; the toggle exercised by click, Enter, reload and on `/docs/getting-started`, no console | PASS   |

## Executed commands

```sh
pnpm install --frozen-lockfile                       # ok
pnpm build:doq && pnpm build                         # exit 0 (4 turbo tasks)
(cd apps/site && pnpm build) x5                      # index.page chunk: 4 compiled components every time, 0 chunks with raw selectors
pnpm format:check                                    # all files use Prettier code style
pnpm typecheck:scripts                               # exit 0
pnpm agentyx:check && pnpm api:check && pnpm content:check   # exit 0
pnpm test:unit                                       # 27 files, 551 passed
pnpm --filter site test:components                   # 2 files, 27 passed
pnpm test:contract -k contract_03                    # 6 passed (CONTRACT-030..035)
E2E_SKIP_CONSUMER=1 playwright test e2e/site.spec.ts e2e/official-docs.spec.ts   # 50 passed (3 consecutive full runs, plus a final run after the last change)
pnpm docs:check                                      # site 45 pages, 42 documentation pages, ok
pnpm perf:check                                      # every metric ok after the documented site CSS budget update
```

Perf, measured on the same machine: with only the build fix, site `initialJsGzip` 155,438 B and `initialCssGzip` 17,584 B; with this change 157,886 B (within the existing 160,700 B limit) and 19,004 B (budget updated in `perf-budgets.json` with the reason). A first version imported an Angular Movement directive in the eagerly loaded header and measured 174,819 B; the switch's press feedback is CSS for that reason.

## Remaining limitations

- Full `pnpm quality:gate` NOT RUN: the tarball consumers, Firefox/WebKit matrix, CDP harness and adoption checks need tooling the sandbox does not have; CI runs them.
- The same build race can affect `apps/showcase-a` and `apps/showcase-b`; they are not changed here.
- The circular reveal needs the View Transitions API (Chromium, Safari 18+); elsewhere the theme switches instantly.

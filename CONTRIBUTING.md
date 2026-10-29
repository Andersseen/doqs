# Contributing

Thanks for helping. Doq (`@doqs/analog`) adds Markdown documentation to an existing Angular/Analog.js application and is meant to be a small, dependable library. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Questions go through [SUPPORT.md](SUPPORT.md); vulnerabilities through [SECURITY.md](SECURITY.md). Coding agents follow [AGENTS.md](AGENTS.md), which points back here.

## Setup

Supported environment: Node 22.22.3 or newer (`.nvmrc` pins CI's version), pnpm 10 (`corepack enable` picks the version from `package.json`), and Python 3.11+ only for the contract tests.

```sh
pnpm install
pnpm build
```

## Layout

- `packages/doq` — the `@doqs/analog` library. Tests live in `packages/doq/test/`.
- `apps/site` — the official website: the Analog landing at `/` and the official documentation at `/docs`, a real Doqs consumer whose Markdown lives in `apps/site/src/content/docs` (static, deployed to Cloudflare Pages). Release and deployment: [docs/operations/release-and-deployment.md](docs/operations/release-and-deployment.md).
- `apps/showcase-a`, `apps/showcase-b` — two independent host applications that consume the library through the workspace.
- `e2e/` — Playwright browser tests. `tests/contract/` — pytest checks of the packed tarball and generated HTTP output.
- `scripts/` — TypeScript tooling run directly by Node (preview server, verification harness, SDD commands, gates). Keep to erasable syntax (no `enum`, parameter properties or `namespace`); `scripts/tsconfig.json` enforces it.
- `docs/specs/` — specifications (see below). `docs/verification/` — historical validation reports.
- `.agentyx/`, `.agentyx.json`, `.agents/`, `.claude/`, `.codex/`, `.kimi-code/`, `.mcp.json` — Agentyx configuration and generated agent files. Do not edit generated files by hand.

## Running things

```sh
pnpm dev:a            # Showcase A (Vanta UI) dev server
pnpm dev:b            # Showcase B (ForgeCMS) dev server
pnpm dev:site         # official website dev server
pnpm build            # library + both showcases (production); each showcase also generates its Pagefind index after prerendering
pnpm pack:doq         # artifacts/doqs-analog-<version>.tgz — never publishes
```

`pnpm --filter showcase-a preview` / `showcase-b preview` serve a production build (`dist/analog/public`).

### Versioned documentation fixtures (0.6)

Both showcases enable `versioning` through their `src/doq.paths.ts`: Showcase A keeps an archive in `src/content/docs-v1` (served at `/docs/v/1`, with its own older API fixture `vanta-ui-v1`), Showcase B in `src/content/docs-v1` (served at `/v/1`, fixture `forge-sdk-v1`). Their API pages are generated per version: `pnpm api` runs `api:latest` and `api:v1`, and `pnpm api:check` checks both. After editing an archive fixture, regenerate it, never edit generated files. `scripts/consumer.ts --unversioned` builds the same showcase from the tarball with a 0.5-style configuration (no `versioning`, no archives); `pnpm consumer:build` builds all four consumers and the quality gate requires them.

## Tests: what each layer is for

| Command                  | Layer                                    | Proves                                                                                                                                                            |
| ------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:unit`         | Vitest (node)                            | Path/slug/ordering/config logic, the SDD checker, repository invariants                                                                                           |
| `pnpm test:components`   | Vitest + Angular Testing Library (jsdom) | Rendered behavior of the index, docs page, nav tree, shell, slots, drawer — found by role, label and text                                                         |
| `pnpm test:contract`     | pytest (stdlib only)                     | The packed tarball and the generated static site, checked from outside over HTTP                                                                                  |
| `pnpm test:e2e`          | Playwright (Chromium)                    | Real-browser journeys on production builds, including a tarball-installed consumer                                                                                |
| `pnpm verify:mvp`        | CDP harness (existing)                   | The 24 MVP + 0.1 acceptance criteria; see [scripts/verification/README.md](scripts/verification/README.md)                                                        |
| `pnpm verify:package`    | Package verifier (existing)              | Manifest, exports, declarations, the `doq` CLI run from the unpacked tarball and an installed consumer                                                            |
| `pnpm verify:public-api` | Public API report (0.8)                  | The packed declarations against `packages/doq/public-api.report.json` and the 0.7 baseline; `pnpm public-api:update` records an intended change                   |
| `pnpm verify:init`       | Initialized consumers (0.8)              | Bare Analog apps (Angular 21 embedded and docs-first, Angular 22) adopt the packed tarball through `doq doctor` / `doq init`, then build                          |
| `pnpm verify:adoption`   | Angular Movement proof (opt-in, network) | Clones the real Angular Movement site into a temp dir, adds a `/handbook` region from the packed tarball, runs `e2e/adoption.spec.ts`; not part of `quality:gate` |

Component tests mock exactly one boundary: Analog's build-time content glob. Everything else (renderer, router, markdown component) is real. Do not snapshot large HTML or test private methods; assert what a user or consumer can observe.

**Playwright browsers.** Install Chromium inside `node_modules` (nothing is written under `$HOME`) and run:

```sh
PLAYWRIGHT_BROWSERS_PATH=0 pnpm exec playwright install chromium
pnpm build && pnpm pack:doq
pnpm test:e2e                       # builds/reuses the tarball consumer; add --skip-consumer for a faster loop
pnpm test:e2e e2e/toc.spec.ts       # extra arguments go to Playwright (--headed, --grep …)
PW_CHANNEL=chrome pnpm test:e2e     # use installed Google Chrome instead
```

On some macOS setups the downloaded headless shell never produces animation frames and click actions time out; `PW_CHANNEL=chrome` avoids that. Failures keep traces and screenshots in `test-results/` (`pnpm exec playwright show-trace <trace.zip>`).

**Cross-browser (0.7).** `pnpm test:e2e` is the complete suite in Chromium. `pnpm test:e2e:browsers` runs the engine-dependent journeys (routing, history, fragments, TOC, search, versions, tabs, copy, drawer, themes, overflow, axe, hardening) in Firefox and WebKit on the same production assets:

```sh
PLAYWRIGHT_BROWSERS_PATH=0 pnpm exec playwright install firefox webkit   # add --with-deps on Linux CI
pnpm test:e2e:browsers                                                    # or: pnpm test:e2e e2e/toc.spec.ts --project=webkit
```

In CI the matrix is not part of every pull request (it alone took longer than the rest of the pipeline): `ci-extended.yml` runs it every Monday on `main`, on demand (Actions → CI extended → Run workflow) and on pull requests labelled `full-ci`. Linux uses the Playwright-maintained image matching the pinned `@playwright/test` version so WebKit's native libraries do not depend on a runner's apt state. Add the label when a change touches engine-sensitive behavior.

The same extended workflow runs a focused Chromium browser suite on `windows-latest` against production builds. It does not claim Firefox or WebKit support on Windows. See the [manual screen-reader protocol](docs/operations/browser-and-screen-reader-verification.md) for VoiceOver/Safari and NVDA verification; axe and Playwright results are not substitutes for those sessions.

Adapt a test to an engine only for a real platform limit and say why in the test: Firefox and WebKit cannot grant `clipboard-read` (`expectClipboard` in `e2e/fixtures.ts` annotates the gap), Safari's default Tab skips links (`nextFocusKey`), engines word a legitimate 404 differently (`EXPECTED_404_NOISE`). Never delete a product assertion to turn an engine green.

**Static integrity, determinism, compatibility and budgets (0.7).**

| Command                               | Proves                                                                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm docs:check`                     | Prerendered output: heading ids equal a sequential render, unique ids, TOC fragments, same-site links and fragments, canonicals, a route for every Markdown file |
| `pnpm verify:determinism [--control]` | Repeated clean builds of a stress consumer agree on every heading id; `--control` removes `doqDeterministicMarkdown()` and must be detected                      |
| `pnpm verify:compat --angular=21\|22` | The packed tarball on Angular 21.2 / Angular 22.2 + TypeScript 6 (strict peers, no Zone.js): build, `doq-api`, search, `docs:check`, `e2e/compat.spec.ts`        |
| `pnpm perf:check`                     | Size budgets in `perf-budgets.json` (first-loaded JS, total JS, CSS, search index, pages). Raise one only in a PR that explains why                              |
| `pnpm perf:scale [--check]`           | Generated 20/200/1000-document fixtures: build, bytes, median navigation latency; `--check` guards the per-document JavaScript growth                            |

**Contract tests.** `pnpm test:contract` creates `.venv` and installs the pinned `tests/contract/requirements.txt` on first run. Run `pnpm build && pnpm pack:doq` first; the suite never builds anything.

## Spec-driven workflow

Every meaningful change — a new option, a behavior change, a minor release — starts from a specification:

```sh
pnpm sdd:new 0002 search-index     # creates docs/specs/0002-search-index/{spec,design,tasks,verification}.md
# fill in the TODO(sdd) markers: requirements REQ-001…, acceptance cases AC-001…, tasks, then tests
pnpm sdd:check                     # structure + traceability only; it does not prove behavior
pnpm api:check                     # generated API reference pages of both showcases match their fixtures (pnpm api regenerates)
pnpm content:check                 # pages generated from src/authoring match their sources, fragments and API index (pnpm content regenerates)
```

Requirements get stable ids; every requirement needs an acceptance case and a task; every acceptance case needs at least one verification case (`UNIT-`, `COMP-`, `E2E-`, `CONTRACT-`, `SDD-` or `MANUAL-`), and non-manual case ids must appear in a test source. `verification.md` records the commands you actually ran and their results. [docs/specs/0001-oss-sdd-testing-foundation](docs/specs/0001-oss-sdd-testing-foundation/spec.md) is the worked example. Typos and one-line fixes only need a short spec section in the PR description.

## Before opening a pull request

```sh
pnpm verify:change   # fast local gate: format, types, SDD, API reference check, Agentyx lock, unit, components, builds, package, contract
pnpm quality:gate    # mandatory before "ready": verify:change + tarball consumer + Playwright E2E + CDP harness
```

Both are deterministic scripts and never call an AI model. If a step cannot run in your environment, say so in the PR; do not mark it passed.

- **Bug fixes** need a regression test at the lowest layer that can see the bug, which fails without the fix.
- **New features** need a spec, tests for each acceptance case, and README/CHANGELOG updates for public API (`packages/doq/README.md`, `packages/doq/CHANGELOG.md`).
- **Public API** is everything exported from `packages/doq/src/public-api.ts`, the config shape, frontmatter keys, route shapes and `--host-docs-*` tokens. Breaking changes need an explicit decision and a changelog entry.
- Library and showcase sources are not yet covered by Prettier; keep the style of the surrounding code and do not reformat unrelated lines. Scripts, tests, docs and config are formatted (`pnpm format`).

## Pull requests

One focused branch from `origin/main`, one cohesive PR, using the PR template: purpose, spec reference, behavior change, tests, the verification commands you ran with real counts, API and docs impact, and remaining limitations. Commits are authored by you alone; keep history reviewable.

## Reporting failures

Open an issue with the bug report form: Doq, Angular, Analog and Node versions, a reproduction, expected vs. actual behavior, whether it happens in SSR/SSG or the browser, and relevant logs. A failing test or a minimal Markdown + config sample is the best reproduction.

## Agent tooling (Agentyx)

`@agentyx/cli` is pinned in `package.json`. `.agentyx.json` selects packs (technical, typescript, angular, testing, accessibility, documentation, agentic, git, efficiency, plus the project pack `doq-workflow`) for Codex, Claude Code and Kimi Code. Change it with `pnpm exec agentyx configure …` then `pnpm exec agentyx sync`; verify with `pnpm agentyx:check` (`agentyx doctor --locked --check`). A fresh clone restores the locked state with `pnpm install --frozen-lockfile && pnpm exec agentyx install --frozen`. MCP servers: `context7` for current Angular/Analog docs and `playwright` (`@playwright/mcp`, pinned by Agentyx) for browser inspection — neither needs credentials. Evaluated but not enabled: GitHub MCP (needs per-provider authorization), Chrome DevTools MCP (duplicates Playwright MCP), codebase-memory (needs a local executable). Configuration being present does not mean a provider has activated it; Codex project hooks need user trust, and Kimi Code has no project-local hooks.

## Release and versioning boundaries

Contributors do not publish. Version bumps, tags and npm publication are maintainer decisions and happen outside ordinary PRs; a PR changes `packages/doq/package.json` `version` only when a maintainer asked for it. Infrastructure and test changes stay within the current minor.

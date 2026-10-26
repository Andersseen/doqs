# Verification — 0018 CI time budget

Run in the cloud sandbox (Linux, Node 22.22.0, pnpm 10.18.3). Workflows cannot run here; the evidence is the static checks below plus the Actions job timings quoted in the spec. The first real runs of the changed workflows are this pull request's CI.

## Test cases

| Case       | Acceptance | Checks                                                                                                                                                     | Result |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| UNIT-177   | AC-001     | Every `ci.yml` job's timeout, plus 15 minutes when it waits for `build`, is at most 35                                                                     | PASS   |
| UNIT-178   | AC-002     | No raw `playwright install` in either workflow; the composite action caches, bounds with `timeout`, keeps `PLAYWRIGHT_BROWSERS_PATH=0`                     | PASS   |
| UNIT-179   | AC-003     | Every job with `needs: build` downloads the `builds` artifact                                                                                              | PASS   |
| UNIT-180   | AC-004     | The Firefox/WebKit matrix is only in `ci-extended.yml` (schedule, dispatch, `full-ci` label, read-only) and not a release/deploy gate                      | PASS   |
| MANUAL-001 | AC-002     | `PLAYWRIGHT_BROWSERS_PATH=0` stores browsers in `node_modules/.pnpm/playwright-core@1.64.1/node_modules/playwright-core/.local-browsers` (the cached path) | PASS   |

## Executed commands

```sh
pnpm install --frozen-lockfile                                                  # ok
pnpm exec vitest run -c vitest.unit.config.ts scripts/release/workflows.spec.ts # 15 passed
# same file against the previous .github (ci.yml from main, no action, no ci-extended.yml): 4 failed (UNIT-177..180), 11 passed
pnpm build:doq && pnpm test:unit                                                # 27 files, 555 passed
pnpm format:check                                                               # all files use Prettier code style
pnpm typecheck:scripts                                                          # exit 0
pnpm agentyx:check                                                              # exit 0
python3 yaml.safe_load on ci.yml, ci-extended.yml, action.yml                   # parse ok
```

## Remaining limitations

- The changed workflows themselves are NOT RUN here (no Actions runner); `actionlint` is not installed in the sandbox. The cache hit path is first exercised on the second CI run after merge.
- Branch protection: if "Playwright cross-browser (Firefox, WebKit)" is a required status check, the owner must remove it, or pull requests wait for a check that no longer reports.
- Firefox/WebKit regressions are now found by the weekly run or a `full-ci` label, not on every pull request.

# Design — 0018 CI time budget

## Existing implementation

`.github/workflows/ci.yml` ran ten jobs; `contract`, `e2e`, `acceptance`, `e2e-browsers`, `determinism`, `compat` and `scale` all had `needs: build`, but only `contract`, `e2e` and `e2e-browsers` download its `builds` artifact. Each Playwright job ran `PLAYWRIGHT_BROWSERS_PATH=0 pnpm exec playwright install --with-deps <browsers>` with only the job timeout (30–45 minutes) as a bound.

## Proposed implementation

- `.github/actions/playwright-browsers/action.yml`: reads the pinned `@playwright/test` version, caches `node_modules/.pnpm/playwright-core@<version>/node_modules/playwright-core/.local-browsers` (where `PLAYWRIGHT_BROWSERS_PATH=0` puts them) keyed by OS, version and browsers, removes `/var/lib/man-db/auto-update`, then runs the install under `timeout 420` up to three times. `--with-deps` still installs the system packages on a cache hit.
- `ci.yml`: the four self-building jobs lose `needs: build`, so the critical path becomes max(`build` + `e2e`, `acceptance`) ≈ 8 minutes instead of `build` + the slowest job; timeouts drop to 10–20 minutes.
- `ci-extended.yml`: one job that builds, packs and runs `pnpm test:e2e:browsers`, with the same read-only permissions as CI.
- UNIT-177..180 in `scripts/release/workflows.spec.ts` keeps these invariants.

## Tradeoffs and alternatives

- **Official Playwright container image**: no apt step at all, but its tag must be bumped in lockstep with `@playwright/test` and image pulls cost about a minute; the cache plus bounded retries covers the observed failures with less coupling.
- **Moving determinism, scale or compat to the weekly run**: they take 1.5–4 minutes in parallel and do not lengthen the run; determinism already caught a real regression (0017), so they stay on every PR.
- **Running the cross-browser matrix on every push to `main`**: would keep its stall risk on the release path; the weekly run plus the `full-ci` label for engine-sensitive pull requests is the requested trade.

# Verification — 0016 official site v1 readiness

Run in the cloud sandbox (Linux, Node 22.22.0, pnpm 10.18.3, Chromium 1243 linked as the Playwright 1248 build). Firefox, WebKit, Lighthouse and the adoption checks (which clone Angular Movement and Volt UI) were not available there; CI runs them (see "Not verified here").

## Test cases

| Case       | Acceptance             | Checks                                                                                                                                                          | Result |
| ---------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| COMP-020   | AC-003                 | Landing: one `h1`, Get started → `/docs/getting-started`, Explore examples → `/examples`, differentiators, no i18n/MDX claims, preview links and component      | PASS   |
| COMP-021   | AC-001, AC-002         | `Main` navigation order and hrefs (no `#`), `aria-current` per route, logo, mobile menu mirrors routes and closes after navigating, footer links                | PASS   |
| COMP-070   | AC-004                 | Examples: one `h1`, six sections each with a guide link, lab controls change the component and the usage code, install demo                                     | PASS   |
| COMP-100   | AC-002                 | The official site keeps the host header and footer around the routed documentation, Docs is current                                                             | PASS   |
| E2E-030    | AC-003, AC-007         | Prerendered hero and preview, CTAs, copy, code tabs, no hydration or console problems                                                                           | PASS   |
| E2E-031    | AC-001, AC-002, AC-010 | Real routes with Docs last, active link through navigation, Back/Forward and reload, drawer by keyboard, footer                                                 | PASS   |
| E2E-032    | AC-004, AC-005, AC-007 | Lab drives component and code, Movement demo stays operable, reduced motion, per-page metadata                                                                  | PASS   |
| E2E-033    | AC-006                 | Theme on every route and across navigation, no overflow 320–1920 px on `/` and `/examples`, axe in light and dark, every internal link 200                      | PASS   |
| E2E-034    | AC-009                 | Rails below the site header, last TOC link reveals its heading below the header and becomes active (fails without the pin fix)                                  | PASS   |
| MANUAL-001 | AC-005                 | Sitemap with `DOQ_SITE_ORIGIN`: the Playwright check is annotated "no sitemap by design" without an origin; the sitemap builder is unit-tested with `/examples` | PASS   |
| MANUAL-002 | AC-008                 | `pnpm perf:check`: entry JavaScript +661 B gzip against the pre-change measurement (see below)                                                                  | PASS   |
| MANUAL-003 | AC-006, AC-007         | Screenshots reviewed in `docs/verification/0016-site-screenshots/` (desktop and mobile, light and dark, drawer, docs)                                           | PASS   |

## Executed commands

```sh
pnpm install --frozen-lockfile                 # ok
pnpm format:check                              # all files use Prettier code style
pnpm typecheck:scripts                         # exit 0
pnpm agentyx:check                             # exit 0
pnpm api:check && pnpm content:check           # up to date
pnpm test:unit                                 # 27 files, 551 passed
pnpm test:components                           # library 18 files / 187 passed; site 2 files / 27 passed
pnpm build                                     # exit 0 (4 turbo tasks)
pnpm docs:check                                # showcase-b 28 pages ok; site 45 pages, 42 documentation pages, ok
pnpm perf:check                                # every metric ok
pnpm pack:doq && pnpm verify:package artifacts/doqs-analog-0.11.0.tgz   # 26 PASS / 0 FAIL
pnpm verify:public-api                         # exit 0
pnpm test:contract                             # 127 passed (after updating three landing assertions)
pnpm verify:negative-controls                  # all mutations detected (one stale mutation target repaired)
pnpm consumer:build && pnpm verify:init        # exit 0
pnpm verify:determinism && pnpm verify:portable   # exit 0
pnpm verify:compat --angular=21 / --angular=22 # exit 0 / exit 0
pnpm test:e2e                                  # Chromium: 246 passed
CHROME_BIN=… MVP_CONSUMER_ROOT=/tmp/doq-e2e-consumer/dist/analog/public pnpm verify:mvp   # 17 PASS / 0 FAIL (M16 Showcase A and B PASS)
```

### Performance (same machine, before → after)

| Metric                              | Before (origin/main 4fddc5f … f165c8d) | After          |
| ----------------------------------- | -------------------------------------- | -------------- |
| Site initial JS gzip (entry chunks) | 154,768                                | 155,431        |
| Site all JS gzip                    | 336,279                                | 344,499        |
| Site initial CSS gzip               | 16,772                                 | 17,380         |
| Site static pages                   | 44                                     | 45             |
| Docs CLS (desktop, 4 runs)          | 0.2156                                 | 0.0844         |
| Landing CLS / LCP (desktop)         | not measured                           | 0.001 / 208 ms |
| Examples CLS / LCP (desktop)        | n/a                                    | 0 / 128 ms     |

CLS and LCP come from a `PerformanceObserver` in headless Chromium against the static preview, without throttling. They are not a Lighthouse score.

Budget changes (`perf-budgets.json`): `site.staticPages` 44 → 45 (the `/examples` page) and `site.initialCssGzip` baseline 17,372 / max 18,240 (the redesign adds utility classes and about 1 KB raw of site CSS). The first lab used Volt's slider and switch, which moved about 6 KB gzip into the entry chunk; they were replaced by toggle groups instead of raising `initialJsGzip`.

## Defects found and fixed while verifying

1. **TOC pin released during smooth scroll** (library). `/docs/guides/rich-markdown`, click "Rules": the active link stayed "Titled code" because the scroll-spy saw the followed heading off screen mid-scroll. Reproduced in Chromium, fixed in `DoqDocsComponent` (pin held until `scrollend`, 1.5 s fallback), covered by E2E-034; the existing `e2e/toc.spec.ts` still passes.
2. **Drawer under the sticky header.** Volt's overlay has no `z-index`; the close button and the title were hidden under the header. Fixed with `[voltdraweroverlay] { z-index: 60 }`, covered by the drawer journey in E2E-031.
3. **Code tabs overflowed at 390 px**: the wrapped tab list spilled over the code block (also present before). Fixed with `h-auto`.
4. **Scrollable regions without a tab stop** (axe `scrollable-region-focusable`) on the install command; fixed with `tabindex="0"`.
5. **Layout shift of the footer while the lazy documentation chunk loads** (0.2156 before, 0.2778 with the first redesign): `#content` now reserves `min-height: 85vh`.
6. **`moveInView` cards stayed invisible until scrolled to** (before and after screenshots): the capability list uses `moveInViewOnce`.
7. `verify:negative-controls` mutated a template line that no longer existed on main (`copy.label` → `navLabel()`); the harness was repaired and detects the mutation.

## Remaining limitations

- Firefox and WebKit (`pnpm test:e2e:browsers`), `pnpm verify:adoption`, `verify:adoption:routes` and `verify:adoption:volt`, and Lighthouse were not run here; they depend on browsers or external checkouts the sandbox does not have. CI runs the browsers and adoption jobs.
- One production build of the site printed `ERROR RuntimeError: NG0950` once and another produced a bundle that threw "JIT compiler unavailable" on load; neither reproduced in 8 further clean or incremental builds, and the E2E `problems` fixture would fail any such bundle. The cause is not identified.
- `DOQ_SITE_ORIGIN` was not set in the local builds, so canonical, `og:url`, `og:image` and the sitemap file were verified by unit test and by reading `SeoLinks`, not in rendered output.
- The social image is a static PNG generated from `public/og.svg`; it is not regenerated by the build.
- Visual review was done by one reviewer on screenshots at 1440 and 390 px; the intermediate widths are covered only by the overflow assertions.
- The 0.12 work (spec 0015) is unchanged and still unreleased; this spec does not complete it.

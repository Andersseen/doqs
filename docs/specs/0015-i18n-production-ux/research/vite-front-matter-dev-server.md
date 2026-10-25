# Vite dev-server failure: `front-matter` does not provide an export named `default`

Research for the consumer report from `angular-movement` (`@doqs/analog@0.11.0`).
Environment: Angular 22.2.3, Analog 2.9.1, Vite 8.3.5, TypeScript 6.0.3, pnpm 10.30, zoneless, Cloudflare Pages.
Symptom: Markdown documentation route fails **only under the Vite dev server**; `vite build` is correct.

All claims below are backed by a quoted file path, a command result, or a URL. Inference is labelled
**Inferred**. What could not be proven is in [Unknowns](#unknowns).

---

## Root cause

### The mechanism, in one paragraph

`front-matter` is CommonJS-only, but its TypeScript types advertise a default export, so Analog's published
bundle contains `import fm from "front-matter"`. Analog's own Vite plugin **excludes** `@analogjs/content`
from dep pre-bundling while **including** a bare `'front-matter'` entry. That bare entry is resolved from the
**project root**. Under pnpm's strict layout an app that does not declare `front-matter` has no
`<root>/node_modules/front-matter`, so the include entry silently fails, `front-matter` is never converted to
ESM, and Vite serves the raw CJS `index.js` to the browser. The browser's native ESM loader then finds no
`default` export and throws the reported error. Production builds are unaffected because Rollup resolves from
the _importer_ and runs the CommonJS plugin.

### Evidence, link by link

**1. `front-matter@4.0.2` is CommonJS-only.** Latest version, published 2023-07-12 (unmaintained since).
`node_modules/.pnpm/front-matter@4.0.2/node_modules/front-matter/package.json`:

```json
"main": "index.js",
"dependencies": { "js-yaml": "^3.13.1" }
```

There is **no** `"type"`, **no** `"module"`, **no** `"exports"` map. `index.js` is plain CJS and also touches
Node globals:

```js
var parser = require('js-yaml')
var platform = typeof process !== 'undefined' ? process.platform : ''
...
module.exports = extractor
module.exports.test = test
```

**2. Its types nevertheless declare a default export**, which is what makes TypeScript emit a default import.
`front-matter/index.d.ts`:

```ts
declare const fm: FM;
export default fm;
```

**3. Analog imports it with a default import, from the browser entry.**
`@analogjs/content@2.9.0/fesm2022/analogjs-content.mjs`:

```js
7:  import fm from "front-matter";
302: function parseRawContentFile(rawContentFile) {
303:     const { body, attributes } = fm(rawContentFile);
792: export { ... parseRawContentFile, ... };
```

`fm()` is used **only** inside `parseRawContentFile`. `front-matter` is declared as a **peerDependency**
(`"front-matter": "^4.0.2"`), not a dependency — Analog's only real dependency is `tslib`.

**4. Doqs pulls that function into the browser graph.**
`packages/doq/src/lib/doq-docs.component.ts`:

```ts
6:   import { ContentRenderer, injectContentFilesMap, MarkdownComponent, parseRawContentFile } from '@analogjs/content';
210:         const parsed = parseRawContentFile<DocAttributes>(raw);
```

Line 210 runs inside the `document()` signal of a client component, so `front-matter` is a **client**-side
dependency of every Doqs docs page. **This confirms the hypothesis in the brief**: the runtime
`parseRawContentFile` call is the trigger.

**5. Analog's own plugin sets the exact `optimizeDeps` combination that breaks.**
`@analogjs/platform@2.9.0/src/lib/deps-plugin.js`, plugin `analogjs-deps-plugin`, `config()` hook (line 33):

```js
optimizeDeps: {
    include: [
        '@angular/common',
        '@angular/common/http',
        ...(Number(VERSION.major) > 15 ? ['@angular/core/rxjs-interop'] : []),
        'front-matter',            // <-- bare specifier: resolved from the PROJECT ROOT
    ],
    exclude: [
        '@angular/platform-server',
        '@analogjs/content',       // <-- so its `import fm from "front-matter"` is served unbundled
        '@analogjs/router',
        ...
    ],
},
```

`@analogjs/vite-plugin-angular/src/lib/utils/plugin-config.js:116` adds `include: ['rxjs/operators', 'rxjs']`.
`@analogjs/content` itself injects no `optimizeDeps` (grep: no matches).

Because `@analogjs/content` is excluded, Vite serves `analogjs-content.mjs` as source ESM and must resolve and
serve `front-matter` separately. That only works if the bare `'front-matter'` include entry resolved — which
requires the package at the app root.

### Reproduction

Reproduced with the **real** `front-matter@4.0.2`, the **real** Vite **8.3.5** (the consumer's exact version),
a hand-built pnpm store layout, and Analog's exact `include`/`exclude` pair. Scratch dir:
`/tmp/frontmatter-research`. `fake-analog-content` stands in for `@analogjs/content` and is byte-identical in
the respects that matter (`"type": "module"`, `exports` map, `import fm from "front-matter"`).

The fixture is validated to match pnpm exactly:

```
-- peer link target exists? --      EXISTS (correct)
-- front-matter at app root? --     ABSENT (matches consumer)
-- resolve front-matter FROM the importer? --  .../front-matter@4.0.2/node_modules/front-matter/index.js
-- resolve front-matter FROM the app root? --  FAILS: MODULE_NOT_FOUND
```

> Note: an earlier fixture used `../front-matter@4.0.2/...` (one level) instead of pnpm's `../../` (two
> levels), producing a dangling symlink and a misleading HTTP 500 `Failed to resolve import`. That result was
> discarded. The real layout, confirmed in this repo, is two levels:
> `node_modules/.pnpm/@analogjs+content@2.9.0_.../node_modules/front-matter -> ../../front-matter@4.0.2/node_modules/front-matter`.

**Failing case** (`/tmp/frontmatter-research/pnpm-app`, Analog-faithful config, no `front-matter` at root).

Server log:

```
Failed to resolve dependency: front-matter, present in client 'optimizeDeps.include'
  VITE v8.3.5  ready in 352 ms
```

`node_modules/.vite/deps/_metadata.json` → `optimized: []` (nothing pre-bundled).

What the browser receives for the excluded content package:

```js
import fm from '/node_modules/.pnpm/front-matter@4.0.2/node_modules/front-matter/index.js?v=200622da';
```

And what that URL serves — `HTTP/1.1 200 OK`, `Content-Type: text/javascript`, **raw CJS**:

```js
var parser = require('js-yaml')
...
module.exports = extractor
module.exports.test = test
```

`grep -c "export default"` on the served body → **0**. A default import against a module with no default
export is precisely `does not provide an export named 'default'`. Mechanism proven end to end on the server
side.

**Why the build works:** **Inferred** from Vite's documented dev/build split (see
https://vite.dev/guide/dep-pre-bundling.html — "During development, Vite serves all code as native ESM.
Therefore, Vite must convert dependencies that are shipped as CommonJS or UMD into ESM first"). `vite build`
uses Rollup, which resolves from the importer and applies CommonJS interop, so the root-resolution
requirement never arises. I did not run a production build to re-confirm this; the consumer already reports
builds are fine.

### Why Doqs never saw this

All three apps in this repo declare `front-matter` as a **direct** dependency, so it is present at each app
root and Analog's bare include entry resolves:

- `apps/site/package.json:34` — `"front-matter": "^4.0.2",`
- `apps/showcase-a/package.json:12` — `"front-matter": "^4.0.2",`
- `apps/showcase-b/package.json:12` — `"front-matter": "^4.0.2",`

Confirmed on disk: `apps/site/node_modules/front-matter -> ../../../node_modules/.pnpm/front-matter@4.0.2/node_modules/front-matter`
(same for both showcases). There is no `node_modules/front-matter` at the workspace root, and **no**
`optimizeDeps` key anywhere in the repo (grep across `*.md`, `*.ts`, `*.mts`, `*.mjs`: zero matches).

The E2E consumer inherits the same mask: `scripts/consumer.ts:168` copies the showcase manifest
(`const manifest = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'))`) and only overrides
`@doqs/analog`, `zone.js` and the Angular range — so `front-matter` comes along for free.

**But the documented install path omits it.** `packages/doq/README.md:38`:

```sh
pnpm add @doqs/analog @analogjs/content @analogjs/router prismjs
```

and `packages/doq/bin/cli/init.mjs:95`, the list `doq init` reports as missing:

```js
const missing = ['@doqs/analog', '@analogjs/content', '@analogjs/router', 'prismjs'].filter(
  (name) => !(name in declared),
);
```

`front-matter` is in neither. `bin/cli/doctor.mjs:62` reads declared deps but only gates on `@doqs/analog`.
So a real consumer who follows the README or `doq init` on pnpm gets a broken dev server. **This is the
actionable defect on the Doqs side: the repo is internally consistent but externally under-documented, and
the consistency is undocumented.**

---

## Upstream status

**Not fixed on the 2.x line.**

| Version                  | `import fm from "front-matter"`         | `front-matter` declared as                |
| ------------------------ | --------------------------------------- | ----------------------------------------- |
| 2.9.0 (this repo)        | `fesm2022/analogjs-content.mjs:7`       | peerDependency only                       |
| 2.9.1 (consumer's)       | present                                 | peerDependency `^4.0.2`; deps `{ tslib }` |
| **2.9.2 (npm `latest`)** | `fesm2022/analogjs-content.mjs:7`       | peerDependency only                       |
| 3.0.0-beta.10            | `fesm2022/parse-raw-content-file.mjs:2` | peerDependency only                       |

Verified by `npm pack` + extraction into `/tmp/frontmatter-research/c292` and `c3b10`. `npm view
@analogjs/content dist-tags` → `{ alpha: 3.0.0-alpha.99, latest: 2.9.2, beta: 3.0.0-beta.10 }`. There is no
2.10.x/2.11.x (`npm view` → E404).

**Moving toward a real fix in v3 only.** Analog PR
[#2678](https://github.com/analogjs/analog/pull/2678) `perf(content): parse frontmatter at build time instead
of in the browser`, **merged 2026-10-22**: _"Because `@analogjs/content` imports the parser statically, any
app that calls `provideContent()` ships `front-matter` → `js-yaml` → `esprima` (+ a `buffer` polyfill) in its
initial chunk"_; the fix moves the parser into _"a separate lazy chunk that is only loaded when a loader
returns a raw string"_. This removes `front-matter` from the eager browser graph in v3, which would remove
this failure mode — but it is a bundle-size change, **not** a CJS-interop fix, and it is not on 2.x.

**No upstream issue reports this exact error.** Searched `analogjs/analog` for `front-matter` (43 hits),
`"does not provide an export named"` (4 hits: [#2597](https://github.com/analogjs/analog/issues/2597),
[#2249](https://github.com/analogjs/analog/pull/2249), [#1730](https://github.com/analogjs/analog/issues/1730),
[#361](https://github.com/analogjs/analog/issues/361) — all unrelated), `optimizeDeps` (34 hits). **NOT
FOUND**: any Analog issue about a dev-server-only CJS/ESM interop failure on Markdown routes. Filing one is
reasonable.

**Analog does not document `front-matter` as a consumer install.** https://analogjs.org/docs/features/markdown/markdown-content
returned only the SPA shell on three attempts; `packages/content/README.md` (raw, 103 bytes) has no
front-matter/peer-dep text. It is declared only as a peerDependency.

**Vite semantics confirmed.** From https://vite.dev/config/dep-optimization-options: _"If an ESM dependency is
excluded from optimization, but has a nested CommonJS dependency, the CommonJS dependency should be added to
`optimizeDeps.include`. Example: `include: ['esm-dep > cjs-dep']`"_ — the `>` form is documented for exactly
this shape, and resolves the nested dep **from the parent**, which is why it works when the bare form does
not. Same page: _"CJS-only dependencies must be present in `optimizeDeps.include` during dev."_

**The pnpm pattern is a known Vite issue.** [vitejs/vite#16293](https://github.com/vitejs/vite/issues/16293)
"Problem with Dependency Optimization in pnpm" reports the identical error string, with the same two
workarounds (`'dep > nested-dep'` or hoisting). [vitejs/vite#13490](https://github.com/vitejs/vite/issues/13490):
works on `build`, not `dev`, because Vite does not auto-add a dependency's peer dep to pre-bundling.
Analog-side precedent for strict-pnpm resolution failures:
[#393](https://github.com/analogjs/analog/issues/393) (`Cannot find package 'destr'`),
[#950](https://github.com/analogjs/analog/issues/950).

**Plugin config merging is safe.** A plugin returning `{ optimizeDeps: { include: [...] } }` from `config()`
cannot clobber the user's array: https://vite.dev/guide/api-plugin.html — _"It can return a partial config
object that will be deeply merged into existing config"_ — and Vite's `mergeConfigRecursively`
(`packages/vite/src/node/utils.ts`) concatenates arrays (`merged[key] = [...arraify(existing), ...arraify(value)]`),
applied via `conf = mergeConfig(conf, res)` in `runConfigHook` (`packages/vite/src/node/config.ts`) with the
user config as the base. Empirically confirmed: in FIX-1 below both Analog's bare `'front-matter'` and the
added `'pkg > front-matter'` coexisted. **Caveat (Inferred):** a plugin that _mutates_
`config.optimizeDeps.include = [...]` in `configResolved` would overwrite; returning a partial config from
`config()` does not.

---

## Remediation options ranked

Ranked for a **library author** who cannot patch the consumer's `node_modules`.

### 1. Have the consumer app declare `front-matter` — RECOMMENDED

Add `front-matter` to the documented install command, to `doq init`'s missing-dependency list, and to
`doq doctor`. Verified as FIX-2 (`/tmp/frontmatter-research/fix2`): app-root `front-matter` present, Analog's
config **completely unmodified**:

```
  VITE v8.3.5  ready in 328 ms        <-- no "Failed to resolve dependency" warning
```

```js
// served importer
const fm = __vite__cjsImport0_frontMatter;
import __vite__cjsImport0_frontMatter from '/node_modules/.vite/deps/front-matter.js?v=622aec7f';
```

```json
"front-matter": { "src": "../../.pnpm/front-matter@4.0.2/node_modules/front-matter/index.js",
                  "file": "front-matter.js", "needsInterop": true }
```

`needsInterop: true` is the proof the CJS→ESM shim is applied.

- **Safety: highest.** No Vite config, no plugin, no public API surface. It is already the state of all three
  apps in this repo, so it cannot change any behaviour Doqs already ships.
- **Merge risk: none** — nothing is written to `optimizeDeps`.
- **Precision point:** adding `front-matter` as a _dependency of `@doqs/analog`_ does **not** work. pnpm
  links a package's own dependencies inside `.pnpm/@doqs+analog@x/node_modules/`, never at the consumer's app
  root, so Analog's root-relative bare include would still fail. **The app itself must declare it.** (pnpm's
  default `hoist-pattern` lifts to `node_modules/.pnpm/node_modules`, which is also not the app root.)
- **Cost:** one line in `README.md:38`, one array entry in `init.mjs:95`, one check in `doctor.mjs`.

### 2. Documented `optimizeDeps.include: ['@analogjs/content > front-matter']`

The consumer's own workaround. Verified as FIX-1 (`/tmp/frontmatter-research/fix1`), with `front-matter`
still **absent** from the app root:

```js
// served importer
const fm = __vite__cjsImport0_frontMatter;
import __vite__cjsImport0_frontMatter from '/node_modules/.vite/deps/fake-analog-content_n_front-matter.js?v=737b01f6';
```

```json
"fake-analog-content > front-matter": { "src": "../../.pnpm/front-matter@4.0.2/node_modules/front-matter/index.js",
                                        "file": "fake-analog-content_n_front-matter.js", "needsInterop": true }
```

- **Safety: high, but it asks the consumer to edit `vite.config.ts`** and to know Analog's internal package
  name. The bare `'front-matter'` entry Analog adds still logs `Failed to resolve dependency` — harmless
  (the `>` entry supplies the interop) but noisy and confusing.
- **Merge risk: none for the consumer's own config**; and per the Vite evidence above, a _plugin_ adding this
  would also merge safely.
- **Downside vs. option 1:** it is strictly more intrusive for the same outcome. Keep it as the documented
  fallback for consumers who cannot or will not add the dependency (e.g. strict dependency allow-lists).

### 3. A Doqs Vite plugin/config helper that injects the entry

`packages/doq/bin/vite.mjs` currently exports exactly one thing: `doqDeterministicMarkdown(options)`. It is a
Node-only helper (`// Node-only Vite helper (@doqs/analog/vite). Never imported by the browser entry.`) that
serialises Analog's `analogjs-content-file` `load` hook so concurrent Markdown renders cannot interleave and
corrupt duplicate-heading ids. It locates Analog's plugin via `configResolved(config)` and throws a clear
error if `analogjs-content-file` is absent. It touches no `optimizeDeps` today.

A sibling export (e.g. `doqDevDeps()`) returning `{ name, config: () => ({ optimizeDeps: { include: ['@analogjs/content > front-matter'] } }) }`
would work and, per the merge evidence, could not clobber a consumer's own `optimizeDeps.include`.

- **Safety: medium.** Mechanically sound, but it grows the public API (`packages/doq/src/public-api.ts` /
  `public-api.report.json`, `pnpm verify:public-api`), needs a changelog entry, and hard-codes Analog's
  package name — which is exactly the coupling `doqDeterministicMarkdown` already had to defend with an
  override option.
- **Redundant with option 1** for every consumer who can add a dependency. Prefer it only if maintainers want
  a zero-config experience; then it should follow the existing precedent and accept an override for the
  package name, and fail loudly rather than silently if resolution changes.

### 4. Avoid the runtime `front-matter` import (stop calling `parseRawContentFile` in the browser)

Feasible in principle and it is where Analog itself is heading (PR #2678), but for Doqs it is a real
redesign, not a fix: `doq-docs.component.ts:210` needs `attributes` **and** `content` per route, lazily, from
`injectContentFilesMap()` loaders that return raw strings. Removing the call means either pre-parsing
frontmatter at build time (a new Analog content pipeline or a Doqs codegen step) or reimplementing a
frontmatter parser — the latter would re-import the same CJS problem or add a dependency Doqs currently
avoids. **Cost: high. Not justified as a bug fix**; worth tracking as the 1.0 direction once Analog v3 lands.

### 5. `resolve.dedupe` / `ssr.noExternal` — not relevant

- `resolve.dedupe` forces one copy of a package when several resolve; there is no duplicate-`front-matter`
  symptom here (the failure is a missing interop, not two copies). No evidence it helps.
- `ssr.noExternal` affects the **server** bundle. Analog already sets `noExternal: ['@analogjs/**', ...]`
  (`deps-plugin.js`). The reported error is a **browser** ESM loader error on the client graph, so this knob
  does not address it.
- `shamefully-hoist=true` / `public-hoist-pattern` **would** mask it (they put `front-matter` at the app root,
  making Analog's bare include resolve) — https://pnpm.io/settings/node-modules notes `shamefullyHoist`
  exists for tooling that _"only works when the hoisted dependencies are in the root of `node_modules`"_, and
  `shamefullyHoist: true` ≡ `publicHoistPattern: ["*"]`. **I would not recommend it as primary advice:** it
  is a workspace-wide escape hatch that abandons pnpm's strictness for every dependency to fix one, and it
  cannot be shipped by a library — only requested of a consumer. Mention it only as a last resort.

---

## Recommended fix

**Option 1: make `front-matter` a declared consumer dependency, and say so everywhere Doqs already speaks.**

Concretely, three small edits (all additive, none touching `optimizeDeps`):

1. `packages/doq/README.md:38` — add `front-matter` to the install command, with one sentence explaining that
   Analog declares it as a peer dependency and that Vite's dev server needs it resolvable from the app root.
2. `packages/doq/bin/cli/init.mjs:95` — add `'front-matter'` to the `missing` list so `doq init` prints the
   right `installCommand`. Note the existing `done:` check filters out `prismjs`
   (`missing.filter(name => name !== 'prismjs')`); decide explicitly whether `front-matter` is required
   (it is, for any docs route) and keep it in the `done` condition.
3. `packages/doq/bin/cli/doctor.mjs` — add a check that reports `FAIL` (never a guessed `PASS`) when
   `front-matter` is absent from the app's declared dependencies, with the dev-server symptom in the hint.

Ship option 2's `optimizeDeps.include: ['@analogjs/content > front-matter']` in the README as a documented
**fallback** for consumers who cannot add the dependency. Do not add a new Vite plugin export unless
maintainers explicitly want zero-config; if they do, follow the `doqDeterministicMarkdown` precedent
(override option, loud failure).

Also worth doing: file the upstream Analog issue (none exists), and record the requirement in
`packages/doq/CHANGELOG.md`. Per `AGENTS.md`, any change to `bin/cli` behaviour and the README is a public
contract change and needs the changelog entry; `pnpm verify:public-api` must stay green.

---

## Regression test plan

### The gap that let this ship

`playwright.config.ts` launches **only static production builds**. Every entry in `webServer` is
`node scripts/preview-static.ts <dist/analog/public>` (ports 4273–4286), and `scripts/e2e.ts` asserts a
production build exists before running (`apps/showcase-a/dist/analog/public/index.html`) and builds tarball
consumers with `pnpm build`. **No test in this repo has ever started a Vite dev server.** That is the whole
reason a dev-only defect survived: the suite structurally cannot see it.

All three apps do have a dev script — `apps/site/package.json` `"dev": "vite"`, and both showcases
`"dev": "vite"` / `"start": "pnpm dev"` — wired at the root as `dev:a`, `dev:b`, `dev:site`. `vite` uses its
default port **5173**; no app pins a port. So the infrastructure exists locally and is simply never exercised
in CI.

### Minimum needed

A regression test must reproduce the **consumer** condition, not the workspace condition. Testing
`apps/showcase-a` would pass forever, because it declares `front-matter`. The test needs a consumer whose
app-root `node_modules` has **no** `front-matter`.

1. **Extend `scripts/consumer.ts` with a `--no-front-matter` flag.** It already builds a full consumer from
   the packed tarball into `tmpdir()`; after the manifest copy at line 168, `delete
manifest.dependencies['front-matter']`. Keep the showcase's `"dev": "vite"` script (it survives the
   `manifest.scripts` filter only if added — the filter at line ~181 keeps `api*`/`content*` plus `build`, so
   the flag must also preserve or re-add `dev`).
2. **Add a dev-server `webServer` entry** to `playwright.config.ts` on a fresh port (next free is **4287**),
   command `pnpm --dir <consumerDir> dev`, `url: http://127.0.0.1:4287`, `reuseExistingServer: false`, and a
   generous `timeout` (Analog dev boot compiles Angular; 30s as used for static servers is too tight — allow
   120s). Gate it behind an env flag (e.g. `DOQ_DEV_CONSUMER_DIR`) exactly as `withAdoption` gates the
   adoption apps, so the default suite is unaffected.
3. **The spec** (`e2e/dev-frontmatter.spec.ts`): collect `page.on('console')` and `page.on('pageerror')` from
   before navigation, `goto` a Markdown route (`/docs/<slug>` from the consumer's `doq.paths.ts`), then assert
   - **negative:** no message matches `/does not provide an export named/` (and none matches
     `/front-matter/`),
   - **positive:** the document actually rendered — `expect(page.getByRole('heading', { level: 1 })).toBeVisible()`
     and a known body string is present, so a silently blank page cannot pass.

   The positive assertion matters: with the current bug the page fails to hydrate, so a console-only test
   could pass vacuously if the route 404s.

4. **A cheap non-browser guard** (runs in `pnpm test:unit`, no Vite, no browser): a Vitest test asserting
   `front-matter` appears in the README install command, in `bin/cli/init.mjs`'s required list, and in
   `bin/cli/doctor.mjs`'s checks. This fails the moment someone drops it from the docs again, which is how it
   regressed in the first place.

### Does Analog's dev server support SSR/Markdown routes the same way?

**Partly verified, partly not.** The apps configure `analog({ ssr: true, static: true, ... })`, and Analog's
nitro plugin runs in dev, so SSR routes do work under `vite` dev — and `pnpm dev:a` / `dev:site` are supported
root scripts. But I did **not** start an Analog dev server during this research (it needs a full
Angular+Analog install), so I cannot state from evidence that a Markdown route renders identically in dev and
in the prerendered build. **Inferred:** the client-side hydration path — which is where this bug lives — is
the same, because the failing import is in the browser graph either way. Step 3's positive assertion is what
makes the test robust regardless: it asserts the rendered document, not the SSR mechanism.

**Practical note:** the bug is client-side, so the test does not need SSR to be meaningful. If Analog dev SSR
turns out to be slow or flaky in CI, the test can disable `ssr`/`static` for the dev consumer and still catch
the regression.

---

## Unknowns

1. **I never ran a real Analog dev server.** The reproduction uses the real `front-matter@4.0.2` and real
   Vite 8.3.5 with Analog's exact `optimizeDeps` include/exclude pair and a validated pnpm layout, against a
   stand-in for `@analogjs/content`. The server-side mechanism is proven (raw CJS served, `needsInterop`
   absent, zero `export default`). The final browser-side throw is **inferred** from the served bytes plus the
   consumer's report, not observed in a browser here. Confirming it needs one dev-server run of the consumer.
2. **I have not seen `angular-movement`'s `package.json` or `vite.config.ts`.** That it does not declare
   `front-matter` is **inferred** — if it did, Analog's bare include would have resolved and the bug could not
   occur. Worth asking the consumer to confirm, and to check whether anything else in their config
   (`optimizeDeps.exclude`, a custom resolver, `resolve.mainFields`) contributes.
3. **Whether the consumer's exact error is the 200-raw-CJS path or a 500.** Both are possible depending on
   whether `front-matter` is resolvable from the importer. Their message (`does not provide an export named
'default'`) matches the 200 path I reproduced; a truly missing package gives `Failed to resolve import`
   instead. Their wording is consistent with my reproduction.
4. **Analog's docs could not be retrieved** (https://analogjs.org/docs/features/markdown/markdown-content
   returned only the SPA shell three times). So I cannot say whether Analog _does_ tell users to install
   `front-matter` somewhere I failed to load. It is declared only as a peerDependency in every version I
   inspected.
5. **Whether Analog will accept an upstream fix on 2.x.** Changing `include: ['front-matter']` to
   `include: ['@analogjs/content > front-matter']` in `deps-plugin.js` would fix every consumer with no
   consumer-side change, and PR #2678 shows the v3 direction avoids the browser import entirely. No 2.x issue
   exists; I did not open one or contact maintainers.
6. **Vite version sensitivity.** Only Vite 8.3.5 was tested. `packages/doq` pins `vite: ^7.3.6` as a
   devDependency while the apps use `^8.0.0`, and the README states Vite below 8 is "Not verified". Whether
   Vite 7 resolves bare `optimizeDeps.include` entries identically is untested.

# Migration findings: what changes in Angular Movement and Volt UI

Every statement is marked **[E]** executed (a Playwright journey against a real checkout built from the packed tarball), **[S]** source inspection, or **[P]** proposed and unverified. Nothing was pushed to either repository: the proofs clone `Andersseen/angular-movement` (`4e71e2f`) and `Andersseen/volt-ui` (`7c76ef3`) into temporary directories (`pnpm verify:adoption:routes`, `pnpm verify:adoption:volt`; `pnpm verify:adoption` is the earlier `/handbook` proof with versioning).

## Method for the size figures

Line counts are `wc -l` over the files named, taken from the clones. They measure how much hand-written documentation infrastructure a file set contains, not effort or bundle size, and they are not a promise about a full migration: only the pages listed were converted.

## Angular Movement

**Mapping.** Doqs is mounted at `/docs` with `unmatched: 'continue'` and `landmark: 'host'`. `/docs/get-started`, `/docs/api-selection`, `/docs/accessibility` and `/docs/reference` (generated) are served by Doqs at their existing URLs **[E]**. `/demos/*`, `/`, `/templates` and the remaining `/docs/*` pages (`introduction`, `api`, `patterns`, `presets`, `mcp`, `migration`, `choose-a-tool`) are untouched **[E]** (`/docs/introduction` and `/demos/enter`). No redirect is needed.

**What becomes unnecessary once every page is Markdown [S]:** `pages/docs.page.ts` (153 lines: sidebar, quick-find, mobile toggle, layout), `shared/docs-nav.ts` (99), `docs-footer-nav` (49), `heading-anchors` (108): 409 lines. `code-block` (135) stays while `/demos` uses it.

**What was converted [E]:** four pages, 694 lines of Angular templates (`get-started` 85, `api-selection` 231, `accessibility` 140, `reference` 238), replaced by 158 lines of Markdown (the API reference is generated from `projects/movement/src/public-api.ts`).

**What stays host-owned.** The animation wrapper for the playground (`HandbookMovementPlayground`, about 50 lines: `moveEnter` plays once in `ngOnInit` and has no outputs, so the wrapper re-creates the element per setting and adds a `played` output) **[E]**; `SmoothScrollService`, wired through a Doqs slot, still interpolates wheel input on a Doqs page **[E]**; the navbar, footer and `--host-docs-*` token mapping (12 lines of CSS) **[E]**.

**How API references are generated.** `doq-api generate --project projects/movement/tsconfig.lib.json --entry projects/movement/src/public-api.ts --out src/content/docs/reference --base-path /docs`; the page for `MoveEnterDirective` lists exactly the inputs declared in the source **[E]**. The usage example reads the real `provideMovement` through `::source` after one region marker is added to the (disposable) checkout **[E]**; in the real repository that marker is a one-line comment pair.

**Compatibility limitations found.**

1. _Extra-route order._ Doqs's catch-all shadowed the host's own `/docs/*` pages and answered them with a prerendered 200 "not found". Fixed by `unmatched: 'continue'` **[E]**.
2. _Nested `main`._ `app.ts` wraps the router outlet in `<main>`; the 0.10 proof (`/handbook`) nested Doqs's `main` inside it without noticing. `landmark: 'host'` fixes it **[E]**. The host's own `/demos/enter` page contains a second `main` inside the shell's: a host defect, reported here **[E]**.
3. _Two searches._ Pagefind indexes only Doqs pages (77 indexed pages: the migrated ones and the generated reference); the host's quick-find stays in the host docs layout and finds host pages. A reader needs the right one until the last page moves **[E]**.
4. _The Doqs sidebar lists only Doqs pages_ while some pages are still host pages; the host sidebar still links to the migrated ones **[E]**. Incremental migration shows two navigations until the last page moves.

## Volt UI

**Mapping.** Doqs at `/docs`, `unmatched: 'continue'`, `landmark: 'host'`, routes registered **before** `withLocalizedRoutes()` **[E]**. Served by Doqs at their existing URLs: `/docs/components/{button,dialog,popover,select}`, `/docs/customization`, `/docs/recipes/async-search` and the generated `/docs/api/*` (196 symbol pages) **[E]**. Host-owned and unchanged: `/docs/components/switch` (and every other component page), `/docs/blocks/hero`, `/docs/layouts/login`, `/create-theme` (Theme Studio), `/docs/introduction`, `/es/docs/components/switch` **[E]**.

**What becomes unnecessary once every page is Markdown [S]:** the documentation frame (`docs-page-shell` 247, `docs-breadcrumbs` 50, `docs-mobile-nav` 58, `docs-nav-list` 111, `docs-pager` 60, `docs-toc` 55, `lib/docs-nav` 64: 645 lines), the hand-built API tables (`api-reference.ts` 112 plus `api-reference.generated.ts` 1858 lines) and the code panel's copy logic. The gallery pages need their own layout and stay.

**What was converted [E]:** six pages, 668 lines of Angular templates and TypeScript (button, dialog, popover, select with their templates, customization, recipe), replaced by 152 lines of Markdown plus 174 lines of host-owned playground wrappers and configuration. Real Volt UI components run in four playgrounds; the recipe page renders the host's own `AsyncSearchRecipe` with `::demo`.

**Playgrounds.** Variant, size, label and disabled drive the real `volt-button`, `pressed` is recorded and the code panel copies exactly what it shows **[E]**. The dialog (`voltDialogRoot`) opens, traps focus, closes on Escape/Confirm and returns focus to its trigger; the popover and select report `openChange`/changes **[E]**.

**Overlays need special treatment inside the expanded preview [E].** Doqs expands a playground into a native modal `<dialog>`, which lives in the browser's top layer. Volt UI appends select dropdowns and dialogs to `<body>`, which is not in the top layer: with the select playground expanded, the dropdown opens **underneath** the preview (`elementFromPoint` is the preview, not the option). Inline previews are not affected. The measured, safe pattern: use the inline preview for overlay components (the expanded preview still works for everything that renders inside the playground). A host that wants overlays above the expanded view would need to route its overlay container into the dialog (`container="…"` on `volt-select`, Angular CDK `OverlayContainer`) — **[P]**, not tested, and not done by Doqs because moving consumer nodes between layers is unsafe and a universal fix would be an overlay framework.

**Localization: blocked [E].** See `consumer-parity.md`. Pages migrated to Doqs keep only their English URL. The locale-prefixed URL (`/es/docs/components/button`) is answered by Analog's own Markdown route for the same file: raw Markdown without the Doqs chrome and without the playground. Pages that are not migrated keep `/es` and `/uk`. Doqs's interface labels (Search, On this page, Previous, Next, version selector) are English constants; `DoqPresentation` only changes the documentation label, index heading, index description and the title suffix. Pagefind is indexed once.

**Theme [E].** Volt UI's tokens (`--background`, `--primary`, …) are mapped in 11 lines of CSS; the `dark` class on `<html>` flips the documentation. The proof found a real Doqs defect: with Volt's blue (`#3467f5`) the active navigation item, links in code and the pressed preview toggle had 3.96–4.24:1 contrast. 0.11 derives that text from a slightly darker mix; axe is clean in light and dark.

**Other findings.**

- `withLocalizedRoutes()` is itself a catch-all extra route; Doqs must be registered before it **[E]**.
- At 320 px Volt UI's own header is 7 px wider than the viewport on every page, migrated or not; the Doqs region fits **[E]**.
- Prerendering the unmodified site with the Node preset logs `MutationObserver is not defined` from a host component during the build; every page was still produced **[E]**. The Cloudflare worker path (the real deployment) was not exercised **[P]**.
- Building Volt UI needs network access: its build validates remote translation catalogs **[E]**.

## What remains before either site could migrate for good

| Gap                                                           | Owner                                        | Evidence      |
| ------------------------------------------------------------- | -------------------------------------------- | ------------- |
| Localized documentation (routes, search, interface labels)    | Doqs, a dedicated minor                      | [E]           |
| Overlay components inside the expanded preview                | documented limitation; host container option | [E]           |
| Two navigations and two searches during incremental migration | by design; resolves when the last page moves | [E]           |
| Converting the remaining pages                                | content work, no Doqs gap found              | [S]           |
| Cloudflare SSR (Volt UI)                                      | host                                         | not exercised |

## 0.12 update: pinned revisions and the integrated Angular Movement

- **[E] Reproducibility.** The statements above were recorded against Angular Movement `4e71e2f` and Volt UI `7c76ef3`. The scripts now fetch those exact commits (full SHAs in `scripts/adoption*.ts`), log the resolved SHA and refuse to replace a directory they did not create. Moving to a newer revision is an explicit `AM_REF` / `VU_REF`, not a silent default.
- **[E] Angular Movement after its own integration (`ce9b03d`).** Its maintainers adopted Doqs with a lazy `/docs` region, a registry of real playgrounds, API reference, source-backed examples and `doq-search`. Rebuilt with the packed tarball and its own lockfile, `doq doctor --build` reports no failure, `docs:check` validates all 91 documentation pages, and every Markdown route renders as one Doqs article while `/` and the demos stay host-owned (`pnpm verify:adoption:existing`). One thing only a real consumer showed: it prerenders with `autoSubfolderIndex: false` (`docs/x.html`), which the repository's own `docs:check` and preview server did not understand; they do now.
- **[E] Volt UI SSR noise.** Server rendering Volt UI's ng-primitives collapsible prints `MutationObserver is not defined` with or without Doqs; the proof records it as upstream and fails on anything else.
- **[S] Localization.** Volt UI's localized routes (Etyma) remain host-owned; Doqs does not translate its pages and has no Etyma-specific integration. A host that wants localized documentation uses the provider-neutral adapter.

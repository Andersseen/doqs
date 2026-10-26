# 0016 — official site v1 readiness

## Problem

The official website (`apps/site`) was functional but not yet the public face of a project heading to 1.0:

- The global navigation mixed application routes with homepage anchors (`/#features`, `/#getting-started`, `/#interactive-markdown`), so it was ambiguous from `/docs` and had no active-route state.
- The hero showed an abstract wireframe instead of Doqs working, there was no place to try the product (no `/examples`), and ten equally weighted feature cards hid the real differentiators.
- Only the landing had its own title and description; every page shared the same social metadata and there was no social image.
- The feature cards and "How it works" steps were rendered with `moveInView` and stayed invisible until scrolled to (confirmed on the "before" screenshots).

Two defects found while verifying the new header against the documentation shell:

- After a table-of-contents click on a site with `scroll-behavior: smooth` (this one), the followed heading was released from its pin while the page was still travelling towards it, so the TOC highlighted the previous section (`/docs/guides/rich-markdown#rules` highlighted "Titled code").
- Volt's drawer overlay has no `z-index`, so the sticky site header was painted over the mobile menu and hid its close button.

## Consumer impact

None for consumers of `@doqs/analog`, apart from one behaviour fix in the TOC (REQ-009): the followed heading now stays highlighted while a smooth scroll runs. No export, configuration key, frontmatter key, route shape or `--host-docs-*` token changes. The package version is not changed (0.12 is still unreleased; see spec 0015).

## Scope

- Route-based global navigation (Home, Examples, Docs), active-route state, a mirrored mobile drawer and a footer with the same routes.
- A redesigned landing page and a new `/examples` page, built from Volt UI, Lumen icons and Angular Movement.
- Per-page title, description, Open Graph and Twitter metadata, a social image and a sitemap that lists `/examples`.
- Regression coverage for the TOC and the drawer layering, and the perf-budget changes this page causes.

## Non-goals

- No change to the Doqs library API, the documentation content or the documentation URLs (`/docs/**`).
- No internationalization, localized pages or claims about the unreleased 0.12 work.
- No package version bump, npm publication or deployment from this branch.
- No Quartz Headless: no interaction needed a headless primitive Volt UI does not already provide.

## Requirements

- **REQ-001** The global navigation contains only application routes — Home (`/`), Examples (`/examples`), Docs (`/docs`, last) — followed by the external GitHub and npm links, on desktop and in the mobile drawer.
- **REQ-002** The current route is marked with `aria-current="page"` and a visible indicator: Home only on `/`, Examples on `/examples`, Docs on `/docs` and every documentation descendant; it is correct after navigation, history traversal and a direct load.
- **REQ-003** The landing page communicates what Doqs is in its single `h1`, leads with a Get started call to action to `/docs/getting-started` and an Explore examples action to `/examples`, and shows real Doqs behaviour: links into the real documentation and a real Angular component, without loading the documentation runtime.
- **REQ-004** `/examples` exists, is prerendered, and demonstrates real capabilities with controls that change a real component and its usage code, each linking to the matching guide; at least one example uses Angular Movement.
- **REQ-005** Each site-owned page has its own title, description and social text in the prerendered HTML; canonical, `og:url` and the social image are written only when `DOQ_SITE_ORIGIN` is set; the sitemap lists every prerendered route including `/examples`.
- **REQ-006** The pages are usable and free of horizontal overflow from 320 px to 1920 px, in light and dark, with no serious or critical axe violations and no hydration or console errors.
- **REQ-007** Motion is purposeful and never hides content: nothing below the fold stays invisible once seen, reduced motion shows everything at once.
- **REQ-008** The documentation remains a lazy `@doqs/analog` region: the landing loads none of the Doqs runtime, search, playgrounds or Markdown renderer, and the initial JavaScript stays within the recorded budget.
- **REQ-009** After a fragment is followed (TOC link, search result, deep link) the followed heading stays active while the page scrolls towards it, including with smooth scrolling; the sticky rails remain below the site header.
- **REQ-010** The mobile drawer is layered above the sticky header, opens and closes by keyboard, traps focus, closes after navigating and restores focus.

## Acceptance cases

- **AC-001** [REQ-001] The `Main` navigation lists Home, Examples, Docs, GitHub, npm in that order with hrefs `/`, `/examples`, `/docs` and the two external URLs, and no href contains `#`; the drawer mirrors it.
- **AC-002** [REQ-002] Navigating to `/`, `/examples`, `/docs` and `/docs/guides/interactive-playgrounds` leaves exactly one `Main` link with `aria-current="page"` (Home, Examples, Docs, Docs); the same holds after Back/Forward and a reload.
- **AC-003** [REQ-003] The landing has one `h1`; the primary link opens `/docs/getting-started` and the secondary `/examples`; the documentation preview links to `/docs/guides/interactive-playgrounds` and its anchors and its Rendered tab runs the real `enter-animation` component.
- **AC-004** [REQ-004] On `/examples` choosing a preset, a duration or turning the animation off changes the rendered component and the computed usage code; the install demo switches the copied command; every section has a link to its guide.
- **AC-005** [REQ-005] The prerendered `/examples` HTML has `<title>Examples — Doqs</title>` and matching description and `og:title`; with an origin the sitemap contains `/examples`; the sitemap helper and the navigation list are unit-tested.
- **AC-006** [REQ-006] At 320, 375, 768, 1280, 1440 and 1920 px neither page overflows horizontally; axe reports no serious or critical violation in light and dark; every internal link on both pages returns 200.
- **AC-007** [REQ-007] With `prefers-reduced-motion: reduce` every capability item has `opacity: 1` and smooth scrolling is off; the Movement demo stays operable while it animates.
- **AC-008** [REQ-008] `pnpm perf:check` passes with the recorded budgets; the landing's initial JavaScript grows by less than 1 KB gzip against the measured baseline.
- **AC-009** [REQ-009] On `/docs/guides/rich-markdown` at 1440×900 the sidebar and the TOC never slide under the site header, a click on the last TOC link reveals its heading below the header, and that link becomes the active one.
- **AC-010** [REQ-010] At 360×740 the drawer opens with Enter, keeps focus inside, closes with Escape returning focus to the trigger, closes after following Examples, and its close button is visible.

## Public API impact

None. `packages/doq` changes one private method group inside `DoqDocsComponent` (scroll-spy pin). `pnpm verify:public-api` is unchanged.

## Compatibility

Angular 21 and 22 as before; the site is SSR/SSG prerendered with Analog. The documentation URLs, the `--host-docs-sticky-offset` contract (5 rem on this site) and the lazy `/docs` region are unchanged.

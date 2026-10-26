# 0017 — site theme switch and landing

## Problem

The light/dark switch of the official website did not work, and the landing page looked plain next to the components it is built from.

- **Both icons visible.** The switch hid one Lumen icon with Tailwind's `hidden` class, but Lumen icons set `display: inline-flex` inline on their host, so the sun and the moon were always shown together (reported with a screenshot of the production site).
- **Nothing reacted after load.** `vite build` builds the client and SSR environments at the same time (`@analogjs/vite-plugin-nitro` uses `Promise.all` with shared plugins). The Angular plugin releases its compilation in `buildEnd`; when the SSR build finished first, client chunks still being transformed (the landing page among them) shipped uncompiled. The browser then failed with `JIT compiler unavailable`, the prerendered page never hydrated and no control on it worked, the switch included. Reproduced locally: 3 of 8 builds shipped an uncompiled `index.page` chunk with identical sources.
- The landing hero left half the viewport empty and every section used the same flat layout; it did not show off Volt UI or Angular Movement, the libraries the site is meant to dogfood.

## Consumer impact

None. Only `apps/site` (and its tests) change: no export, configuration key, frontmatter key, route shape or `--host-docs-*` token of `@doqs/analog`.

## Scope

- A new theme switch atom (`app-theme-toggle`): a Volt button drawn as a track with a sliding thumb, CSS-driven by `.dark` so the prerendered state is already correct, with a circular view-transition reveal and Angular Movement press feedback.
- Deterministic site builds: client and SSR environments are built one after the other.
- A redesigned landing: two-column hero with a decorative Markdown → page illustration, a stack strip, Volt cards for the differentiators, capabilities and proof, numbered quick-start steps and a closing call to action, animated with Angular Movement (`moveInView`, `moveStagger`, `moveLoop`, `moveText`, `moveWhileHover`, `moveWhileTap`).
- A pill-shaped main navigation in the header.

## Non-goals

- No change to the landing copy's claims, the documentation content, the examples page or any URL.
- No fix for the same build race in the showcases (`apps/showcase-a`, `apps/showcase-b`): they are test fixtures, not the public site; the same plugin can be added there separately.
- No upstream patch to Analog; the workaround lives in the site's `vite.config.ts`.

## Requirements

- **REQ-001** The theme switch shows exactly one theme icon at a time, in the prerendered page and after hydration, flips Volt's `.dark` class with pointer and keyboard, exposes its state with `aria-pressed`, and keeps the choice across reloads.
- **REQ-002** Every site component in the client bundle is AOT-compiled on every build; the browser never needs the JIT compiler.
- **REQ-003** The landing keeps its public content contract (one `h1` with the same text, calls to action, differentiators as articles, capabilities as a list, preview, code tabs) while using Volt UI atoms and Angular Movement animations, with no horizontal overflow from 320 px and no serious axe violations in either theme.
- **REQ-004** Switching the theme never leaves controls between the two palettes (no colour transitions while the theme changes), so the page is consistent as soon as `.dark` changes.

## Acceptance cases

- **AC-001** [REQ-001] Given the landing in light mode, the switch's sun is opaque and its moon transparent; after a click `html` has `.dark`, `aria-pressed="true"` and only the moon is opaque; after a reload the dark choice remains; Enter switches back.
- **AC-002** [REQ-002] Given a production build, no client chunk contains raw `selector: 'app-…'` component metadata, and the landing loads without console errors.
- **AC-003** [REQ-003] The landing component and E2E checks (headings, links, tabs, preview, copy, prerendered hero) pass; no horizontal overflow at 320–1920 px; axe finds nothing serious in light and dark.
- **AC-004** [REQ-004] On a documentation page, after the switch is clicked and `.dark` is applied, axe finds no colour-contrast violation, repeatedly.

## Public API impact

None.

## Compatibility

Angular 21, Analog 2.9, Vite 8 (the `buildApp` plugin hook). The view transition is used only when `document.startViewTransition` exists and reduced motion is not requested; otherwise the theme switches instantly. The switch works before hydration visually (CSS follows `.dark`, set by the inline script in `index.html`).

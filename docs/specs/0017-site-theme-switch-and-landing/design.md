# Design — 0017 site theme switch and landing

## Existing implementation

`apps/site/src/app/site-header.ts` rendered a ghost icon button with `<lmn-moon class="dark:hidden">` and `<lmn-sun class="hidden dark:inline-flex">`; `ThemeController` (`theme.ts`) applied Volt's theme synchronously. `vite.config.ts` used Analog's default build orchestration. The landing (`pages/index.page.ts`) was a single column with plain sections.

## Proposed implementation

- `theme-toggle.ts`: `button[voltButton]` (outline, rounded-full) with a track, two faint hint icons and a thumb holding a sun and a moon. All state styling is CSS on `:root.dark` (`styles.css`), never classes on the Lumen hosts. `moveWhileTap="press"` gives press feedback. The click passes the pointer position (or the switch centre for keyboard) to `ThemeController.toggle(origin)`.
- `theme.ts`: `toggle(origin?)` wraps the theme change in `document.startViewTransition` and animates a growing `clip-path` circle on `::view-transition-new(root)`; reduced motion or no support switches instantly. While the class changes, a temporary `transition: none !important` style keeps controls from fading between palettes.
- `vite.config.ts`: `sequentialEnvironmentBuilds()` uses the `buildApp` plugin hook (runs before Analog's `builder.buildApp`) to queue `builder.build` calls, so the client and SSR environments no longer race on the shared Angular compilation.
- Landing: new site atoms `section-heading.ts` (Volt badge eyebrow + h2 + lead, `moveInView`) and `hero-stage.ts` (decorative, `aria-hidden` and `inert`: Volt cards, skeletons, buttons and badges with `moveEnter`/`moveLoop`). Feature and proof blocks are `volt-card`s with soft Lumen icon bubbles; the closing heading uses `moveText`. The `h1` stays plain text (prerendered as one string) and gets its brand colour from a CSS gradient.

## Tradeoffs and alternatives

- `VoltSwitch` was considered for the theme control, but its checked state is a signal that is `false` during SSR, so the thumb would jump on hydration for dark users, and it has no icon slot. A Volt button with CSS state keeps the prerendered page correct.
- Toggling icons with `@if (theme.dark())` would also flash on hydration; CSS keyed on `.dark` does not.
- Patching `@analogjs/vite-plugin-angular` in `node_modules` is not durable; serialising environment builds from the site config is local, small and removable once Analog fixes the race. It costs a few seconds of build time.

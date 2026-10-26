# Design — 0016 official site v1 readiness

## Existing implementation

`apps/site` is an Analog app: `src/app/pages/index.page.ts` (landing), a lazy `/docs` region (`docs.routes.ts`, `doq.config.ts`) that consumes `@doqs/analog`, `site-header.ts`/`site-footer.ts`, host tokens in `styles.css`, SEO in `seo.ts` and `lib/site-config.ts`. The landing already used Volt UI, Lumen icons and Angular Movement; the header used plain `href`s.

## Proposed implementation

- **Information architecture.** `/` introduces, `/examples` demonstrates, `/docs` explains. `navItems` in `lib/site-config.ts` is the single source for header, drawer and footer, and `RouterLinkActive` with `ariaCurrentWhenActive="page"` (exact only for Home) provides the active state. External links stay after a separator.
- **Landing.** Hero with the product preview, three differentiators as alternating rows with real code, six smaller capabilities as a quiet list, quick start (four numbered steps, copyable command, the existing code tabs), a "built with Doqs" section grounded in the repository's adoption reports, a closing call to action. i18n is not mentioned.
- **Product preview** (`components/product-preview.ts`). Not a second renderer: static markup with real links into the documentation and the real `EnterDemo` component behind Volt tabs, so the landing loads none of the Doqs runtime. The sidebar and TOC columns are hidden below `lg`, leaving the article.
- **Examples** (`pages/examples.page.ts`, `components/example-frame.ts`, `movement-lab.ts`, `code-block.ts`). Six sections. The lab binds Volt toggle groups to signals that feed the real `MovementPlaygroundComponent` and a computed usage snippet. No component of `apps/site` is a copy of a Doqs feature.
- **Motion.** `moveEnter` on the preview and page header, hover/tap on buttons, and a staggered `moveInView` with `moveInViewOnce` on the capability list so nothing re-hides.
- **SEO.** `SeoLinks` now also sets title, description, og/twitter text from `pageMeta` for the pages the site owns and, only with an origin, canonical, `og:url`, `og:image` and `summary_large_image`. `public/og.svg` is the source of the 1200×630 `og.png` (palette-quantized, 76 KB).
- **Library.** `DoqDocsComponent` holds the followed-heading pin until the scroll ends (`scrollend`, with a 1.5 s fallback) before checking its visibility.
- **Layering.** `[voltdraweroverlay] { z-index: 60 }` lifts Volt's fixed overlay above the sticky header.

## Tradeoffs and alternatives

- The slider and switch from Volt were first used in the lab. They pulled ~6 KB gzip into the shared entry chunk (Volt ships as one module) and `@defer` did not help, so the lab uses toggle groups already present in the entry. Initial JS grew 661 B instead of 6.4 KB.
- A custom mini-renderer for the hero was rejected: it would duplicate Doqs and drift. A lazily loaded real documentation page was rejected for the initial bundle.
- Quartz Headless was not introduced: the drawer, tabs and toggles Volt UI provides cover every interaction.
- `moveInView` without `once` was dropped for the capability list because it hid items again after leaving the viewport.

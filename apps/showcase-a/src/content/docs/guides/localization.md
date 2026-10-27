---
title: Localization fixture
description: English documentation for the multilingual acceptance fixture.
group: Guides/Internationalization
order: 1
---

This English page verifies language and version aware documentation routing.

## Keep each language isolated

Each language reads its own Markdown directory. Search only indexes this English text for the English route.

### Try the registered demo

::demo[vanta-button]

## Search the current guide

The English phrase **amber compass** is unique to this page and is used by the real Pagefind index check.

## Sticky contents

This long fixture keeps the table of contents taller than a short viewport so its internal scrolling can be checked.

## Logical navigation

The same document is available in Spanish and Arabic, each with separate content and locale metadata.

## Static rendering

The generated pages retain their locale in the URL, document language and Pagefind filter.

## Version selection

Spanish has a version 1 archive. Arabic intentionally has no archive catalog.

## Translation identity

Links follow a matching slug only. Titles are never used to guess translation identity.

## Search isolation

The search fixture checks language filters against the generated Pagefind index.

## Host integration

The host adapter derives its active language from the URL and translates Doqs-owned interface text.

## Direction

Arabic uses right-to-left direction while English and Spanish remain left-to-right.

## Browser hydration

The server and browser start from the same route-derived language.

## Keyboard access

The navigation and contents remain available to keyboard users.

## Responsive layout

The documentation region adapts to narrow viewports without page-wide horizontal scrolling.

## Search result routes

Results retain the locale and version of their indexed document.

## Metadata ownership

Doqs writes one canonical URL and alternates only while it owns the document head.

## Archive localization

The Spanish archive uses the same locale prefix and version path segment as its current pages.

## Locale availability

The Arabic locale does not publish an archive, so the version matrix omits that combination.

## Missing translations

The Spanish catalog intentionally omits the existing English routing guide.

## Final section

The final heading keeps the long article scrollable beyond the initial viewport.

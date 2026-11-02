# 0024 — playground overlay interoperability

## Problem

A playground's expanded preview is a native modal `<dialog>` (`showModal()`), which lives in the browser's top layer. Components such as Volt UI's select, popover and dialog append their overlay content to `document.body`. Content outside the dialog subtree cannot paint above the top layer, whatever its `z-index`, and the modal makes the rest of the document inert. The dropdown is attached but invisible and unreachable. Verified on the real pinned Volt UI checkout (ADOPT-013 / PLAY-03; E2E-167 asserts `elementFromPoint` does not hit the option).

## Consumer impact

Existing playgrounds are unchanged. A definition may opt into `expandedPreview: 'overlay-compatible'`, a non-modal expanded panel in ordinary stacking order, so body-mounted overlays stay visible and interactive.

## Scope

One optional `DoqPlaygroundDefinition.expandedPreview` option (`'modal'` default, `'overlay-compatible'`), its validation, a non-modal open path in `DoqPlaygroundComponent`, CSS, docs, and real Volt UI proof.

## Non-goals

No overlay framework, no portal container API, no DOM reparenting of consumer overlays, no monkey-patching of `document.body` or browser APIs, no new dependency, no 1.0 declaration, no manual publication or deployment, no claim of manual screen-reader verification.

## Requirements

- **REQ-001** Existing playground expansion is backward-compatible: without the option, the preview opens as a native modal exactly as in 0.14.
- **REQ-002** An opt-in mode supports the verified external overlay scenario: body-mounted overlays are visible and hit-testable.
- **REQ-003** Expanded previews preserve component identity and state in both modes.
- **REQ-004** Keyboard, focus and Escape behavior are predictable and honestly described: the opt-in mode is non-modal, installs no key listener, and leaves Escape to the consumer's overlays.
- **REQ-005** SSR, hydration, routing and teardown remain correct; the opt-in behavior is browser-only.
- **REQ-006** Real Volt UI adoption validates the behavior for select, popover and dialog, and the default button case.
- **REQ-007** Public API, performance and Angular compatibility remain stable; the change is additive.
- **REQ-008** Documentation distinguishes default and opt-in guarantees and limits.

## Acceptance cases

- **AC-001** [REQ-001] A definition without `expandedPreview` (or with `'modal'`) opens through `showModal()` and the real Volt button playground matches `:modal`.
- **AC-002** [REQ-002] With `'overlay-compatible'`, the real Volt select list option is visible, passes `elementFromPoint`, can be clicked and the Doqs `Changed` output is recorded; the control case in default mode is not hit-testable.
- **AC-003** [REQ-003] The component instance stays the same node while expanded; its internal count and the selected Volt value survive expansion and inline restoration.
- **AC-004** [REQ-004] By keyboard: Enter on Expand opens, the select opens/selects with Enter and arrows, Escape closes the Volt list or popover but not the preview, the Close button closes it and focus returns to Expand.
- **AC-005** [REQ-005] Opening happens only on user action in the browser; destroying the route while expanded removes the stage; invalid values are rejected by `validateDoqPlaygrounds`.
- **AC-006** [REQ-006] The real Volt popover and dialog open above the panel, close by their own controls and restore focus; the preview survives.
- **AC-007** [REQ-007] `pnpm verify:public-api` passes with only the additive `DoqExpandedPreviewMode` export and `expandedPreview` property; bundle and perf checks pass.
- **AC-008** [REQ-008] The playgrounds guide, README and changelog describe both modes, the top-layer reason and the limits.

## Public API impact

Additive: type `DoqExpandedPreviewMode`, optional `DoqPlaygroundDefinition.expandedPreview`, optional CSS token `--doq-playground-expanded-z-index`.

## Compatibility

Angular 21.2/22, Analog `^2.9.2`. The prerendered DOM is identical (the dialog is closed and only gains a `data-doq-expanded` attribute derived from the definition, deterministic on server and client).

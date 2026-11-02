# Design — 0024 playground overlay interoperability

## Existing implementation

`DoqPlaygroundComponent.expand()` moves the stage into a `<dialog>` and calls `showModal()`; `close` restores it.

## Proposed implementation

`expandedMode` (computed from the definition) selects `dialog.show()` for `'overlay-compatible'`; the same stage move, `close` event, focus restoration and `DestroyRef` cleanup apply. CSS positions that dialog fixed with a token z-index (50: body-mounted overlays are appended later and win ties; Volt UI's select list is `z-50`, so a higher value would cover it). Because `.doq-root`/`.doq-shell` use `isolation: isolate`, a `:has()` rule lifts the isolation only while an overlay-compatible panel is open, so the panel can rise above host sticky headers. No key listener is added: Escape belongs to the consumer's overlay; the Close button and the native `close` path remain. `validateDoqPlaygrounds` rejects other values.

## Tradeoffs and alternatives

- Consumer-controlled portal container: requires every library to expose one (class B only) and a Doqs-specific contract; rejected.
- Reparenting overlay nodes into the dialog or the dialog into `<body>`: forbidden by the brief, and the dialog's tokens are scoped to `.doq-root`.
- A CSS `z-index` on body overlays cannot beat the top layer, so the modal mode cannot be fixed; a non-modal panel can honestly coexist with them.
- Not modal: background stays interactive, no focus trap, no scrim; documented rather than faked.

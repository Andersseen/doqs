---
title: Interactive playgrounds
description: Let readers change a real Angular component's inputs, watch its outputs and copy usage code.
group: Guides
order: 15
---

A playground turns a component you own into something readers can explore. You register it once, describe the inputs worth changing, and place it with one line of Markdown. Doqs supplies the controls, preview, event list, reset, widths, expanded view and code panel.

It is not MDX and it compiles nothing in the browser: the component is yours, built with your application, and Markdown never contains Angular templates.

## Demo or playground?

| | `::demo[id]` | `::playground[id]` |
| --- | --- | --- |
| Renders | Your component, alone | Your component inside a playground |
| Controls, events, code | You build them | Doqs provides them |
| Registered under | `demos` | `playgrounds` |

Both coexist, and existing demos are unchanged.

## Register

```ts
const doqConfig = defineDoqConfig({
  ...doqPaths,
  playgrounds: {
    'button-basic': {
      component: ButtonPlayground,
      title: 'Button',
      controls: [
        { input: 'variant', kind: 'select', label: 'Variant', initial: 'solid', options: [{ label: 'Solid', value: 'solid' }, { label: 'Outline', value: 'outline' }] },
        { input: 'disabled', kind: 'boolean', label: 'Disabled' },
      ],
      outputs: [{ event: 'pressed', label: 'Pressed' }],
      code: [{ label: 'Template', language: 'html', code: (values) => formatDoqUsage('app-button', values) }],
    },
  },
});
```

Keep this in the file that imports your components, not in `doq.paths.ts`, which must stay free of Angular components. An invalid registry throws one readable error when the configuration is defined.

## Place

```markdown
## Playground

::playground[button-basic]
```

The directive follows the `::demo[id]` rules: alone in its paragraph, id of letters, digits, `_` and `-`, literal inside code blocks, lists, quotes and tables. An unregistered id renders an accessible notice.

## Controls

| `kind` | Input it drives | Notes |
| --- | --- | --- |
| `boolean` | `boolean` | Starts `false` unless `initial` says otherwise. |
| `string` | `string` | Without `initial` the input stays unbound until the reader types. |
| `number` | `number` | Optional `min`, `max`, `step`. Invalid or out-of-range text is rejected with a message and the last valid value stays bound. |
| `select` | A finite set | Options carry their own `value`, so numbers and booleans work. Doqs never invents options. |

`input` is the **public binding name**: the alias if the input declares one. Signal inputs, `required` inputs, aliased inputs, input transforms and classic `@Input` all work, because Doqs binds them with Angular's own `createComponent` bindings. Set `required: true` on a control whose input is required: it then needs an `initial` and can never be emptied.

## Outputs

List the outputs worth watching by their public name. Each emission appears in a bounded list of the latest 20 events; payloads are summarised safely (no circular structures, DOM objects or values under keys like `password` or `token`). For a `model()`, list `<name>Change`. Events stay in the page: they are never logged, indexed or sent anywhere.

## Directives

Doqs creates components, not directives. To document an attribute directive, write a small standalone component that applies it and register that, as the live example below does for Angular Movement.

## Code examples

Each entry is either static text or a function of the current valid values. `formatDoqUsage(selector, values, { attributes, text })` renders template usage with the right escaping; the text on screen is exactly what the copy button copies. A static example does not follow the controls, so label it accordingly.

## Preview, expand and reset

- **Widths.** Responsive, Mobile (320px) and Tablet (768px) resize the preview container, not the browser. Pass `previewSizes` to customise them or `false` to hide them. Changing width never recreates the component.
- **Expand.** The preview moves into a native modal dialog: same instance, same state, Escape closes it and focus returns to the button. Overlays a component appends to `<body>` render beneath the dialog; see [Expanded previews and body-mounted overlays](#expanded-previews-and-body-mounted-overlays).
- **Reset.** Restores every control, clears the events and **recreates** the component, so internal state starts over. Changing a control never recreates it.

## Expanded previews and body-mounted overlays

By default the expanded preview is a native modal `<dialog>` (`showModal()`). The browser puts it in the **top layer**, above everything that is not inside it, and makes the rest of the page inert. No `z-index` can lift a regular element above the top layer, so a select list, popover or dialog that a component appends to `document.body` is in the DOM but cannot be seen or reached while the preview is expanded. Components that render overlays inside their own subtree work in both modes.

If your component portals its overlays to `<body>`, opt into the non-modal panel:

```ts
// doq.config.ts
playgrounds: {
  'app-select': {
    component: AppSelectPlayground,
    title: 'Select',
    expandedPreview: 'overlay-compatible',
    outputs: [{ event: 'changed', label: 'Changed' }],
  },
},
```

| | `'modal'` (default) | `'overlay-compatible'` |
| --- | --- | --- |
| Element | `showModal()` dialog in the top layer | non-modal `show()` dialog, fixed panel in normal stacking order |
| Background | inert, dimmed | stays interactive, not dimmed |
| Focus | trapped by the browser | **not trapped**; Tab can leave the panel |
| Escape | closes the preview | **not handled by Doqs**; your overlays receive it, the Close button closes the panel |
| Body-mounted overlays | hidden behind the top layer | visible and interactive if their container stacks above `--doq-playground-expanded-z-index` (default 50) |

Doqs guarantees, in both modes, that the same component instance moves into the panel and back, so inputs, outputs, internal state and the event list survive, that focus returns to the Expand button on close, and that a route change removes the panel. The mode is not modal and is not announced as modal. Whether an overlay appears above the panel depends on the library's own container z-index; Doqs does not move, wrap or replace consumer overlays and adds no dependency. Verified in CI against the real Volt UI select, popover and dialog; other libraries are untested.

## Server rendering

The preview is created during rendering, so a component that renders on the server is in the prerendered HTML, with the controls at their initial values, and hydrates in place. A component that touches `window` or `document` must guard them as in any SSR application.

## Styling

The playground uses native controls and the existing `--host-docs-*` tokens. Optional tokens adjust it: `--host-docs-playground-surface` and `--host-docs-playground-preview`; `--doq-playground-expanded-z-index` sets the stacking of the overlay-compatible panel (the common `z-index: 50` overlay level; overlays appended to `<body>` later win ties, so raise the token above your sticky header only if it is higher than that).

## Live example

Angular Movement's `moveEnter` directive, wrapped in a component that Volt UI's button replays. Change the controls; every change replays the animation.

::playground[movement-enter]

## Limits

- Controls cover booleans, strings, numbers and finite choices, not object graphs.
- Controls are written by hand. Doqs does not infer them from the API reference.
- Code examples are text you provide; Doqs does not import source files.

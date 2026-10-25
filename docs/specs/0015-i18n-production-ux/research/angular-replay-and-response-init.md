# Research: Angular event replay before hydration, and `RESPONSE_INIT` for SSR 404

Research for spec `0015-i18n-production-ux`. Evidence-first: every claim below cites a real file
path in this workspace's `node_modules`, a real line in this repo's build output, or an official
URL. Anything that could not be verified is marked **UNVERIFIED** — nothing here is inferred from
memory.

Versions inspected locally (both are installed in this workspace):

| Package                       | Version           | Store path (pnpm)                                                                                         |
| ----------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------- |
| `@angular/core`               | 21.2.25           | `node_modules/.pnpm/@angular+core@21.2.25_@angular+compiler@22.2.3_rxjs@7.8.2/node_modules/@angular/core` |
| `@angular/core`               | 22.2.3            | `node_modules/.pnpm/@angular+core@22.2.3_@angular+compiler@22.2.3_rxjs@7.8.2/node_modules/@angular/core`  |
| `@angular/platform-browser`   | 21.2.25 / 22.2.3  | `node_modules/.pnpm/@angular+platform-browser@{21.2.25,22.2.3}_*/node_modules/@angular/platform-browser`  |
| `@angular/platform-server`    | 21.2.25           | `node_modules/.pnpm/@angular+platform-server@21.2.25_*/node_modules/@angular/platform-server`             |
| `@angular/build`              | 21.2.27           | `node_modules/.pnpm/@angular+build@21.2.27_*/node_modules/@angular/build`                                 |
| `@analogjs/router`            | 2.9.0             | `node_modules/.pnpm/@analogjs+router@2.9.0_*/node_modules/@analogjs/router`                               |
| `@analogjs/vite-plugin-nitro` | 2.9.0             | `node_modules/.pnpm/@analogjs+vite-plugin-nitro@2.9.0_*/node_modules/@analogjs/vite-plugin-nitro`         |
| `@angular/ssr`                | **not installed** | no `@angular+ssr@*` directory exists under `node_modules/.pnpm`                                           |

Paths below are abbreviated: `CORE21` = the `@angular/core@21.2.25` store path above,
`CORE22` = the `@angular/core@22.2.3` store path, `PSERVER` = the `@angular/platform-server@21.2.25`
path, `ABUILD` = the `@angular/build@21.2.27` path, `AROUTER` = the `@analogjs/router@2.9.0` path,
`ANITRO` = the `@analogjs/vite-plugin-nitro@2.9.0` path.

---

# Event replay (`withEventReplay()`)

## Verified facts

### 1. Declaration and stability

`withEventReplay()` is **public API on `@angular/platform-browser`**, not on `@angular/core`.
In `@angular/core` the same function exists but is exported under the private `ɵ` prefix.

`CORE21/types/../../@angular/platform-browser/types/platform-browser.d.ts:677-694` (v21) and the
same block at `:429-444` (v22) — **the JSDoc is byte-identical in 21 and 22**:

````ts
/**
 * Enables support for replaying user events (e.g. `click`s) that happened on a page
 * before hydration logic has completed. Once an application is hydrated, all captured
 * events are replayed and relevant event listeners are executed.
 *
 * @usageNotes
 *
 * Basic example of how you can enable event replay in your application when
 * `bootstrapApplication` function is used:
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [provideClientHydration(withEventReplay())]
 * });
 * ```
 * @publicApi
 * @see {@link provideClientHydration}
 */
declare function withEventReplay(): HydrationFeature<HydrationFeatureKind.EventReplay>;
````

Feature kind, `platform-browser.d.ts:635-641` (v21):

```ts
declare enum HydrationFeatureKind {
  NoHttpTransferCache = 0,
  HttpTransferCacheOptions = 1,
  I18nSupport = 2,
  EventReplay = 3,
  IncrementalHydration = 4,
}
```

The internal core-side declaration, `CORE21/types/core.d.ts:5158-5165`:

```ts
/**
 * Returns a set of providers required to setup support for event replay.
 * Requires hydration to be enabled separately.
 *
 * @see [Capturing and replaying event](guide/hydration#capturing-and-replaying-events)
 *
 */
declare function withEventReplay(): Provider[];
```

and it is re-exported as `withEventReplay as ɵwithEventReplay` (`CORE21/types/core.d.ts:9455`,
`CORE22/types/core.d.ts:9699`).

**Stability:** tagged `@publicApi` with **no** developer-preview/experimental marker in **both** 21
and 22. Confirmed against the live API page, which shows stability `stable` and no limitations
section: https://angular.dev/api/platform-browser/withEventReplay

Note the contrast with its neighbours, which _do_ carry version tags: `withI18nSupport()` is
`@publicApi 20.0`, `withIncrementalHydration()` is `@publicApi 20.0` and in v22 is
`@deprecated Since v22.0.0, incremental hydration is enabled by default with provideClientHydration.
Intent to remove in v24.` (`platform-browser.d.ts:454-463` v22). `withEventReplay()` carries no
version tag in either release.

**Which version introduced it: UNVERIFIED.** Neither the typings nor
https://angular.dev/api/platform-browser/withEventReplay state an "introduced in" version.

### 2. Real mechanism and real file names

The belief that it is `jsaction`-based and installed by an inline script is **correct**. The chain,
with real files:

**(a) The inline contract script.** `@angular/core` ships a minified script at the _package root_:
`CORE21/event-dispatch-contract.min.js` (476 bytes; identical file present in `CORE22`). Full contents:

```js
(() => {
  function p(t, n, r, o, e, i, f, m) {
    return { eventType: t, event: n, targetElement: r, eic: o, timeStamp: e, eia: i, eirp: f, eiack: m };
  }
  function u(t) {
    let n = [],
      r = (e) => {
        n.push(e);
      };
    return {
      c: t,
      q: n,
      et: [],
      etc: [],
      d: r,
      h: (e) => {
        r(p(e.type, e, e.target, t, Date.now()));
      },
    };
  }
  function s(t, n, r) {
    for (let o = 0; o < n.length; o++) {
      let e = n[o];
      ((r ? t.etc : t.et).push(e), t.c.addEventListener(e, t.h, r));
    }
  }
  function c(t, n, r, o, e = window) {
    let i = u(t);
    (e._ejsas || (e._ejsas = {}), (e._ejsas[n] = i), s(i, r), s(i, o, !0));
  }
  window.__jsaction_bootstrap = c;
})();
```

De-minified, `__jsaction_bootstrap(container, appId, bubbleEventTypes, captureEventTypes, dataContainer = window)`:

- builds `EarlyJsactionData` = `{ c: container, q: [], et: [], etc: [], d, h }`
- `h` is the capture handler: pushes `{eventType, event, targetElement, eic: appId, timeStamp}` into `q`
- registers `container.addEventListener(type, h)` for bubble types and `container.addEventListener(type, h, true)` for capture types
- stores it at `window._ejsas[appId]`

So the queue lives at `window._ejsas[appId].q`.

**(b) Who inlines it.** `ABUILD/src/utils/index-file/add-event-dispatch-contract.js:14-27`
(required by `index-html-generator.js:13`):

```js
jsActionContractScript ??=
  '<script type="text/javascript" id="ng-event-dispatch-contract">' +
  (await readFile(require.resolve('@angular/core/event-dispatch-contract.min.js'), 'utf-8')) +
  '</script>';
rewriter.on('startTag', (tag) => {
  rewriter.emitStartTag(tag);
  if (tag.tagName === 'body') {
    rewriter.emitRaw(jsActionContractScript);
  }
});
```

**(c) Who calls the bootstrap, and with what.** `PSERVER/fesm2022/platform-server.mjs:48-97`:

```js
function prepareForHydration(platformState, applicationRef) {
  const environmentInjector = applicationRef.injector;
  const doc = platformState.getDocument();
  if (!environmentInjector.get(_IS_HYDRATION_DOM_REUSE_ENABLED, false)) {
    removeEventDispatchScript(doc);
    return;
  }
  appendSsrContentIntegrityMarker(doc);
  const eventTypesToReplay = _annotateForHydration(applicationRef, doc);
  if (eventTypesToReplay.regular.size || eventTypesToReplay.capture.size) {
    insertEventRecordScript(
      environmentInjector.get(APP_ID),
      doc,
      eventTypesToReplay,
      environmentInjector.get(CSP_NONCE, null),
    );
  } else {
    removeEventDispatchScript(doc);
  }
}

function insertEventRecordScript(appId, doc, eventTypesToReplay, nonce) {
  const { regular, capture } = eventTypesToReplay;
  const eventDispatchScript = findEventDispatchScript(doc);
  if (eventDispatchScript) {
    const replayScriptContents =
      `window.__jsaction_bootstrap(` +
      `document.body,` +
      `"${appId}",` +
      `${JSON.stringify(Array.from(regular))},` +
      `${JSON.stringify(Array.from(capture))}` +
      `);`;
    const replayScript = createScript(doc, replayScriptContents, nonce);
    eventDispatchScript.after(replayScript);
  }
}
```

Two facts worth flagging: the container is **`document.body`**, and if no replayable event types
were collected the contract script is **removed entirely** (zero replay for that page).

**(d) Where the event types and the `jsaction` attributes come from.** `CORE21/fesm2022/core.mjs`:

- `annotateForHydration(appRef, doc)` at `:2215` reads the gate at `:2222`:
  `const shouldReplayEvents = injector.get(IS_EVENT_REPLAY_ENABLED, EVENT_REPLAY_ENABLED_DEFAULT);`
  `EVENT_REPLAY_ENABLED_DEFAULT = false` (`CORE21/fesm2022/_debug_node-chunk.mjs:2040`;
  `CORE22/.../_debug_node-chunk.mjs:2102`).
- `serializeLView` at `:2393`:
  `const nativeElementsToEventTypes = context.shouldReplayEvents ? collectDomEventsInfo(tView, lView, context.eventTypesToReplay) : null;`
- `collectDomEventsInfo(tView, lView, eventTypesToReplay)` at `:1012` walks **`tView.cleanup`** —
  the record of listeners Angular attached from templates/host bindings — and keeps only entries
  where `typeof firstParam === 'string'` (the event type), `isEarlyEventType(eventType)` is true, and
  `isDomEvent` (`typeof useCaptureOrIndx === 'boolean' || useCaptureOrIndx >= 0`). It resolves the
  element via `unwrapRNode(lView[secondParam])` and returns `Map<element, eventType[]>`.
- `:2474-2478` writes the marker, only for element TNodes present in that map:

```js
if (nativeElementsToEventTypes && tNode.type & 2) {
  const nativeElement = unwrapRNode(lView[i]);
  if (nativeElementsToEventTypes.has(nativeElement)) {
    setJSActionAttributes(nativeElement, nativeElementsToEventTypes.get(nativeElement), parentDeferBlockId);
  }
}
```

- `setJSActionAttributes` (`_debug_node-chunk.mjs:2180-2193`) appends `"<type>:;"` pairs to the
  `jsaction` attribute and, when inside a defer block, also sets `ngb` (`DEFER_BLOCK_SSR_ID_ATTRIBUTE = 'ngb'`, `:2179`).
- Defer blocks get their own path: `annotateDeferBlockRootNodesWithJsAction` (`core.mjs:2528-2541`)
  derives actions from `convertHydrateTriggersToJsAction(tDetails.hydrateTriggers)`, adds those types
  to `eventTypesToReplay.regular`, and stamps the block's root element nodes.

**(e) Client side.** `CORE21/fesm2022/core.mjs:910-1010`. `withEventReplay()` contributes two
multi-providers:

- `APP_INITIALIZER`: `enableStashEventListenerImpl()` then
  `setStashFn(appId, (rEl, eventName, listenerFn) => { if (rEl.nodeType !== Node.ELEMENT_NODE) return; sharedStashFunction(rEl, eventName, listenerFn); sharedMapFunction(rEl, jsActionMap); })`
- `APP_BOOTSTRAP_LISTENER`: on `appRef.whenStable().then(...)` → `initEventReplay(eventContractDetails, injector)`

```js
const initEventReplay = (eventDelegation, injector) => {
  const appId = injector.get(APP_ID);
  const earlyJsactionData = window._ejsas[appId];
  const eventContract = (eventDelegation.instance = new EventContract(new EventContractContainer(earlyJsactionData.c)));
  for (const et of earlyJsactionData.et) {
    eventContract.addEvent(et);
  }
  for (const et of earlyJsactionData.etc) {
    eventContract.addEvent(et);
  }
  const eventInfos = getAppScopedQueuedEventInfos(appId);
  eventContract.replayEarlyEventInfos(eventInfos);
  clearAppScopedEarlyEventContract(appId);
  const dispatcher = new EventDispatcher((event) => {
    invokeRegisteredReplayListeners(injector, event, event.currentTarget);
  });
  registerDispatcher(eventContract, dispatcher);
};
```

`invokeRegisteredReplayListeners` (`core.mjs:1050-1058`) branches on the defer marker:

```js
function invokeRegisteredReplayListeners(injector, event, currentTarget) {
  const blockName = (currentTarget && currentTarget.getAttribute(DEFER_BLOCK_SSR_ID_ATTRIBUTE)) ?? '';
  if (/d\d+/.test(blockName)) {
    hydrateAndInvokeBlockListeners(blockName, injector, event, currentTarget);
  } else if (event.eventPhase === EventPhase.REPLAY) {
    invokeListeners(event, currentTarget);
  }
}
```

`EventPhase = { REPLAY: 101 }` (`primitives-event-dispatch.mjs:496-498`).

The stash and the final invocation, `CORE21/fesm2022/_debug_node-chunk.mjs:2194-2201` and `:2241-2252`:

```js
const sharedStashFunction = (rEl, eventType, listenerFn) => {
  const el = rEl;
  const eventListenerMap = el.__jsaction_fns ?? new Map();
  const eventListeners = eventListenerMap.get(eventType) ?? [];
  eventListeners.push(listenerFn);
  eventListenerMap.set(eventType, eventListeners);
  el.__jsaction_fns = eventListenerMap;
};

function invokeListeners(event, currentTarget) {
  const handlerFns = currentTarget?.__jsaction_fns?.get(event.type);
  if (!handlerFns || !currentTarget?.isConnected) {
    return;
  }
  if (currentTarget && handledEventElements.get(event)?.has(currentTarget)) {
    return;
  }
  for (const handler of handlerFns) {
    handler(event);
  }
}
```

The listener stash is fed by `stashEventListenerImpl(lView, target, eventName, wrappedListener)`
(`_debug_node-chunk.mjs:2253-2277`), i.e. Angular's own listener-attachment path.

### 3. **Critical question: is a marker attribute required, or is it pure document-level delegation?**

**Both halves are true, and this is the crux.** Capture is delegated; **dispatch is attribute-gated**.

- **Capture** is a single set of delegated listeners on the container, which `insertEventRecordScript`
  hardcodes to `document.body`. Every matching event anywhere under `<body>` is queued into
  `window._ejsas[appId].q`. No per-element marker is needed _to capture_.
- **Dispatch requires the `jsaction` attribute on the target element or an ancestor up to the container.**
  `CORE21/fesm2022/primitives-event-dispatch.mjs:503-540`:

```js
dispatchToDelegate(eventInfoWrapper) {
    if (eventInfoWrapper.getIsReplay()) { prepareEventForReplay(eventInfoWrapper); }
    prepareEventForBubbling(eventInfoWrapper);
    while (eventInfoWrapper.getAction()) {
      prepareEventForDispatch(eventInfoWrapper);
      if (isCaptureEventType(eventInfoWrapper.getEventType()) && eventInfoWrapper.getAction().element !== eventInfoWrapper.getTargetElement()) { return; }
      this.dispatchDelegate(eventInfoWrapper.getEvent(), eventInfoWrapper.getAction().name);
      if (propagationStopped(eventInfoWrapper)) { return; }
      this.actionResolver.resolveParentAction(eventInfoWrapper.eventInfo);
    }
}
```

The `while (getAction())` loop is the whole gate. `ActionResolver.populateAction` (`:357-386`) walks
from the target up to the container calling `populateActionOnElement` (`:398-407`), which calls
`parseActions` (`:408-...`):

```js
parseActions(actionElement) {
    let actionMap = get(actionElement);
    if (!actionMap) {
      const jsactionAttribute = actionElement.getAttribute(Attribute.JSACTION);
      if (!jsactionAttribute) {
        actionMap = EMPTY_ACTION_MAP;
        set(actionElement, actionMap);
      } else { /* parse "click:;keydown:;" */ }
```

`Attribute.JSACTION === 'jsaction'` (`CORE21/types/primitives-event-dispatch.d.ts:23`). No attribute
→ `EMPTY_ACTION_MAP` → `populateActionOnElement` never calls `setAction` → `populateAction` returns
with no action → **the `while` loop body never executes → nothing is replayed, silently.**

- `prepareEventForDispatch` (`:569-577`) then sets `event.currentTarget = action.element`, which is
  what `invokeRegisteredReplayListeners` inspects for `ngb`.
- Even with the attribute present, replay needs **`__jsaction_fns` on that exact element and
  `currentTarget.isConnected === true`** (`invokeListeners`, above). Both are client-side, populated
  during hydration.

So there are **three independent conditions**, all of which must hold:

| #   | Condition                                             | Established when                     | Failure mode                    |
| --- | ----------------------------------------------------- | ------------------------------------ | ------------------------------- |
| a   | event type in the per-page bootstrap list             | SSR, from that page's rendered views | event never queued at all       |
| b   | `jsaction="<type>:;"` on element or ancestor ≤ body   | SSR, `setJSActionAttributes`         | dispatch loop never runs        |
| c   | `__jsaction_fns` on the same, still-connected element | client, during hydration             | `invokeListeners` returns early |

### Supported event types (real lists)

`CORE21/fesm2022/primitives-event-dispatch.mjs:33-64`. **Verified byte-identical in
`CORE22/fesm2022/primitives-event-dispatch.mjs:33-64`** — no change between 21 and 22.

```js
const EventType = {
  CLICK: 'click',
  CLICKMOD: 'clickmod',
  DBLCLICK: 'dblclick',
  FOCUS: 'focus',
  FOCUSIN: 'focusin',
  BLUR: 'blur',
  FOCUSOUT: 'focusout',
  SUBMIT: 'submit',
  KEYDOWN: 'keydown',
  KEYPRESS: 'keypress',
  KEYUP: 'keyup',
  MOUSEOVER: 'mouseover',
  MOUSEOUT: 'mouseout',
  MOUSEENTER: 'mouseenter',
  MOUSELEAVE: 'mouseleave',
  POINTEROVER: 'pointerover',
  POINTEROUT: 'pointerout',
  POINTERENTER: 'pointerenter',
  POINTERLEAVE: 'pointerleave',
  ERROR: 'error',
  LOAD: 'load',
  TOUCHSTART: 'touchstart',
  TOUCHEND: 'touchend',
  TOUCHMOVE: 'touchmove',
  TOGGLE: 'toggle',
};

const BUBBLE_EVENT_TYPES = [
  EventType.CLICK,
  EventType.DBLCLICK,
  EventType.FOCUSIN,
  EventType.FOCUSOUT,
  EventType.KEYDOWN,
  EventType.KEYUP,
  EventType.KEYPRESS,
  EventType.MOUSEOVER,
  EventType.MOUSEOUT,
  EventType.SUBMIT,
  EventType.TOUCHSTART,
  EventType.TOUCHEND,
  EventType.TOUCHMOVE,
  'touchcancel',
  'auxclick',
  'change',
  'compositionstart',
  'compositionupdate',
  'compositionend',
  'beforeinput',
  'input',
  'select',
  'copy',
  'cut',
  'paste',
  'mousedown',
  'mouseup',
  'wheel',
  'contextmenu',
  'dragover',
  'dragenter',
  'dragleave',
  'drop',
  'dragstart',
  'dragend',
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'pointerover',
  'pointerout',
  'gotpointercapture',
  'lostpointercapture',
  'ended',
  'loadedmetadata',
  'pagehide',
  'pageshow',
  'visibilitychange',
  'beforematch',
];

const CAPTURE_EVENT_TYPES = [EventType.FOCUS, EventType.BLUR, EventType.ERROR, EventType.LOAD, EventType.TOGGLE];
const isCaptureEventType = (eventType) => CAPTURE_EVENT_TYPES.indexOf(eventType) >= 0;
const EARLY_EVENT_TYPES = BUBBLE_EVENT_TYPES.concat(CAPTURE_EVENT_TYPES);
const isEarlyEventType = (eventType) => EARLY_EVENT_TYPES.indexOf(eventType) >= 0;
```

`click` is in the bubble list. `mouseenter`/`mouseleave`/`pointerenter`/`pointerleave` are mapped onto
`mouseover`/`mouseout` by `getBrowserEventType` (`:66+`) and only synthesised when
`syntheticMouseEventSupport` is on — `EventDispatcher` constructs `ActionResolver` with
`clickModSupport = true` and default `syntheticMouseEventSupport = false` (`:508-518`).

### 4. Empirical evidence from **this repo's own prerendered output**

This is the strongest evidence available, because it is the real emitted HTML rather than a model of it.

`apps/showcase-a/dist/analog/public/docs/index.html` (eagerly-registered Doqs routes):

```
__jsaction_bootstrap(document.body,"ng",["click","keydown","submit","input"],[])
```

```html
<button
  type="button"
  aria-haspopup="dialog"
  aria-keyshortcuts="Control+K Meta+K"
  class="doq-search-trigger"
  jsaction="click:;"
>
  <dialog aria-labelledby="doq-search-title" class="doq-search-dialog" jsaction="click:;keydown:;">
    <form role="search" class="doq-search-form" jsaction="submit:;">
      <input id="doq-search-input" type="search" ... class="doq-search-input" value="" jsaction="input:;" />
      <button type="button" class="doq-search-close" jsaction="click:;"></button>
    </form>
  </dialog>
</button>
```

`apps/site/dist/analog/public/docs/index.html` — **the lazy `/docs` region**
(`apps/site/src/app/app.config.ts:16-20` uses `loadChildren: () => import('./docs.routes')`):

```
__jsaction_bootstrap(document.body,"ng",["click","keydown","submit","input"],[])
```

```html
<button
  type="button"
  aria-haspopup="dialog"
  aria-keyshortcuts="Control+K Meta+K"
  class="doq-search-trigger"
  jsaction="click:;"
></button>
```

jsaction census for that file: `46 × jsaction="click:;"`, `1 × jsaction="click:;keydown:;"`,
`1 × jsaction="input:;"`, `1 × jsaction="submit:;"`.

`apps/site/dist/analog/public/index.html` — the landing page, which renders **no** Doqs component:

```
__jsaction_bootstrap(document.body,"ng",["click","pointerdown","pointerup","pointercancel","focusout"],[])
```

`apps/showcase-a/dist/analog/public/docs/components/button/index.html` — a page with a **playground**:

```
47 × jsaction="click:;"   3 × jsaction="change:;"   2 × jsaction="input:;"
 1 × jsaction="keydown:;" 1 × jsaction="submit:;"   1 × jsaction="click:;keydown:;"
```

and the consumer component rendered _inside_ the playground is annotated too:

```html
<div
  role="group"
  data-pagefind-ignore=""
  class="doq-playground"
  aria-labelledby="doq-playground-1-title"
  data-doq-playground="vanta-button"
>
  <button
    voltbutton=""
    type="button"
    data-variant="solid"
    data-size="md"
    class="... h-10 ..."
    jsaction="click:;"
  ></button>
</div>
```

Three conclusions follow directly:

1. **The bootstrap event-type list is per-page**, derived from that page's server-rendered views —
   landing and docs pages have different lists. A page that renders no `(click)` listener gets no
   `click` capture at all.
2. **Doqs library markup IS annotated**, including through a lazy route and including
   playground-instantiated consumer components. Condition (b) is satisfied in SSG output.
3. Nothing in this repo suppresses annotation: `grep -rn "ViewEncapsulation\|encapsulation" packages/doq/src/`
   and `grep -rn "ngSkipHydration" packages/doq/src/ apps/*/src/` both return **zero matches**.
   (`annotateHostElementForHydration`, `core.mjs:2496-2506`, forces `ngSkipHydration` for ShadowDom
   encapsulation or unsupported i18n — neither applies here.)

Hydration is configured identically in all three apps:
`apps/site/src/app/app.config.ts:28`, `apps/showcase-a/src/app/app.config.ts:55`,
`apps/showcase-b/src/app/app.config.ts:68` — all `provideClientHydration(withEventReplay())`.
`apps/site/vite.config.ts` sets `ssr: true, static: true` with `prerender: { routes: ... }`, so the
Doqs site is fully **prerendered (SSG)**, not dynamically server-rendered.

### 5. Official documentation

https://angular.dev/guide/hydration — "Capturing and replaying events", verbatim:

> When an application is rendered on the server, it is visible in a browser as soon as produced HTML
> loads. Users may assume that they can interact with the page, but event listeners are not attached
> until hydration completes. The Event Replay feature captures all events that happen before hydration
> and replays those events once hydration has completed.
>
> Event replay is enabled alongside [incremental hydration](guide/incremental-hydration). If you opt
> out of incremental hydration with `withNoIncrementalHydration()`, you can still enable event replay
> using the `withEventReplay()` function

and, under "How event replay works":

> The Event Replay is divided into three main phases:
>
> - **Capturing user interactions** — Prior to **Hydration**, Event Replay captures and stores all
>   interactions that the user may perform, such as clicks and other browser native events.
> - **Storing events** — The **Event Contract** keeps in memory all the interactions recorded in the
>   previous step, ensuring that they are not lost for later replay.
> - **Relaunch of events** — Once **Hydration** is complete, Angular re-invokes the captured events.
>
> Event replay supports _native browser events_, for example `click`, `mouseover`, and `focusin`. If
> you'd like to learn more about JSAction, the library that powers event replay, you can read more
> [on the readme](https://github.com/angular/angular/tree/main/packages/core/primitives/event-dispatch#readme).

**There is no documented limitation section.** The guide does not mention lazy-loaded routes,
`@defer` blocks, `ngSkipHydration`, imperative listeners, or element replacement anywhere in the
event-replay material. The `jsaction` attribute requirement, the `__jsaction_fns` element stash, the
`isConnected` guard and the single-flush-at-`whenStable` deadline are all **undocumented
implementation contracts** — discoverable only from source.

### 6. Relevant Angular issues

- **https://github.com/angular/angular/issues/62418** — _"Event replay doesn't work in a Zoneless
  application using dynamic imports when using `@defer` and incremental hydration."_ Closed as
  completed, **no linked fix/PR**. Root cause, @thePunderWoman, verbatim:

  > What's happening is you're essentially defer loading twice. You have your dynamic import happening
  > underneath a defer hydrate trigger. So the dynamic import happens on the server side and gets
  > serialized properly. But when it gets to the client side, when the hydration trigger fires, the
  > ngOnInit happens which re-dynamic imports and replaces the content before the event replay happens.
  > **Event Replay stashes the function to replay on the element itself, which gets looked up at replay
  > time. The element was completely replaced by the dynamic import, which means the stashed function is
  > gone and cannot be replayed.**
  >
  > Essentially this dynamic import pattern breaks how incremental hydration and event replay works.
  > You're actually losing the benefits of hydration, too, because you're re-loading and rendering the content.

  This is the **official confirmation of condition (c)** and of the element-replacement failure mode.
  It was closed as a usage problem, not fixed in the framework.

- **https://github.com/angular/angular/issues/60071** — _"EventReplay does not replay events listened
  on the document"_: `document`-level listeners are out of jsaction's scope. Directly relevant to
  `packages/doq/src/lib/doq-search.component.ts:72`, which uses
  `this.documentRef.addEventListener('keydown', listener)`.
- **https://github.com/angular/angular/issues/71518** — _"Event replay: early event contract listeners
  on `<body>` are never removed after hydration"_; the `__jsaction_bootstrap(document.body, ...)`
  listeners keep pushing into `window._ejsas[appId].q` with nothing reading it after replay (leak;
  also blocks GC of elements removed after a route change). Fix: `fix(core): remove early event
listeners after replay`.
- **https://github.com/angular/angular/issues/67328** — _"Event replay causes doubled interactions when
  elements…"_: events handled by already-hydrated components while the app is not yet "stable" are
  still replayed.
- **https://github.com/angular/angular/issues/70796** — _"cleanup after a `@defer` block hydrates runs
  before the app is [stable]"_: `<router-outlet>` + lazily loaded route with default non-blocking
  initial navigation; idle arrives while the router is still fetching the route.

## Analysis

### Why would a host navbar button replay but a Doqs button not?

Given that the host button replays, we know replay is enabled (`IS_EVENT_REPLAY_ENABLED` true), the
contract script was not removed, and — because the bootstrap list is app-page-global — `click` **is**
in the capture list. So condition (a) is satisfied for both elements, and the asymmetry must come from
(b) or (c), or from the listener shape. Enumerated against the evidence:

**(i) Imperative `addEventListener` listeners are not replayable — confirmed, platform.**
`collectDomEventsInfo` reads only `tView.cleanup`, i.e. listeners the compiler recorded from templates
and host bindings. A raw `nativeElement.addEventListener('click', …)` in `ngAfterViewInit` or inside an
`effect()` never appears there → no `jsaction` (b fails) → and it is not routed through
`stashEventListenerImpl` → no `__jsaction_fns` (c fails). Doubly excluded. Issue #60071 confirms the
same for `document`-level listeners.
_Applies to Doqs:_ the search dialog's `keydown` handler at `doq-search.component.ts:72` is
imperative on `document` and is definitively not replayable. The **trigger button is not** — it uses a
template `(click)="show()"` (`doq-search.component.ts:22`), which is the supported shape.

**(ii) Element replacement during hydration loses the stash — confirmed platform mechanism, and there
is a concrete library-side trigger in Doqs.** `invokeListeners` requires both `__jsaction_fns` on
`currentTarget` and `currentTarget.isConnected`. #62418 states the same in prose.
_Applies to Doqs:_ `packages/doq/src/lib/doq-playground.component.ts:29-46` —
`DoqPlaygroundOutletDirective.ngOnChanges()` calls `this.container.clear()` and then
`this.container.createComponent(component, { bindings })` whenever `definition` or `generation`
changes. `ViewContainerRef.clear()` destroys the SSR-rendered nodes; `createComponent` inserts new
ones. If `ngOnChanges` fires on the client during hydration, the element carrying `jsaction` +
`__jsaction_fns` is gone and the queued click has nowhere to land. **This is the strongest
library-side explanation for the "consumer button inside a Doqs playground" half of the report**, and
it is the exact pattern Angular documented in #62418.
_Does not apply to the search trigger:_ nothing in `doq-search.component.ts` clears or recreates the
trigger element.

**(iii) `@defer` blocks have a separate, lossy path — platform.** If `currentTarget` carries
`ngb="dN"`, replay goes through `hydrateAndInvokeBlockListeners` → `EVENT_REPLAY_QUEUE` →
`triggerHydrationFromBlockName` → `createReplayQueuedBlockEventsFn(queue)` (`core.mjs:1060-1080`),
which invokes listeners **only for blocks that actually hydrated** and silently re-queues the rest.
A block that never hydrates drops its events.
_Applies to Doqs:_ **no** — `grep` for `@defer` / `defer (` in `packages/doq/src/lib` returns nothing.

**(iv) Lazy _routes_ — platform, but disproved as the cause here.** A route component that is not part
of the server-rendered view tree is invisible to `collectDomEventsInfo`, so its elements get no
`jsaction`. But the prerendered `apps/site/dist/analog/public/docs/index.html` proves the lazy `/docs`
region **is** server-rendered and **is** annotated (46 `click` markers, search trigger included). So
lazy-route registration alone does not explain the report.

**(v) Timing / deadline — platform, real.** `initEventReplay` runs once, inside
`appRef.whenStable().then(...)`. Immediately after the flush it calls
`clearAppScopedEarlyEventContract(appId)` and, when incremental hydration is **off**,
`eventContract.cleanUp()` synchronously (`core.mjs:975-988`); when incremental hydration is on,
cleanup is deferred to `appRef.onDestroy`. So there _is_ a hard window: events are replayed exactly
once at first stability, and anything whose listener attaches after that flush is dropped. Note the
version asymmetry: incremental hydration is **opt-in in v21** (`withIncrementalHydration()`) and
**default-on in v22** (`withIncrementalHydration` deprecated, `withNoIncrementalHydration()` added).
Neither this repo's configs nor the reported consumer setup was verified to pin this down.

**(vi) Replay disabled / not provided — excluded** by the premise (host button replays) and by
`EVENT_REPLAY_ENABLED_DEFAULT = false` plus the explicit `withEventReplay()` in all three apps.

### Verdict: library defect or platform limitation?

**Split verdict — and the two halves of the report do not share a cause.**

- **The platform owns the architecture, and its limits are undocumented.** Dispatch is gated on a
  `jsaction` attribute written only for listeners found in `tView.cleanup` of server-rendered views;
  the replay function is stashed **on the DOM element**; replay fires exactly once at
  `appRef.whenStable()`. A library has **no public API** to register an element for replay, to add an
  event type to the contract, or to re-open the replay window. None of this appears in
  angular.dev/guide/hydration or on the `withEventReplay` API page. To that extent a missed
  pre-hydration click is an **Angular platform limitation**.
- **The search-button half is NOT explained by any library defect I can evidence.** This repo's own
  prerendered HTML carries `jsaction="click:;"` on `.doq-search-trigger`, `click` is in the bootstrap
  list, the trigger uses a template `(click)`, and there is no ShadowDom, no `ngSkipHydration`, no
  `@defer`, and no element replacement around it. On this evidence the library did its part. The
  remaining explanations are consumer-side or platform-side: the consumer's _served_ HTML differs from
  this repo's prerendered HTML (dynamic SSR where the Doqs region was not rendered, or
  `x-analog-no-ssr`, which `ANITRO/src/lib/utils/renderers.js` honours by returning the bare
  template), a client/server markup mismatch that made Angular discard and rebuild the node, or an
  Angular bug of the #67328/#71518 family.
- **The playground half has a concrete library-side trigger**: `container.clear()` +
  `createComponent()` in `ngOnChanges` (`doq-playground.component.ts:31-45`) reproduces the exact
  element-replacement failure Angular documented and closed as "not a framework bug" in #62418.
  That one is **ours to fix**.

### Evidence that would distinguish them

Ordered cheapest-first; each step isolates one of the three conditions.

1. **Fetch the served HTML** for the failing URL (`curl -s <url> | grep -o 'jsaction="[^"]*"'` and
   `grep -o '__jsaction_bootstrap([^)]*)'`).
   - No `__jsaction_bootstrap` at all → the contract script was removed: no replayable event types
     were collected on the server, or DOM reuse is disabled. Server/config problem.
   - Bootstrap present but `"click"` missing from the array → condition (a): the Doqs region was not
     part of the server-rendered view tree for that page.
   - Bootstrap has `"click"` but `.doq-search-trigger` has **no** `jsaction` → condition (b): the
     element was not in `collectDomEventsInfo`'s map — the component wasn't server-rendered, or an
     ancestor is in a skip-hydration block.
   - `jsaction="click:;"` present → SSR did its job; move to step 2. **(This is what this repo's own
     builds show.)**
2. **Before hydration**, in the console: `window._ejsas` → inspect `window._ejsas['ng'].q.length`
   after clicking. Not growing → capture failed (listener not on `document.body`'s subtree, something
   called `stopPropagation`, or the element is inside a shadow root/iframe). Growing → capture is fine.
3. **After hydration**: `const el = document.querySelector('.doq-search-trigger'); el.__jsaction_fns`
   and `el.isConnected`.
   - `__jsaction_fns` undefined or lacking a `click` key → condition (c): the stash never landed or
     the node was replaced. Compare `el` identity against the node you clicked
     (`window._ejsas['ng'].q[0].targetElement === el`) — **inequality is the smoking gun for element
     replacement.**
   - `isConnected === false` → node was detached/replaced.
4. **Check the replay actually fired**: temporarily log inside the handler, or inspect
   `event.eventPhase === 101` (`EventPhase.REPLAY`) in the handler to distinguish a replayed
   invocation from a live one.
5. **Control the version/mode variable**: repeat under v21 with `withIncrementalHydration()` and under
   v22 default-on, and with `withNoIncrementalHydration()`. `eventContract.cleanUp()` timing differs
   between them (`core.mjs:981-986`).

### Minimal reproduction that would prove it

Two components, one app, prerendered, JS delayed — deliberately minimal so nothing but the mechanism
is under test:

- `HostButton`: standalone, declared **eagerly** in the root component template, `<button (click)="n = n + 1">`.
- `LazyButton`: standalone, reached only through a **lazy route**, identical template.
- Optionally `RecreatedButton`: same, but wrapped in a directive whose `ngOnChanges` does
  `viewContainerRef.clear(); viewContainerRef.createComponent(Inner)` — the Doqs playground shape.

Steps: build with `ssr`/`prerender`, serve statically, throttle or block the JS bundle, click each
button pre-hydration, unblock, and record whether the counter incremented. Then dump the three
diagnostics above for each.

Expected outcomes and what each would mean:

| Result                                                                                          | Interpretation                                                                                                       |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Host replays, Lazy does not, and Lazy's HTML lacks `jsaction`                                   | Platform/config: lazy region absent from the server-rendered tree                                                    |
| Host replays, Lazy does not, but Lazy's HTML **has** `jsaction` and `__jsaction_fns` is missing | Platform bug in the replay path — file against `packages/core/src/hydration/`                                        |
| Host and Lazy both replay; only `RecreatedButton` fails                                         | Confirms #62418 element-replacement as the mechanism → **Doqs playground is a library defect, search button is not** |
| All three replay                                                                                | The defect is in the consumer's app/config, not in Doqs or Angular                                                   |

The third row is what the local evidence predicts.

### Safe mitigations that do not build a custom event queue

**Do not use `ngSkipHydration`.** It makes this strictly worse: `annotateHostElementForHydration`
(`core.mjs:2496-2506`) sets `SKIP_HYDRATION_ATTR_NAME` and returns `null`, and `serializeLView` skips
annotation for nodes inside a skip-hydration block (`isInSkipHydrationBlock` guards at
`core.mjs:2446`, `:2454`, `:2467`). No hydration → no `jsaction` → no `__jsaction_fns` → guaranteed
no replay, and the subtree is destroyed and re-rendered client-side.

**`@defer (on interaction)` / `@defer (hydrate on interaction)` is the supported opt-in**, and the only
mechanism Angular provides for "click before the code exists". Evidence:
`annotateDeferBlockRootNodesWithJsAction` (`core.mjs:2528-2541`) stamps `jsaction` from the hydrate
triggers and adds those event types to `eventTypesToReplay.regular`; on the client,
`invokeRegisteredReplayListeners` detects `ngb="dN"` and routes through
`hydrateAndInvokeBlockListeners` → `triggerHydrationFromBlockName` → replay once hydrated
(`core.mjs:1050-1080`). Caveats: it requires **incremental hydration** (default in v22, opt-in via
`withIncrementalHydration()` in v21), and events for blocks that never hydrate are dropped by
`createReplayQueuedBlockEventsFn`.

**Declaring the component eagerly helps only conditionally.** It guarantees the component is in the
server-rendered view tree, so `collectDomEventsInfo` sees its listeners and emits `jsaction`. Since the
prerendered HTML already proves Doqs is server-rendered and annotated through a lazy route, eager
registration would change nothing for this repo. It _would_ matter for a consumer whose Doqs region is
genuinely absent from SSR output.

**Use template/host-binding listeners for anything that must work pre-hydration.** Only those land in
`tView.cleanup` and get stashed. Never `addEventListener` in `ngAfterViewInit`/`effect()` for a
control a user might click before hydration.

**Do not replace DOM nodes during hydration.** This is the actionable fix for the playground: avoid
`container.clear()` + `createComponent()` on the client when SSR already rendered that content.
Concretely — recreate only when the definition/generation genuinely changed _and_ hydration has
completed, or reuse the existing `ComponentRef` and re-bind inputs instead of tearing down. The
existing `inputBinding`/`outputBinding` design already follows the `values` signal without recreation
(see the class doc comment at `doq-playground.component.ts:8-15`); the residual risk is the
`changes['definition'] || changes['generation']` branch firing during the hydration pass.

**Keep interactive elements out of `@if` branches whose server/client shape can diverge.** A mismatch
makes Angular discard and rebuild the node, losing the stash. Relevant here:
`doq-docs.component.ts:86,88` branch on `config.landmark === 'host'` and wrap content in
`*ngTemplateOutlet` / `*ngComponentOutlet` (`:62,70,74`). `config` must resolve identically on server
and client.

**Accept and document the residual platform limit.** A pre-hydration click on a control inside
dynamically created content is not guaranteed by Angular, is not documented by Angular, and cannot be
fixed from a library. The honest deliverable is a documented limitation plus the playground fix — not
a custom event queue, which would double-fire against Angular's own replay (see #67328).

## Recommended implementation for the library

1. **Fix the playground outlet (library defect, in scope).** In
   `packages/doq/src/lib/doq-playground.component.ts`, stop destroying SSR-rendered nodes during the
   hydration pass. Gate `create()` so the initial client-side `ngOnChanges` does not
   `container.clear()` when a `ComponentRef` already exists for the same `definition`; recreate only on
   a genuine `generation` change (reset) or after hydration. Add a regression test that asserts the
   preview element identity survives hydration.
2. **Add an E2E assertion on the emitted contract**, not on replay behaviour. A Playwright test that
   builds a showcase and asserts (a) `__jsaction_bootstrap(document.body,…)` includes `"click"` and
   (b) `.doq-search-trigger` carries `jsaction="click:;"` locks in conditions (a) and (b) cheaply and
   fails loudly if a future change suppresses annotation. This is deterministic; asserting an actual
   pre-hydration replay is timing-sensitive and belongs in the repro app, not CI.
3. **Document the limitation** in `packages/doq/README.md` and the site's docs: pre-hydration clicks
   are replayed by Angular only for template/host-binding listeners on server-rendered, non-replaced
   elements; `document`-level and imperative listeners are never replayed (cite #60071); dynamically
   recreated content loses replay (cite #62418). State that Doqs does not implement its own queue and
   why.
4. **Ask the consumer for the served HTML** before accepting the search-button report as a Doqs bug.
   The five-step diagnostic above is the reply to send them. If their HTML lacks `jsaction` on the
   trigger, the fault is in their SSR/render configuration, not in Doqs.
5. **Do not** add `ngSkipHydration`, and do not introduce `@defer` solely to chase replay — `@defer`
   is justified by bundle-size/interaction latency goals, and adopting it also changes the hydration
   contract for the whole region.

## Unknowns / UNVERIFIED

- **Which Angular version introduced `withEventReplay()`.** Not stated in the v21 or v22 typings, and
  https://angular.dev/api/platform-browser/withEventReplay shows no "introduced in" annotation.
  UNVERIFIED — do not put a version number in user-facing docs without checking the changelog.
- **The consumer's actual environment.** Their Angular version (21 vs 22), whether incremental
  hydration was on, whether they run dynamic SSR or prerender, and their served HTML were not
  available. `cleanUp()` timing and the defer/replay branch differ between v21 and v22.
- **Whether the consumer's Doqs region is server-rendered at all.** If they use `x-analog-no-ssr`
  (honoured in `ANITRO/src/lib/utils/renderers.js`) or a client-only route, no `jsaction` is emitted
  and the failure is fully explained without any Angular bug.
- **No runtime browser experiment was performed.** All replay behaviour above is derived from source
  plus this repo's committed build output. The three-condition model is well-evidenced but has not
  been executed; the minimal repro is specified precisely so it can be.
- **Angular 22 replay path differences beyond what was diffed.** The event-type lists,
  `EVENT_REPLAY_ENABLED_DEFAULT`, and the `withEventReplay` JSDoc were verified identical between
  21.2.25 and 22.2.3. `initEventReplay`, `invokeListeners` and `dispatchToDelegate` were read in 21
  only and **not** line-diffed against 22. UNVERIFIED whether 22 changed the flush/cleanup ordering.
- **Whether the fixes for #71518 / #67328 landed in 21.2.25 or 22.2.3.** Issue states were reported by
  search; the corresponding commits were not located in the installed sources.

---

# `RESPONSE_INIT` and SSR 404 status

## Verified facts

### 1. Real declaration

`CORE21/types/core.d.ts:9394-9416`. **Byte-identical in `CORE22/types/core.d.ts:3040-3062`** apart
from line numbers:

```ts
type ResponseInit = {
  -readonly [P in keyof globalThis.ResponseInit]: globalThis.ResponseInit[P];
};
/**
 * Injection token for response initialization options.
 *
 * Use this token to provide response options for configuring or initializing
 * HTTP responses in server-side rendering or API endpoints.
 *
 * @remarks
 * This token may be `null` in the following scenarios:
 *
 * * During the build processes.
 * * When the application is rendered in the browser (client-side rendering).
 * * When performing static site generation (SSG).
 * * During route extraction in development (at the time of the request).
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Response/Response `ResponseInit` on MDN}
 *
 * @publicApi
 * @see [Accessing Request and Response via DI](guide/ssr#accessing-request-and-response-via-di)
 */
declare const RESPONSE_INIT: InjectionToken<ResponseInit | null>;
```

- Exact type: `InjectionToken<ResponseInit | null>`, where `ResponseInit` is a **mapped type that
  strips `readonly`** from `globalThis.ResponseInit`. The `-readonly` modifier is deliberate: the
  token hands you a _writable_ object. That is the design signal that you **mutate** it rather than
  provide your own.
- `@publicApi`, **not** developer-preview, in both 21 and 22. Exported publicly from `@angular/core`
  (`CORE21/types/core.d.ts:9455`, `CORE22/types/core.d.ts:9699` — plain `RESPONSE_INIT`, no `ɵ`).
- **Which version added it: UNVERIFIED** — no version annotation in either typings file.

Runtime definition, `CORE21/fesm2022/core.mjs:2912-2923`:

```js
const REQUEST = new InjectionToken(…'REQUEST'…, {
  providedIn: 'platform',
  factory: () => null
});
const RESPONSE_INIT = new InjectionToken(…'RESPONSE_INIT'…, {
  providedIn: 'platform',
  factory: () => null
});
const REQUEST_CONTEXT = new InjectionToken(…'REQUEST_CONTEXT'…, {
  providedIn: 'platform',
  factory: () => null
});
```

**The default value is `null`, at platform scope.** Something else must provide a real object.

### 2. Documented contract

https://angular.dev/guide/ssr, section "Accessing Request and Response via DI":

> - **`REQUEST`**: Provides access to the current request object (Web API `Request` type). Allows access to headers, cookies, and other request information.
> - **`RESPONSE_INIT`**: Provides access to response initialization options (Web API `ResponseInit` type). Allows you to set headers and the status code for the response dynamically at runtime.
> - **`REQUEST_CONTEXT`**: Provides access to additional context related to the current request, passed as the second parameter of the `handle` function. Used for request-related info not part of the standard Web API.

The guide's only verbatim code sample in that section injects `REQUEST`:

```typescript
import { inject, REQUEST, Component } from '@angular/core';

@Component({
  selector: 'app-my-component',
  template: `<h1>My Component</h1>`,
})
export class MyComponent {
  constructor() {
    const request = inject(REQUEST);
    console.log(request?.url);
  }
}
```

and, verbatim:

> **IMPORTANT:** The above tokens will be `null` in the following scenarios:
>
> - During the build processes.
> - When the application is rendered in the browser (CSR).
> - When performing static site generation (SSG).
> - During route extraction in development (at the time of the request).

**The guide does not contain a verbatim example of setting a 404 via DI.** Its separate "Setting
headers and status codes" section uses a _static_ `status: 201` in a `ServerRoute` configuration
array — an `@angular/ssr` feature, not DI, and not available here (`@angular/ssr` is not installed).

The mutate-the-injected-object shape is the one published on the API page
(https://angular.dev/api/core/RESPONSE_INIT), reported by search as:

```typescript
import { inject, RESPONSE_INIT } from '@angular/core';

export class PageNotFoundComponent {
  private responseInit = inject(RESPONSE_INIT);
  constructor() {
    if (this.responseInit) {
      this.responseInit.status = 404;
      this.responseInit.headers = { 'Cache-Control': 'no-cache' };
    }
  }
}
```

Attribution note: I fetched `guide/ssr` directly; the `api/core/RESPONSE_INIT` snippet above came via
a search agent that reported opening that page. Treat the snippet as **search-reported**, though it is
consistent with the `-readonly` mapped type, which only makes sense if callers assign to it.

**You do not provide your own `ResponseInit`.** You inject the server-provided one and mutate
`.status` / `.headers`. The null-guard is mandatory.

### 3. When is it `null`

Four cases, identically documented in the JSDoc and the guide: build processes, browser CSR, SSG, and
dev-time route extraction. Plus the structural case that matters most here: **whenever no server
framework provided it** — because the platform-scoped factory returns `null`.

### 4. Does mutation reach the HTTP response?

**(a) `@angular/ssr` node server — cannot verify locally: `@angular/ssr` is NOT installed.** There is
no `@angular+ssr@*` directory under `node_modules/.pnpm`. UNVERIFIED for this workspace; the
guide/API pages imply it works there.

**(b) Analog.js — NO. Verified decisively.**

A repo-wide search for the identifier across every installed package:

```
cd node_modules/.pnpm && grep -rl "RESPONSE_INIT" --include=*.mjs --include=*.js --include=*.cjs --include=*.d.ts . | grep -v '\.map'
```

returns **only `@angular/core`** (the 21.2.25 ×2 peer variants and 22.2.3). No Analog package, no
`@angular/platform-server`, nothing else references the token. **Nobody in this stack provides it, so
`inject(RESPONSE_INIT)` always resolves to the platform default `null`.** Mutating it throws
`TypeError: Cannot set properties of null`.

What Analog provides instead — `AROUTER/fesm2022/analogjs-router-server.mjs:180-208`:

```js
function provideServerContext({ req, res }) {
	const baseUrl = getBaseUrl(req);
	const locale = … detectLocale(req);
	if (import.meta.env?.DEV) ɵresetCompiledComponents();
	return [
		{ provide: ɵSERVER_CONTEXT, useValue: "ssr-analog" },
		{ provide: REQUEST,  useValue: req },
		{ provide: RESPONSE, useValue: res },
		{ provide: BASE_URL, useValue: baseUrl },
		{ provide: SERVER_FN_DISPATCHER, useValue: createServerFnDispatcher(req, res) },
		...locale ? [{ provide: LOCALE, useValue: locale }] : []
	];
}
```

`REQUEST`/`RESPONSE` here are **Analog's own tokens** from `@analogjs/router/tokens`, not Angular's —
`AROUTER/types/analogjs-router-tokens.d.ts:20`:

```ts
export declare const RESPONSE: InjectionToken<ServerResponse>;
```

i.e. the raw Node `ServerResponse`. There is no `RESPONSE_INIT` and no `REQUEST_CONTEXT`.

The render functions return **HTML only**, never a status
(`AROUTER/fesm2022/analogjs-router-server.mjs:250-262` and `:610-650`):

```js
function render(rootComponent, config, platformProviders = []) {
  function bootstrap(context) {
    return bootstrapApplication(rootComponent, config, context);
  }
  return async function render(url, document, serverContext) {
    resetComponentDefTViews();
    return await renderApplication(bootstrap, {
      document,
      url,
      platformProviders: [provideServerContext(serverContext), platformProviders],
    });
  };
}
```

And the Nitro/h3 layer never sets a status either — `ANITRO/src/lib/utils/renderers.js`:

```js
export const ssrRenderer = `
import { eventHandler, getResponseHeader } from 'h3';
import renderer from '#analog/ssr';
import template from '#analog/index';

export default eventHandler(async (event) => {
  const noSSR = getResponseHeader(event, 'x-analog-no-ssr');
  if (noSSR === 'true') { return template; }
  const html = await renderer(event.node.req.url, template, {
    req: event.node.req,
    res: event.node.res,
  });
  return html;
});`;
```

`createSsrStreamRenderer()` sets `content-type`, and for streaming `content-encoding: identity` and
`cache-control: no-store, no-transform` — but **no status code anywhere**. `clientRenderer` returns the
template untouched. The only status handling in the whole plugin is
`apiMiddleware`'s `createError({ statusCode: 400, statusMessage: 'Invalid API route' })` for SSRF
rejection.

Analog _does_ set statuses for `serverFn` endpoints, which proves the pattern is available in its
runtime (`analogjs-router-server.mjs:727` and `:734`):

```js
event.node.res.statusCode = 400;   // malformed request body
…
event.node.res.statusCode = status; // from dispatchServerFn's { status, body, headers }
```

**Conclusion: Analog 2.9.0 does not propagate `RESPONSE_INIT`.** The supported Analog levers for a
page-render 404 are Analog's `RESPONSE` token (`inject(RESPONSE)` → `res.statusCode = 404`) or
h3's `setResponseStatus(event, 404)` from a Nitro server route/middleware.

Also relevant: `renderers.js` honours an `x-analog-no-ssr` response header by returning the bare
template with no Angular render at all — a second way the Doqs region can be missing from served HTML.

### 5. Does the status survive prerendering/SSG?

**No — it is a no-op, and for a static site it is also unnecessary.**

- `RESPONSE_INIT` is documented `null` during SSG and during build, so there is nothing to mutate; a
  guarded write simply does not execute. It is not an error, provided the null-guard is present. An
  _unguarded_ write would throw during prerender and fail the build.
- Structurally, a prerendered site has no per-request response object at all: the file is written to
  disk once. For an unknown URL **no file exists**, so the static host returns its own 404 — Angular
  never runs.
- This repo is exactly that case. `apps/site/vite.config.ts`:

```ts
analog({
  ssr: true,
  static: true,
  content: { highlighter: 'prism' },
  prerender: { routes: async () => [...site.routes, ...doqPrerenderRoutes(doqPaths)] },
}),
```

and `apps/site/dist/analog/public/**/index.html` are committed build outputs. The Doqs site deploys
to Cloudflare Pages (per `AGENTS.md` → `docs/operations/release-and-deployment.md`). So an unknown
`/docs/...` URL is a missing static file → host-level 404. **A library-side 404 status is
unachievable and unnecessary for `apps/site`.** It matters only for consumers running Analog dynamic
SSR, or their own Node/`@angular/ssr` server.

### 6. Cross-request state leakage

- The **default** is safe by construction: `providedIn: 'platform'` + `factory: () => null` means
  there is no shared object to leak until a server framework provides one.
- Under **Analog**, `provideServerContext(serverContext)` is invoked _inside_ the per-request closure
  returned by `render()` / `renderStream()` (`analogjs-router-server.mjs:250-262`, `:610-650`), and
  `ANITRO/src/lib/utils/renderers.js` calls that closure per request. So Analog's `REQUEST`/`RESPONSE`
  are per-request. Since Analog never provides `RESPONSE_INIT`, **no shared mutable `ResponseInit`
  exists in this stack** — leakage is not a live risk here.
- For `@angular/ssr`, per-request provisioning of `RESPONSE_INIT` is the documented intent, but the
  package is not installed → **UNVERIFIED locally**.
- The risk becomes real only if Doqs (or a host) provides its **own** `ResponseInit` at platform or
  root scope. Safe pattern: provide a **fresh object per request via a factory**, never a
  module-level singleton:

```ts
// WRONG — one object shared by every request on the server
const shared: ResponseInit = {};
provideAppInitializer(() => { /* … uses shared … */ });

// RIGHT — new object per injector instantiation
{ provide: RESPONSE_INIT, useFactory: () => ({ status: 200 }) }
```

and prefer Analog's already-per-request `RESPONSE` over introducing a shared object at all.

### 7. Alternatives that actually exist in the installed versions

Verified by grepping the installed typings:

- **No `notFound()` helper and no status API** in `@angular/core`, `@angular/common`, or
  `@angular/router` at 21.2.25 or 22.2.3. Searched for `declare function notFound*`,
  `NOT_FOUND_ROUTE`, `declare function setStatus*` across
  `@angular+router@{21.2.25,22.2.3}` and `@angular+common@{21.2.25,22.2.3}` typings → **zero matches**.
- `HttpResponse<T>` and `HttpErrorResponse` **do** exist (`@angular/common/types/http.d.ts`,
  `declare class HttpResponse<T>`, `declare class HttpErrorResponse`). They are **client-side HTTP
  types**; constructing or throwing them does not affect the SSR response status. Not a mechanism.
- `@angular/router` has no status/404 concept. The idiomatic Angular approach is a wildcard route
  rendering a not-found view — which Doqs already does
  (`packages/doq/src/lib/doq-docs.component.ts:29` `<ng-template #notFound>`, rendered at `:86` and
  `:88`). The status code is the _server's_ concern, not the router's.
- `@angular/ssr`'s `ServerRoute` config supports a static `status` (documented in guide/ssr, "Setting
  headers and status codes"), but **`@angular/ssr` is not installed** → unavailable here.
- Analog-specific: `RESPONSE` (`InjectionToken<ServerResponse>`, `@analogjs/router/tokens`);
  `serverFn` handlers may return `{ status, body, headers }`
  (`analogjs-router-server.mjs:730-736`); h3's `setResponseStatus` / `createError` inside Nitro server
  routes and middleware.

## Analysis

The engineer's plan — "inject `RESPONSE_INIT` and set `.status = 404`" — **will not work in this
stack**, for a reason that is easy to miss because the token is public, stable, and correctly typed:
nothing in the Analog 2.9.0 dependency graph provides it, so the platform-scoped factory returns
`null` on every request. An unguarded `responseInit.status = 404` throws; a guarded one silently does
nothing. Either way the response stays 200.

This is not an Analog bug so much as a scope mismatch: `RESPONSE_INIT` is the contract between
Angular's _own_ SSR engine (`@angular/ssr`) and applications. Analog implements its own server on
Nitro/h3 and exposes the Node primitives instead (`RESPONSE` → `ServerResponse`). A library that
targets "Angular + Analog" cannot rely on `RESPONSE_INIT` alone.

There is also a second, independent obstacle: for the Doqs **site** the question is moot, because the
site is prerendered. `RESPONSE_INIT` is documented `null` under SSG, and an unknown URL is a missing
static file whose 404 comes from Cloudflare Pages. Any 404 work here only pays off for _consumers_
running dynamic SSR.

Finally, `@doqs/analog` peers on `@analogjs/content` but **not** on `@analogjs/router`
(`packages/doq/package.json`: peers are `@analogjs/content`, `@angular/common`, `@angular/core`,
`@angular/platform-browser`, `@angular/router`, `rxjs`, optional `pagefind`/`typescript`). Its only
Analog imports are `@analogjs/content` (`doq-docs.component.ts:6`, `doq-tabs.component.ts:2`,
`doq-catalog.ts:3`). So importing `RESPONSE` from `@analogjs/router/tokens` directly would introduce
an **undeclared dependency** and break the "consumer independence" and public-contract rules in
`AGENTS.md`. Whatever the fix, it must not hard-import `@analogjs/router`.

## Recommended implementation for the library

**Do not use `RESPONSE_INIT` as the primary mechanism.** Design for both stacks without adding a peer
dependency:

1. **Write to `RESPONSE_INIT` optionally, and expose a host-implemented sink.** In the not-found path
   of `packages/doq/src/lib/doq-docs.component.ts` (the `@else` branches at `:86` and `:88`, which
   render `<ng-template #notFound>`), during SSR only — the component already injects `PLATFORM_ID`
   and `isPlatformBrowser` (`:1`) — do:

   ```ts
   const responseInit = inject(RESPONSE_INIT, { optional: true });
   if (isPlatformServer(this.platformId) && responseInit) responseInit.status = 404;
   ```

   `RESPONSE_INIT` comes from `@angular/core`, already a peer, so this is free and additive. It does
   nothing under Analog (always `null`) and works under `@angular/ssr` hosts.

2. **Add an optional injection token for the Analog bridge**, e.g. a `DoqServerStatusReporter`
   (or a `DOQ_RESPONSE_STATUS` writable signal) with a **no-op default provider**. The library calls
   `reporter.setNotFound()` from the same place. Hosts on Analog wire it once in their app config:

   ```ts
   // host app, Analog SSR only — this import lives in the HOST, not in the library
   import { RESPONSE } from '@analogjs/router/tokens';
   { provide: DoqServerStatusReporter, useFactory: () => {
       const res = inject(RESPONSE, { optional: true });
       return { setNotFound: () => { if (res && !res.headersSent) res.statusCode = 404; } };
   } }
   ```

   This keeps `@analogjs/router` out of the library's dependency graph, satisfies consumer
   independence, and is purely additive to the public contract (record it with
   `pnpm public-api:update` and document it in `packages/doq/README.md` +
   `packages/doq/CHANGELOG.md`, per `AGENTS.md`).

3. **Guard against `ERR_HTTP_HEADERS_SENT`.** Under Analog's streaming renderer,
   `createSsrStreamRenderer()` sets `content-type` _after_ `renderer(...)` resolves and returns a
   stream; if the first chunk already flushed, a late `statusCode` assignment can throw. Check
   `res.headersSent` (as above) and set the status as early as possible in the not-found path. For
   buffered routes (`streaming: false`, and all prerender routes) the HTML is fully collected before
   return, so the status is still settable. **Verify at runtime — see Unknowns.**

4. **Set the status from a `@defer`-free, SSR-reachable code path.** It must run during the server
   render, not in a browser-only effect, and must not depend on client-side routing events.

5. **Document the prerender reality.** For static/SSG deployments — including the Doqs site itself —
   state plainly that the library cannot influence the status code and the host returns its own 404
   for a missing file; recommend configuring the host's 404 page. Recommend the Analog
   `routeRules`/`prerender` 404 pattern
   (https://analogjs.org/docs/features/server/server-side-rendering) for consumers who want one.

6. **Do not** throw `HttpErrorResponse`, and do not add a custom `notFound()` that pretends to be a
   platform API. Neither affects the SSR response status in the installed versions.

## Unknowns / UNVERIFIED

- **Which Angular version added `RESPONSE_INIT`.** No annotation in the 21.2.25 or 22.2.3 typings.
  UNVERIFIED.
- **`@angular/ssr` behaviour.** The package is not installed, so its per-request provisioning of
  `RESPONSE_INIT`, its `ServerRoute` `status` support, and whether mutation reliably reaches the
  socket could not be read from source. UNVERIFIED locally; only the angular.dev guide/API pages
  describe it.
- **Whether Analog's streaming SSR tolerates a status change after the first flush.** Inferred from
  reading `createSsrStreamRenderer()` in `ANITRO/src/lib/utils/renderers.js`; **not executed**. Needs
  a runtime test against a real Analog SSR server (`res.headersSent` at the moment the not-found view
  renders).
- **Whether Analog's dev server (`vite dev`) behaves like the Nitro production renderer.** Only the
  production `renderers.js` templates and `dev-server-plugin.js`/`register-dev-middleware.js`
  filenames were located; the dev middleware's status handling was **not read**. UNVERIFIED.
- **Whether a newer Analog (≥2.10) adds `RESPONSE_INIT` support.** Only 2.9.0 is installed. The
  Analog repo/docs were searched but no `RESPONSE_INIT` support was found; a targeted check of
  https://github.com/analogjs/analog for `RESPONSE_INIT` was **not** performed against latest `main`.
- **No runtime HTTP status test was run** for either topic. All conclusions come from reading
  installed sources, this repo's committed prerendered HTML, and official docs/issues.

---

## Sources

- https://angular.dev/guide/hydration
- https://angular.dev/api/platform-browser/withEventReplay
- https://angular.dev/guide/ssr
- https://angular.dev/api/core/RESPONSE_INIT
- https://angular.dev/guide/incremental-hydration
- https://github.com/angular/angular/issues/62418
- https://github.com/angular/angular/issues/60071
- https://github.com/angular/angular/issues/71518
- https://github.com/angular/angular/issues/67328
- https://github.com/angular/angular/issues/70796
- https://github.com/angular/angular/tree/main/packages/core/primitives/event-dispatch#readme
- https://analogjs.org/docs/features/server/server-side-rendering
- https://github.com/analogjs/analog/issues/1279

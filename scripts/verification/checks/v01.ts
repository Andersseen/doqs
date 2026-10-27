import assert from 'node:assert/strict';
import type { Page } from '../lib/page.ts';
import type { VerifiedApp } from '../lib/types.ts';
import { waitFor } from '../lib/wait.ts';

export async function v01(page: Page, app: VerifiedApp) {
  const x = app.v01;
  assert.ok(x, `${app.name}: no 0.1 expectations configured (set MVP_CONSUMER_V01 for the external consumer)`);
  const base = `http://127.0.0.1:${app.port}`;
  const head = () =>
    page.evaluate(
      "({title:document.title,description:document.querySelector('meta[name=description]')?.content??null,h1:[...document.querySelectorAll('h1')].length,h1Text:document.querySelector('h1')?.textContent.trim()})",
    );
  const count = (selector: string) => page.evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
  const waitTitle = (title: string, label: string) =>
    waitFor(async () => (await page.evaluate('document.title')) === title, `${label} title "${title}"`);
  for (const [w, h] of [
    [1440, 900],
    [375, 812],
  ] as const) {
    await page.viewport(w, h);
    // Direct load of a document: suffix, slot, single h1.
    await page.navigate(base + app.doc);
    let state = await head();
    const docHeading = state.h1Text;
    assert.equal(state.title, `${docHeading} · ${x.suffix}`, `direct document title at ${w}px`);
    assert.equal(state.h1, 1, 'exactly one h1 on a document');
    assert.equal(await count(x.docSlot), 1, 'document slot renders exactly once');
    assert.equal(
      await page.evaluate(
        `(()=>{const a=document.querySelector('.doq-markdown'),s=document.querySelector(${JSON.stringify(x.docSlot)});return !!(a.compareDocumentPosition(s)&Node.DOCUMENT_POSITION_FOLLOWING)})()`,
      ),
      true,
      'document slot follows the Markdown content',
    );
    // Index: presentation copy, index slot before cards, single h1, no document slot.
    await page.navigate(base + (x.docsBase || '/'));
    state = await head();
    assert.equal(state.h1Text, x.indexTitle, 'index heading');
    assert.equal(state.title, x.indexTitle, 'index title');
    assert.equal(state.h1, 1, 'exactly one h1 on the index');
    assert.equal(await count(x.indexSlot), 1, 'index slot renders exactly once');
    assert.equal(await count(x.docSlot), 0, 'document slot absent on the index');
    assert.equal(
      await page.evaluate(
        `(()=>{const s=document.querySelector(${JSON.stringify(x.indexSlot)}),g=document.querySelector('.doq-index-grid');return !!(s.compareDocumentPosition(g)&Node.DOCUMENT_POSITION_FOLLOWING)})()`,
      ),
      true,
      'index slot sits before the document cards',
    );
    assert.ok((await count('.doq-index-card')) > 0, 'index cards still render');
    assert.ok(
      state.description && state.description !== x.hostDescription,
      'index description comes from presentation config',
    );
    if (w === 375) continue;
    // Client navigation index → document → document → index → host route; metadata follows each step.
    await page.click('.doq-index-card');
    await waitFor(async () => (await count('.doq-markdown')) > 0, 'document after index card click');
    state = await head();
    await waitTitle(`${state.h1Text} · ${x.suffix}`, 'card navigation');
    const firstTitle = state.title;
    await page.evaluate(
      "(()=>{document.querySelectorAll('details.doq-nav-group').forEach(d=>d.setAttribute('open',''));const l=[...document.querySelectorAll('.doq-nav-link:not(.is-active)')].find(e=>e.getClientRects().length&&!e.closest('details:not([open])'));l.setAttribute('data-v01-target','')})()",
    );
    await page.click('[data-v01-target]');
    await waitFor(
      async () => (await page.evaluate('document.title')) !== firstTitle,
      'title change after sidebar navigation',
    ).catch(async (e) => {
      throw new Error(
        e.message +
          ' ' +
          JSON.stringify(
            await page.evaluate(
              "({path:location.pathname,title:document.title,target:document.querySelector('[data-v01-target]')?.getAttribute('href'),hit:(()=>{const t=document.querySelector('[data-v01-target]'),r=t.getBoundingClientRect(),e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return [r.x,r.y,r.width,r.height,e?.outerHTML.slice(0,120)]})()})",
            ),
          ),
      );
    });
    state = await head();
    assert.equal(state.title, `${state.h1Text} · ${x.suffix}`, 'title after client navigation');
    const described = await page.evaluate(
      "document.querySelector('.doq-article .doq-description')?.textContent.trim()??null",
    );
    assert.equal(
      state.description,
      described ?? x.hostDescription,
      'description matches the visible document, never a stale one',
    );
    if (x.noDescriptionPath) {
      await page.evaluate(
        `document.querySelector('.doq-nav-link[href="${x.noDescriptionPath}"]').closest('details.doq-nav-group:not([open])')?.setAttribute('open','')`,
      );
      await page.click(`.doq-nav-link[href="${x.noDescriptionPath}"]`);
      await waitFor(
        async () => (await page.evaluate('location.pathname')) === x.noDescriptionPath,
        'no-description route',
      );
      await waitFor(
        async () =>
          await page.evaluate(
            "document.querySelector('h1')?.textContent.trim()==='Changelog'&&document.querySelector('.doq-markdown')?.childElementCount>0",
          ),
        'no-description content',
      );
      state = await head();
      assert.equal(await page.evaluate("!!document.querySelector('.doq-article .doq-description')"), false);
      assert.equal(
        state.description,
        x.hostDescription,
        'a document without description falls back to the host description',
      );
    }
    await page.click('.doq-overview');
    await waitFor(
      async () => (await page.evaluate('document.title')) === x.indexTitle,
      'index title after client navigation',
    );
    await waitFor(async () => (await count(x.indexSlot)) === 1, 'index slot after client navigation');
    await page.click('.doq-index-card');
    await waitFor(async () => (await count('.doq-markdown')) > 0, 'document after second card click');
    if (x.hostRoute) {
      await page.click('a[href="/"]');
      await waitFor(async () => (await page.evaluate('location.pathname')) === '/', 'host route');
      await waitFor(
        async () => (await page.evaluate('document.title')) === x.hostTitle,
        'host title restored after leaving docs',
      );
      state = await head();
      assert.equal(state.description, x.hostDescription, 'host description restored after leaving docs');
      // Direct document load then leave: the host values must come from the server capture, not the doc head.
      await page.navigate(base + app.doc);
      await page.click('a[href="/"]');
      await waitFor(
        async () => (await page.evaluate('document.title')) === x.hostTitle,
        'host title restored after hydrated doc',
      );
      state = await head();
      assert.equal(state.description, x.hostDescription, 'host description restored after hydrated doc');
    }
    // Unknown document route (client-side): not-found metadata, no stale title.
    await page.navigate(base + app.doc);
    await page.evaluate(
      `history.pushState({},'','${x.docsBase}/not-a-real-page');dispatchEvent(new PopStateEvent('popstate'))`,
    );
    if (x.unknownRouteOwnedByHost) {
      await waitFor(
        async () => (await page.evaluate('location.pathname')) === `${x.docsBase}/not-a-real-page`,
        'unknown route delegated to host router',
      );
      assert.equal(await count('.doq-not-found'), 0, 'Doqs leaves unknown routes to the host router');
      continue;
    }
    await waitFor(async () => (await count('.doq-not-found')) > 0, 'not-found view');
    await waitTitle(`Page not found · ${x.suffix}`, 'not found');
  }
}

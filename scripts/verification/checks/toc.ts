import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import type { Page } from '../lib/page.ts';
import type { Showcase } from '../lib/types.ts';
import { waitFor } from '../lib/wait.ts';

export async function toc(page: Page, app: Showcase) {
  if (!app.toc) {
    await page.navigate(`http://127.0.0.1:${app.port}${app.doc}`);
    assert.equal(
      await page.evaluate("!!document.querySelector('.doq-toc')"),
      false,
      'showTableOfContents=false should suppress TOC',
    );
    return;
  }
  await page.viewport(1440, 900);
  await page.navigate(`http://127.0.0.1:${app.port}${app.tocPath}`);
  await page.evaluate('window.scrollTo(0,0)');
  await delay(200);
  const anchors = await page.evaluate<{ headings: { id: string; tag: string }[]; links: string[]; all: boolean }>(
    "(()=>{const h=[...document.querySelectorAll('.doq-markdown h2,.doq-markdown h3')],a=[...document.querySelectorAll('.doq-toc a')];return{headings:h.map(x=>({id:x.id,tag:x.tagName})),links:a.map(x=>x.getAttribute('href')),all:a.length>0&&a.every(x=>{const id=decodeURIComponent(x.hash.slice(1));return !!document.getElementById(id)})}})()",
  );
  assert.ok(anchors.all, 'TOC entries must match real headings');
  assert.ok(anchors.headings.some((x) => x.tag === 'H2'));
  assert.ok(anchors.headings.some((x) => x.tag === 'H3'));
  const link = await page.evaluate("document.querySelector('.doq-toc a')?.getAttribute('href')");
  assert.ok(link);
  await page.click('.doq-toc a');
  await waitFor(
    async () => await page.evaluate(`location.hash===${JSON.stringify(new URL(link, 'http://localhost').hash)}`),
    'TOC fragment update',
  );
  const target = await page.evaluate(
    '(()=>{const e=document.getElementById(decodeURIComponent(location.hash.slice(1)));return{top:e?.getBoundingClientRect().top,scroll:scrollY,id:e?.id}})()',
  );
  assert.ok(target.id && target.scroll > 0, 'TOC click should scroll to target');
  await page.navigate(`http://127.0.0.1:${app.port}/docs/verification/toc-fixture`);
  await page.evaluate('window.scrollTo(0,0)');
  await waitFor(
    async () => await page.evaluate("document.querySelectorAll('.doq-toc a').length>0"),
    'TOC rendered after route change',
  );
  const duplicate = await page.evaluate(
    "(()=>{const h=[...document.querySelectorAll('.doq-markdown h2,.doq-markdown h3')],a=[...document.querySelectorAll('.doq-toc a')];return{ids:h.map(x=>x.id),links:a.map(x=>x.hash),match:a.every(x=>document.getElementById(decodeURIComponent(x.hash.slice(1))))}})()",
  );
  assert.equal(new Set(duplicate.ids).size, duplicate.ids.length, 'duplicate headings must receive unique IDs');
  assert.ok(duplicate.match);
  assert.ok(duplicate.ids.includes('repeated-heading-1'), 'second duplicate should have a stable unique slug');
  const fixtureLink = await page.evaluate("document.querySelector('.doq-toc a')?.getAttribute('href')");
  assert.ok(fixtureLink);
  await page.click('.doq-toc a');
  await waitFor(
    async () => await page.evaluate(`location.hash===${JSON.stringify(new URL(fixtureLink, 'http://localhost').hash)}`),
    'fixture TOC fragment update',
  );
  await page.evaluate('window.scrollTo(0,0)');
  await delay(200);
  const clickedHash = new URL(fixtureLink, 'http://localhost').hash;
  const activeTarget = await page.evaluate(
    `(()=>{const hs=[...document.querySelectorAll('.doq-markdown h2,.doq-markdown h3')];for(const h of hs){if('#'+h.id===${JSON.stringify(clickedHash)})continue;const max=Math.max(0,document.documentElement.scrollHeight-innerHeight),top=h.getBoundingClientRect().top;if(top<innerHeight*.75)continue;return{id:h.id,scroll:Math.max(0,Math.min(scrollY+top-innerHeight*.2,max)),initialTop:top}}return null})()`,
  );
  assert.ok(
    activeTarget,
    'long duplicate-heading fixture must place a different heading below the initial observer zone',
  );
  await page.evaluate(`window.scrollTo(0,${activeTarget.scroll})`);
  try {
    await waitFor(
      async () =>
        await page.evaluate(
          `!!document.querySelector('.doq-toc a.is-active')&&document.querySelector('.doq-toc a.is-active')?.hash!==${JSON.stringify(clickedHash)}&&!!document.getElementById(decodeURIComponent(document.querySelector('.doq-toc a.is-active').hash.slice(1)))`,
        ),
      'active TOC heading changes after scrolling',
    );
  } catch (error) {
    const state = await page.evaluate(
      `(async()=>({scrollY,viewport:innerHeight,clicked:${JSON.stringify(clickedHash)},target:${JSON.stringify(activeTarget.id)},targetTop:document.getElementById(${JSON.stringify(activeTarget.id)})?.getBoundingClientRect().top,active:document.querySelector('.doq-toc a.is-active')?.hash??null,visibility:document.visibilityState,focused:document.hasFocus(),probe:await new Promise(r=>{const t=document.getElementById(${JSON.stringify(activeTarget.id)});const o=new IntersectionObserver(e=>{o.disconnect();r(e.map(x=>x.isIntersecting))},{rootMargin:'0px 0px -'+Math.round(innerHeight*.7)+'px 0px'});o.observe(t);setTimeout(()=>r('no-callback'),2000)}),headings:[...document.querySelectorAll('.doq-markdown h2,.doq-markdown h3')].map(h=>({id:h.id,top:h.getBoundingClientRect().top}))}))()`,
    );
    throw new Error(`${error instanceof Error ? error.message : error}; state=${JSON.stringify(state)}`);
  }
  const currentActive = await page.evaluate("document.querySelector('.doq-toc a.is-active')?.hash");
  assert.ok(currentActive && currentActive !== clickedHash);
  const observedActiveId = decodeURIComponent(currentActive.slice(1));
  await page.send('Page.navigate', {
    url: `http://127.0.0.1:${app.port}/docs/verification/toc-fixture#${observedActiveId}`,
  });
  await waitFor(
    async () => await page.evaluate(`location.hash===${JSON.stringify(`#${observedActiveId}`)}`),
    'direct fragment navigation',
  );
  await waitFor(
    async () =>
      await page.evaluate(
        `document.querySelector('.doq-toc a.is-active')?.hash===${JSON.stringify(`#${observedActiveId}`)}`,
      ),
    'TOC observer after direct fragment load',
  );
  await page.navigate(`http://127.0.0.1:${app.port}/docs/components/button`);
  await page.navigate(`http://127.0.0.1:${app.port}/docs/verification/toc-fixture`);
  await page.evaluate(`document.getElementById(${JSON.stringify(observedActiveId)}).scrollIntoView({block:'start'})`);
  await waitFor(
    async () =>
      await page.evaluate(
        `document.querySelector('.doq-toc a.is-active')?.hash===${JSON.stringify(`#${observedActiveId}`)}`,
      ),
    'TOC observer after route lifecycle',
  );
  await page.navigate(`http://127.0.0.1:${app.port}/docs/verification/no-headings`);
  assert.equal(
    await page.evaluate("!!document.querySelector('.doq-toc')"),
    false,
    'pages without headings should omit the TOC',
  );
}

import { describe, expect, it } from 'vitest';
import GithubSlugger from 'github-slugger';
import { checkPage, extractPageFacts, frontmatterSlug, inLinkScope, resolveLink, routeOfHtmlFile } from './lib.ts';

const slugger = () => new GithubSlugger();
const article = (body: string, toc = '') =>
  `<html><head><title>T</title></head><body><article class="doq-article"><header><h1>Title</h1></header>${toc}<analog-markdown class="doq-markdown"><div class="analog-markdown">${body}</div></analog-markdown></article></body></html>`;
const text =
  '<p>' + 'A paragraph with enough words to count as a real page of documentation content. '.repeat(2) + '</p>';
const toc = (...ids: string[]) =>
  `<aside class="doq-toc">${ids.map((id) => `<a href="/docs/x#${id}">${id}</a>`).join('')}</aside>`;
const run = (html: string, route = '/docs/x', extra: object = {}) =>
  checkPage({ route, facts: extractPageFacts(html), createSlugger: slugger, ...extra });
const kinds = (html: string, route?: string, extra?: object) => run(html, route, extra).map((item) => item.kind);

describe('UNIT-140 static documentation integrity (SEO-03, SEO-04, DET-03)', () => {
  it('accepts a page whose duplicate headings carry sequential suffixes', () => {
    const body = `<h2 id="usage">Usage</h2>${text}<h2 id="usage-1">Usage</h2>${text}<h3 id="a--b">A &amp; B</h3>`;
    expect(kinds(article(body, toc('usage', 'usage-1', 'a--b')))).toEqual([]);
  });

  it('rejects the output of the heading race: a duplicate heading without its suffix', () => {
    const body = `<h2 id="usage">Usage</h2>${text}<h2 id="usage">Usage</h2>${text}`;
    expect(kinds(article(body, toc('usage', 'usage-1')))).toEqual(
      expect.arrayContaining(['duplicate-id', 'heading-id', 'toc-fragment']),
    );
  });

  it('rejects suffixes that belong to another document (usage-2 on a page that has only two usage headings)', () => {
    const body = `<h2 id="usage-2">Usage</h2>${text}<h2 id="usage-3">Usage</h2>${text}`;
    const found = run(article(body, toc('usage-2', 'usage-3')));
    expect(found.filter((item) => item.kind === 'heading-id')).toHaveLength(2);
    expect(found[0]!.message).toContain('usage-2');
  });

  it('rejects an empty successful page, a missing or repeated h1, and a table of contents that omits a heading', () => {
    expect(kinds(article('<p>x</p>'))).toContain('empty-page');
    expect(kinds(article(`${text}`).replace('<h1>Title</h1>', ''))).toContain('missing-h1');
    expect(kinds(article(`${text}`).replace('<h1>Title</h1>', '<h1>A</h1><h1>B</h1>'))).toContain('multiple-h1');
    expect(kinds(article(`<h2 id="a">A</h2><h2 id="b">B</h2>${text}`, toc('a')))).toContain('toc-missing');
  });

  it('ignores pages that are not documentation articles, such as a host landing page', () => {
    expect(kinds('<html><body><h1>Home</h1><h2 id="x">X</h2><h2 id="x">X</h2></body></html>')).toEqual([]);
  });

  it('validates canonical links against the route and the configured origin', () => {
    const withCanonical = (href: string, count = 1) =>
      article(text).replace('<head>', `<head>${`<link rel="canonical" href="${href}">`.repeat(count)}`);
    expect(
      kinds(withCanonical('https://docs.example/docs/x'), '/docs/x', { canonicalOrigin: 'https://docs.example' }),
    ).toEqual([]);
    expect(kinds(withCanonical('https://docs.example/docs/v/1/x'))).toContain('canonical');
    expect(
      kinds(withCanonical('https://other.example/docs/x'), '/docs/x', { canonicalOrigin: 'https://docs.example' }),
    ).toContain('canonical');
    expect(kinds(withCanonical('https://docs.example/docs/x', 2))).toContain('canonical');
    expect(kinds(withCanonical('/docs/x'))).toContain('canonical');
  });

  it('extracts only Markdown headings, never page chrome', () => {
    const facts = extractPageFacts(`<h2 id="doq-search-title">Search</h2>${article('<h2 id="real">Real</h2>')}`);
    expect(facts.markdownHeadings.map((heading) => heading.id)).toEqual(['real']);
    expect(facts.ids.has('doq-search-title')).toBe(true);
  });
});

describe('UNIT-141 link classification and route expectations (SEO-03, SEO-05)', () => {
  it('resolves relative, root-relative and fragment links against the page route', () => {
    expect(resolveLink('/docs/a#x', '/docs/b')).toEqual({ kind: 'internal', path: '/docs/a', fragment: 'x' });
    expect(resolveLink('../c', '/docs/a/b')).toEqual({ kind: 'internal', path: '/docs/c', fragment: undefined });
    expect(resolveLink('#top', '/docs/a')).toEqual({ kind: 'internal', path: '/docs/a', fragment: 'top' });
    expect(resolveLink('https://github.com/x', '/docs/a')).toEqual({ kind: 'external' });
    expect(resolveLink('https://docs.example/docs/a', '/', ['https://docs.example'])).toMatchObject({
      kind: 'internal',
      path: '/docs/a',
    });
    expect(resolveLink('mailto:a@b.c', '/')).toEqual({ kind: 'ignored' });
  });

  it('validates every same-site target without a scope, and only the documentation prefix with one', () => {
    expect(inLinkScope('/demos/enter', [])).toBe(true);
    expect(inLinkScope('/handbook', ['/handbook'])).toBe(true);
    expect(inLinkScope('/handbook/api/x', ['/handbook/'])).toBe(true);
    expect(inLinkScope('/handbook-old/x', ['/handbook'])).toBe(false);
    expect(inLinkScope('/demos/enter', ['/handbook'])).toBe(false);
    expect(inLinkScope('/anything', ['/'])).toBe(true);
  });

  it('reads a frontmatter slug', () => {
    expect(frontmatterSlug('---\ntitle: A\nslug: "custom/path"\n---\nbody')).toBe('custom/path');
    expect(frontmatterSlug('---\ntitle: A\n---\nbody')).toBeUndefined();
  });
});

describe('UNIT-144 prerendered file layouts', () => {
  it('maps both Nitro layouts to the same route and ignores host fallbacks', () => {
    expect(routeOfHtmlFile('docs/guide/index.html')).toBe('/docs/guide');
    expect(routeOfHtmlFile('docs/guide.html')).toBe('/docs/guide');
    expect(routeOfHtmlFile('index.html')).toBe('/');
    expect(routeOfHtmlFile('docs\\guide.html')).toBe('/docs/guide');
    expect(routeOfHtmlFile('404.html')).toBeUndefined();
    expect(routeOfHtmlFile('docs/guide.txt')).toBeUndefined();
  });
});

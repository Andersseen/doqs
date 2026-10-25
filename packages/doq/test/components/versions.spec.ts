import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DoqSearchService } from '../../src/lib/doq-search.service';
import { DoqSearchResult } from '../../config/src/lib/doq-search';
import { FakeDoc } from './content-state';
import { renderDocs } from './harness';

const versioning = { current: { id: 'latest', label: 'Latest' }, archives: [{ id: '1', label: 'v1.x', contentDirectory: 'docs-v1' }, { id: '0.9', label: 'v0.9', contentDirectory: 'docs-v0-9' }] } as const;
const docs: FakeDoc[] = [
  { source: 'overview', body: 'Latest overview body', attributes: { title: 'Overview', group: 'Intro', order: 1 } },
  { source: 'install', body: 'Latest install body', attributes: { title: 'Install', group: 'Intro', order: 2 } },
  { source: 'guides/new', body: 'Latest only guide body', attributes: { title: 'Brand new guide', group: 'Guides', order: 3 } },
  { source: 'custom-file', body: 'Latest custom body', attributes: { title: 'Custom', slug: 'shared/custom', group: 'Guides', order: 4 } },
  { directory: 'docs-v1', source: 'overview', body: 'Archive overview body', attributes: { title: 'Overview 1.x', group: 'Intro', order: 1 } },
  { directory: 'docs-v1', source: 'install', body: 'Archive install body', attributes: { title: 'Install 1.x', group: 'Intro', order: 2 }, toc: [{ id: 'legacy', text: 'Legacy step', level: 2 }] },
  { directory: 'docs-v1', source: 'legacy-only', body: 'Archive only body', attributes: { title: 'Legacy only', group: 'Intro', order: 3 } },
  { directory: 'docs-v1', source: 'old-name', body: 'Archive custom body', attributes: { title: 'Custom 1.x', slug: 'shared/custom', group: 'Guides', order: 4 } },
  { directory: 'docs-v0-9', source: 'overview', body: 'Ancient overview body', attributes: { title: 'Overview 0.9', group: 'Intro', order: 1 } },
];

const config = (extra = {}) => ({ versioning, ...extra });
const hrefOf = (name: string | RegExp, scope: HTMLElement | Document = document) => within(scope as HTMLElement).getByRole('link', { name }).getAttribute('href');
const overviewHref = () => document.querySelector('.doq-sidebar .doq-overview')?.getAttribute('href');
const sidebar = () => screen.getByRole('navigation', { name: 'Documentation' });

afterEach(() => document.head.querySelectorAll('link[rel="canonical"]').forEach(link => link.remove()));

describe('COMP-090 version-aware catalogs (VER-06, VER-07, NAV-06, NAV-07)', () => {
  it('shows only current documents at the unchanged current URLs', async () => {
    await renderDocs({ docs, config: config(), url: '/docs/install' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Install' })).toBeTruthy();
    expect(screen.getByText('Latest install body')).toBeTruthy();
    expect(hrefOf('Brand new guide', sidebar())).toBe('/docs/guides/new');
    expect(within(sidebar()).queryByRole('link', { name: /Legacy only|Install 1\.x/ })).toBeNull();
    expect(overviewHref()).toBe('/docs');
  });

  it('serves an archive document from its own content directory, not the current one with the same slug', async () => {
    await renderDocs({ docs, config: config(), url: '/docs/v/1/install' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Install 1.x' })).toBeTruthy();
    expect(screen.getByText('Archive install body')).toBeTruthy();
    expect(screen.queryByText('Latest install body')).toBeNull();
    const nav = sidebar();
    expect(hrefOf('Legacy only', nav)).toBe('/docs/v/1/legacy-only');
    expect(within(nav).queryByRole('link', { name: 'Brand new guide' })).toBeNull();
    expect(overviewHref()).toBe('/docs/v/1');
    expect(document.title).toBe('Install 1.x · Documentation · v1.x');
  });

  it('resolves custom frontmatter slugs per version', async () => {
    await renderDocs({ docs, config: config(), url: '/docs/v/1/shared/custom' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Custom 1.x' })).toBeTruthy();
    expect(screen.getByText('Archive custom body')).toBeTruthy();
  });

  it('keeps previous/next links and breadcrumbs inside the archive', async () => {
    await renderDocs({ docs, config: config(), url: '/docs/v/1/install' });
    await screen.findByRole('heading', { level: 1, name: 'Install 1.x' });
    const pager = screen.getByRole('navigation', { name: 'Page navigation' });
    expect(hrefOf(/Overview 1\.x/, pager)).toBe('/docs/v/1/overview');
    expect(hrefOf(/Legacy only/, pager)).toBe('/docs/v/1/legacy-only');
    expect(document.querySelector('.doq-breadcrumb a')?.getAttribute('href')).toBe('/docs/v/1');
    expect(document.querySelector('.doq-breadcrumb a')?.textContent).toContain('v1.x');
  });

  it('renders the archive index with only archive cards and an archive notice', async () => {
    await renderDocs({ docs, config: config(), url: '/docs/v/1' });
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
    const cards = Array.from(document.querySelectorAll('.doq-index-card')).map(card => card.getAttribute('href'));
    expect(cards).toEqual(['/docs/v/1/overview', '/docs/v/1/install', '/docs/v/1/legacy-only', '/docs/v/1/shared/custom']);
    expect(screen.getByRole('note').textContent).toMatch(/v1\.x.*archived/);
    expect(document.title).toBe('Documentation · v1.x');
  });

  it('does not show an archive notice or version label on the current version', async () => {
    await renderDocs({ docs, config: config(), url: '/docs' });
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('note')).toBeNull();
    expect(document.title).toBe('Documentation');
  });
});

describe('COMP-091 missing pages and unknown versions (VER-10, NAV-05)', () => {
  it('reports a missing document inside a valid version and links to that version index', async () => {
    await renderDocs({ docs, config: config(), url: '/docs/v/1/guides/new' });
    expect(await screen.findByRole('heading', { name: 'Documentation page not found' })).toBeTruthy();
    expect(screen.queryByText('Latest only guide body')).toBeNull();
    expect(hrefOf('Browse documentation')).toBe('/docs/v/1');
  });

  it.each(['/docs/v/9/install', '/docs/v/9', '/docs/v'])('never resolves an unconfigured version or the bare prefix (%s) as a current document', async (url) => {
    await renderDocs({ docs, config: config(), url });
    expect(await screen.findByRole('heading', { name: 'Documentation page not found' })).toBeTruthy();
    expect(hrefOf('Browse documentation')).toBe('/docs');
  });

  it('rejects a current document that would use the reserved archive prefix', async () => {
    const colliding = [...docs, { source: 'v/1/fake', body: 'Collider', attributes: { title: 'Collider', slug: 'v/1/fake' } }];
    await expect(renderDocs({ docs: colliding, config: config(), url: '/docs' })).rejects.toThrow(/reserved URL prefix/);
  });

  it('fails loudly for an archive without Markdown documents', async () => {
    await expect(renderDocs({ docs: docs.filter(doc => doc.directory !== 'docs-v0-9'), config: config(), url: '/docs' })).rejects.toThrow(/version "0\.9" has no Markdown documents/);
  });
});

describe('COMP-092 version selector (NAV-01 to NAV-03, NAV-08)', () => {
  it('names the active version and lists every version as a link with the matching slug preserved', async () => {
    await renderDocs({ docs, config: config(), url: '/docs/install' });
    await screen.findByRole('heading', { level: 1, name: 'Install' });
    const nav = sidebar();
    expect(within(nav).getByText('Version').parentElement?.textContent).toContain('Latest');
    const list = within(nav).getByRole('list', { name: 'Documentation versions', hidden: true });
    const links = within(list).getAllByRole('link', { hidden: true });
    expect(links.map(link => [link.getAttribute('href'), link.getAttribute('aria-current')])).toEqual([
      ['/docs/install', 'true'],
      ['/docs/v/1/install', null],
      ['/docs/v/0.9', null],
    ]);
    expect(links[2]!.textContent).toContain('opens the index');
    expect(links[1]!.textContent).toContain('archived');
  });

  it('matches custom slugs by public identity and falls back to the index for documents missing in a version', async () => {
    await renderDocs({ docs, config: config(), url: '/docs/shared/custom' });
    await screen.findByRole('heading', { level: 1, name: 'Custom' });
    const links = within(sidebar()).getAllByRole('link', { hidden: true }).filter(link => link.classList.contains('doq-version-link'));
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/docs/shared/custom', '/docs/v/1/shared/custom', '/docs/v/0.9']);
  });

  it('marks the archive as active and points back to the current slug', async () => {
    await renderDocs({ docs, config: config(), url: '/docs/v/1/install' });
    await screen.findByRole('heading', { level: 1, name: 'Install 1.x' });
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.doq-version-link'));
    expect(links.map(link => [link.getAttribute('href'), link.getAttribute('aria-current')])).toEqual([['/docs/install', null], ['/docs/v/1/install', 'true'], ['/docs/v/0.9', null]]);
    expect(screen.getByRole('note').querySelector('a')?.getAttribute('href')).toBe('/docs/install');
  });

  it('switches version by link activation, with the destination content, title and sidebar', async () => {
    const user = userEvent.setup();
    const view = await renderDocs({ docs, config: config(), url: '/docs/install' });
    await screen.findByRole('heading', { level: 1, name: 'Install' });
    await user.click(screen.getByText('Version'));
    await user.click(within(sidebar()).getByRole('link', { name: /v1\.x/ }));
    await view.fixture.whenStable();
    view.detectChanges();
    expect(view.router.url).toBe('/docs/v/1/install');
    expect(await screen.findByRole('heading', { level: 1, name: 'Install 1.x' })).toBeTruthy();
    expect(document.title).toBe('Install 1.x · Documentation · v1.x');
    expect(within(sidebar()).getByRole('link', { name: 'Legacy only' })).toBeTruthy();
    expect(document.querySelectorAll('.doq-version').length).toBe(1);
  });

  it('falls back to the version index when the current document does not exist there', async () => {
    const user = userEvent.setup();
    const view = await renderDocs({ docs, config: config(), url: '/docs/guides/new' });
    await screen.findByRole('heading', { level: 1, name: 'Brand new guide' });
    await user.click(within(sidebar()).getByRole('link', { name: /v1\.x/, hidden: true }));
    await view.fixture.whenStable();
    expect(view.router.url).toBe('/docs/v/1');
    expect(view.router.url).not.toContain('guides');
  });

  it('opens with the keyboard and closes with Escape, returning focus to the summary', async () => {
    const user = userEvent.setup();
    await renderDocs({ docs, config: config(), url: '/docs/install' });
    await screen.findByRole('heading', { level: 1, name: 'Install' });
    const summary = document.querySelector<HTMLElement>('.doq-version-summary')!;
    const details = summary.closest('details')!;
    summary.focus();
    await user.click(summary);
    expect(details.open).toBe(true);
    await user.keyboard('{Escape}');
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });

  it.each(['hidden', 'right', 'left'] as const)('places the selector once for sidebar "%s"', async (sidebarMode) => {
    await renderDocs({ docs, config: config({ sidebar: sidebarMode }), url: '/docs/install' });
    await screen.findByRole('heading', { level: 1, name: 'Install' });
    expect(document.querySelectorAll('.doq-version').length).toBe(1);
    expect(!!document.querySelector('.doq-topbar .doq-version')).toBe(sidebarMode === 'hidden');
    expect(!!document.querySelector('.doq-sidebar .doq-version')).toBe(sidebarMode !== 'hidden');
  });

  it('is available on the index page', async () => {
    await renderDocs({ docs, config: config(), url: '/docs' });
    await screen.findByRole('heading', { level: 1 });
    expect(document.querySelector('.doq-index .doq-version')).not.toBeNull();
  });

  it('closes the mobile drawer after choosing a version', async () => {
    const user = userEvent.setup();
    const view = await renderDocs({ docs, config: config(), url: '/docs/install' });
    await screen.findByRole('heading', { level: 1, name: 'Install' });
    await user.click(screen.getByRole('button', { name: 'Documentation menu' }));
    expect(sidebar().classList.contains('is-open')).toBe(true);
    await user.click(screen.getByText('Version'));
    await user.click(within(sidebar()).getByRole('link', { name: /v1\.x/ }));
    await view.fixture.whenStable();
    expect(view.router.url).toBe('/docs/v/1/install');
    expect(sidebar().classList.contains('is-open')).toBe(false);
  });
});

describe('COMP-093 root-mounted versioning (VER-05)', () => {
  it('serves the current docs at "/" and archives at "/v/<id>"', async () => {
    await renderDocs({ docs, config: config({ basePath: '/' }), url: '/v/1/install' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Install 1.x' })).toBeTruthy();
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.doq-version-link')).map(link => link.getAttribute('href'));
    expect(links).toEqual(['/install', '/v/1/install', '/v/0.9']);
    expect(overviewHref()).toBe('/v/1');
  });

  it('keeps the current root documents routable and rejects the bare prefix', async () => {
    await renderDocs({ docs, config: config({ basePath: '/' }), url: '/guides/new' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Brand new guide' })).toBeTruthy();
  });
});

describe('COMP-094 version-filtered search (SEARCH-01, SEARCH-02, SEARCH-04)', () => {
  class FakeSearch {
    calls: unknown[][] = [];
    async search(...args: unknown[]): Promise<DoqSearchResult[]> {
      this.calls.push(args);
      return [];
    }
  }

  async function searchFrom(url: string, extra = {}) {
    const search = new FakeSearch();
    const user = userEvent.setup();
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };
    await renderDocs({ docs, url, config: config({ search: { enabled: true }, ...extra }), providers: [{ provide: DoqSearchService, useValue: search }] });
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getAllByRole('button', { name: /Search/ })[0]!);
    await user.type(screen.getByLabelText('Search the documentation'), 'install');
    await new Promise(resolve => setTimeout(resolve, 250));
    return search;
  }

  it.each([
    ['/docs/install', ['install', '/pagefind/', '/docs', 'latest', undefined]],
    ['/docs/v/1/install', ['install', '/pagefind/', '/docs/v/1', '1', undefined]],
    ['/docs/v/0.9', ['install', '/pagefind/', '/docs/v/0.9', '0.9', undefined]],
  ])('searches the version being read from %s', async (url, expected) => {
    const search = await searchFrom(url);
    expect(search.calls).toEqual([expected]);
  });

  it('marks indexed pages with the version filter only on versioned sites', async () => {
    await renderDocs({ docs, config: config(), url: '/docs/v/1/install' });
    await screen.findByRole('heading', { level: 1, name: 'Install 1.x' });
    expect(document.querySelector('article')?.getAttribute('data-pagefind-filter')).toBe('doqsVersion:1');
    expect(document.querySelector('.doq-version')?.hasAttribute('data-pagefind-ignore')).toBe(true);
    expect(document.querySelector('.doq-version-notice')?.hasAttribute('data-pagefind-ignore')).toBe(true);
  });

  it('keeps an unversioned site unchanged: no filter attribute, no selector, no version argument', async () => {
    const search = new FakeSearch();
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
    const user = userEvent.setup();
    await renderDocs({ docs, url: '/docs/install', config: { search: { enabled: true } }, providers: [{ provide: DoqSearchService, useValue: search }] });
    await screen.findByRole('heading', { level: 1, name: 'Install' });
    expect(document.querySelector('article')?.hasAttribute('data-pagefind-filter')).toBe(false);
    expect(document.querySelector('.doq-version, .doq-version-notice')).toBeNull();
    expect(document.querySelector('[data-doq-version]')).toBeNull();
    await user.click(screen.getAllByRole('button', { name: /Search/ })[0]!);
    await user.type(screen.getByLabelText('Search the documentation'), 'doq');
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(search.calls).toEqual([['doq', '/pagefind/', '/docs', undefined, undefined]]);
  });

  it('reports a version that was never indexed instead of searching another one', async () => {
    const search = new FakeSearch();
    const { DoqVersionNotIndexedError } = await import('../../src/lib/doq-search.service');
    search.search = async () => { throw new DoqVersionNotIndexedError('1'); };
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
    const user = userEvent.setup();
    await renderDocs({ docs, url: '/docs/v/1/install', config: config({ search: { enabled: true } }), providers: [{ provide: DoqSearchService, useValue: search }] });
    await screen.findByRole('heading', { level: 1, name: 'Install 1.x' });
    await user.click(screen.getAllByRole('button', { name: /Search/ })[0]!);
    await user.type(screen.getByLabelText('Search the documentation'), 'install');
    expect(await screen.findByText(/no index for v1\.x/, undefined, { timeout: 2000 })).toBeTruthy();
  });
});

describe('COMP-095 canonical URLs (VER-04, BUILD-03)', () => {
  const origin = 'https://docs.example.com';
  const canonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');

  it('declares each page as its own canonical when an origin is configured', async () => {
    const view = await renderDocs({ docs, config: config({ versioning: { ...versioning, canonicalOrigin: origin } }), url: '/docs/install' });
    await screen.findByRole('heading', { level: 1, name: 'Install' });
    expect(canonical()).toBe(`${origin}/docs/install`);
    await view.router.navigateByUrl('/docs/v/1/install');
    await screen.findByRole('heading', { level: 1, name: 'Install 1.x' });
    expect(canonical()).toBe(`${origin}/docs/v/1/install`);
    view.fixture.destroy();
    expect(canonical()).toBeUndefined();
  });

  it('adds no canonical link without an origin', async () => {
    await renderDocs({ docs, config: config(), url: '/docs/install' });
    await screen.findByRole('heading', { level: 1, name: 'Install' });
    expect(canonical()).toBeUndefined();
  });

  it('never replaces a host-authored canonical link', async () => {
    const host = document.createElement('link');
    host.rel = 'canonical';
    host.href = 'https://host.example/page';
    document.head.appendChild(host);
    await renderDocs({ docs, config: config({ versioning: { ...versioning, canonicalOrigin: origin } }), url: '/docs/install' });
    await screen.findByRole('heading', { level: 1, name: 'Install' });
    expect(canonical()).toBe('https://host.example/page');
  });
});

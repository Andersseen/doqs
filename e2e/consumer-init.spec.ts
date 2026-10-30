import { apps, expect, expectHydrated, test, watchDomReplacement } from './fixtures.ts';

// Applications that were bare Analog hosts, adopted Doqs with `doq init` and the printed snippets, and were built from the
// packed tarball (scripts/init-consumer.ts). The host pages stay; the documentation appears exactly where the mode says.
//
// `doq init`, `doq doctor` and a successful production build do not prove the application runs: a build can exit 0 and ship
// components that were never compiled ahead of time (an upstream Analog race, spec 0022), which prerender fine and then throw
// "JIT compiler unavailable" in the browser. These journeys therefore load the pages in a real browser, require hydration
// to consume the server markup, and fail on any browser error or warning (the `problems` fixture).
const cases = [
  { name: 'embedded, Angular 21', app: apps.initEmbedded, angular: '21', embedded: true },
  { name: 'docs-first, Angular 21', app: apps.initDocsFirst, angular: '21', embedded: false },
  { name: 'embedded, Angular 22', app: apps.initEmbeddedNg22, angular: '22', embedded: true },
] as const;

const requestsTo = (page: import('@playwright/test').Page, pattern: RegExp): string[] => {
  const seen: string[] = [];
  page.on('request', (request) => {
    if (pattern.test(request.url())) seen.push(request.url());
  });
  return seen;
};

test.describe('E2E-101 newly initialized consumers', () => {
  for (const { name, app, angular, embedded } of cases) {
    const docs = embedded ? `${app.url}/docs` : app.url;
    const entry = embedded ? app.url : `${app.url}/getting-started`;

    test(`DX-016 ${name}: every first-party page hydrates on a direct load`, async ({ page }) => {
      await watchDomReplacement(page);
      const pagefind = requestsTo(page, /pagefind/i);
      const pages: [string, string][] = [
        ...(embedded ? ([[app.url, 'Acme home']] as [string, string][]) : []),
        [`${docs}/getting-started`, 'Getting started'],
        [`${docs}/introduction`, 'Introduction'],
      ];
      for (const [url, heading] of pages) {
        await page.goto(url);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        await expectHydrated(page, { reusesPrerenderedDom: heading === 'Acme home' });
        // The Angular major the page was actually built with: this proves the compatibility cell ran what it claims.
        await expect(page.locator('app-root')).toHaveAttribute('ng-version', new RegExp(`^${angular}\\.`));
      }
      // The documentation index is a different lazy route from the pages.
      await page.goto(docs);
      await expect(page.locator('.doq-index')).toBeVisible();
      await expectHydrated(page);
      // Search was never enabled: no search button, no Pagefind request.
      await expect(page.getByRole('button', { name: /^Search/ })).toHaveCount(0);
      expect(pagefind).toEqual([]);
    });

    test(`DX-016 ${name}: client-side navigation and Back/Forward stay in one document`, async ({ page }) => {
      await watchDomReplacement(page);
      await page.goto(entry);
      await expectHydrated(page, { reusesPrerenderedDom: embedded });
      if (embedded) {
        // The host's header link is a plain anchor: a full document load into the Doqs-owned /docs region.
        await expect(page.getByRole('heading', { level: 1, name: 'Acme home' })).toBeVisible();
        await page.getByRole('link', { name: 'Docs' }).click();
        await expect(page).toHaveURL(docs);
        await expect(page.locator('.doq-index')).toBeVisible();
        await expectHydrated(page);
      }
      // A full document load would drop this marker; a client-side route change keeps it.
      await page.evaluate(() => ((window as unknown as { __spa: number }).__spa = 1));
      const sameDocument = () => page.evaluate(() => (window as unknown as { __spa?: number }).__spa === 1);
      if (embedded)
        await page
          .getByRole('link', { name: /Getting started/ })
          .first()
          .click();
      await expect(page).toHaveURL(`${docs}/getting-started`);
      await expect(page.getByRole('heading', { level: 1, name: 'Getting started' })).toBeVisible();
      await expect(page.locator('.doq-callout')).toBeVisible();

      await page.getByRole('link', { name: 'Introduction' }).first().click();
      await expect(page).toHaveURL(`${docs}/introduction`);
      await expect(page.getByRole('heading', { level: 1, name: 'Introduction' })).toBeFocused();

      await page.goBack();
      await expect(page).toHaveURL(`${docs}/getting-started`);
      await expect(page.getByRole('heading', { level: 1, name: 'Getting started' })).toBeVisible();
      await page.goForward();
      await expect(page.getByRole('heading', { level: 1, name: 'Introduction' })).toBeVisible();
      await expect(page.locator('h1')).toHaveCount(1);
      expect(await sameDocument()).toBe(true);
    });
  }

  test('DX-016 embedded: the host owns its pages, Doqs owns /docs', async ({ page }) => {
    await watchDomReplacement(page);
    await page.goto(apps.initEmbedded.url);
    await expect(page.getByRole('heading', { level: 1, name: 'Acme home' })).toBeVisible();
    await expect(page.locator('.doq-root')).toHaveCount(0);
    await page.goto(`${apps.initEmbedded.url}/docs`);
    await expect(page.locator('.doq-index, main').first()).toBeVisible();
  });

  test('DX-016 docs-first: documentation owns the root and every other URL is a documentation 404', async ({
    page,
  }) => {
    await watchDomReplacement(page);
    await page.goto(apps.initDocsFirst.url);
    await expect(page.locator('.doq-index')).toBeVisible();
    await expectHydrated(page);
    await page.goto(`${apps.initDocsFirst.url}/getting-started`);
    await expect(page.getByRole('heading', { level: 1, name: 'Getting started' })).toBeVisible();
    // Doqs mounted at "/" owns every route: a host page at /about is shadowed, as the docs-first guide states.
    await page.goto(`${apps.initDocsFirst.url}/about`);
    await expect(page.getByRole('heading', { level: 1, name: 'Documentation page not found' })).toBeVisible();
    await expectHydrated(page, { reusesPrerenderedDom: false });
  });
});

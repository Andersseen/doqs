import { apps, expect, expectHydrated, test, watchDomReplacement } from './fixtures.ts';

const directPages = [
  { host: 'Showcase A embedded', url: `${apps.a.url}/docs/installation` },
  { host: 'Showcase B docs-first', url: `${apps.b.url}/guides/sdk/quickstart` },
  { host: 'Official site', url: `${apps.site.url}/docs/operations/troubleshooting` },
  { host: 'Spanish catalog', url: `${apps.a.url}/es/docs/guides/localization` },
  { host: 'Arabic RTL catalog', url: `${apps.a.url}/ar/docs/guides/localization` },
  { host: 'Archived catalog', url: `${apps.a.url}/docs/v/1/installation` },
];

test.describe('E2E-102 in-place document hydration', () => {
  for (const item of directPages) {
    test(`${item.host} retains its prerendered document nodes`, async ({ page }) => {
      await watchDomReplacement(page);
      await page.goto(item.url);
      await expect(page.locator('.doq-root, .doq-not-found')).toBeVisible();
      await expectHydrated(page, { documentation: true });
    });
  }

  test('negative control: the identity assertion rejects a recreated prerendered document tree', async ({ page }) => {
    await watchDomReplacement(page);
    await page.setContent(
      '<app-root ngh="0"><main class="doq-root"><article><h1>Guide</h1></article></main></app-root>' +
        '<script>const oldRoot = document.querySelector(".doq-root"); oldRoot.replaceWith(oldRoot.cloneNode(true)); document.querySelector("app-root").removeAttribute("ngh");</script>',
    );
    await expect(expectHydrated(page, { documentation: true })).rejects.toThrow(
      /prerendered application nodes were discarded/,
    );
  });
});

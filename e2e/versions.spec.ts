import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { apps, expect, test, nextFocusKey } from './fixtures.ts';

// Real production output + real Pagefind index. Showcase A: current docs at /docs, archive "1" at /docs/v/1 (src/content/docs-v1).
// Showcase B: docs-first root, archive "1" at /v/1. Neither the index nor the selector is mocked.
const dialogOf = (page: Page) => page.getByRole('dialog', { name: 'Search documentation' });
const searchFor = async (page: Page, phrase: string) => {
  await page.getByRole('button', { name: 'Search', exact: false }).first().click();
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('searchbox', { name: 'Search the documentation' }).fill(phrase);
  return dialog;
};
const chooseVersion = async (page: Page, name: RegExp) => {
  const nav = page.locator('.doq-sidebar, .doq-topbar').locator('.doq-version-switcher').first();
  await nav.locator('summary').click();
  await nav.getByRole('link', { name }).click();
};

test.describe('E2E-110 versioned documentation: embedded (/docs)', () => {
  test('current stays at its URL; switching keeps the slug, reload and history work', async ({ page }) => {
    await page.goto(`${apps.a.url}/docs/installation`);
    await expect(page.getByRole('heading', { level: 1, name: 'Installation' })).toBeVisible();
    await expect(page.locator('.doq-version-switcher summary')).toContainText('Latest');
    await expect(page.locator('article [data-pagefind-filter="doqsVersion"]')).toHaveText('latest');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://docs.example.test/docs/installation',
    );

    await chooseVersion(page, /v1\.x/);
    await expect(page).toHaveURL(`${apps.a.url}/docs/v/1/installation`);
    await expect(page.getByText('Vanta 1.x supports')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Installation' })).toBeFocused();
    await expect(page).toHaveTitle('Installation · Vanta UI · v1.x');
    await expect(page.locator('.doq-version-switcher summary')).toContainText('v1.x');
    await expect(page.getByRole('note')).toContainText('archived version');
    // Sidebar lists only archive documents.
    const sidebar = page.getByRole('navigation', { name: 'Vanta UI docs' });
    await expect(sidebar.getByRole('link', { name: 'Theming' })).toHaveCount(0);

    await page.reload();
    await expect(page.getByText('Vanta 1.x supports')).toBeVisible();
    await expect(page.locator('.doq-version-switcher summary')).toContainText('v1.x');

    await page.goBack();
    await expect(page).toHaveURL(`${apps.a.url}/docs/installation`);
    await expect(page.getByText('Vanta targets modern Angular')).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(`${apps.a.url}/docs/v/1/installation`);
    await expect(page.getByText('Vanta 1.x supports')).toBeVisible();

    await chooseVersion(page, /Latest/);
    await expect(page).toHaveURL(`${apps.a.url}/docs/installation`);
  });

  test('a document missing in the target version falls back to that version index', async ({ page }) => {
    await page.goto(`${apps.a.url}/docs/guides/theming`);
    await chooseVersion(page, /v1\.x/);
    await expect(page).toHaveURL(`${apps.a.url}/docs/v/1`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const cards = await page
      .locator('.doq-index-card')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((href) => href!.startsWith('/docs/v/1/'))).toBe(true);
  });

  test('archive has its own pages: custom slug, TOC, previous/next, breadcrumb and 404 for current-only pages', async ({
    page,
  }) => {
    await page.goto(`${apps.a.url}/docs/v/1/legacy/theming`);
    await expect(page.getByRole('heading', { level: 1, name: 'Legacy palette' })).toBeVisible();
    await expect(page.locator('.doq-toc')).toBeVisible();
    await expect(page.locator('.doq-breadcrumb a')).toHaveAttribute('href', '/docs/v/1');
    for (const link of await page.locator('.doq-pagination a').all())
      await expect(link).toHaveAttribute('href', /^\/docs\/v\/1\//);
  });

  test('pages that do not exist in a version, or versions that are not configured, are real 404s on a static host', async ({
    request,
  }) => {
    // Nothing is prerendered for them, so no stale or current page can be served under an archive URL.
    for (const path of ['/docs/v/1/guides/theming', '/docs/v/9/installation', '/docs/v/9', '/docs/v/1/guides/new']) {
      expect((await request.get(`${apps.a.url}${path}`)).status(), path).toBe(404);
    }
    expect((await request.get(`${apps.a.url}/docs/v/1/installation`)).status()).toBe(200);
  });

  test('search returns only the version being read, for a phrase present in both', async ({ page }) => {
    await page.goto(`${apps.a.url}/docs/installation`);
    let dialog = await searchFor(page, 'harbor-signal');
    const current = dialog.getByRole('link', { name: /Installation/ });
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute('href', /^\/docs\/installation#/);
    await expect(dialog.locator('a[href*="/docs/v/1"]')).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.goto(`${apps.a.url}/docs/v/1/installation`);
    dialog = await searchFor(page, 'harbor-signal');
    const archived = dialog.getByRole('link', { name: /Installation/ });
    await expect(archived).toHaveCount(1);
    await expect(archived).toHaveAttribute('href', /^\/docs\/v\/1\/installation#/);
    await expect(dialog.locator('a[href^="/docs/installation"]')).toHaveCount(0);
  });

  test('archive-only text is not found in current, and opens its section in the archive', async ({ page }) => {
    await page.goto(`${apps.a.url}/docs/installation`);
    let dialog = await searchFor(page, 'quill-ember');
    await expect(dialog.getByText('No results')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.goto(`${apps.a.url}/docs/v/1/overview`);
    dialog = await searchFor(page, 'quill-ember');
    const result = dialog.getByRole('link', { name: /Installation/ });
    await expect(result).toHaveAttribute('href', '/docs/v/1/installation#before-you-ship');
    await result.click();
    await expect(page).toHaveURL(`${apps.a.url}/docs/v/1/installation#before-you-ship`);
    await expect(page.locator('#before-you-ship')).toBeInViewport();
    await expect(page.locator('.doq-toc a.is-active')).toHaveText('Before you ship');
  });

  test('independent generated API reference per version', async ({ page }) => {
    await page.goto(`${apps.a.url}/docs/v/1/reference/generated/vanta-alert-component`);
    await expect(page.getByRole('heading', { level: 1, name: 'VantaAlertComponent' })).toBeVisible();
    await expect(page.locator('.doq-markdown table').first()).toContainText('kind');
    await expect(page.locator('.doq-markdown')).not.toContainText('alertTitle');
    await page.goto(`${apps.a.url}/docs/reference/generated/vanta-alert-component`);
    await expect(page.locator('.doq-markdown')).toContainText('alertTitle');
    // Fallback: this symbol exists in both versions, so the switch keeps it.
    await chooseVersion(page, /v1\.x/);
    await expect(page).toHaveURL(`${apps.a.url}/docs/v/1/reference/generated/vanta-alert-component`);
  });

  test('keyboard-only version selection and Escape', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${apps.a.url}/docs/installation`);
    const summary = page.locator('.doq-sidebar .doq-version-switcher summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.doq-version-switcher .doq-version-list')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.doq-version-switcher .doq-version-list')).toBeHidden();
    await expect(summary).toBeFocused();
    await page.keyboard.press('Space');
    await page.keyboard.press(nextFocusKey(page));
    await page.keyboard.press(nextFocusKey(page));
    await expect(page.getByRole('link', { name: /v1\.x/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${apps.a.url}/docs/v/1/installation`);
  });

  test('mobile drawer offers version switching', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${apps.a.url}/docs/installation`);
    await page.getByRole('button', { name: /menu/i }).click();
    await page.locator('.doq-version-switcher summary').click();
    await page.getByRole('link', { name: /v1\.x/ }).click();
    await expect(page).toHaveURL(`${apps.a.url}/docs/v/1/installation`);
    await expect(page.locator('.doq-sidebar')).toBeHidden();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  for (const width of [320, 375, 768, 1280, 1920]) {
    test(`archive page and open selector have no horizontal overflow or axe violations at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${apps.a.url}/docs/v/1/installation`);
      await expect(page.getByRole('heading', { level: 1, name: 'Installation' })).toBeVisible();
      const menu = page.getByRole('button', { name: /menu/i });
      if (await menu.isVisible()) await menu.click();
      await page.locator('.doq-version-switcher summary').click();
      await expect(page.locator('.doq-version-switcher .doq-version-list')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(
        0,
      );
      const results = await new AxeBuilder({ page }).include('.doq-root').withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
    });
  }

  test('host light and dark themes keep the selector legible', async ({ page }) => {
    await page.goto(`${apps.a.url}/docs/v/1/installation`);
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const results = await new AxeBuilder({ page }).include('.doq-version').withRules(['color-contrast']).analyze();
      expect(results.violations, scheme).toEqual([]);
    }
  });
});

test.describe('E2E-111 versioned documentation: docs-first root (/)', () => {
  test('current at "/", archive at "/v/1" with nested and custom-slug pages', async ({ page }) => {
    await page.goto(`${apps.b.url}/`);
    await expect(page.locator('.doq-version-switcher summary')).toContainText('2.x (latest)');
    await page.goto(`${apps.b.url}/onboarding/first-application`);
    await expect(page.getByText('Create a workspace')).toBeVisible();
    await expect(page.locator('.doq-root')).toHaveAttribute('data-sidebar', 'right');
    await chooseVersion(page, /1\.x/);
    await expect(page).toHaveURL(`${apps.b.url}/v/1/onboarding/first-application`);
    await expect(page.getByText('project API key')).toBeVisible();
    await expect(page.locator('.doq-article .doq-version-notice')).toContainText('1.x');
    await page.reload();
    await expect(page.getByText('project API key')).toBeVisible();
    await page.goto(`${apps.b.url}/v/1`);
    await expect(page.locator('.doq-index-card').first()).toHaveAttribute('href', /^\/v\/1\//);
  });

  test('search is filtered per version and archived API reference is independent', async ({ page }) => {
    await page.goto(`${apps.b.url}/reference/api`);
    let dialog = await searchFor(page, 'tidewater-index');
    await expect(dialog.getByRole('link', { name: /API reference/ })).toHaveAttribute('href', /^\/reference\/api#/);
    await expect(dialog.locator('a[href^="/v/1"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.goto(`${apps.b.url}/v/1/reference/api`);
    dialog = await searchFor(page, 'tidewater-index');
    await expect(dialog.getByRole('link', { name: /API reference/ })).toHaveAttribute(
      'href',
      /^\/v\/1\/reference\/api#/,
    );
    await expect(dialog.locator('a[href^="/reference"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.goto(`${apps.b.url}/v/1/reference/generated/forge-client`);
    await expect(page.getByRole('heading', { level: 1, name: 'ForgeClient' })).toBeVisible();
    await expect(page.locator('.doq-markdown')).toContainText('getEntry');
    await page.goto(`${apps.b.url}/reference/generated/forge-client`);
    await expect(page.locator('.doq-markdown')).not.toContainText('getEntry');
  });

  test('archived pages hydrate without console errors and the version prefix does not capture host routes', async ({
    page,
    request,
  }) => {
    for (const path of ['/v/1/getting-started', '/v/9/anything', '/v/1/guides/environments'])
      expect((await request.get(`${apps.b.url}${path}`)).status(), path).toBe(404);
    await page.goto(`${apps.b.url}/v/1/onboarding/first-application`);
    await expect(page.locator('[ng-version]').first()).toBeAttached();
    const article = page.locator('article');
    const inlineVersionFilter = await article.getAttribute('data-pagefind-filter');
    if (inlineVersionFilter) expect(inlineVersionFilter).toBe('doqsVersion:1');
    else await expect(article.locator('[data-pagefind-filter="doqsVersion"]')).toHaveText('1');
  });
});

test.describe('E2E-112 versioned documentation: packed tarball consumers', () => {
  test.skip(
    !!process.env['E2E_SKIP_CONSUMER'],
    'The focused suite omits packed consumers; the full quality gate builds and serves them.',
  );
  test('embedded consumer switches versions and filters search', async ({ page }) => {
    await page.goto(`${apps.consumerA.url}/docs/installation`);
    await chooseVersion(page, /v1\.x/);
    await expect(page).toHaveURL(`${apps.consumerA.url}/docs/v/1/installation`);
    const dialog = await searchFor(page, 'quill-ember');
    await expect(dialog.getByRole('link', { name: /Installation/ })).toHaveAttribute(
      'href',
      /^\/docs\/v\/1\/installation#/,
    );
  });

  test('root consumer switches versions and filters search', async ({ page }) => {
    await page.goto(`${apps.consumer.url}/reference/api`);
    await chooseVersion(page, /1\.x/);
    await expect(page).toHaveURL(`${apps.consumer.url}/v/1/reference/api`);
    const dialog = await searchFor(page, 'sandpiper-offset');
    await expect(dialog.getByRole('link', { name: /API reference/ })).toHaveAttribute(
      'href',
      /^\/v\/1\/reference\/api#/,
    );
  });
});

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { apps, expect, test, nextFocusKey } from './fixtures.ts';

const docs = `${apps.site.url}/docs`;
const dialogOf = (page: Page) => page.getByRole('dialog', { name: 'Search documentation' });
const bgOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((node) => getComputedStyle(node).backgroundColor);

test.describe('E2E-100 the official site documents Doqs with Doqs', () => {
  test('DX-001/DX-002: the landing is intact and leads to Getting started', async ({ page }) => {
    await page.goto(apps.site.url);
    // Firefox warns when the test's own evaluation forces layout before the document has settled.
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/^Doqs — Documentation that lives/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Your documentation, inside your Angular app.' }),
    ).toBeVisible();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Docs', exact: true }).click();
    await expect(page).toHaveURL(`${docs}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Doqs documentation' })).toBeVisible();
    await page.locator('main a[href="/docs/getting-started"]').click();
    await expect(page).toHaveURL(`${docs}/getting-started`);
    await expect(page).toHaveTitle('Getting started · Doqs');
    await expect(page.getByRole('heading', { level: 1, name: 'Getting started' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('DX-003/DX-004: nested pages are reachable from the grouped sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${docs}/getting-started`);
    const sidebar = page.locator('nav.doq-sidebar');
    await sidebar.getByText('Guides', { exact: true }).click();
    await sidebar.getByRole('link', { name: 'Rich Markdown' }).click();
    await expect(page).toHaveURL(`${docs}/guides/rich-markdown`);
    await expect(page.getByRole('heading', { level: 1, name: 'Rich Markdown' })).toBeFocused();
    await expect(sidebar.getByRole('link', { name: 'Rich Markdown' })).toHaveClass(/is-active/);
    // Rich blocks render from the same Markdown: callouts, a code group, steps and a titled code block.
    await expect(page.locator('.doq-callout').first()).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Package manager' })).toBeVisible();
    await expect(page.locator('.doq-steps, ol').first()).toBeVisible();
    await expect(page.locator('figcaption', { hasText: 'app.config.ts' })).toBeVisible();
    await page.getByRole('link', { name: 'Next', exact: false }).last().click();
    await expect(page).toHaveURL(`${docs}/guides/interactive-components`);
  });

  test('DX-005: the table of contents and fragment links scroll to their headings', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.goto(`${docs}/analog-configuration`);
    const toc = page.getByRole('complementary', { name: 'On this page' });
    await toc.getByRole('link', { name: /Prerender with Analog/ }).click();
    await expect(page).toHaveURL(/#2-prerender-with-analog$/);
    await expect(page.locator('[id="2-prerender-with-analog"]')).toBeInViewport();
    // A deep link with a fragment lands on the heading, below the sticky site header.
    await page.goto(`${docs}/operations/deterministic-vite-plugin#the-problem`);
    await expect(page.locator('#the-problem')).toBeInViewport();
    expect(
      await page.locator('#the-problem').evaluate((node) => Math.round(node.getBoundingClientRect().top)),
    ).toBeGreaterThan(60);
  });

  test('DX-006/DX-007: Pagefind finds a phrase only the documentation body contains and opens the canonical page', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto(`${docs}/installation`);
    await page.getByRole('button', { name: /^Search/ }).click();
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    // "slugger in module state" is in no title, heading or description.
    await dialog.getByRole('searchbox', { name: 'Search the documentation' }).fill('slugger in module state');
    const result = dialog.locator('a[href^="/docs/operations/deterministic-vite-plugin#"]').first();
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute('href', '/docs/operations/deterministic-vite-plugin#the-problem');
    await expect(
      dialog.locator('a[href^="/docs/"]:not([href^="/docs/operations/deterministic-vite-plugin"])'),
    ).toHaveCount(0);
    await result.click();
    await expect(page).toHaveURL(`${docs}/operations/deterministic-vite-plugin#the-problem`);
    await expect(page.locator('#the-problem')).toBeInViewport();
  });

  test('DX-008/DX-009: the consumer-owned Angular demo renders inline and responds', async ({ page }) => {
    await page.goto(`${docs}/getting-started`);
    const demo = page.locator('app-install-demo');
    await expect(demo).toBeVisible();
    await expect(demo.locator('code')).toHaveText('pnpm add @doqs/analog @analogjs/content @analogjs/router prismjs');
    await demo.getByText('npm', { exact: true }).click();
    await expect(demo.locator('code')).toHaveText(
      'npm install @doqs/analog @analogjs/content @analogjs/router prismjs',
    );
    await demo.getByRole('button', { name: /Copy/ }).click();
    await expect(demo.getByRole('status').first()).toBeAttached();
    // Demo markup is not part of the search index; the Markdown around it is.
    await expect(page.locator('[data-pagefind-ignore] app-install-demo, app-install-demo').first()).toBeVisible();
  });

  test('DX-010/DX-011: back on the landing the host title, description and theme are restored', async ({ page }) => {
    await page.goto(apps.site.url);
    // Firefox warns when the test's own evaluation forces layout before the document has settled.
    await page.waitForLoadState('networkidle');
    const landingDescription = await page.locator('meta[name="description"]').getAttribute('content');
    await page.goto(`${docs}/cli`);
    await expect(page).toHaveTitle('The doq CLI · Doqs');
    await expect(page.locator('.doq-root')).toBeVisible();
    await page.waitForLoadState('networkidle');
    const darkToggle = page.getByRole('button', { name: 'Dark theme' });
    const wasDark = await page.locator('html').evaluate((node) => node.classList.contains('dark'));
    const lightBackground = await bgOf(page, '.doq-root');
    await darkToggle.click();
    await expect(page.locator('html')).toHaveClass(wasDark ? /^((?!dark).)*$/ : /dark/);
    expect(await bgOf(page, '.doq-root'), 'the documentation follows the host theme').not.toBe(lightBackground);
    await page.getByRole('link', { name: 'Doqs, home' }).click();
    await expect(page).toHaveURL(`${apps.site.url}/`);
    await expect(page).toHaveTitle(/^Doqs — Documentation that lives/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', landingDescription ?? '');
    await expect(page.locator('html')).toHaveClass(wasDark ? /^((?!dark).)*$/ : /dark/);
    await expect(page.locator('.doq-root')).toHaveCount(0);
    // The Doqs stylesheet does not restyle the landing.
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/ui-sans-serif|system-ui/);
  });

  test('DX-012: mobile navigation opens, navigates and closes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${docs}/getting-started`);
    const trigger = page.getByRole('button', { name: /documentation menu$/i });
    const drawer = page.locator('nav.doq-sidebar');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await drawer.getByText('Operations', { exact: true }).click();
    await drawer.getByRole('link', { name: 'Troubleshooting' }).click();
    await expect(page).toHaveURL(`${docs}/operations/troubleshooting`);
    await expect(page.getByRole('heading', { level: 1, name: 'Troubleshooting' })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Long code examples scroll inside their block instead of widening the page.
    await page.goto(`${docs}/analog-configuration`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('DX-013: desktop shows the sidebar and the table of contents together', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${docs}/guides/versioned-documentation`);
    await expect(page.locator('nav.doq-sidebar')).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'On this page' })).toBeVisible();
    await expect(page.getByRole('button', { name: /documentation menu$/i })).toBeHidden();
  });

  test('DX-014: every documentation page hydrates without console errors', async ({ page }) => {
    // The `problems` fixture fails on any console error or warning, uncaught exception or failed request.
    const sitemap = [
      'getting-started',
      'installation',
      'cli',
      'analog-configuration',
      'guides/embedded-documentation',
      'guides/docs-first-applications',
      'guides/writing-markdown',
      'guides/rich-markdown',
      'guides/interactive-components',
      'guides/navigation-and-search',
      'guides/versioned-documentation',
      'guides/api-reference',
      'guides/styling-and-host-integration',
      'operations/deterministic-vite-plugin',
      'operations/deployment-and-ci',
      'operations/troubleshooting',
      'reference/migration-and-compatibility',
      'reference/public-api',
    ];
    for (const slug of ['', ...sitemap]) {
      await page.goto(`${docs}/${slug}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      // LANDMARK-01: Doqs owns the main landmark; every documentation view has exactly one and none nests.
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.locator('main main')).toHaveCount(0);
    }
  });

  test('DX-015: reduced motion and keyboard operation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${docs}/getting-started`);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
    // The skip link is the first stop and moves focus to the routed content (a fragment that exists on every page).
    await page.keyboard.press(nextFocusKey(page));
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#content')).toBeFocused();
    // Search by keyboard, and Escape returns focus to the trigger.
    await page.keyboard.press('Control+k');
    await expect(dialogOf(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogOf(page)).toBeHidden();
    // Escape returns focus to where it was before the dialog opened.
    await expect(page.locator('#content')).toBeFocused();
  });

  test('DX-018: deep links and refreshes work on static hosting; unknown URLs answer 404', async ({
    page,
    request,
  }) => {
    for (const path of ['/docs/guides/rich-markdown', '/docs/reference/public-api', '/docs']) {
      await page.goto(`${apps.site.url}${path}`);
      // Reloading while the lazy documentation chunk is still downloading cancels it, which is the test's doing, not the page's.
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForLoadState('networkidle');
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    expect((await request.get(`${docs}/does-not-exist`)).status()).toBe(404);
    expect((await request.get(`${docs}/guides`)).status()).toBe(404);
    const robots = await (await request.get(`${apps.site.url}/robots.txt`)).text();
    expect(robots).toContain('User-agent: *');
  });

  test('official documentation passes automated accessibility checks in both themes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const dark of [false, true]) {
      await page.goto(`${docs}/guides/rich-markdown`);
      if (dark !== (await page.locator('html').evaluate((node) => node.classList.contains('dark'))))
        await page.getByRole('button', { name: 'Dark theme' }).click();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(
        results.violations.map(
          (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`,
        ),
      ).toEqual([]);
    }
  });
});

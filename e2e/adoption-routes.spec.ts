import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { apps, expect, test } from './fixtures.ts';

// ADOPT-001..008, 017..020: a real Angular Movement checkout whose get-started, api-selection, accessibility and reference pages are
// now rendered by the packed Doqs tarball AT THEIR ORIGINAL URLS, next to host-owned /, /demos/* and the other /docs/* pages.
// Built by scripts/adoption-routes.ts.
const base = apps.adoptionRoutes.url;
const checkout = resolve(apps.adoptionRoutes.root, '../../..');
const headingTop = (page: Page, id: string) =>
  page.evaluate((target) => Math.round(document.getElementById(target)!.getBoundingClientRect().top), id);
const rawHtml = async (page: Page, path: string) => (await page.request.get(`${base}${path}`)).text();

test.describe('E2E-141 ADOPT-001..002 documentation served by Doqs at the host’s original URLs', () => {
  test('ADOPT-001: /docs/get-started is a Doqs page inside the host shell', async ({ page }) => {
    const response = await page.goto(`${base}/docs/get-started`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Get started' })).toBeVisible();
    await expect(page.locator('.doq-root')).toHaveCount(1);
    // The host navbar and footer are still the upstream components.
    await expect(page.getByRole('navigation').first()).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Documentation' }).getByRole('link', { name: 'Get started' }),
    ).toBeVisible();
  });

  test('ADOPT-002: guides are reachable from the Doqs navigation and keep their public URLs', async ({ page }) => {
    await page.goto(`${base}/docs/get-started`);
    const nav = page.getByRole('navigation', { name: 'Documentation' });
    await nav.getByText('Learn', { exact: true }).click();
    await nav.getByRole('link', { name: 'Choose an API' }).click();
    await expect(page).toHaveURL(`${base}/docs/api-selection`);
    await expect(page.getByRole('heading', { level: 1, name: 'Choose an API' })).toBeFocused();
    await expect(page.getByRole('table')).toContainText('MoveAnimator');
    await nav.getByRole('link', { name: 'Accessibility & troubleshooting' }).click();
    await expect(page).toHaveURL(`${base}/docs/accessibility`);
    await expect(page.locator('.doq-callout')).toContainText('Reduced motion removes');
    await expect(page.getByRole('heading', { level: 2, name: 'Troubleshooting' })).toBeVisible();
  });
});

test.describe('ADOPT-003 generated API reference and source-backed examples', () => {
  test('the reference keeps /docs/reference and lists the real public API; examples show the real source', async ({
    page,
  }) => {
    await page.goto(`${base}/docs/reference`);
    await expect(page.getByRole('heading', { level: 1, name: 'API reference' })).toBeVisible();
    await expect(
      page.locator('.doq-markdown table').getByRole('link', { name: 'MoveEnterDirective', exact: true }),
    ).toBeVisible();
    await page.goto(`${base}/docs/reference/move-enter-directive`);
    const text = readFileSync(
      resolve(checkout, 'projects/movement/src/lib/directives/move-enter.directive.ts'),
      'utf8',
    );
    const inputs = [...text.matchAll(/readonly (\w+) = input(?:\.required)?[<(]/g)].map((match) => match[1]);
    const names = await page
      .locator('.doq-markdown table')
      .first()
      .locator('tbody tr td:first-child code')
      .allInnerTexts();
    expect(names).toEqual(inputs);

    await page.goto(`${base}/docs/get-started`);
    const source = page.locator('.doq-markdown pre', { hasText: 'function provideMovement(' });
    await expect(source).toBeVisible();
    // The authoring pipeline copies the region without its marker comments.
    await expect(source).not.toContainText('doqs:provide-movement');
    await expect(page.getByRole('link', { name: 'provideMovement', exact: true }).first()).toHaveAttribute(
      'href',
      '/docs/reference/provide-movement',
    );
    await page.getByRole('link', { name: 'provideMovement', exact: true }).first().click();
    await expect(page).toHaveURL(`${base}/docs/reference/provide-movement`);
  });
});

test.describe('ADOPT-004 real Angular Movement playground', () => {
  test('controls drive the real moveEnter directive and the output inspector records the replay', async ({ page }) => {
    await page.goto(`${base}/docs/get-started`);
    const playground = page.locator('doq-playground');
    await expect(playground).toBeVisible();
    const target = playground.locator('[data-testid="am-target"]');
    await expect(target).toHaveText('fade-up');
    await playground.getByLabel('Preset').selectOption('zoom-in');
    await expect(target).toHaveText('zoom-in');
    await playground.getByLabel('Duration (ms)').fill('900');
    await expect(playground.getByText('Played').first()).toBeVisible();
    await expect(playground.locator('pre', { hasText: 'moveDuration' })).toContainText('900');
    await playground.getByRole('button', { name: /reset/i }).click();
    await expect(target).toHaveText('fade-up');
  });
});

test.describe('ADOPT-005..006 host-owned routes, history and refresh', () => {
  test('ADOPT-005: /demos/enter stays a host page and is reachable from Doqs content', async ({ page }) => {
    await page.goto(`${base}/docs/get-started`);
    await page.getByRole('link', { name: 'live demos' }).click();
    await expect(page).toHaveURL(`${base}/demos/enter`);
    await expect(page.locator('.doq-root')).toHaveCount(0);
    expect((await page.request.get(`${base}/demos/enter`)).status()).toBe(200);
    // Host-owned documentation pages that were NOT migrated keep their upstream layout (quick-find sidebar).
    await page.goto(`${base}/docs/introduction`);
    await expect(page.locator('.doq-root')).toHaveCount(0);
    await expect(page.getByLabel('Search the documentation')).toBeVisible();
  });

  test('ADOPT-006: Back/Forward cross the Doqs/host boundary and a direct refresh renders every migrated URL', async ({
    page,
  }) => {
    await page.goto(`${base}/docs/get-started`);
    await page.getByRole('link', { name: 'live demos' }).click();
    await expect(page).toHaveURL(`${base}/demos/enter`);
    await page.goBack();
    await expect(page).toHaveURL(`${base}/docs/get-started`);
    await expect(page.getByRole('heading', { level: 1, name: 'Get started' })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(`${base}/demos/enter`);
    for (const path of [
      '/docs/get-started',
      '/docs/api-selection',
      '/docs/accessibility',
      '/docs/reference',
      '/docs/reference/provide-movement',
    ]) {
      await page.goto(`${base}${path}`);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('.doq-root')).toHaveCount(1);
    }
  });

  test('unknown documentation URLs are never served as 200', async ({ request }) => {
    for (const path of ['/docs/does-not-exist', '/docs/reference/not-a-symbol'])
      expect((await request.get(`${base}${path}`)).status(), path).toBe(404);
  });
});

test.describe('ADOPT-007 search', () => {
  test('Pagefind finds migrated and generated pages and nothing from host-owned pages', async ({ page }) => {
    await page.goto(`${base}/docs/api-selection`);
    await page.getByRole('button', { name: 'Search', exact: false }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Search documentation' });
    const box = dialog.getByRole('searchbox', { name: 'Search the documentation' });
    await box.fill('persimmon-granite-harbor');
    await expect(dialog.getByRole('link', { name: /Get started/ }).first()).toHaveAttribute(
      'href',
      /^\/docs\/get-started(#|$)/,
    );
    await box.fill('moveDragSnapToOrigin');
    await expect(dialog.getByRole('link', { name: /MoveDragDirective/ }).first()).toHaveAttribute(
      'href',
      /^\/docs\/reference\/move-drag-directive(#|$)/,
    );
    await dialog
      .getByRole('link', { name: /MoveDragDirective/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/docs\/reference\/move-drag-directive/);
  });
});

test.describe('ADOPT-008 host layout, theme and scrolling', () => {
  test('host theme tokens drive the page, SmoothScrollService is active and axe finds nothing serious', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1700, height: 500 });
    await page.goto(`${base}/docs/accessibility`);
    // The lazy documentation region may still be swapping in right after load; read tokens only once it is there.
    await expect(page.locator('.doq-root')).toBeVisible();
    const colors = () =>
      page.evaluate(() => [
        getComputedStyle(document.querySelector('.doq-root')!).getPropertyValue('--host-docs-background').trim(),
        getComputedStyle(document.body).backgroundColor,
      ]);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    const dark = await colors();
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    const light = await colors();
    expect(dark[0]).not.toBe('');
    expect(light[1]).not.toBe(dark[1]);
    for (const theme of ['dark', 'light']) {
      await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
      await expect
        .poll(
          async () =>
            (await new AxeBuilder({ page }).include('.doq-root').analyze()).violations
              .filter((v) => v.impact === 'serious' || v.impact === 'critical')
              .map((v) => v.id),
          { message: theme, timeout: 10_000 },
        )
        .toEqual([]);
    }
    await page.mouse.move(400, 300);
    await page.mouse.wheel(0, 400);
    expect(await page.evaluate(() => scrollY)).toBeLessThan(400);
    await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBeGreaterThan(380);
    await page.goto(`${base}/docs/accessibility#keyboard-and-focus`);
    await expect.poll(() => headingTop(page, 'keyboard-and-focus')).toBeLessThan(160);
  });

  test('mobile layouts have no horizontal overflow and the Doqs drawer works inside the host shell', async ({
    page,
  }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of [
        '/docs/get-started',
        '/docs/api-selection',
        '/docs/accessibility',
        '/docs/reference/provide-movement',
      ]) {
        await page.goto(`${base}${path}`);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
          `${width} ${path}`,
        ).toBe(true);
      }
    }
    await page.goto(`${base}/docs/get-started`);
    await page.getByRole('button', { name: 'Documentation menu' }).click();
    const drawer = page.getByRole('navigation', { name: 'Documentation' });
    await drawer.getByText('Learn', { exact: true }).click();
    await drawer.getByRole('link', { name: 'Choose an API' }).click();
    await expect(page).toHaveURL(`${base}/docs/api-selection`);
  });
});

test.describe('ADOPT-017..020 landmarks, SEO and hydration', () => {
  test('ADOPT-017: the host owns the only main landmark in prerendered HTML and in the hydrated DOM', async ({
    page,
  }) => {
    for (const path of [
      '/docs/get-started',
      '/docs/api-selection',
      '/docs/reference',
      '/docs/reference/provide-movement',
    ]) {
      expect((await rawHtml(page, path)).match(/<main[\s>]/g), `${path} prerendered`).toHaveLength(1);
      await page.goto(`${base}${path}`);
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.locator('main main')).toHaveCount(0);
      await expect(page.locator('main .doq-root')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    }
  });

  test('ADOPT-018: keyboard — the drawer trigger, search and playground controls are reachable and named', async ({
    page,
  }) => {
    await page.goto(`${base}/docs/get-started`);
    await page.getByRole('heading', { level: 1, name: 'Get started' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    await page.getByRole('button', { name: 'Search', exact: false }).first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Search documentation' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Search documentation' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Search', exact: false }).first()).toBeFocused();
    for (const label of ['Preset', 'Duration (ms)', 'Delay (ms)', 'Easing', 'Disabled'])
      await expect(page.locator('doq-playground').getByLabel(label)).toBeVisible();
  });

  test('ADOPT-019: metadata is per page, no invented domain, and routes the host did not migrate are untouched', async ({
    page,
  }) => {
    for (const [path, title] of [
      ['/docs/get-started', 'Get started'],
      ['/docs/api-selection', 'Choose an API'],
      ['/docs/reference/provide-movement', 'provideMovement'],
    ] as const) {
      const html = await rawHtml(page, path);
      expect(html, path).toContain(`<title>${title} · Angular Movement`);
      expect(html, path).toMatch(/<meta name="description" content="[^"]+"/);
      expect(html, path).not.toMatch(/rel="canonical"/);
    }
    const intro = await rawHtml(page, '/docs/introduction');
    expect(intro).not.toContain('doq-root');
  });

  test('ADOPT-020: no hydration problems, console errors or failed requests across the journey', async ({
    page,
    problems,
  }) => {
    for (const path of [
      '/docs/get-started',
      '/docs/api-selection',
      '/docs/accessibility',
      '/docs/reference',
      '/docs/reference/provide-movement',
      '/demos/enter',
      '/docs/introduction',
      '/',
    ])
      await page.goto(`${base}${path}`);
    expect(problems).toEqual([]);
  });
});

import AxeBuilder from '@axe-core/playwright';
import { apps, expect, test, expectClipboard } from './fixtures.ts';

const installCommand = 'pnpm add @doqs/analog @analogjs/content @analogjs/router prismjs';
const heroTitle = 'Your documentation, inside your Angular app.';
const mainNav = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Main' });

test.describe('E2E-030 official website: landing', () => {
  test('SITE-001/015: the hero, the install command and the documentation preview are visible', async ({ page }) => {
    await page.goto(apps.site.url);
    await expect(page).toHaveTitle(/^Doqs/);
    await expect(page.getByRole('heading', { level: 1, name: heroTitle })).toBeVisible();
    await expect(page.getByText(installCommand).first()).toBeVisible();
    const preview = page.getByRole('figure');
    await expect(preview.getByRole('link', { name: 'Interactive playgrounds' })).toHaveAttribute(
      'href',
      '/docs/guides/interactive-playgrounds',
    );
    await expect(preview.getByTestId('enter-target')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('pre', { hasText: 'doqPaths' }).first()).toBeVisible();
  });

  test('SITE-002/003: the primary call to action opens the guide, the secondary one the examples', async ({ page }) => {
    await page.goto(apps.site.url);
    await page.waitForLoadState('networkidle');
    await page.getByRole('main').getByRole('link', { name: 'Get started' }).first().click();
    await expect(page).toHaveURL(`${apps.site.url}/docs/getting-started`);
    await expect(page.getByRole('heading', { level: 1, name: 'Getting started' })).toBeVisible();
    await page.goto(apps.site.url);
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Explore examples' }).click();
    await expect(page).toHaveURL(`${apps.site.url}/examples`);
    await expect(page.getByRole('heading', { level: 1, name: 'See Doqs work, then read how.' })).toBeVisible();
  });

  test('the copy button puts the exact install command on the clipboard', async ({ page }) => {
    await page.goto(apps.site.url);
    await page.getByRole('button', { name: /Copy install command/ }).click();
    await expect(page.locator('app-copy-command').getByRole('status')).toHaveText(/copied/i);
    await expectClipboard(page, installCommand);
  });

  test('code tabs switch examples and copy exactly the visible code', async ({ page }) => {
    await page.goto(apps.site.url);
    const tabs = page.getByRole('tablist', { name: 'Setup steps' });
    await expect(tabs.getByRole('tab', { selected: true })).toHaveText('Shared paths');
    await tabs.getByRole('tab', { name: 'Analog prerender' }).click();
    const panel = page.getByRole('tabpanel').filter({ hasText: 'doqPrerenderRoutes' });
    await expect(panel).toBeVisible();
    await tabs.getByRole('tab', { name: 'Angular providers' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.getByRole('tab', { name: 'API reference' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.getByRole('tab', { name: 'Demo registration' })).toBeFocused();
    await page.keyboard.press('Enter');
    const demos = page.getByRole('tabpanel').filter({ hasText: "'enter-animation'" });
    await expect(demos).toBeVisible();
    await demos.getByRole('button', { name: /Copy/ }).click();
    await expectClipboard(page, await demos.locator('pre code').innerText());
  });

  test('prerendered HTML already contains the hero, the capabilities and the Volt markup', async ({ request }) => {
    const html = await (await request.get(apps.site.url)).text();
    expect(html).toContain(heroTitle);
    expect(html).toContain('Angular components inside Markdown');
    expect(html).toContain('<volt-card');
    expect(html).toContain('data-color="ember"');
    expect(html).toContain('doqPrerenderRoutes');
    expect(html).not.toContain('href="/#');
  });

  test('SITE-024: no hydration, console or network problems on a direct load and a scroll', async ({ page }) => {
    await page.goto(apps.site.url);
    await expect(page.locator('html')).toHaveAttribute('data-color', 'ember');
    await expect(page.locator('html')).toHaveAttribute('data-style', 'soft');
    const icon = page.locator('lmn-arrow-right svg').first();
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(500);
    // The `problems` fixture fails the test on any console error or warning.
  });
});

test.describe('E2E-031 official website: navigation', () => {
  test('SITE-004/005/NAV-07: the navbar holds real routes with Docs last, and no homepage anchors', async ({
    page,
  }) => {
    await page.goto(apps.site.url);
    const links = mainNav(page).getByRole('link');
    expect(await links.evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()))).toEqual([
      'Home',
      'Examples',
      'Docs',
      'GitHub',
      'npm',
    ]);
    expect(await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))).toEqual([
      '/',
      '/examples',
      '/docs',
      'https://github.com/Andersseen/doqs',
      'https://www.npmjs.com/package/@doqs/analog',
    ]);
  });

  test('SITE-006/007/008: the active route follows navigation, the logo goes home and history works', async ({
    page,
  }) => {
    await page.goto(apps.site.url);
    await page.waitForLoadState('networkidle');
    const current = () => mainNav(page).locator('a[aria-current="page"]').allInnerTexts();
    expect(await current()).toEqual(['Home']);
    await mainNav(page).getByRole('link', { name: 'Examples' }).click();
    await expect(page).toHaveURL(`${apps.site.url}/examples`);
    expect(await current()).toEqual(['Examples']);
    await mainNav(page).getByRole('link', { name: 'Docs', exact: true }).click();
    await expect(page).toHaveURL(`${apps.site.url}/docs`);
    await expect(page.getByRole('heading', { level: 1, name: 'Doqs documentation' })).toBeVisible();
    expect(await current()).toEqual(['Docs']);
    await page.goBack();
    await expect(page).toHaveURL(`${apps.site.url}/examples`);
    expect(await current()).toEqual(['Examples']);
    await page.goBack();
    await expect(page).toHaveURL(`${apps.site.url}/`);
    expect(await current()).toEqual(['Home']);
    await page.goForward();
    await expect(page).toHaveURL(`${apps.site.url}/examples`);
    await page.getByRole('link', { name: 'Doqs, home' }).click();
    await expect(page).toHaveURL(`${apps.site.url}/`);
    expect(await current()).toEqual(['Home']);
  });

  test('SITE-009/010: a direct load or refresh keeps the page and its active link', async ({ page }) => {
    for (const [path, active] of [
      ['/examples', 'Examples'],
      ['/docs/guides/interactive-playgrounds', 'Docs'],
    ] as const) {
      await page.goto(`${apps.site.url}${path}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForLoadState('networkidle');
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await mainNav(page).locator('a[aria-current="page"]').allInnerTexts()).toEqual([active]);
    }
  });

  test('SITE-011/012: the mobile drawer opens by keyboard, traps focus, mirrors the routes and closes after navigating', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(apps.site.url);
    await page.waitForLoadState('networkidle');
    const toggle = page.getByRole('button', { name: 'Menu' });
    await expect(mainNav(page)).toBeHidden();
    await toggle.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const menu = dialog.getByRole('navigation', { name: 'Main' });
    expect(await menu.getByRole('link').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))).toEqual(
      ['/', '/examples', '/docs', 'https://github.com/Andersseen/doqs', 'https://www.npmjs.com/package/@doqs/analog'],
    );
    await expect(menu.locator('a[aria-current="page"]')).toHaveText('Home');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement)), 'focus stays inside').toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await dialog.getByRole('link', { name: 'Examples' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(`${apps.site.url}/examples`);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  });

  test('external links point to the repository and the npm package, and the footer repeats the site routes', async ({
    page,
  }) => {
    await page.goto(apps.site.url);
    await expect(mainNav(page).getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/Andersseen/doqs',
    );
    const footer = page.getByRole('navigation', { name: 'Footer' });
    for (const name of ['Home', 'Examples', 'Docs']) await expect(footer.getByRole('link', { name })).toBeVisible();
    for (const name of ['GitHub', 'npm', 'Changelog', 'MIT License'])
      await expect(footer.getByRole('link', { name })).toHaveAttribute('href', /^https:\/\//);
  });

  test('SITE-028: keyboard focus is visible, starting with the skip link', async ({ page }) => {
    await page.goto(apps.site.url);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
    expect(outline).not.toBe('none');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Doqs, home' })).toBeFocused();
  });
});

test.describe('E2E-032 official website: examples', () => {
  test('SITE-016/EX-05: the playground controls drive the component and its usage code', async ({ page }) => {
    await page.goto(`${apps.site.url}/examples`);
    await page.waitForLoadState('networkidle');
    const lab = page.getByRole('region', { name: /usage code that stay in sync/i });
    await lab.scrollIntoViewIfNeeded();
    await lab.getByRole('radio', { name: 'zoom-in' }).click();
    await expect(lab.getByTestId('movement-target')).toHaveText('zoom-in');
    await expect(lab.getByTestId('lab-usage')).toContainText('moveEnter="zoom-in"');
    await lab.getByRole('radio', { name: '1000 ms' }).click();
    await expect(lab.getByTestId('lab-usage')).toContainText('[moveDuration]="1000"');
    await lab.getByRole('radio', { name: 'Off (jump to end)' }).click();
    await expect(lab.getByTestId('lab-usage')).toContainText('[moveDisabled]="true"');
    await expect(lab.getByTestId('lab-event')).toContainText('zoom-in');
    await lab.getByRole('button', { name: /Copy usage code/ }).click();
    await expectClipboard(page, await lab.getByTestId('lab-usage').innerText());
  });

  test('SITE-017: the Angular Movement demo stays interactive while it animates', async ({ page }) => {
    await page.goto(`${apps.site.url}/examples`);
    await page.waitForLoadState('networkidle');
    const demo = page.getByRole('group', { name: 'Enter animation preset' }).first();
    await demo.getByRole('radio', { name: 'blur-in' }).click();
    await demo.getByRole('radio', { name: 'zoom-in' }).click();
    await expect(demo.getByRole('radio', { name: 'zoom-in' })).toBeChecked();
    await expect(page.getByTestId('enter-target').first()).toHaveText('zoom-in');
  });

  test('SITE-018: with reduced motion the content is visible at once and nothing stays hidden', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(apps.site.url);
    await page.getByRole('heading', { level: 2, name: /made of your app/i }).scrollIntoViewIfNeeded();
    for (const item of await page.locator('main ul > li').all()) await expect(item).toHaveCSS('opacity', '1');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  });

  test('SITE-026: every site page has its own title, description and social text', async ({ request }) => {
    const home = await (await request.get(apps.site.url)).text();
    const examples = await (await request.get(`${apps.site.url}/examples`)).text();
    expect(home).toMatch(/<title>Doqs — Documentation that lives in your Angular app<\/title>/);
    expect(examples).toMatch(/<title>Examples — Doqs<\/title>/);
    expect(examples).toContain('property="og:title" content="Examples — Doqs"');
    expect(examples).toMatch(/<meta name="description" content="Live Doqs examples/);
    expect(examples.match(/<link rel="canonical"/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  test('SITE-027: the sitemap lists the site routes when an origin is configured', async ({ request }) => {
    const response = await request.get(`${apps.site.url}/sitemap.xml`);
    if (response.status() === 404) {
      test
        .info()
        .annotations.push({ type: 'sitemap', description: 'built without DOQ_SITE_ORIGIN: no sitemap by design' });
      return;
    }
    const xml = await response.text();
    for (const route of ['/', '/examples', '/docs', '/docs/getting-started'])
      expect(xml).toMatch(new RegExp(`<loc>https?://[^<]+${route === '/' ? '/' : route}</loc>`));
  });
});

test.describe('E2E-033 official website: theme, layout and accessibility', () => {
  test('SITE-013/014: the theme toggles on every route and survives navigation', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(apps.site.url);
    await page.waitForLoadState('networkidle');
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Dark theme' }).click();
    await expect(html).toHaveClass(/dark/);
    for (const path of ['/examples', '/docs/getting-started', '/']) {
      await page.goto(`${apps.site.url}${path}`);
      await expect(html).toHaveClass(/dark/);
    }
    await mainNav(page).getByRole('link', { name: 'Examples' }).click();
    await expect(page).toHaveURL(`${apps.site.url}/examples`);
    await expect(html).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Dark theme' }).click();
    await expect(html).not.toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem('doqs-theme'))).toBe('light');
  });

  test('theme: follows the system and swaps Volt tokens', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(apps.site.url);
    await expect(page.locator('html')).toHaveClass(/dark/);
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.getByRole('button', { name: 'Dark theme' }).click();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(dark);
  });

  for (const path of ['/', '/examples']) {
    for (const width of [320, 375, 768, 1280, 1440, 1920]) {
      test(`SITE-023: no horizontal overflow on ${path} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${apps.site.url}${path}`);
        await page.waitForLoadState('networkidle');
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
      });
    }
  }

  for (const path of ['/', '/examples']) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`axe finds no serious or critical violations on ${path} (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(`${apps.site.url}${path}`);
        await page.waitForLoadState('networkidle');
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
      });
    }
  }

  test('SITE-025: every internal link on the site pages resolves', async ({ page, request }) => {
    const hrefs = new Set<string>();
    for (const path of ['/', '/examples']) {
      await page.goto(`${apps.site.url}${path}`);
      for (const href of await page
        .locator('a[href^="/"]')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href')!)))
        hrefs.add(href.split('#')[0]!);
    }
    expect(hrefs.size).toBeGreaterThan(5);
    for (const href of hrefs) expect((await request.get(`${apps.site.url}${href}`)).status(), href).toBe(200);
  });
});

test.describe('E2E-034 official website: documentation shell under the site header', () => {
  test('SITE-021/022/030: the sticky rails sit below the header and a table-of-contents click reveals its heading', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${apps.site.url}/docs/guides/rich-markdown`);
    await expect(page.locator('.doq-root')).toBeVisible();
    await page.waitForLoadState('networkidle');
    const header = page.locator('app-site-header header');
    const headerBottom = await header.evaluate((node) => node.getBoundingClientRect().bottom);
    const toc = page.locator('.doq-toc');
    const links = toc.getByRole('link');
    expect(await links.count()).toBeGreaterThan(2);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
    for (const selector of ['.doq-toc', 'nav.doq-sidebar']) {
      const top = await page
        .locator(selector)
        .first()
        .evaluate((node) => node.getBoundingClientRect().top);
      expect(top, `${selector} must not slide under the header`).toBeGreaterThanOrEqual(headerBottom - 1);
    }
    await page.evaluate(() => scrollTo(0, 0));
    const last = links.last();
    const hash = new URL((await last.getAttribute('href'))!, 'http://x.invalid').hash;
    await last.click();
    await expect(page).toHaveURL(new RegExp(`${hash}$`));
    const target = page.locator(hash);
    await expect(target).toBeInViewport();
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    expect(await target.evaluate((node) => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(headerBottom - 1);
    await expect(toc.locator('a.is-active')).toHaveAttribute('href', new RegExp(`${hash}$`));
  });
});

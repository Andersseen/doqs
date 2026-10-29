import AxeBuilder from '@axe-core/playwright';
import { apps, expect, nextFocusKey, test } from './fixtures.ts';

// Cross-browser hardening (0.7): behavior that depends on the engine or on the reader's environment rather than on the
// product's own logic: reduced motion, text zoom, forced colors, consumer color tokens and keyboard focus.
const installation = `${apps.a.url}/docs/installation`;

test.describe('E2E-130 reader environment', () => {
  test('reduced motion removes transitions and smooth scrolling from documentation controls', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(installation);
    // `goto` can return while client hydration is still adding the region class; wait for the control under test before
    // reading its computed styles so this acceptance does not race the production hydrate on a busy runner.
    await expect(page.locator('.doq-root')).toBeVisible();
    const durations = await page.evaluate(() => {
      const read = (selector: string) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).transitionDuration : 'missing';
      };
      return [read('.doq-nav-link'), read('.doq-tab'), read('.doq-search-trigger')];
    });
    for (const duration of durations) expect(duration === 'missing' || parseFloat(duration) <= 0.001).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.doq-root')!).scrollBehavior)).toBe(
      'auto',
    );
  });

  for (const width of [320, 1280]) {
    test(`200% text size reflows at ${width}px without horizontal scrolling or lost controls`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(installation);
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await expect(page.getByRole('heading', { level: 1, name: 'Installation' })).toBeVisible();
      // The documentation must reflow inside the viewport. The page itself can still scroll sideways when the host's own
      // header does not fit, which is the host's to fix, so measure the documentation and its text, not the document.
      const escaping = await page.evaluate(() => {
        const limit = window.innerWidth + 1;
        const scrollers = '.doq-tablist, pre, table';
        return Array.from(
          document.querySelectorAll('.doq-root, .doq-root :is(p, h1, h2, h3, li, figcaption, summary, a, button)'),
        )
          .filter(
            (el) =>
              !el.closest(scrollers) &&
              el.getBoundingClientRect().right > limit &&
              el.getBoundingClientRect().width > 0,
          )
          .map((el) => `${el.tagName}.${String(el.className).slice(0, 30)}`);
      });
      expect(escaping, 'documentation elements wider than the viewport').toEqual([]);
      const trigger =
        width < 1000
          ? page.getByRole('button', { name: /menu$/i })
          : page.getByRole('button', { name: /^Search/ }).first();
      await expect(trigger).toBeVisible();
      const box = await trigger.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= width + 1, 'control stays inside the viewport').toBe(true);
    });
  }

  test('forced colors keep the selected tab and current links distinguishable without color', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'Playwright cannot emulate forced colors in WebKit');
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto(installation);
    const tabs = page.getByRole('tablist', { name: 'Package manager' }).getByRole('tab');
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    const style = (index: number) =>
      tabs.nth(index).evaluate((el) => {
        const s = getComputedStyle(el);
        return { decoration: s.textDecorationLine, border: s.borderBottomColor };
      });
    const selected = await style(0);
    const other = await style(1);
    expect(
      selected.decoration === 'underline' || selected.border !== other.border,
      'selected tab differs without color',
    ).toBe(true);
    const current = page.locator('.doq-nav-link.is-active').first();
    await expect(current).toBeVisible();
    expect(await current.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('underline');
  });

  test('consumer color tokens restyle the documentation and keep text contrast', async ({ page }) => {
    await page.goto(installation);
    await page.addStyleTag({
      content: `.doq-root, .doq-root * { --host-docs-background: #0b1020; --host-docs-foreground: #eef1ff; --host-docs-primary: #9db4ff; --host-docs-muted: #b4bddc;
        --host-docs-secondary: #b4bddc; --host-docs-border: #3a4468; --host-docs-surface: #151c33; --host-docs-focus: #ffd166;
        --host-docs-code-background: #10172b; --host-docs-code-foreground: #eef1ff; }`,
    });
    await expect(page.locator('.doq-root')).toBeVisible();
    expect(await page.locator('.doq-root').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      'rgb(11, 16, 32)',
    );
    const results = await new AxeBuilder({ page }).include('.doq-root').withRules(['color-contrast']).analyze();
    expect(
      results.violations.map(
        (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
      ),
    ).toEqual([]);
  });
});

test.describe('E2E-131 keyboard and focus', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the mobile drawer opens and closes by keyboard, returns focus and leaves no hidden tab stop', async ({
    page,
  }) => {
    await page.goto(installation);
    const trigger = page.getByRole('button', { name: /menu$/i });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('nav.doq-sidebar').locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
    for (let step = 0; step < 14; step++) {
      await page.keyboard.press(nextFocusKey(page));
      expect(
        await page.evaluate(() => !!document.activeElement?.closest('nav.doq-sidebar')),
        `tab stop ${step + 1} is inside the closed drawer`,
      ).toBe(false);
    }
  });

  test('after Back the reader is not left on a removed control: focus is on the document or its heading', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(installation);
    const sidebar = page.getByRole('navigation', { name: 'Vanta UI docs' });
    await sidebar.getByText('Guides', { exact: true }).click();
    await sidebar.getByRole('link', { name: 'Theming' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Theming' })).toBeFocused();
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Installation' })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.activeElement === document.body || !!document.activeElement?.closest('.doq-article h1'),
      ),
    ).toBe(true);
    // Whatever holds focus, the next Tab moves into the page rather than being lost.
    await page.keyboard.press(nextFocusKey(page));
    expect(
      await page.evaluate(() => document.activeElement !== null && document.activeElement !== document.documentElement),
    ).toBe(true);
  });
});

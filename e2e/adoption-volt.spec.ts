import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { apps, expect, expectClipboard, test } from './fixtures.ts';

// ADOPT-009..020 on a real Volt UI checkout (Angular 22, zoneless, Tailwind 4, Etyma localization, its own shell): the packed Doqs
// tarball serves the button, dialog, popover and select pages, the customization guide and the async-search recipe AT THEIR ORIGINAL
// URLs; the gallery, Theme Studio, the other component pages and the localized routes stay host-owned. Built by scripts/adoption-volt.ts.
const base = apps.adoptionVolt.url;
const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true });
const events = (playground: ReturnType<typeof group>) => playground.getByRole('list', { name: 'Events' });
const hitTestable = (locator: ReturnType<Page['locator']>) =>
  locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return !!hit && (el === hit || el.contains(hit));
  });
const rawHtml = async (page: Page, path: string) => (await page.request.get(`${base}${path}`)).text();

test.describe('E2E-142 ADOPT-009 component documentation rendered by Doqs', () => {
  test('the button page is a Doqs article inside the Volt shell, with the real source and generated API links', async ({
    page,
  }) => {
    const response = await page.goto(`${base}/docs/components/button`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Button' })).toBeVisible();
    await expect(page.locator('.doq-root')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Documentation' })).toBeVisible();
    const source = page.locator('.doq-markdown pre', { hasText: 'buttonVariants' });
    await expect(source).toContainText('solid:');
    await expect(source).toContainText('destructive:');
    await expect(page.getByRole('link', { name: 'VoltButton', exact: true }).first()).toHaveAttribute(
      'href',
      '/docs/api/volt-button',
    );
    await page.getByRole('link', { name: 'VoltButton', exact: true }).first().click();
    await expect(page).toHaveURL(`${base}/docs/api/volt-button`);
    const inputs = await page
      .locator('.doq-markdown table')
      .first()
      .locator('tbody tr td:first-child code')
      .allInnerTexts();
    expect(inputs).toEqual(expect.arrayContaining(['variant', 'size', 'type', 'disabled']));
  });

  test('the customization guide and the async-search recipe keep their URLs', async ({ page }) => {
    await page.goto(`${base}/docs/customization`);
    await expect(page.getByRole('heading', { level: 1, name: 'Customization' })).toBeVisible();
    await expect(page.locator('.doq-callout')).toContainText('Change one token');
    await page.goto(`${base}/docs/recipes/async-search`);
    await expect(page.getByRole('heading', { level: 1, name: 'Async search' })).toBeVisible();
    await expect(page.locator('[data-doq-demo="async-recipe"], [data-doq-demo="async-search-recipe"]')).toHaveCount(1);
    await expect(page.locator('app-async-search-recipe')).toBeVisible();
  });
});

test.describe('ADOPT-010..012 real Volt UI components in playgrounds', () => {
  test('ADOPT-010/011: the button playground drives the real volt-button and reports its output', async ({ page }) => {
    await page.goto(`${base}/docs/components/button`);
    const playground = group(page, 'volt-button');
    const live = playground.locator('.doq-pg-frame button');
    await playground.getByLabel('Variant').selectOption('destructive');
    await expect(live).toHaveAttribute('data-variant', 'destructive');
    await playground.getByLabel('Size').selectOption('lg');
    await expect(live).toHaveAttribute('data-size', 'lg');
    await playground.getByLabel('Label').fill('Remove');
    await expect(live).toHaveText('Remove');
    await live.click();
    await expect(events(playground)).toContainText('Pressed');
    await playground.getByLabel('Disabled').check();
    await expect(live).toBeDisabled();
    await playground.getByRole('button', { name: 'Reset' }).click();
    await expect(live).toHaveAttribute('data-variant', 'solid');
  });

  test('ADOPT-012: the usage code follows the controls and copy puts exactly that text on the clipboard', async ({
    page,
  }) => {
    await page.goto(`${base}/docs/components/button`);
    const playground = group(page, 'volt-button');
    await playground.getByLabel('Variant').selectOption('ghost');
    const shown = (await playground.locator('.doq-pg-panel code').textContent())!;
    expect(shown).toContain('variant="ghost"');
    await playground.getByRole('button', { name: 'Copy Template code' }).click();
    await expect(playground.getByRole('button', { name: 'Template code copied' })).toBeVisible();
    await expectClipboard(page, shown);
  });

  test('select and popover playgrounds use the real components and their outputs', async ({ page }) => {
    await page.goto(`${base}/docs/components/select`);
    const select = group(page, 'volt-select');
    await select.getByRole('combobox', { name: 'Fruit' }).click();
    await page.getByRole('option', { name: 'Banana' }).click();
    await expect(events(select)).toContainText('Changed');
    await page.goto(`${base}/docs/components/popover`);
    const popover = group(page, 'voltPopover');
    await popover.getByRole('button', { name: 'Show details' }).click();
    await expect(page.getByText('Set the width and height of the layer.')).toBeVisible();
    await expect(events(popover)).toContainText('Open change');
    await page.keyboard.press('Escape');
    await expect(page.getByText('Set the width and height of the layer.')).toHaveCount(0);
  });
});

test.describe('ADOPT-013 overlay interaction', () => {
  test('a real Volt UI dialog opens from the playground, traps focus, closes with Escape and restores focus', async ({
    page,
  }) => {
    await page.goto(`${base}/docs/components/dialog`);
    const playground = group(page, 'voltDialogRoot');
    await playground.getByLabel('Heading').fill('Remove item?');
    const trigger = playground.getByRole('button', { name: 'Open dialog' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Remove item?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(events(playground)).toContainText('Closed');
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Remove item?' })).toBeVisible();
    await expect(
      page.getByRole('dialog', { name: 'Remove item?' }).getByRole('button', { name: 'Confirm' }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  // Default expansion is a native modal <dialog> in the browser's top layer: overlays Volt UI appends to <body> are NOT in the top layer
  // and cannot be reached. This is the verified limitation (PLAY-03) that `expandedPreview: 'overlay-compatible'` opts out of (PLAY-04..06).
  test('E2E-167 PLAY-03: in the default modal expansion a body-mounted Volt select list is attached but not hit-testable', async ({
    page,
  }) => {
    await page.goto(`${base}/docs/components/select`);
    const select = group(page, 'volt-select-modal');
    await select.getByRole('button', { name: 'Expand' }).click();
    const expanded = select.getByRole('dialog', { name: /expanded preview/ });
    await expect(expanded).toBeVisible();
    expect(await expanded.evaluate((el) => (el as HTMLDialogElement).matches(':modal'))).toBe(true);
    await expanded.getByRole('combobox', { name: 'Fruit' }).click();
    const option = page.getByRole('option', { name: 'Banana' });
    await expect(option).toBeAttached();
    expect(await hitTestable(option)).toBe(false);
    // The documented escape hatch for the default mode: close the expanded preview and use the inline one.
    await page.keyboard.press('Escape');
    await expect(expanded).toBeHidden();
  });

  test('E2E-168 PLAY-04: the overlay-compatible expansion keeps the real Volt select list visible, hit-testable and operable (mouse)', async ({
    page,
  }) => {
    await page.goto(`${base}/docs/components/select`);
    const select = group(page, 'volt-select');
    const expand = select.getByRole('button', { name: 'Expand' });
    await expand.click();
    const expanded = select.getByRole('dialog', { name: /expanded preview/ });
    await expect(expanded).toBeVisible();
    expect(await expanded.evaluate((el) => (el as HTMLDialogElement).matches(':modal'))).toBe(false);
    const combobox = expanded.getByRole('combobox', { name: 'Fruit' });
    await combobox.click();
    const option = page.getByRole('option', { name: 'Banana' });
    await expect(option).toBeVisible();
    expect(await hitTestable(option)).toBe(true);
    await option.click();
    await expect(events(select)).toContainText('Changed');
    await expect(combobox).toContainText(/banana/i);
    await expanded.getByRole('button', { name: 'Close' }).click();
    await expect(expanded).toBeHidden();
    await expect(expand).toBeFocused();
    await expect(select.getByRole('combobox', { name: 'Fruit' })).toContainText(/banana/i);
    await select.getByRole('combobox', { name: 'Fruit' }).click();
    await expect(page.getByRole('option', { name: 'Grapes' })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('E2E-169 PLAY-04: the overlay-compatible select works by keyboard alone and Escape closes the list, not the preview', async ({
    page,
  }) => {
    await page.goto(`${base}/docs/components/select`);
    const select = group(page, 'volt-select');
    await select.getByRole('button', { name: 'Expand' }).focus();
    await page.keyboard.press('Enter');
    const expanded = select.getByRole('dialog', { name: /expanded preview/ });
    await expect(expanded).toBeVisible();
    const combobox = expanded.getByRole('combobox', { name: 'Fruit' });
    await combobox.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('option', { name: 'Apple' })).toBeVisible();
    expect(await hitTestable(page.getByRole('option', { name: 'Apple' }))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('option', { name: 'Apple' })).toHaveCount(0);
    await expect(expanded).toBeVisible();
    await combobox.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('option', { name: 'Apple' })).toHaveAttribute('data-active', '');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option', { name: 'Banana' })).toHaveAttribute('data-active', '');
    await page.keyboard.press('Enter');
    await expect(events(select)).toContainText('Changed');
    await expect(combobox).not.toContainText('Select a fruit');
    await expanded.getByRole('button', { name: 'Close' }).focus();
    await page.keyboard.press('Enter');
    await expect(expanded).toBeHidden();
    await expect(select.getByRole('button', { name: 'Expand' })).toBeFocused();
  });

  test('E2E-170 PLAY-05: the real Volt popover opens from the overlay-compatible preview; Escape closes it, the preview survives', async ({
    page,
  }) => {
    await page.goto(`${base}/docs/components/popover`);
    const popover = group(page, 'voltPopover');
    await popover.getByRole('button', { name: 'Expand' }).click();
    const expanded = popover.getByRole('dialog', { name: /expanded preview/ });
    const trigger = expanded.getByRole('button', { name: 'Show details' });
    await trigger.click();
    const content = page.getByText('Set the width and height of the layer.');
    await expect(content).toBeVisible();
    expect(await hitTestable(content)).toBe(true);
    await expect(events(popover)).toContainText('Open change');
    await page.keyboard.press('Escape');
    await expect(content).toHaveCount(0);
    await expect(expanded).toBeVisible();
    await expanded.getByRole('button', { name: 'Close' }).click();
    await expect(expanded).toBeHidden();
    await popover.getByRole('button', { name: 'Show details' }).click();
    await expect(content).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('E2E-171 PLAY-06: the real Volt dialog opens above the overlay-compatible preview, closes by itself and restores focus', async ({
    page,
  }) => {
    await page.goto(`${base}/docs/components/dialog`);
    const playground = group(page, 'voltDialogRoot');
    await playground.getByRole('button', { name: 'Expand' }).click();
    const expanded = playground.getByRole('dialog', { name: /expanded preview/ });
    const trigger = expanded.getByRole('button', { name: 'Open dialog' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Delete project?' });
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole('button', { name: 'Confirm' });
    await expect(confirm).toBeFocused();
    expect(await hitTestable(confirm)).toBe(true);
    await confirm.click();
    await expect(dialog).toHaveCount(0);
    await expect(events(playground)).toContainText('Closed');
    await expect(trigger).toBeFocused();
    await expect(expanded).toBeVisible();
    await expanded.getByRole('button', { name: 'Close' }).click();
    await expect(expanded).toBeHidden();
  });

  test('E2E-172 PLAY-07: the default button playground still expands as a native modal', async ({ page }) => {
    await page.goto(`${base}/docs/components/button`);
    const button = group(page, 'volt-button');
    await button.getByRole('button', { name: 'Expand' }).click();
    const expanded = button.getByRole('dialog', { name: /expanded preview/ });
    await expect(expanded).toBeVisible();
    expect(await expanded.evaluate((el) => (el as HTMLDialogElement).matches(':modal'))).toBe(true);
    await expanded.getByRole('button', { name: 'Close' }).click();
    await expect(expanded).toBeHidden();
  });
});

test.describe('ADOPT-014 host-owned routes stay host-owned', () => {
  test('a non-migrated component page, a gallery page, Theme Studio and the localized variant are Volt UI pages', async ({
    page,
  }) => {
    for (const path of [
      '/docs/components/switch',
      '/docs/blocks/hero',
      '/docs/layouts/login',
      '/create-theme',
      '/es/docs/components/switch',
      '/docs/introduction',
    ]) {
      const response = await page.goto(`${base}${path}`);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator('.doq-root'), path).toHaveCount(0);
      await expect(page.getByRole('main'), path).toHaveCount(1);
    }
  });

  test('client navigation from a Doqs page into the host catalog and back works', async ({ page }) => {
    await page.goto(`${base}/docs/components/button`);
    await page.locator('a[href="/docs/components"]').first().click();
    await expect(page).toHaveURL(`${base}/docs/components`);
    await expect(page.locator('.doq-root')).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(`${base}/docs/components/button`);
    await expect(page.getByRole('heading', { level: 1, name: 'Button' })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(`${base}/docs/components`);
  });

  test('unknown documentation URLs are real 404s', async ({ request }) => {
    for (const path of ['/docs/components/nope', '/docs/api/not-a-symbol'])
      expect((await request.get(`${base}${path}`)).status(), path).toBe(404);
  });
});

test.describe('ADOPT-015..016 themes and mobile navigation', () => {
  test('light and dark follow Volt UI’s dark class; axe finds nothing serious', async ({ page }) => {
    await page.goto(`${base}/docs/components/button`);
    const colors = () =>
      page.evaluate(() => {
        const root = getComputedStyle(document.querySelector('.doq-root')!);
        return [root.getPropertyValue('--host-docs-background').trim(), root.backgroundColor, root.color];
      });
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    const light = await colors();
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    const dark = await colors();
    expect(light[0]).not.toBe('');
    expect(dark[1]).not.toBe(light[1]);
    expect(dark[2]).not.toBe(light[2]);
    for (const mode of ['dark', 'light']) {
      await page.evaluate((value) => document.documentElement.classList.toggle('dark', value === 'dark'), mode);
      await expect
        .poll(
          async () =>
            (await new AxeBuilder({ page }).include('.doq-root').analyze()).violations
              .filter((v) => v.impact === 'serious' || v.impact === 'critical')
              .map((v) => v.id),
          { message: mode, timeout: 10_000 },
        )
        .toEqual([]);
    }
  });

  test('mobile: no horizontal overflow on migrated pages and the Doqs drawer opens, navigates and closes', async ({
    page,
  }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of [
        '/docs/components/button',
        '/docs/components/dialog',
        '/docs/customization',
        '/docs/api/volt-button',
      ]) {
        await page.goto(`${base}${path}`);
        await expect(page.locator('.doq-article')).toBeVisible();
        // The documentation region itself must fit; code blocks scroll inside their own box.
        expect(
          await page.evaluate(() => {
            const root = document.querySelector('.doq-root')!;
            return (
              root.scrollWidth <= root.clientWidth + 1 &&
              root.getBoundingClientRect().right <= document.documentElement.clientWidth + 1
            );
          }),
          `${width} ${path}`,
        ).toBe(true);
        // Finding, not a Doqs defect: Volt UI's own header is wider than a 320 px viewport on every page, migrated or not.
        const hostOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        if (hostOverflow > 0)
          test.info().annotations.push({
            type: 'host-overflow',
            description: `${width}px ${path}: +${hostOverflow}px from the host header`,
          });
      }
    }
    await page.goto(`${base}/docs/components/button`);
    await page.getByRole('button', { name: 'Documentation menu' }).click();
    const drawer = page.getByRole('navigation', { name: 'Documentation' });
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: 'Dialog', exact: true }).click();
    await expect(page).toHaveURL(`${base}/docs/components/dialog`);
    await expect(page.getByRole('heading', { level: 1, name: 'Dialog' })).toBeFocused();
  });
});

test.describe('ADOPT-017..020 landmarks, keyboard, SEO and hydration', () => {
  test('ADOPT-017: the host owns the single main in prerendered HTML and in the hydrated DOM', async ({ page }) => {
    for (const path of [
      '/docs/components/button',
      '/docs/components/dialog',
      '/docs/customization',
      '/docs/recipes/async-search',
      '/docs/api/volt-button',
    ]) {
      expect((await rawHtml(page, path)).match(/<main[\s>]/g), `${path} prerendered`).toHaveLength(1);
      await page.goto(`${base}${path}`);
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.locator('main main')).toHaveCount(0);
      await expect(page.locator('main .doq-root')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    }
  });

  test('ADOPT-018: search, the playground controls and the version-free sidebar are keyboard operable', async ({
    page,
  }) => {
    await page.goto(`${base}/docs/components/button`);
    await page.getByRole('button', { name: 'Search', exact: false }).first().focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Search documentation' });
    await dialog.getByRole('searchbox', { name: 'Search the documentation' }).fill('buttonVariants');
    await expect(dialog.getByRole('link').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    for (const label of ['Variant', 'Size', 'Label', 'Disabled'])
      await expect(group(page, 'volt-button').getByLabel(label)).toBeVisible();
  });

  test('ADOPT-019: metadata is per page and no domain is invented', async ({ page }) => {
    const html = await rawHtml(page, '/docs/components/button');
    expect(html).toContain('<title>Button · Volt UI');
    expect(html).toMatch(/<meta name="description" content="Trigger actions/);
    // Doqs invents no domain; the canonical link on a migrated page is still Volt UI's own SEO provider's, at the same URL.
    expect(html).toContain(
      '<link rel="canonical" href="https://voltui.dev/docs/components/button" data-etyma="canonical">',
    );
  });

  test('ADOPT-020: no hydration problems or console errors across the journey', async ({ page, problems }) => {
    for (const path of [
      '/docs/components/button',
      '/docs/components/dialog',
      '/docs/components/popover',
      '/docs/components/select',
      '/docs/customization',
      '/docs/recipes/async-search',
      '/docs/api/volt-button',
      '/docs/components/switch',
      '/create-theme',
    ])
      await page.goto(`${base}${path}`);
    expect(problems).toEqual([]);
  });

  test('ADOPT-021: search finds migrated text and generated API symbols at their URLs', async ({ page }) => {
    await page.goto(`${base}/docs/customization`);
    await page.getByRole('button', { name: 'Search', exact: false }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Search documentation' });
    await dialog.getByRole('searchbox', { name: 'Search the documentation' }).fill('VoltPopoverTrigger');
    await expect(dialog.getByRole('link', { name: /VoltPopoverTrigger/ }).first()).toHaveAttribute(
      'href',
      /^\/docs\/api\/volt-popover-trigger(#|$)/,
    );
  });
});

test.describe('COMPAT-03 localization finding (recorded, not solved)', () => {
  test('Doqs has no localized documents: the locale-prefixed URL of a migrated page is Analog’s raw Markdown route, not a Doqs page', async ({
    page,
  }) => {
    await page.goto(`${base}/es/docs/components/button`);
    await expect(page.locator('.doq-root')).toHaveCount(0);
    await expect(page.locator('analog-markdown-route')).toHaveCount(1);
    await expect(page.locator('doq-playground')).toHaveCount(0);
  });
});

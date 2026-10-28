import { apps, expect, test } from './fixtures.ts';

// COMPAT-01: the embedded consumer (Showcase A's sources, Angular 21) installed from the packed tarball as a ZONE.JS application:
// zone.js imported on the client and the server, provideZoneChangeDetection() instead of the zoneless default. Built by
// `node scripts/consumer.ts --app=showcase-a --zone`. Every test also fails on console errors and warnings (hydration).
const base = apps.consumerZone.url;
const button = `${base}/docs/components/button`;

test.describe('E2E-140 Zone.js application with the packed package', () => {
  test('the application really runs inside Zone.js and hydrates the prerendered Doqs page', async ({
    page,
    request,
  }) => {
    const html = await (await request.get(button)).text();
    expect(html).toContain('data-doq-playground="vanta-button"');
    await page.goto(button);
    expect(await page.evaluate(() => typeof (window as unknown as { Zone?: unknown }).Zone)).toBe('function');
    // NgZone patches timers/events: code in the Angular zone sees a non-root current zone.
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { Zone: { root: unknown; current: unknown } }).Zone.current ===
          (window as unknown as { Zone: { root: unknown } }).Zone.root,
      ),
    ).toBe(true);
    await expect(page.getByRole('heading', { level: 1, name: 'Button' })).toBeVisible();
  });

  test('playground Input changes update the live component, Outputs reach the inspector, Reset restores', async ({
    page,
  }) => {
    await page.goto(button);
    const playground = page.getByRole('group', { name: 'Volt UI button', exact: true });
    const live = playground.locator('.doq-pg-frame button[voltbutton]');
    await playground.getByLabel('Variant').selectOption('Destructive');
    await expect(live).toHaveAttribute('data-variant', 'destructive');
    await playground.getByLabel('Label').fill('Remove');
    await expect(live).toHaveText('Remove');
    await playground.getByLabel('Disabled').check();
    await expect(live).toBeDisabled();
    await playground.getByLabel('Disabled').uncheck();
    await live.click();
    await expect(playground.getByRole('list', { name: 'Events' })).toContainText('Pressed');
    await playground.getByRole('button', { name: 'Reset' }).click();
    await expect(live).toHaveText('Save changes');
    await expect(playground.getByRole('list', { name: 'Events' })).toHaveCount(0);
  });

  test('routing, component lifecycle and history work: demos are destroyed on leave and recreated on return', async ({
    page,
  }) => {
    await page.goto(button);
    await expect(page.getByRole('region', { name: 'Vanta button demo' })).toBeVisible();
    await page.getByRole('navigation', { name: 'Vanta UI docs' }).getByRole('link', { name: 'Overview' }).click();
    await expect(page).toHaveURL(`${base}/docs`);
    await expect(page.locator('doq-playground')).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(button);
    await expect(page.getByRole('group', { name: 'Volt UI button', exact: true })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(`${base}/docs`);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('search state survives typing, closing and reopening, and opens the result', async ({ page }) => {
    await page.goto(base + '/docs');
    await page
      .getByRole('button', { name: /^Search/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: 'Search documentation' });
    const box = dialog.getByRole('searchbox', { name: 'Search the documentation' });
    await box.fill('button');
    await expect(dialog.getByRole('link').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await page
      .getByRole('button', { name: /^Search/ })
      .first()
      .click();
    await box.fill('button');
    await dialog.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/docs\//);
  });

  test('version selection switches between current and archived documentation', async ({ page }) => {
    await page.goto(`${base}/docs/installation`);
    await expect(page.locator('.doq-version-switcher summary')).toContainText('Latest');
    await page.locator('.doq-sidebar .doq-version-switcher summary').click();
    await page.locator('.doq-version-list').getByRole('link', { name: /v1/ }).click();
    await expect(page).toHaveURL(/\/docs\/v\/1\//);
    await expect(page.getByRole('note')).toContainText('archived version');
  });
});

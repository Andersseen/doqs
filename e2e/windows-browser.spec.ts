import { apps, expect, test } from './fixtures.ts';

test.describe('E2E-021 Windows Chromium browser acceptance', () => {
  test('embedded documentation navigation hydrates and preserves readable content', async ({ page }) => {
    await page.goto(apps.a.url);
    await page.getByRole('link', { name: /Explore the documentation/ }).click();
    await expect(page).toHaveURL(`${apps.a.url}/docs`);
    await expect(page.getByRole('heading', { level: 1, name: 'Build with Vanta UI' })).toBeVisible();
    await page.getByRole('link', { name: /Routing and content/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Routing and content' })).toBeVisible();
    await expect(page.locator('main')).toHaveCount(1);
  });

  test('search supports keyboard open, labelled input, results and Escape focus restoration', async ({ page }) => {
    await page.goto(`${apps.a.url}/docs/overview`);
    const trigger = page.getByRole('button', { name: /^Search/ });
    await trigger.focus();
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'Search documentation' });
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole('searchbox', { name: 'Search the documentation' });
    await expect(input).toBeFocused();
    await input.fill('lantern cobalt ledger');
    await expect(dialog.getByRole('link', { name: /Accessibility/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('mobile drawer opens, navigates by keyboard and closes with focus restored', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${apps.a.url}/docs/overview`);
    const trigger = page.getByRole('button', { name: /menu$/i });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const drawer = page.getByRole('navigation', { name: 'Vanta UI docs' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer.locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });

  test('playground input and expanded dialog preserve state and restore focus', async ({ page }) => {
    await page.goto(`${apps.a.url}/docs/components/button`);
    const playground = page.getByRole('group', { name: 'Volt UI button', exact: true });
    const label = playground.getByLabel('Label');
    await label.fill('Windows check');
    const expand = playground.getByRole('button', { name: 'Expand' });
    await expand.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: /expanded preview/i });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(expand).toBeFocused();
    await expect(playground.locator('.doq-pg-frame button')).toContainText('Windows check');
  });

  test('localized documentation keeps Arabic language and RTL direction after hydration', async ({ page }) => {
    await page.goto(`${apps.a.url}/ar/docs/guides/localization`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.locator('.doq-locale summary').click();
    await page.getByRole('link', { name: 'Español' }).click();
    await expect(page).toHaveURL(`${apps.a.url}/es/docs/guides/localization`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });
});

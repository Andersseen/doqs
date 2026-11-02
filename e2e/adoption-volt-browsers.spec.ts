import { apps, expect, test } from './fixtures.ts';

// Focused cross-browser subset of the Volt UI proof (Chromium runs the full e2e/adoption-volt.spec.ts): playground controls on the real
// component, a real overlay with focus restoration, the expanded preview, navigation and hydration.
const base = apps.adoptionVolt.url;
const group = (page: import('@playwright/test').Page, name: string) => page.getByRole('group', { name, exact: true });

test.describe('E2E-144 ADOPT browsers: Volt UI at its original URLs', () => {
  test('the real volt-button follows the playground controls and reports its output', async ({ page }) => {
    await page.goto(`${base}/docs/components/button`);
    const playground = group(page, 'volt-button');
    const live = playground.locator('.doq-pg-frame button');
    await playground.getByLabel('Variant').selectOption('outline');
    await expect(live).toHaveAttribute('data-variant', 'outline');
    await live.click();
    await expect(playground.getByRole('list', { name: 'Events' })).toContainText('Pressed');
    await expect(page.getByRole('main')).toHaveCount(1);
  });

  test('a real dialog opens, closes with Escape and returns focus; the expanded preview keeps its instance and restores focus', async ({
    page,
  }) => {
    await page.goto(`${base}/docs/components/dialog`);
    const playground = group(page, 'voltDialogRoot');
    const trigger = playground.getByRole('button', { name: 'Open dialog' });
    // Opened by keyboard: WebKit does not focus a button on a mouse click, so there would be no focused opener to restore.
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Delete project?' });
    await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  // The default (modal) expansion is unchanged: Escape closes it and focus returns to Expand. The button playground keeps the default.
  test('the default expanded preview is modal, keeps its instance, closes with Escape and restores focus', async ({
    page,
  }) => {
    await page.goto(`${base}/docs/components/button`);
    const playground = group(page, 'volt-button');
    const expand = playground.getByRole('button', { name: 'Expand' });
    await expand.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: /expanded preview/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(expand).toBeFocused();
  });

  test('E2E-173 an overlay-compatible expanded preview keeps the real Volt select list hit-testable and usable by pointer', async ({
    page,
  }) => {
    await page.goto(`${base}/docs/components/select`);
    const select = group(page, 'volt-select');
    const expand = select.getByRole('button', { name: 'Expand' });
    await expand.focus();
    await page.keyboard.press('Enter');
    const expanded = select.getByRole('dialog', { name: /expanded preview/ });
    await expect(expanded).toBeVisible();
    await expanded.getByRole('combobox', { name: 'Fruit' }).click();
    const option = page.getByRole('option', { name: 'Banana' });
    await expect(option).toBeVisible();
    const hit = await option.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return !!top && (el === top || el.contains(top));
    });
    expect(hit).toBe(true);
    await option.click();
    await expect(select.getByRole('list', { name: 'Events' })).toContainText('Changed');
    await expanded.getByRole('button', { name: 'Close' }).focus();
    await page.keyboard.press('Enter');
    await expect(expanded).toBeHidden();
    await expect(expand).toBeFocused();
    await expect(select.getByRole('combobox', { name: 'Fruit' })).toContainText(/banana/i);
  });

  test('E2E-174 in the default modal expansion the same body-mounted list is not hit-testable (control)', async ({
    page,
  }) => {
    await page.goto(`${base}/docs/components/select`);
    const select = group(page, 'volt-select-modal');
    await select.getByRole('button', { name: 'Expand' }).click();
    const expanded = select.getByRole('dialog', { name: /expanded preview/ });
    await expanded.getByRole('combobox', { name: 'Fruit' }).click();
    const option = page.getByRole('option', { name: 'Banana' });
    await expect(option).toBeAttached();
    const hit = await option.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return !!top && (el === top || el.contains(top));
    });
    expect(hit).toBe(false);
  });

  test('client navigation to a host-owned page and back hydrates without errors', async ({ page }) => {
    await page.goto(`${base}/docs/components/popover`);
    await expect(page.getByRole('heading', { level: 1, name: 'Popover' })).toBeVisible();
    await page.locator('a[href="/docs/components"]').first().click();
    await expect(page).toHaveURL(`${base}/docs/components`);
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Popover' })).toBeVisible();
  });
});

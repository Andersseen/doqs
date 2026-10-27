import { apps, expect, test, expectClipboard } from './fixtures.ts';

// Both consumers are built from the packed tarball outside the workspace (`pnpm consumer:build`): no source aliases.
test.describe('E2E-077 packed consumers: rich Markdown authoring', () => {
  test('embedded consumer (documentation under /docs): callouts, tabs, steps, keyboard, copy and demos', async ({
    page,
    request,
  }) => {
    expect((await request.get(`${apps.consumerA.url}/docs/installation`)).status()).toBe(200);
    await page.goto(`${apps.consumerA.url}/docs/installation`);
    await expect(page.getByRole('note').first()).toContainText('Angular 21 or later');
    const tabs = page.getByRole('tablist', { name: 'Package manager' }).getByRole('tab');
    await expect(tabs).toHaveText(['npm', 'pnpm', 'yarn']);
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
    const activePanel = page.locator(`#${await tabs.nth(1).getAttribute('aria-controls')}`);
    await expect(activePanel).toBeVisible();
    await activePanel.getByRole('button', { name: 'Copy code' }).click();
    await expectClipboard(page, 'pnpm dlx voltui add button\n');
    await expect(page.locator('.doq-steps > ol > li')).toHaveCount(3);
    await expect(page.getByRole('region', { name: 'Vanta install command' })).toBeVisible();
    await page.goto(`${apps.consumerA.url}/docs/guides/accessibility`);
    await expect(page.locator('[data-callout]')).toHaveCount(3);
    await expect(page.getByRole('region', { name: 'Vanta contrast checker' })).toHaveCount(1);
    // The host landing page is not documentation.
    await page.goto(apps.consumerA.url);
    await expect(page.locator('.doq-root, .doq-callout')).toHaveCount(0);
  });

  test('embedded consumer: search finds callout and inactive-tab text under the /docs prefix', async ({ page }) => {
    await page.goto(`${apps.consumerA.url}/docs/overview`);
    await page.getByRole('button', { name: /^Search/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Search documentation' });
    await dialog.getByRole('searchbox').fill('unexpectedly');
    await expect(dialog.getByRole('link', { name: /Accessibility/ }).first()).toHaveAttribute(
      'href',
      '/docs/guides/accessibility#announcements',
    );
    await dialog.getByRole('searchbox').fill('dlx voltui');
    await expect(dialog.getByRole('link', { name: /Installation/ }).first()).toHaveAttribute(
      'href',
      /^\/docs\/installation#/,
    );
  });

  test('root consumer (docs-first): rich pages, custom slug, titled code and search', async ({ page, request }) => {
    expect((await request.get(`${apps.consumer.url}/getting-started`)).status()).toBe(404);
    await page.goto(`${apps.consumer.url}/onboarding/first-application`);
    await expect(page.locator('[data-callout="tip"]')).toBeVisible();
    const tabs = page.getByRole('tablist', { name: 'Request style' }).getByRole('tab');
    await tabs.nth(1).click();
    await expect(page.getByRole('tabpanel')).toContainText('curl -H');
    await page.goto(`${apps.consumer.url}/guides/environments`);
    await expect(page.locator('[data-callout="warning"]')).toBeVisible();
    await expect(page.locator('.doq-steps > ol > li')).toHaveCount(3);
    await page.goto(`${apps.consumer.url}/reference/api`);
    await expect(page.locator('figure.doq-code figcaption')).toHaveText('src/app/entries.ts');
    await page.getByRole('button', { name: /^Search/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Search documentation' });
    await dialog.getByRole('searchbox').fill('preview token unpublished');
    await expect(dialog.getByRole('link', { name: /Environments/ }).first()).toHaveAttribute(
      'href',
      /^\/guides\/environments#/,
    );
  });
});

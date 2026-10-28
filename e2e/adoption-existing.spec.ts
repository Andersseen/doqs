import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test as hostTest } from '@playwright/test';
import { apps, expect, test } from './fixtures.ts';

// ADOPT-021..026: Angular Movement as it is today, already integrated with Doqs by its maintainers, rebuilt against the packed tarball
// of this workspace (scripts/adoption-existing.ts). Nothing is scaffolded or overlaid. The routes below are not hardcoded: the script
// derives them from the checkout's real content tree and page files, so a renamed upstream page changes the list instead of
// breaking the proof.
const base = apps.adoptionExisting.url;
const checkout = resolve(apps.adoptionExisting.root, '../../..');
const facts = JSON.parse(readFileSync(resolve(checkout, '.doq-adoption-routes.json'), 'utf8')) as {
  sha: string;
  version: string;
  docs: string[];
  demos: string[];
  hostPages: string[];
};

test.describe('E2E-166 ADOPT-021 the packed package is what runs', () => {
  test('the installed @doqs/analog is the tarball built from this workspace, and the checkout is a recorded revision', () => {
    const installed = JSON.parse(readFileSync(resolve(checkout, 'node_modules/@doqs/analog/package.json'), 'utf8')) as {
      version: string;
    };
    expect(installed.version).toBe(facts.version);
    expect(facts.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(facts.docs.length).toBeGreaterThan(10);
  });
});

test.describe('ADOPT-022 every documentation route renders as a Doqs article', () => {
  for (const route of facts.docs) {
    test(`${route}`, async ({ page }) => {
      const response = await page.goto(`${base}${route}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('');
      await expect(page.locator('.doq-root')).toHaveCount(1);
      await expect(page.locator('.doq-markdown').first()).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Documentation' }).first()).toBeAttached();
    });
  }
});

// Host-owned pages are the host's responsibility, including what its own runtime logs (the landing's hero animation prints a
// Chromium "Invalid keyframe value ... NaNpx" warning, with or without Doqs). The strict console fixture therefore guards the Doqs
// routes only; here the contract is that the host page is served, is not a Doqs article, and throws no uncaught exception.
hostTest.describe('ADOPT-023 host-owned routes are untouched', () => {
  for (const route of ['/', ...facts.demos]) {
    hostTest(`${route} is served by the host and carries no Doqs article`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const response = await page.goto(`${base}${route}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('.doq-root')).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  hostTest('the host page files the proof derived are all present in the checkout (nothing was removed)', () => {
    expect(facts.hostPages).toEqual(expect.arrayContaining(['demos/enter.page.ts']));
  });
});

test.describe('ADOPT-024 navigation and table of contents', () => {
  test('the current page is marked in the Markdown-derived sidebar and the table of contents jumps to its heading', async ({
    page,
  }) => {
    // The first documentation page that has a table of contents entry; derived at run time, not named here.
    let target: string | undefined;
    for (const route of facts.docs) {
      await page.goto(`${base}${route}`);
      if ((await page.locator('[aria-label="On this page"] a').count()) > 1) {
        target = route;
        break;
      }
    }
    expect(target, 'a documentation page with a table of contents').toBeDefined();
    const nav = page.getByRole('navigation', { name: 'Documentation' }).first();
    await expect(nav.locator('a.is-active')).toHaveCount(1);
    await expect(nav.locator(`a[href="${target}"]`)).toHaveCount(1);
    const link = page.locator('[aria-label="On this page"] a').nth(1);
    const fragment = (await link.getAttribute('href'))!.split('#')[1]!;
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#${fragment}$`));
    await expect(page.locator(`[id="${fragment}"]`)).toBeInViewport();
  });
});

test.describe('ADOPT-025 static search', () => {
  test('Pagefind finds a documentation page by its own heading and not host pages', async ({ page }) => {
    const route = facts.docs.find((entry) => entry.includes('/guides/')) ?? facts.docs[0]!;
    await page.goto(`${base}${route}`);
    const heading = (await page.getByRole('heading', { level: 1 }).innerText()).trim();
    await page.getByRole('button', { name: 'Search', exact: false }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Search documentation' });
    await dialog.getByRole('searchbox', { name: 'Search the documentation' }).fill(heading);
    const hit = dialog.locator(`a[href^="${route}"]`).first();
    await expect(hit).toBeVisible();
    for (const href of await dialog
      .getByRole('link')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href')))) {
      expect(href, 'a result outside the documentation region').toMatch(/^\/docs(\/|#|$)/);
    }
  });
});

test.describe('ADOPT-026 accessibility of the integrated pages', () => {
  test('a guide and the first documentation page have no serious or critical axe violations', async ({ page }) => {
    for (const route of [facts.docs[0]!, facts.docs.find((entry) => entry.includes('/guides/')) ?? facts.docs[1]!]) {
      await page.goto(`${base}${route}`);
      await page.waitForLoadState('networkidle');
      const violations = (await new AxeBuilder({ page }).include('.doq-root').analyze()).violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => v.id);
      expect(violations, route).toEqual([]);
    }
  });
});

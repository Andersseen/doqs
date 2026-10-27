import { apps, expect, test } from './fixtures.ts';

const button = `${apps.a.url}/docs/components/button`;

test.describe('E2E-004 table of contents', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
  });

  test('links point at real headings and following one updates the URL fragment', async ({ page }) => {
    await page.goto(button);
    const links = page.getByRole('complementary', { name: 'On this page' }).getByRole('link');
    await expect(links).toHaveText(['Choose a style', 'Example', 'Behavior']);
    for (const href of await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')!))) {
      await expect(page.locator(`.doq-markdown ${href.slice(href.indexOf('#'))}`)).toHaveCount(1);
    }
    await links.nth(1).click();
    await expect(page).toHaveURL(`${button}#example`);
  });

  test('the active heading follows the reader while scrolling', async ({ page }) => {
    await page.goto(button);
    const links = page.getByRole('complementary', { name: 'On this page' }).getByRole('link');
    for (const [index, id] of ['choose-a-style', 'example', 'behavior'].entries()) {
      await page.evaluate((target) => document.getElementById(target)!.scrollIntoView({ block: 'start' }), id);
      await expect(links.nth(index)).toHaveClass(/is-active/);
      await expect(page.locator('.doq-toc a.is-active')).toHaveCount(1);
    }
  });

  test('the TOC still works after navigating away and back', async ({ page }) => {
    await page.goto(button);
    await page.locator('a.volt-brand').click();
    await expect(page.locator('.landing-a')).toBeVisible();
    await page.goBack();
    const links = page.getByRole('complementary', { name: 'On this page' }).getByRole('link');
    await expect(links).toHaveCount(3);
    await page.evaluate(() => document.getElementById('behavior')!.scrollIntoView({ block: 'start' }));
    await expect(links.last()).toHaveClass(/is-active/);
  });

  test('clicking a TOC link scrolls its heading into view', async ({ page }) => {
    await page.goto(button);
    await expect(page.locator('.doq-markdown h2')).toHaveCount(3);
    await page.getByRole('complementary', { name: 'On this page' }).getByRole('link', { name: 'Behavior' }).click();
    await expect(page).toHaveURL(`${button}#behavior`);
    await expect(page.locator('#behavior')).toBeInViewport();
  });

  test('E2E-165: sticky TOC and sidebar remain below the host header and a tall TOC scrolls internally', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 520 });
    await page.goto(`${apps.a.url}/docs/guides/localization`);
    const toc = page.getByRole('complementary', { name: 'On this page' });
    await expect(toc).toBeVisible();
    await expect.poll(() => toc.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
    await toc.evaluate((element) => {
      element.scrollTop = 140;
    });
    await expect.poll(() => toc.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const internalScroll = await toc.evaluate((element) => element.scrollTop);

    await page.evaluate(() => window.scrollTo(0, 650));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    const geometry = await page.evaluate(() => {
      const header = document.querySelector('.volt-header')!.getBoundingClientRect();
      const toc = document.querySelector<HTMLElement>('.doq-toc')!.getBoundingClientRect();
      const sidebar = document.querySelector<HTMLElement>('.doq-sidebar')!.getBoundingClientRect();
      return {
        headerBottom: header.bottom,
        tocTop: toc.top,
        sidebarTop: sidebar.top,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    expect(geometry.tocTop).toBeGreaterThanOrEqual(geometry.headerBottom - 1);
    expect(Math.abs(geometry.tocTop - geometry.sidebarTop)).toBeLessThanOrEqual(2);
    expect(internalScroll).toBeGreaterThan(0);
    expect(geometry.horizontalOverflow).toBe(false);
  });

  test('Showcase B has no table of contents because its host disabled it', async ({ page }) => {
    await page.goto(`${apps.b.url}/concepts/models`);
    await expect(page.getByRole('heading', { level: 1, name: 'Content models' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'On this page' })).toHaveCount(0);
  });

  test.describe('E2E-011 fragment navigation on a long document', () => {
    const long = `${apps.a.url}/docs/guides/accessibility`;
    const headingTop = (page: import('@playwright/test').Page, id: string) =>
      page.evaluate((target) => Math.round(document.getElementById(target)!.getBoundingClientRect().top), id);

    test('a TOC click puts the heading at the top of the viewport and keeps the fragment', async ({ page }) => {
      await page.goto(long);
      const toc = page.getByRole('complementary', { name: 'On this page' });
      await expect(toc.getByRole('link')).toHaveCount(8);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      await toc.getByRole('link', { name: 'Checklist' }).click();
      await expect(page).toHaveURL(`${long}#checklist`);
      await expect(page.locator('#checklist')).toBeInViewport();
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(500);
      expect(await headingTop(page, 'checklist')).toBeLessThan(120);
      await expect(toc.getByRole('link', { name: 'Checklist' })).toHaveClass(/is-active/);
    });

    test('loading and reloading a URL with a fragment scrolls to the heading', async ({ page }) => {
      await page.goto(`${long}#announcements`);
      await expect(page.locator('#announcements')).toBeInViewport();
      expect(await headingTop(page, 'announcements')).toBeLessThan(120);
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(300);
      await page.evaluate(() => scrollTo(0, 0));
      await page.reload();
      await expect(page.locator('#announcements')).toBeInViewport();
      expect(await headingTop(page, 'announcements')).toBeLessThan(120);
    });

    test('client-side navigation to a document fragment scrolls once the document is rendered', async ({ page }) => {
      await page.goto(`${apps.a.url}/docs/overview`);
      await page.evaluate(() => {
        history.pushState({}, '', '/docs/overview');
      });
      await page.getByRole('navigation', { name: 'Vanta UI docs' }).getByText('Guides').click();
      await page
        .getByRole('navigation', { name: 'Vanta UI docs' })
        .getByRole('link', { name: 'Accessibility' })
        .click();
      await expect(page).toHaveURL(long);
      await page
        .getByRole('complementary', { name: 'On this page' })
        .getByRole('link', { name: 'Color and contrast' })
        .click();
      await expect(page.locator('#color-and-contrast')).toBeInViewport();
    });

    test('headings with the same text follow the renderer ids and each link reaches its own heading', async ({
      page,
    }) => {
      await page.goto(long);
      const toc = page.getByRole('complementary', { name: 'On this page' });
      const hrefs = await toc
        .getByRole('link', { name: 'Examples' })
        .evaluateAll((els) => els.map((el) => el.getAttribute('href')));
      expect(hrefs).toEqual([expect.stringMatching(/#examples$/), expect.stringMatching(/#examples-1$/)]);
      await toc.getByRole('link', { name: 'Examples' }).nth(1).click();
      await expect(page).toHaveURL(`${long}#examples-1`);
      expect(await headingTop(page, 'examples-1')).toBeLessThan(120);
      await toc.getByRole('link', { name: 'Examples' }).nth(0).click();
      expect(await headingTop(page, 'examples')).toBeLessThan(120);
    });

    // The TOC is not sticky, so Playwright's click would first scroll the link into view and change the position the
    // browser records for the entry. A DOM click isolates the behavior under test: the page position per history entry.
    const follow = (page: import('@playwright/test').Page, name: string) =>
      page
        .getByRole('complementary', { name: 'On this page' })
        .getByRole('link', { name, exact: true })
        .evaluate((el) => (el as HTMLElement).click());

    test('Back and Forward move between fragment positions predictably', async ({ page }) => {
      await page.goto(long);
      await follow(page, 'Color and contrast');
      await expect(page).toHaveURL(`${long}#color-and-contrast`);
      await follow(page, 'Checklist');
      await expect(page).toHaveURL(`${long}#checklist`);
      await page.goBack();
      await expect(page).toHaveURL(`${long}#color-and-contrast`);
      await expect(page.locator('#color-and-contrast')).toBeInViewport();
      await expect.poll(() => headingTop(page, 'color-and-contrast')).toBeLessThan(120);
      await page.goBack();
      await expect(page).toHaveURL(long);
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      await page.goForward();
      await page.goForward();
      await expect(page).toHaveURL(`${long}#checklist`);
      await expect.poll(() => headingTop(page, 'checklist')).toBeLessThan(120);
    });

    test("Back across documents returns to the reader's earlier position", async ({ page }) => {
      await page.goto(long);
      await follow(page, 'Checklist');
      await expect(page).toHaveURL(`${long}#checklist`);
      const before = await page.evaluate(() => scrollY);
      await page.getByRole('link', { name: /Previous/ }).evaluate((el) => (el as HTMLElement).click());
      await expect(page).not.toHaveURL(/accessibility/);
      await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Accessibility');
      await page.goBack();
      await expect(page).toHaveURL(`${long}#checklist`);
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(before);
      expect(await headingTop(page, 'checklist')).toBeLessThan(120);
    });

    test('a fragment that matches no heading leaves the page readable without errors', async ({ page }) => {
      await page.goto(`${long}#no-such-heading`);
      await expect(page.getByRole('heading', { level: 1, name: 'Accessibility' })).toBeVisible();
      await expect(page.locator('.doq-markdown h2').first()).toBeAttached();
      expect(await page.evaluate(() => scrollY)).toBe(0);
    });
  });
});

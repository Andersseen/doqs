import AxeBuilder from '@axe-core/playwright';
import { apps, expect, test } from './fixtures.ts';

const english = `${apps.a.url}/docs/guides/localization`;
const spanish = `${apps.a.url}/es/docs/guides/localization`;
const arabic = `${apps.a.url}/ar/docs/guides/localization`;

test.describe('E2E-164 multilingual documentation acceptance', () => {
  test('prerendered documents hydrate with locale, RTL direction, and available SEO alternates', async ({ page }) => {
    for (const [url, locale, dir] of [
      [english, 'en', 'ltr'],
      [spanish, 'es', 'ltr'],
      [arabic, 'ar', 'rtl'],
    ] as const) {
      const response = await page.goto(url);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);
      await expect(page.locator('.doq-root')).toHaveAttribute('dir', dir);
      await expect(page.getByRole('complementary', { name: /page|página|الصفحة/i })).toBeVisible();
      await expect(page.locator('.doq-locale a[hreflang="en"]')).toHaveAttribute('href', '/docs/guides/localization');
      await expect(page.locator('.doq-locale a[hreflang="es"]')).toHaveAttribute(
        'href',
        '/es/docs/guides/localization',
      );
      await expect(page.locator('.doq-locale a[hreflang="ar"]')).toHaveAttribute(
        'href',
        '/ar/docs/guides/localization',
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://docs.example.test${new URL(url).pathname}`,
      );
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
        'href',
        'https://docs.example.test/docs/guides/localization',
      );
      await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveAttribute(
        'href',
        'https://docs.example.test/es/docs/guides/localization',
      );
      await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveAttribute(
        'href',
        'https://docs.example.test/ar/docs/guides/localization',
      );
      expect(await page.locator('link[rel="alternate"]').count()).toBe(4);
      await expect(
        page.getByRole('heading', { name: /Keep each language|Mantén cada idioma|أبقِ محتوى/ }),
      ).toBeVisible();
    }
  });

  test('locale switching preserves document and version; unavailable archive locales are omitted', async ({ page }) => {
    await page.goto(spanish);
    await page.locator('.doq-locale summary').click();
    await page.getByRole('link', { name: 'العربية' }).click();
    await expect(page).toHaveURL(arabic);
    await expect(page.locator('h1')).toHaveText('دليل الترجمة');

    const archived = `${apps.a.url}/es/docs/v/1/guides/localization`;
    await page.goto(archived);
    await expect(page.getByRole('heading', { level: 1, name: 'Guía de localización anterior' })).toBeVisible();
    await expect(page.locator('.doq-root')).toHaveAttribute('data-doq-version', '1');
    await expect(page.locator('.doq-locale a[hreflang="en"]')).toHaveAttribute('href', '/docs/v/1');
    await expect(page.locator('.doq-locale a[hreflang="ar"]')).toHaveCount(0);

    await page.goto(spanish);
    await expect(page.locator('.doq-version-link').filter({ hasText: 'v1.x' })).toHaveAttribute(
      'href',
      '/es/docs/v/1/guides/localization',
    );
    await page.goto(arabic);
    await expect(page.locator('.doq-version-link').filter({ hasText: 'v1.x' })).toHaveCount(0);
  });

  test('host-owned localized indexes render the matching catalog only', async ({ page }) => {
    await page.goto(`${apps.a.url}/es/docs`);
    await expect(page.locator('.doq-index')).toHaveAttribute('data-doq-locale', 'es');
    await expect(page.locator('.doq-index-card')).toHaveCount(1);
    await expect(page.locator('.doq-index-card')).toHaveAttribute('href', '/es/docs/guides/localization');
    await expect(page.locator('.doq-index')).not.toContainText('The English page');

    await page.goto(`${apps.a.url}/ar/docs`);
    await expect(page.locator('.doq-index')).toHaveAttribute('data-doq-locale', 'ar');
    await expect(page.locator('.doq-index-card')).toHaveCount(1);
    await expect(page.locator('.doq-index-card')).toHaveAttribute('href', '/ar/docs/guides/localization');
  });

  test('real Pagefind results compose locale and version filters and never leak missing translations', async ({
    page,
  }) => {
    await page.goto(english);
    const results = await page.evaluate(async () => {
      const bundleUrl = '/pagefind/pagefind.js';
      const pagefind = await import(/* @vite-ignore */ bundleUrl);
      await pagefind.init();
      const filterInventory = await pagefind.filters();
      const search = async (term: string, locale: string, version: string) => {
        document.documentElement.lang = locale;
        await pagefind.destroy();
        await pagefind.init();
        return Promise.all(
          (await pagefind.search(term, { filters: { doqsLocale: locale, doqsVersion: version } })).results.map(
            async (hit: any) => {
              const data = await hit.data();
              return { url: data.url as string, content: data.content as string };
            },
          ),
        );
      };
      const output = {
        filterInventory,
        englishUnfiltered: await search('amber compass', 'en', 'latest'),
        en: await search('amber compass', 'en', 'latest'),
        es: await search('brújula ámbar', 'es', 'latest'),
        ar: await search('بوصلة كهرمانية', 'ar', 'latest'),
        archived: await search('brújula antigua', 'es', '1'),
        wrongVersion: await search('brújula antigua', 'es', 'latest'),
        wrongLocale: await search('brújula ámbar', 'ar', 'latest'),
        missingTranslation: await search('amber compass', 'es', 'latest'),
      };
      console.log('MULTILINGUAL_PAGEFIND', JSON.stringify(output));
      return output;
    });
    expect(
      results.en.map((result) => result.url),
      JSON.stringify(results),
    ).toEqual(['/docs/guides/localization/']);
    expect(
      results.es.map((result) => result.url),
      JSON.stringify(results),
    ).toEqual(['/es/docs/guides/localization/']);
    expect(
      results.ar.map((result) => result.url),
      JSON.stringify(results),
    ).toEqual(['/ar/docs/guides/localization/']);
    expect(
      results.archived.map((result) => result.url),
      JSON.stringify(results),
    ).toEqual(['/es/docs/v/1/guides/localization/']);
    expect(results.wrongVersion).toEqual([]);
    expect(results.wrongLocale).toEqual([]);
    expect(results.missingTranslation).toEqual([]);
    expect(results.ar[0]?.content).toContain('بوصلة كهرمانية');
  });

  test('missing translations stay missing and localized search chrome follows the host signal', async ({ page }) => {
    expect((await page.request.get(`${apps.a.url}/docs/guides/localization`)).status()).toBe(200);
    expect((await page.request.get(`${apps.a.url}/docs/does-not-exist`)).status()).toBe(404);
    expect((await page.request.get(`${apps.a.url}/es/docs/guides/routing`)).status()).toBe(404);
    expect((await page.request.get(`${apps.a.url}/docs/host-route`)).status()).toBe(200);
    const missing = await page.request.get(`${apps.a.url}/es/docs/guides/routing`);
    expect(missing.status()).toBe(404);
    expect(await missing.text()).not.toContain('The English page');

    await page.goto(spanish);
    await expect(page.getByRole('button', { name: 'Buscar' })).toBeVisible();
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByRole('dialog', { name: 'Buscar documentación' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Buscar en la documentación' })).toBeVisible();
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
  });

  test('packed external consumer serves localized routes and Pagefind search', async ({ page }) => {
    test.skip(
      !!process.env['E2E_SKIP_CONSUMER'],
      'The focused suite skips the packed consumer; the full E2E gate runs it.',
    );
    await page.goto('http://127.0.0.1:4279/es/docs/guides/localization');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('heading', { level: 1, name: 'Guía de localización' })).toBeVisible();
    const urls = await page.evaluate(async () => {
      const bundleUrl = '/pagefind/pagefind.js';
      const pagefind = await import(/* @vite-ignore */ bundleUrl);
      await pagefind.init();
      const result = await pagefind.search('brújula ámbar', {
        filters: { doqsLocale: 'es', doqsVersion: 'latest' },
      });
      return Promise.all(result.results.map(async (hit: any) => (await hit.data()).url as string));
    });
    expect(urls).toEqual(['/es/docs/guides/localization/']);
  });
});

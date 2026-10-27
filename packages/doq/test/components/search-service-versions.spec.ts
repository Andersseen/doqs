import { describe, expect, it } from 'vitest';
import { DoqSearchService, DoqVersionNotIndexedError } from '../../src/lib/doq-search.service';

/**
 * A Pagefind-shaped ES module: Doq imports it exactly like the deployed bundle. The service appends "pagefind.js" to the
 * bundle path, so the module is a data: URL whose source ends in a line comment that swallows the appended name.
 */
async function fakeBundle(filters: Record<string, Record<string, number>>) {
  const source = `export const calls = (globalThis.__pagefindCalls ??= []);
export async function filters() { return ${JSON.stringify(filters)}; }
export async function search(query, options) {
  calls.push({ query, options });
  const only = options?.filters?.doqsVersion;
  return { results: [{ data: async () => ({ url: only ? '/docs/v/' + only + '/install/' : '/docs/install/', excerpt: 'x', meta: { title: 'Install' } }) }] };
}\n//`;
  return `data:text/javascript,${encodeURIComponent(source)}`;
}

describe('COMP-096 / COMP-144 DoqSearchService version and locale filters (SEARCH-02, SEARCH-04)', () => {
  const calls = () => (globalThis as { __pagefindCalls?: unknown[] }).__pagefindCalls ?? [];

  it('passes the version as a Pagefind filter, applied by Pagefind itself', async () => {
    const bundle = await fakeBundle({ doqsVersion: { latest: 3, '1': 2 } });
    const results = await new DoqSearchService().search('install', bundle, '/docs/v/1', '1');
    expect(calls().at(-1)).toEqual({ query: 'install', options: { filters: { doqsVersion: '1' } } });
    expect(results.map(result => result.url)).toEqual(['/docs/v/1/install']);
  });

  it('applies a locale filter before Pagefind ranks results', async () => {
    const bundle = await fakeBundle({ doqsLocale: { en: 3, es: 2 } });
    await new DoqSearchService().search('install', bundle, '/docs', undefined, 'es');
    expect(calls().at(-1)).toEqual({ query: 'install', options: { filters: { doqsLocale: 'es' } } });
  });

  it('rejects with DoqVersionNotIndexedError when no page carries that version', async () => {
    const bundle = await fakeBundle({ doqsVersion: { latest: 3 } });
    await expect(new DoqSearchService().search('install', bundle, '/docs/v/1', '1')).rejects.toBeInstanceOf(DoqVersionNotIndexedError);
    const bare = await fakeBundle({});
    await expect(new DoqSearchService().search('install', bare, '/docs/v/1', '1')).rejects.toBeInstanceOf(DoqVersionNotIndexedError);
  });

  it('sends no options and asks for no filters on an unversioned site', async () => {
    const bundle = await fakeBundle({});
    await new DoqSearchService().search('install', bundle, '/docs');
    expect(calls().at(-1)).toEqual({ query: 'install', options: undefined });
  });

  it('fails closed for localized search when the index has no locale metadata, while legacy search remains available', async () => {
    const legacy = await fakeBundle({});
    await expect(new DoqSearchService().search('install', legacy, '/docs', undefined, 'es')).rejects.toMatchObject({ reason: 'missing-metadata' });
    const otherLocale = await fakeBundle({ doqsLocale: { en: 1 } });
    await expect(new DoqSearchService().search('install', otherLocale, '/docs', undefined, 'es')).rejects.toMatchObject({ reason: 'missing-locale' });
    await expect(new DoqSearchService().search('install', legacy, '/docs')).resolves.toHaveLength(1);
  });
});

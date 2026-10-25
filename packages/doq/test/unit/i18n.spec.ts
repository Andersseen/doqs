import { describe, expect, it } from 'vitest';
import { normalizeDoqPaths, doqPrerenderRoutes } from '../../config/src/lib/doq-paths';
import {
  assertDoqSlugAvailable,
  DOQ_LOCALE_FILTER,
  doqLocaleLinks,
  doqReservedSegments,
  findDoqCatalog,
  getDoqCatalogs,
  normalizeDoqI18n,
  unlocalizedLocale,
} from '../../config/src/lib/doq-i18n';
import { createDoqStaticI18nAdapter, DOQ_DEFAULT_MESSAGES, formatDoqMessage } from '../../config/src/lib/doq-i18n-adapter';
import { formatDoqUsage } from '../../config/src/lib/doq-playground-model';
import { getDoqVersions } from '../../config/src/lib/doq-versions';

const i18n = {
  defaultLocale: 'en',
  locales: [
    { id: 'en', label: 'English' },
    { id: 'es', label: 'Español', contentDirectory: 'docs-es' },
    { id: 'uk', label: 'Українська', contentDirectory: 'docs-uk' },
  ],
} as const;

const versioning = {
  current: { id: 'latest', label: 'Latest' },
  archives: [{ id: '1', label: 'v1', contentDirectory: 'docs-v1' }],
} as const;

describe('UNIT-171 locale configuration validation (I18N-01, I18N-02)', () => {
  it('leaves an unlocalized configuration byte-identical to 0.11', () => {
    expect(normalizeDoqPaths({ contentDirectory: 'docs' })).toEqual({ contentDirectory: 'docs', basePath: '/docs' });
    expect('i18n' in normalizeDoqPaths({ contentDirectory: 'docs', basePath: '/' })).toBe(false);
  });

  it('resolves labels, prefixes and direction, keeping the default locale unprefixed', () => {
    const resolved = normalizeDoqPaths({ contentDirectory: 'docs', i18n }).i18n!;
    expect(resolved.defaultLocale).toBe('en');
    expect(resolved.locales.map(locale => [locale.id, locale.label, locale.prefix, locale.contentDirectory, locale.dir, locale.default])).toEqual([
      ['en', 'English', '', 'docs', 'ltr', true],
      ['es', 'Español', '/es', 'docs-es', 'ltr', false],
      ['uk', 'Українська', '/uk', 'docs-uk', 'ltr', false],
    ]);
  });

  it('defaults a missing label to the id and accepts an rtl locale', () => {
    const resolved = normalizeDoqI18n({ defaultLocale: 'en', locales: [{ id: 'en' }, { id: 'ar', contentDirectory: 'docs-ar', dir: 'rtl' }] }, 'docs', undefined);
    expect(resolved.locales[1]).toMatchObject({ id: 'ar', label: 'ar', dir: 'rtl', prefix: '/ar' });
  });

  it('accepts a BCP 47 tag with subtags as a URL prefix', () => {
    const resolved = normalizeDoqI18n({ defaultLocale: 'en', locales: [{ id: 'en' }, { id: 'pt-BR', contentDirectory: 'docs-pt-br' }] }, 'docs', undefined);
    expect(resolved.locales[1]!.prefix).toBe('/pt-BR');
  });

  it.each([
    ['an empty locale list', { defaultLocale: 'en', locales: [] }, /non-empty array/],
    ['a malformed locale id', { defaultLocale: 'en', locales: [{ id: 'not a locale' }, { id: 'en' }] }, /invalid locale id/],
    ['a duplicate locale id', { defaultLocale: 'en', locales: [{ id: 'en' }, { id: 'EN', contentDirectory: 'docs-en' }] }, /duplicate locale id/],
    ['an unknown default locale', { defaultLocale: 'fr', locales: [{ id: 'en' }] }, /is not one of the configured locales/],
    ['a non-default locale with no directory', { defaultLocale: 'en', locales: [{ id: 'en' }, { id: 'es' }] }, /needs a contentDirectory/],
    ['a default locale overriding the top-level directory', { defaultLocale: 'en', locales: [{ id: 'en', contentDirectory: 'other' }] }, /must use the top-level contentDirectory/],
    ['two locales sharing one directory', { defaultLocale: 'en', locales: [{ id: 'en' }, { id: 'es', contentDirectory: 'docs' }] }, /overlaps/],
    ['nested locale directories', { defaultLocale: 'en', locales: [{ id: 'en' }, { id: 'es', contentDirectory: 'docs/es' }] }, /overlaps/],
    ['a traversal in a locale directory', { defaultLocale: 'en', locales: [{ id: 'en' }, { id: 'es', contentDirectory: '../secret' }] }, /needs a contentDirectory/],
    ['an invalid direction', { defaultLocale: 'en', locales: [{ id: 'en' }, { id: 'es', contentDirectory: 'docs-es', dir: 'sideways' }] }, /invalid dir/],
    ['an invalid fallback', { defaultLocale: 'en', locales: [{ id: 'en' }], fallback: 'machine-translate' }, /i18n\.fallback must be/],
  ])('rejects %s', (_name, config, message) => {
    expect(() => normalizeDoqI18n(config as never, 'docs', undefined)).toThrow(message);
  });
});

describe('UNIT-172 locale and version composition (I18N-05)', () => {
  const paths = normalizeDoqPaths({ contentDirectory: 'docs', basePath: '/docs', versioning, i18n: { ...i18n, locales: [{ id: 'en', label: 'English' }, { id: 'es', label: 'Español', contentDirectory: 'docs-es', archives: { 1: 'docs-es-v1' } }] } });

  it('produces one catalog per published locale and version, default locale first', () => {
    expect(getDoqCatalogs(paths).map(catalog => [catalog.locale.id, catalog.version.id, catalog.contentDirectory, catalog.basePath, catalog.current])).toEqual([
      ['en', 'latest', 'docs', '/docs', true],
      ['en', '1', 'docs-v1', '/docs/v/1', false],
      ['es', 'latest', 'docs-es', '/es/docs', true],
      ['es', '1', 'docs-es-v1', '/es/docs/v/1', false],
    ]);
  });

  it('uses the configured version path segment inside every locale, never a hardcoded "v"', () => {
    const custom = normalizeDoqPaths({ contentDirectory: 'docs', versioning: { ...versioning, pathSegment: 'old' }, i18n: { defaultLocale: 'en', locales: [{ id: 'en' }, { id: 'es', contentDirectory: 'docs-es', archives: { 1: 'docs-es-v1' } }] } });
    expect(getDoqCatalogs(custom).map(catalog => catalog.basePath)).toEqual(['/docs', '/docs/old/1', '/es/docs', '/es/docs/old/1']);
  });

  it('omits a locale/version combination nobody publishes instead of borrowing another locale', () => {
    const partial = normalizeDoqPaths({ contentDirectory: 'docs', versioning, i18n });
    const catalogs = getDoqCatalogs(partial);
    // `es` and `uk` declare no archive directory, so the 0.11 archive exists for `en` only.
    expect(catalogs.map(catalog => catalog.basePath)).toEqual(['/docs', '/docs/v/1', '/es/docs', '/uk/docs']);
    expect(findDoqCatalog(catalogs, 'es', '1')).toBeUndefined();
    expect(findDoqCatalog(catalogs, 'en', '1')?.contentDirectory).toBe('docs-v1');
  });

  it('composes locales with a root-mounted documentation tree', () => {
    const root = normalizeDoqPaths({ contentDirectory: 'docs', basePath: '/', i18n });
    expect(getDoqCatalogs(root).map(catalog => catalog.basePath)).toEqual(['/', '/es', '/uk']);
  });

  it('rejects a locale id that collides with the version path segment', () => {
    expect(() => normalizeDoqPaths({ contentDirectory: 'docs', versioning: { ...versioning, pathSegment: 'es' }, i18n })).toThrow(/collides with versioning\.pathSegment/);
  });

  it('rejects a locale id that is not a usable BCP 47 primary subtag', () => {
    expect(() => normalizeDoqPaths({ contentDirectory: 'docs', versioning, i18n: { defaultLocale: 'en', locales: [{ id: 'en' }, { id: 'v', contentDirectory: 'docs-v' }] } })).toThrow(/invalid locale id/);
  });

  it('keeps an unlocalized versioned tree exactly as 0.11 produced it', () => {
    const unlocalized = normalizeDoqPaths({ contentDirectory: 'docs', basePath: '/docs', versioning });
    expect(getDoqCatalogs(unlocalized).map(catalog => catalog.basePath)).toEqual(getDoqVersions(unlocalized).map(version => version.basePath));
    expect(getDoqCatalogs(unlocalized).every(catalog => catalog.locale.id === '')).toBe(true);
    expect(unlocalizedLocale('docs')).toMatchObject({ id: '', prefix: '', default: true });
  });
});

describe('UNIT-173 prerender routes for localized trees (I18N-04)', () => {
  it('emits an index and a content route per catalog, with the locale prefix', () => {
    const routes = doqPrerenderRoutes({ contentDirectory: 'docs', basePath: '/docs', i18n });
    expect(routes.filter(route => typeof route === 'string')).toEqual(['/docs', '/es/docs', '/uk/docs']);
    expect(routes.filter(route => typeof route !== 'string').map(route => (route as { contentDir: string }).contentDir)).toEqual(['src/content/docs', 'src/content/docs-es', 'src/content/docs-uk']);
  });

  it('transforms a file into its localized public URL', () => {
    const routes = doqPrerenderRoutes({ contentDirectory: 'docs', basePath: '/docs', i18n }) as { transform: (file: { name: string; relativePath?: string }) => string }[];
    const spanish = routes.filter(route => typeof route !== 'string')[1]!;
    expect(spanish.transform({ name: 'button', relativePath: 'components' })).toBe('/es/docs/components/button');
  });

  it('keeps default-locale URLs unchanged for an unlocalized site', () => {
    expect(doqPrerenderRoutes({ contentDirectory: 'docs' }).filter(route => typeof route === 'string')).toEqual(['/docs']);
  });
});

describe('UNIT-174 translation identity and missing translations (I18N-06)', () => {
  const resolved = normalizeDoqPaths({ contentDirectory: 'docs', i18n }).i18n!;
  const version = getDoqVersions(normalizeDoqPaths({ contentDirectory: 'docs' }))[0]!;
  const catalogs = { en: [{ slug: 'getting-started' }, { slug: 'guides/routing' }], es: [{ slug: 'getting-started' }], uk: [] };

  it('links a locale that publishes the same slug to that slug', () => {
    const links = doqLocaleLinks(resolved, 'en', version, 'getting-started', catalogs);
    expect(links.map(link => [link.id, link.href, link.sameDocument, link.active])).toEqual([
      ['en', '/docs/getting-started', true, true],
      ['es', '/es/docs/getting-started', true, false],
      ['uk', '/uk/docs', false, false],
    ]);
  });

  it('sends a locale without the document to its own index rather than to English content', () => {
    const links = doqLocaleLinks(resolved, 'en', version, 'guides/routing', catalogs);
    expect(links.find(link => link.id === 'es')).toMatchObject({ href: '/es/docs', sameDocument: false });
  });

  it('never infers translation identity from a translated title', () => {
    const titled = { en: [{ slug: 'getting-started' }], es: [{ slug: 'primeros-pasos' }] };
    const links = doqLocaleLinks(resolved, 'en', version, 'getting-started', titled);
    expect(links.find(link => link.id === 'es')?.href).toBe('/es/docs');
  });

  it('omits a locale that does not publish this version at all', () => {
    const links = doqLocaleLinks(resolved, 'en', version, 'getting-started', { en: [{ slug: 'getting-started' }] });
    expect(links.map(link => link.id)).toEqual(['en']);
  });

  it('resolves the fallback mode but never lets it change where a locale link points', () => {
    const withFallback = normalizeDoqPaths({ contentDirectory: 'docs', i18n: { ...i18n, fallback: 'default-locale' } }).i18n!;
    expect(withFallback.fallback).toBe('default-locale');
    expect(resolved.fallback).toBe('none');
    // Serving English under a Spanish URL is a property of the rendered page, so the switcher links are
    // identical either way: `en` publishes the slug, `es` does not and leads to its own index.
    const links = doqLocaleLinks(withFallback, 'es', version, 'guides/routing', catalogs).map(link => [link.id, link.href, link.sameDocument]);
    expect(links).toEqual(doqLocaleLinks(resolved, 'es', version, 'guides/routing', catalogs).map(link => [link.id, link.href, link.sameDocument]));
    expect(links).toEqual([['en', '/docs/guides/routing', true], ['es', '/es/docs', false], ['uk', '/uk/docs', false]]);
  });

  it('reserves every non-default locale id against current-version slugs', () => {
    expect(doqReservedSegments(resolved, undefined)).toEqual(['es', 'uk']);
    expect(doqReservedSegments(undefined, undefined)).toEqual([]);
    expect(doqReservedSegments(resolved, normalizeDoqPaths({ contentDirectory: 'docs', versioning, i18n }).versioning)).toEqual(['v', 'es', 'uk']);
    expect(() => assertDoqSlugAvailable('es/fake', ['es', 'uk'], 'src/content/docs/es/fake.md')).toThrow(/reserved URL prefix "es\/"/);
    expect(() => assertDoqSlugAvailable('ES/fake', ['es'], 'x.md')).toThrow(/reserved URL prefix/);
    expect(() => assertDoqSlugAvailable('getting-started', ['es', 'uk'], 'x.md')).not.toThrow();
  });
});

describe('UNIT-175 interface strings and the adapter fallback (I18N-08)', () => {
  it('substitutes named parameters and leaves unknown ones intact', () => {
    expect(formatDoqMessage('{count} results', { count: 3 })).toBe('3 results');
    expect(formatDoqMessage('No results for “{query}”.', { query: 'doq' })).toBe('No results for “doq”.');
    expect(formatDoqMessage('{missing} stays', {})).toBe('{missing} stays');
    expect(formatDoqMessage('untouched')).toBe('untouched');
  });

  it('keeps the English defaults a 0.11 reader already sees', () => {
    expect(DOQ_DEFAULT_MESSAGES['toc.title']).toBe('On this page');
    expect(DOQ_DEFAULT_MESSAGES['search.trigger']).toBe('Search');
    expect(DOQ_DEFAULT_MESSAGES['nav.close']).toBe('Close navigation');
    expect(DOQ_DEFAULT_MESSAGES['pagination.previous']).toBe('Previous');
    expect(DOQ_DEFAULT_MESSAGES['notFound.title']).toBe('Documentation page not found');
    expect(DOQ_DEFAULT_MESSAGES['documentation.loading']).toBe('Loading documentation…');
  });

  it('gives a host adapter the English fallback for a key it does not translate', () => {
    const adapter = createDoqStaticI18nAdapter();
    expect(adapter.translate('toc.title', DOQ_DEFAULT_MESSAGES['toc.title'])).toBe('On this page');
    expect(adapter.localize('/docs/x')).toBe('/docs/x');
    expect(adapter.locale()).toBe('');
    expect(adapter.direction()).toBe('ltr');
  });

  it('exposes a locale filter name distinct from the version filter', () => {
    expect(DOQ_LOCALE_FILTER).toBe('doqsLocale');
  });
});

describe('UNIT-176 usage snippets may omit declared defaults (AM-06)', () => {
  const defaults = { moveDelay: 0, moveDisabled: false, variant: 'solid' } as const;

  it('is unchanged without the option, so 0.11 output is byte-identical', () => {
    expect(formatDoqUsage('div', { moveDelay: 0, moveDisabled: false })).toBe('<div [moveDelay]="0" [moveDisabled]="false" />');
    expect(formatDoqUsage('div', { moveDelay: 0 }, { defaults: {} })).toBe('<div [moveDelay]="0" />');
  });

  it('omits only values identical to a declared default', () => {
    expect(formatDoqUsage('div', { moveDelay: 0 }, { defaults })).toBe('<div />');
    expect(formatDoqUsage('div', { moveDisabled: false }, { defaults })).toBe('<div />');
    // A string default is compared by value too, so an unchanged variant drops out just like 0 and false.
    expect(formatDoqUsage('div', { variant: 'solid' }, { defaults })).toBe('<div />');
  });

  it('keeps a changed value, including falsy and zero values that are not the default', () => {
    expect(formatDoqUsage('div', { moveDelay: 250 }, { defaults })).toBe('<div [moveDelay]="250" />');
    expect(formatDoqUsage('div', { moveDelay: 0, moveDisabled: true }, { defaults })).toBe('<div [moveDisabled]="true" />');
    expect(formatDoqUsage('div', { variant: 'outline' }, { defaults })).toBe('<div variant="outline" />');
  });

  it('never suppresses 0 or false by type for an input that has no declared default', () => {
    expect(formatDoqUsage('div', { unrelated: 0, other: false }, { defaults })).toBe('<div [unrelated]="0" [other]="false" />');
  });

  it('still leaves unset inputs out and keeps escaping intact', () => {
    expect(formatDoqUsage('div', { moveDelay: undefined, variant: 'solid' }, { defaults })).toBe('<div />');
    expect(formatDoqUsage('x-y', { label: 'Say "hi" <b>&' }, { defaults: { label: 'other' } })).toBe('<x-y label="Say &quot;hi&quot; &lt;b&gt;&amp;" />');
  });
});

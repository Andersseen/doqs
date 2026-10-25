import { inject } from '@angular/core';
import { CanMatchFn, Route, Routes, UrlMatcher, UrlSegment } from '@angular/router';
import { DOQ_CONFIG, DoqConfig } from '@doqs/analog/config';
import { injectDoqDocuments } from './doq-catalog';
import { DoqDocsComponent } from './doq-docs.component';
import { DoqIndexComponent } from './doq-index.component';
import { doqReservedSegments, getDoqCatalogs, normalizeDoqPaths } from '@doqs/analog/config';

/**
 * Public Angular Router bridge. It captures the nested path as one Analog content slug.
 *
 * Routes are generated per (locale, version) catalog. The default locale keeps the unprefixed URLs a
 * 0.11 consumer already has, every other locale gets `/<locale>` in front of them, and archives keep
 * their `<basePath>/<pathSegment>/<id>` shape inside each locale — so `/docs/v/1/x` and
 * `/es/docs/v/1/x` are both real, and a locale that does not publish an archive has no routes for it.
 * Locale-prefixed routes are listed first: on a root-mounted tree `/es/getting-started` must never be
 * readable as the slug `es/getting-started`.
 */
export function doqRoutes(config: Pick<DoqConfig, 'basePath' | 'routeParam' | 'versioning' | 'i18n' | 'unmatched'> = {}): Routes {
  const routeParam = config.routeParam ?? 'slug';
  const paths = normalizeDoqPaths({ contentDirectory: 'docs', ...config });
  const matchesPrefix = (segments: UrlSegment[], prefix: readonly string[]) => prefix.every((part, index) => segments[index]?.path === part);
  const continues = config.unmatched === 'continue';
  const reserved = doqReservedSegments(paths.i18n, paths.versioning);
  /**
   * `unmatched: 'continue'`: claim a URL only when this exact catalog has a document for its slug, read
   * from the injected content catalog. Locale and version are both part of the identity, so an English
   * document never makes a Spanish URL claimable.
   */
  const hasDocument = (versionId: string | undefined, localeId: string | undefined, prefixLength: number): CanMatchFn => (_route, segments) => {
    const slug = segments.slice(prefixLength).map(segment => segment.path).join('/');
    return injectDoqDocuments(inject(DOQ_CONFIG), versionId, localeId).some(doc => doc.slug === slug);
  };
  const versionRoutes = (prefix: readonly string[], data: Route['data'], versionId: string | undefined, localeId: string | undefined, hostOwnsIndex = false): Route[] => [
    ...(hostOwnsIndex ? [] : [{ matcher: (segments: UrlSegment[]) => segments.length === prefix.length && matchesPrefix(segments, prefix) ? { consumed: segments, posParams: {} } : null, component: DoqIndexComponent, data } as Route]),
    {
      matcher: (segments) => {
        if (segments.length <= prefix.length || !matchesPrefix(segments, prefix)) return null;
        return { consumed: segments, posParams: { [routeParam]: new UrlSegment(segments.slice(prefix.length).map(segment => segment.path).join('/'), {}) } };
      },
      component: DoqDocsComponent,
      data,
      ...(continues ? { canMatch: [hasDocument(versionId, localeId, prefix.length)] } : {}),
    },
  ];

  const catalogs = getDoqCatalogs(paths);
  const locales = paths.i18n ? paths.i18n.locales : [undefined];
  const routesForLocale = (localeId: string | undefined): Routes => {
    const own = catalogs.filter(catalog => catalog.locale.id === (localeId ?? ''));
    if (!own.length) return [];
    const localePrefix = own[0]!.locale.prefix.split('/').filter(Boolean);
    const archives = own.filter(catalog => !catalog.current);
    const current = own.find(catalog => catalog.current)!;
    const currentPrefix = current.basePath.split('/').filter(Boolean);
    const data = { ...(localeId === undefined ? {} : { doqLocale: localeId }), ...(paths.versioning ? { doqVersion: current.version.id } : {}) };
    if (!paths.versioning) return versionRoutes(currentPrefix, paths.versioning ? data : (localeId === undefined ? undefined : data), undefined, localeId, continues);
    const reservedPrefix = [...currentPrefix, paths.versioning.pathSegment];
    const unknownVersion: UrlMatcher = (segments) => segments.length > currentPrefix.length && matchesPrefix(segments, reservedPrefix) ? { consumed: segments, posParams: {} } : null;
    const currentRoutes = versionRoutes(currentPrefix, data, current.version.id, localeId, continues);
    // The current document matcher must not capture the reserved archive prefix: an unconfigured version
    // is "not found", never a current slug.
    const currentDocument = currentRoutes[currentRoutes.length - 1] as Route;
    const currentIndex = currentRoutes.slice(0, -1);
    const guardedDocument: Route = {
      ...currentDocument,
      matcher: (segments, group, route) => (segments.length > reservedPrefix.length - 1 && matchesPrefix(segments, reservedPrefix) ? null : (currentDocument.matcher as UrlMatcher)(segments, group, route)),
    };
    return [
      ...archives.flatMap(archive => versionRoutes(archive.basePath.split('/').filter(Boolean), { ...data, doqVersion: archive.version.id }, archive.version.id, localeId)),
      { matcher: unknownVersion, component: DoqDocsComponent, data: { ...data, doqUnknownVersion: true } },
      ...currentIndex,
      guardedDocument,
    ];
  };

  if (!paths.i18n) return routesForLocale(undefined);
  const defaultLocale = paths.i18n.defaultLocale;
  // Prefixed locales first, then the default locale; within the default locale the archive prefix is
  // additionally guarded so `/docs/v/unknown` is an unknown version rather than a slug.
  const localized = paths.i18n.locales.filter(locale => locale.id !== defaultLocale).flatMap(locale => routesForLocale(locale.id));
  const defaults = routesForLocale(defaultLocale);
  return [...localized, ...defaults];
}

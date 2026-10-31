import { inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { injectContentFiles } from '@analogjs/content';
import { DOQ_CONFIG, DoqConfig } from '@doqs/analog/config';
import { DoqDocument, DoqDocumentAttributes, normalizeDoqDocument, sortDoqDocuments } from '@doqs/analog/config';
import { normalizeDoqPathsFull } from '@doqs/analog/config';
import { assertDoqSlugAvailable, DoqCatalog, DoqResolvedLocale, doqReservedSegments, findDoqCatalog, getDoqCatalogs } from '@doqs/analog/config';
import { DoqVersion, getDoqVersions } from '@doqs/analog/config';

/**
 * Sorted, de-duplicated documents of one (locale, version) tree — the current version of the default
 * locale unless told otherwise. Each catalog reads only its own content directory, so catalogs never
 * mix across versions or languages. Call from an injection context.
 */
export function injectDoqDocuments(config: DoqConfig = inject(DOQ_CONFIG), versionId?: string, localeId?: string): readonly DoqDocument[] {
  const paths = normalizeDoqPathsFull(config);
  const catalog = resolveCatalog(paths, versionId, localeId);
  const { contentDirectory, basePath } = catalog;
  const files = injectContentFiles<DoqDocumentAttributes>(file => file.filename.includes(`/content/${contentDirectory}/`));
  const documents = files.map(file => normalizeDoqDocument(file, contentDirectory, basePath)).filter((doc): doc is DoqDocument => !!doc);
  if (catalog.current) {
    const reserved = doqReservedSegments(paths.i18n, paths.versioning);
    for (const doc of documents) assertDoqSlugAvailable(doc.slug, reserved, doc.sourceFilename);
  } else if (!documents.length) {
    throw new Error(`Doq: version "${catalog.version.id}" has no Markdown documents in src/content/${contentDirectory}/.`);
  }
  return sortDoqDocuments(documents);
}

/** Catalogs of every version of one locale, keyed by version id; used to resolve where the version selector points. */
export function injectDoqCatalogs(config: DoqConfig = inject(DOQ_CONFIG), localeId?: string): Readonly<Record<string, readonly DoqDocument[]>> {
  const paths = normalizeDoqPathsFull(config);
  const locale = resolveLocale(paths, localeId);
  const catalogs = getDoqCatalogs(paths).filter(catalog => catalog.locale.id === locale.id);
  // Delegates to injectDoqDocuments so an archive with no Markdown still fails loudly here, exactly as
  // it does when that archive is the page being rendered.
  return Object.fromEntries(catalogs.map(catalog => [catalog.version.id, injectDoqDocuments(config, catalog.version.id, locale.id || undefined)]));
}

/**
 * Catalogs of every locale for one version, keyed by locale id. A locale that does not publish that
 * version is absent, which is how the language selector knows not to link to it.
 */
export function injectDoqLocaleCatalogs(config: DoqConfig = inject(DOQ_CONFIG), versionId?: string): Readonly<Record<string, readonly DoqDocument[]>> {
  const paths = normalizeDoqPathsFull(config);
  const version = resolveVersion(paths, versionId);
  const catalogs = getDoqCatalogs(paths).filter(catalog => catalog.version.id === version.id);
  return Object.fromEntries(catalogs.map(catalog => [catalog.locale.id, injectDoqDocuments(config, version.id, catalog.locale.id || undefined)]));
}

/** The catalog one route renders, resolved from the route data `doqRoutes()` wrote. */
export function injectDoqCatalog(config: DoqConfig = inject(DOQ_CONFIG)): DoqCatalog {
  return resolveDoqRouteCatalog(config, inject(ActivatedRoute).snapshot.data, inject(Router).url);
}

/** Resolve the same locale/version catalog used by the routed docs view, from route snapshot data. */
export function resolveDoqRouteCatalog(config: DoqConfig, data: Readonly<Record<string, unknown>>, url: string): DoqCatalog {
  const paths = normalizeDoqPathsFull(config);
  const urlLocale = url.split(/[?#]/, 1)[0]?.split('/').filter(Boolean)[0];
  const locale = data['doqLocale'] as string | undefined ?? paths.i18n?.locales.find(candidate => !candidate.default && candidate.id === urlLocale)?.id;
  return resolveCatalog(paths, data['doqVersion'] as string | undefined, locale);
}

export interface DoqVersionContext {
  readonly versions: readonly DoqVersion[];
  /** The version the routed page belongs to (the current version for an unknown version URL). */
  readonly version: DoqVersion;
  /** True when the URL names an archive that is not configured. */
  readonly unknown: boolean;
  readonly versioned: boolean;
}

/** Version of the routed page, taken from the route data written by doqRoutes(). Call from an injection context. */
export function injectDoqVersion(config: DoqConfig = inject(DOQ_CONFIG)): DoqVersionContext {
  const data = inject(ActivatedRoute).snapshot.data;
  const paths = normalizeDoqPathsFull(config);
  const versions = getDoqVersions(paths);
  const requested = data['doqVersion'] as string | undefined;
  const version = (requested === undefined ? undefined : versions.find(candidate => candidate.id === requested)) ?? versions[0]!;
  return { versions, version, unknown: !!data['doqUnknownVersion'], versioned: !!paths.versioning };
}

export interface DoqLocaleContext {
  /** Every published locale, in configured order. Empty on an unlocalized site. */
  readonly locales: readonly DoqResolvedLocale[];
  /** The locale the routed page belongs to; undefined on an unlocalized site. */
  readonly locale: DoqResolvedLocale | undefined;
  /** True when the URL names a locale that is not configured. */
  readonly unknown: boolean;
  readonly localized: boolean;
}

/** Locale of the routed page, taken from the route data written by doqRoutes(). Call from an injection context. */
export function injectDoqLocale(config: DoqConfig = inject(DOQ_CONFIG)): DoqLocaleContext {
  const data = inject(ActivatedRoute).snapshot.data;
  const paths = normalizeDoqPathsFull(config);
  const i18n = paths.i18n;
  if (!i18n) return { locales: [], locale: undefined, unknown: false, localized: false };
  const requested = data['doqLocale'] as string | undefined;
  const locale = (requested === undefined ? undefined : i18n.locales.find(candidate => candidate.id === requested)) ?? i18n.locales.find(candidate => candidate.default);
  return { locales: i18n.locales, locale, unknown: !!data['doqUnknownLocale'], localized: i18n.locales.length > 1 };
}

/** Copy used by the built-in components; unset values fall back to Doq's defaults. */
export function resolveDoqCopy(config: DoqConfig) {
  const p = config.presentation ?? {};
  const label = p.documentationLabel?.trim();
  return {
    label: label || 'Documentation',
    breadcrumbRoot: label || 'Docs',
    indexTitle: p.indexTitle?.trim() || 'Explore the docs',
    indexDescription: p.indexDescription?.trim() || 'Browse guides and references for this product.',
    pageTitleSuffix: p.pageTitleSuffix === undefined ? 'Documentation' : p.pageTitleSuffix.trim(),
    hasIndexTitle: !!p.indexTitle?.trim(),
    hasIndexDescription: !!p.indexDescription?.trim(),
  };
}

type ResolvedPaths = ReturnType<typeof normalizeDoqPathsFull>;

function resolveLocale(paths: ResolvedPaths, localeId?: string): DoqResolvedLocale {
  if (!paths.i18n) return { id: '', label: '', dir: 'ltr', prefix: '', contentDirectory: paths.contentDirectory, archives: {}, default: true };
  const locale = localeId === undefined ? undefined : paths.i18n.locales.find(candidate => candidate.id === localeId);
  return locale ?? paths.i18n.locales.find(candidate => candidate.default)!;
}

function resolveVersion(paths: ResolvedPaths, versionId?: string): DoqVersion {
  const versions = getDoqVersions(paths);
  const version = versionId === undefined ? undefined : versions.find(candidate => candidate.id === versionId);
  return version ?? versions[0]!;
}

function resolveCatalog(paths: ResolvedPaths, versionId?: string, localeId?: string): DoqCatalog {
  const version = resolveVersion(paths, versionId);
  const locale = resolveLocale(paths, localeId);
  const catalog = findDoqCatalog(getDoqCatalogs(paths), locale.id, version.id);
  if (catalog) return catalog;
  // A (locale, version) combination nobody publishes falls back to the default locale's catalog for
  // that version, so the route can render Doqs's "not found" instead of throwing during resolution.
  const fallback = findDoqCatalog(getDoqCatalogs(paths), paths.i18n?.defaultLocale ?? '', version.id);
  if (fallback) return fallback;
  throw new Error(`Doq: unknown documentation catalog for locale "${locale.id}" and version "${version.id}".`);
}

function catalogDocuments(paths: ResolvedPaths, catalog: DoqCatalog): readonly DoqDocument[] {
  const files = injectContentFiles<DoqDocumentAttributes>(file => file.filename.includes(`/content/${catalog.contentDirectory}/`));
  const documents = files.map(file => normalizeDoqDocument(file, catalog.contentDirectory, catalog.basePath)).filter((doc): doc is DoqDocument => !!doc);
  if (catalog.current) {
    const reserved = doqReservedSegments(paths.i18n, paths.versioning);
    for (const doc of documents) assertDoqSlugAvailable(doc.slug, reserved, doc.sourceFilename);
  }
  return sortDoqDocuments(documents);
}

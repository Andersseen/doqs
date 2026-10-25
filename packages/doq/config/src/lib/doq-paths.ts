import { doqPrerenderRoute } from './doq-document';
import { DoqResolvedI18n, DoqI18nConfig, getDoqCatalogs, normalizeDoqI18n } from './doq-i18n';
import { DoqResolvedVersioning, DoqVersioning, normalizeContentDirectory, normalizeDoqVersioning } from './doq-versions';

/** The values shared by Angular runtime config and Analog's build-time prerender config. */
export interface DoqPaths {
  /** Analog content subdirectory; docs are read from src/content/<contentDirectory>. */
  readonly contentDirectory: string;
  /** Public mount path, for example /docs, or "/" when the whole application is documentation. Defaults to /docs. */
  readonly basePath?: string;
  /** Optional documentation versions: this `contentDirectory` stays the current version; archives are separate snapshots. */
  readonly versioning?: DoqVersioning;
  /**
   * Optional localization: independently authored Markdown per locale, served at `/<locale>` prefixed
   * URLs while the default locale keeps the URLs the site already has. Omit it entirely to keep the
   * single-locale 0.11 behavior.
   */
  readonly i18n?: DoqI18nConfig;
}

/** Analog `prerender.routes` entry that expands a content directory into routes. */
export interface DoqPrerenderContentRoute {
  contentDir: string;
  recursive: true;
  transform: (file: { name: string; relativePath?: string; attributes?: { slug?: unknown } }) => string;
}

export interface DoqResolvedPaths {
  contentDirectory: string;
  basePath: string;
  versioning?: DoqResolvedVersioning;
  i18n?: DoqResolvedI18n;
}

/** Trim and validate path settings; returns slash-free `contentDirectory` and a `/`-prefixed `basePath` ("/" for the root). */
export function normalizeDoqPaths(paths: DoqPaths): { contentDirectory: string; basePath: string; versioning?: DoqResolvedVersioning } {
  const { i18n: _i18n, ...rest } = normalizeDoqPathsFull(paths);
  return rest;
}

/**
 * `normalizeDoqPaths` plus the resolved `i18n` block. Kept as a separate export so the 0.7-era
 * declaration of `normalizeDoqPaths` stays byte-identical: the public-API gate compares existing
 * declarations against the baseline by text, so widening an old signature counts as a break even when
 * the change is additive. New code that needs locales imports this one.
 */
export function normalizeDoqPathsFull(paths: DoqPaths): DoqResolvedPaths {
  const contentDirectory = normalizeContentDirectory(paths.contentDirectory ?? '');
  if (!contentDirectory) {
    throw new Error(`Doq: invalid contentDirectory "${paths.contentDirectory}"; use a directory below src/content, for example "docs".`);
  }
  const rawBasePath = (paths.basePath ?? '/docs').trim();
  const segments = rawBasePath.split('/').filter(Boolean);
  // "/" mounts the documentation at the application root; an empty string is still a mistake.
  const isRoot = rawBasePath.length > 0 && !segments.length;
  if ((!segments.length && !isRoot) || segments.some(part => part === '.' || part === '..')) {
    throw new Error(`Doq: invalid basePath "${paths.basePath}"; use a mount path such as "/docs", or "/" for the application root.`);
  }
  const result: DoqResolvedPaths = { contentDirectory, basePath: `/${segments.join('/')}` };
  // Versioning resolves first: locale archive directories are validated against the archive ids it declares.
  const withVersions = paths.versioning === undefined ? result : { ...result, versioning: normalizeDoqVersioning(paths.versioning, contentDirectory) };
  return paths.i18n === undefined ? withVersions : { ...withVersions, i18n: normalizeDoqI18n(paths.i18n, contentDirectory, withVersions.versioning) };
}

/**
 * Analog prerender routes for a Doq documentation tree: the index plus every Markdown file below
 * `src/content/<contentDirectory>`, mapped to its canonical (or custom-slug) public URL.
 * With `i18n`, every published (locale, version) tree contributes its own index and content routes, so
 * a localized page is prerendered only where its Markdown actually exists.
 * Spread the result into `analog({ prerender: { routes: async () => ['/', ...doqPrerenderRoutes(doqPaths)] } })`.
 */
export function doqPrerenderRoutes(paths: DoqPaths): readonly (string | DoqPrerenderContentRoute)[] {
  const normalized = normalizeDoqPathsFull(paths);
  const reserved = normalized.versioning?.pathSegment;
  return getDoqCatalogs(normalized).flatMap((catalog): (string | DoqPrerenderContentRoute)[] => [
    catalog.basePath,
    {
      contentDir: `src/content/${catalog.contentDirectory}`,
      recursive: true,
      transform: file => doqPrerenderRoute(file, catalog.basePath, catalog.current ? reserved : undefined),
    },
  ]);
}

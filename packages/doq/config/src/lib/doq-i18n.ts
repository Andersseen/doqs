import { joinDoqPath } from './doq-document';
import { DoqResolvedVersioning, DoqVersion, getDoqVersions, normalizeContentDirectory } from './doq-versions';

/**
 * Pure localization helpers. No Angular runtime, no DOM, no Node: safe to import from `vite.config.ts`,
 * from the `@doqs/analog/config` entry point and from the browser bundle.
 *
 * Doqs owns documentation content and its own UI text. It never owns the host's translation provider,
 * so everything here is configuration and URL arithmetic; reading the active locale and translating
 * strings goes through the adapter in `doq-i18n-adapter.ts`.
 */

export type DoqTextDirection = 'ltr' | 'rtl';

/**
 * BCP 47 primary language plus optional subtags, restricted to characters that are also safe as a single
 * URL segment. Deliberately not a full BCP 47 grammar: a locale id becomes a path prefix, so an id that
 * cannot appear in a URL is rejected here rather than producing an unroutable tree.
 */
const LOCALE_ID = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

/** Pagefind filter carrying the locale id on every indexed page of a localized site. */
export const DOQ_LOCALE_FILTER = 'doqsLocale';

/** One locale as written in configuration. */
export interface DoqLocaleConfig {
  /** BCP 47 identifier, for example "en", "es", "uk" or "ar". Also the URL prefix of every non-default locale. */
  readonly id: string;
  /** Text shown in the language selector. Defaults to the id. */
  readonly label?: string;
  /** Text direction of the locale. Defaults to "ltr". */
  readonly dir?: DoqTextDirection;
  /**
   * Analog content subdirectory holding this locale's *current-version* documents. Required for every
   * locale except the default one, which uses the top-level `contentDirectory`: a localized URL must
   * never silently serve another locale's content.
   */
  readonly contentDirectory?: string;
  /**
   * Content directories for archived versions, keyed by version id. A locale that omits an archive does
   * not serve it: that locale/version combination has no routes and no prerendered pages.
   */
  readonly archives?: Readonly<Record<string, string>>;
}

/** Optional localization. Omitting it entirely keeps the 0.11 single-locale behavior and URLs. */
export interface DoqI18nConfig {
  /** The locale served at the unprefixed URLs. Must be one of `locales`. */
  readonly defaultLocale: string;
  /** Every published locale, in the order the language selector shows them. */
  readonly locales: readonly DoqLocaleConfig[];
  /**
   * What a localized URL does when the document exists only in the default locale.
   * - `'none'` (default): the URL has no document, so Doqs renders "not found" (HTTP 404 under SSR).
   *   Translations are never implied from similar titles.
   * - `'default-locale'`: serve the default locale's document at the localized URL *and* render a
   *   visible untranslated notice, so the reader is never silently shown another language.
   */
  readonly fallback?: 'none' | 'default-locale';
}

export interface DoqResolvedLocale {
  readonly id: string;
  readonly label: string;
  readonly dir: DoqTextDirection;
  /** URL prefix: `''` for the default locale, `'/<id>'` for every other one. */
  readonly prefix: string;
  /** Content directory of the current version for this locale. */
  readonly contentDirectory: string;
  /** Resolved archive directories, keyed by version id. */
  readonly archives: Readonly<Record<string, string>>;
  readonly default: boolean;
}

export interface DoqResolvedI18n {
  readonly defaultLocale: string;
  readonly locales: readonly DoqResolvedLocale[];
  readonly fallback: 'none' | 'default-locale';
}

/**
 * One renderable documentation tree: a locale crossed with a version. This is the unit every catalog,
 * route, prerender entry, search filter and canonical URL is derived from, so identity is always
 * (locale, version, slug) and never slug alone.
 */
export interface DoqCatalog {
  readonly locale: DoqResolvedLocale;
  readonly version: DoqVersion;
  /** Where this catalog's Markdown lives. */
  readonly contentDirectory: string;
  /** Mount path of this catalog's index, including the locale prefix. */
  readonly basePath: string;
  /** True when this catalog is the current version of its locale. */
  readonly current: boolean;
}

const nests = (a: string, b: string) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

/**
 * Join two absolute in-app paths, collapsing duplicate slashes. Unlike `joinDoqPath`, whose second
 * argument is a slug, both arguments here are paths, so a root-mounted tree stays "/" and a prefixed
 * tree becomes "/es" rather than "/es//".
 */
export function joinDoqLocalePath(prefix: string, path: string): string {
  return `/${[...prefix.split('/').filter(Boolean), ...path.split('/').filter(Boolean)].join('/')}`;
}

const readLabel = (label: unknown, id: string, where: string) => {
  if (label === undefined) return id;
  if (typeof label !== 'string' || !label.trim()) throw new Error(`Doq: locale "${id}" has an empty label in ${where}.`);
  return label.trim();
};

/**
 * Validate the optional `i18n` setting against the content directories the rest of the configuration
 * already claims. Throws one actionable message; never mutates its input.
 */
export function normalizeDoqI18n(
  i18n: DoqI18nConfig,
  currentContentDirectory: string,
  versioning: DoqResolvedVersioning | undefined,
): DoqResolvedI18n {
  if (i18n === null || typeof i18n !== 'object') {
    throw new Error('Doq: i18n must be an object such as { defaultLocale: "en", locales: [{ id: "en" }, { id: "es", contentDirectory: "docs-es" }] }.');
  }
  if (!Array.isArray(i18n.locales) || !i18n.locales.length) throw new Error('Doq: i18n.locales must be a non-empty array.');
  if (i18n.fallback !== undefined && i18n.fallback !== 'none' && i18n.fallback !== 'default-locale') {
    throw new Error(`Doq: i18n.fallback must be 'none' or 'default-locale', received ${JSON.stringify(i18n.fallback)}.`);
  }
  if (typeof i18n.defaultLocale !== 'string' || !i18n.defaultLocale.trim()) throw new Error('Doq: i18n.defaultLocale is required, for example "en".');

  const archiveIds = (versioning?.archives ?? []).map(archive => archive.id);
  const reservedSegment = versioning?.pathSegment;
  const seen = new Set<string>();
  // First pass: ids, so the default locale can be resolved before directories are validated.
  for (const [index, entry] of i18n.locales.entries()) {
    const id = entry?.id;
    if (typeof id !== 'string' || !LOCALE_ID.test(id)) {
      throw new Error(`Doq: invalid locale id ${JSON.stringify(id)} in i18n.locales[${index}]; use a BCP 47 tag that is also a safe URL segment, for example "en", "es" or "pt-BR".`);
    }
    if (seen.has(id.toLowerCase())) throw new Error(`Doq: duplicate locale id "${id}".`);
    seen.add(id.toLowerCase());
    if (reservedSegment && id.toLowerCase() === reservedSegment.toLowerCase()) {
      throw new Error(`Doq: locale id "${id}" collides with versioning.pathSegment "${reservedSegment}"; rename one of them.`);
    }
  }
  const defaultLocale = i18n.defaultLocale.trim();
  if (!seen.has(defaultLocale.toLowerCase())) {
    throw new Error(`Doq: i18n.defaultLocale "${defaultLocale}" is not one of the configured locales (${[...seen].join(', ')}).`);
  }
  const defaultEntry = i18n.locales.find(entry => entry.id.toLowerCase() === defaultLocale.toLowerCase())!;
  const canonicalDefault = defaultEntry.id;

  const directories: string[] = [];
  const locales = i18n.locales.map((entry, index): DoqResolvedLocale => {
    const where = `i18n.locales[${index}]`;
    const isDefault = entry.id === canonicalDefault;
    const dir = entry.dir ?? 'ltr';
    if (dir !== 'ltr' && dir !== 'rtl') throw new Error(`Doq: locale "${entry.id}" has an invalid dir ${JSON.stringify(entry.dir)}; use "ltr" or "rtl".`);
    let contentDirectory = normalizeContentDirectory(entry.contentDirectory ?? '');
    if (!contentDirectory) {
      // The default locale inherits the top-level directory; any other locale must name its own, so a
      // localized URL can never resolve to another language's Markdown.
      if (!isDefault) throw new Error(`Doq: locale "${entry.id}" needs a contentDirectory below src/content, for example "docs-${entry.id}".`);
      contentDirectory = currentContentDirectory;
    } else if (isDefault && contentDirectory !== currentContentDirectory) {
      throw new Error(`Doq: the default locale "${entry.id}" must use the top-level contentDirectory "${currentContentDirectory}", not "${contentDirectory}".`);
    }
    const archives: Record<string, string> = {};
    // The default locale inherits the archive directories the versioning block already declared, so
    // adding i18n to an existing versioned site does not silently drop its archives. Any explicit entry
    // below overrides that, and a non-default locale has to name each archive it serves.
    if (isDefault) for (const archive of versioning?.archives ?? []) archives[archive.id] = archive.contentDirectory;
    if (entry.archives !== undefined) {
      if (entry.archives === null || typeof entry.archives !== 'object' || Array.isArray(entry.archives)) {
        throw new Error(`Doq: locale "${entry.id}" archives must be an object keyed by version id.`);
      }
      for (const [versionId, value] of Object.entries(entry.archives)) {
        if (!archiveIds.includes(versionId)) {
          throw new Error(`Doq: locale "${entry.id}" declares archives["${versionId}"], which is not a configured versioning.archives id (${archiveIds.join(', ') || 'none'}).`);
        }
        const archiveDirectory = normalizeContentDirectory(value);
        if (!archiveDirectory) throw new Error(`Doq: locale "${entry.id}" archives["${versionId}"] must be a directory below src/content.`);
        archives[versionId] = archiveDirectory;
      }
    }
    const claimed = [contentDirectory, ...Object.values(archives)];
    for (const candidate of claimed) {
      const clash = directories.find(known => nests(known, candidate));
      if (clash) throw new Error(`Doq: locale "${entry.id}" content directory "${candidate}" overlaps "${clash}"; every locale and version needs its own separate directory.`);
      directories.push(candidate);
    }
    return {
      id: entry.id,
      label: readLabel(entry.label, entry.id, where),
      dir,
      prefix: isDefault ? '' : `/${entry.id}`,
      contentDirectory,
      archives,
      default: isDefault,
    };
  });
  return { defaultLocale: canonicalDefault, locales, fallback: i18n.fallback ?? 'none' };
}

/**
 * Every renderable (locale, version) tree, default locale first and current version first inside each
 * locale. A locale that does not declare an archive directory simply has no catalog for it, so that
 * combination produces no routes and no prerendered pages instead of borrowing another locale's text.
 * An unlocalized configuration yields exactly the catalogs `getDoqVersions` already produced.
 */
export function getDoqCatalogs(paths: {
  contentDirectory: string;
  basePath: string;
  versioning?: DoqResolvedVersioning;
  i18n?: DoqResolvedI18n;
}): readonly DoqCatalog[] {
  const versions = getDoqVersions(paths);
  if (!paths.i18n) {
    return versions.map(version => ({ locale: unlocalizedLocale(paths.contentDirectory), version, contentDirectory: version.contentDirectory, basePath: version.basePath, current: version.current }));
  }
  return paths.i18n.locales.flatMap(locale =>
    versions.flatMap((version): DoqCatalog[] => {
      const contentDirectory = version.current ? locale.contentDirectory : locale.archives[version.id];
      if (!contentDirectory) return [];
      return [{ locale, version, contentDirectory, basePath: locale.prefix ? joinDoqLocalePath(locale.prefix, version.basePath) : version.basePath, current: version.current }];
    }),
  );
}

/** The single synthetic locale an unlocalized configuration renders as: no prefix, no language switcher. */
export function unlocalizedLocale(contentDirectory: string): DoqResolvedLocale {
  return { id: '', label: '', dir: 'ltr', prefix: '', contentDirectory, archives: {}, default: true };
}

/** One catalog's paths, or undefined when the (locale, version) combination is not published. */
export function findDoqCatalog(catalogs: readonly DoqCatalog[], localeId: string, versionId: string): DoqCatalog | undefined {
  return catalogs.find(catalog => catalog.locale.id === localeId && catalog.version.id === versionId);
}

export interface DoqLocaleLink {
  readonly id: string;
  readonly label: string;
  readonly dir: DoqTextDirection;
  readonly href: string;
  readonly active: boolean;
  /** True when this locale publishes the same document in the same version. */
  readonly sameDocument: boolean;
}

/**
 * Where each locale leads from the page being read. A locale that publishes the same slug in the same
 * version links to it; a locale that publishes the version but not the document links to that locale's
 * index; a locale that does not publish the version at all is omitted. Nothing is inferred from
 * translated titles, and no link ever points at content that does not exist.
 *
 * Serving another locale's document under a notice (`i18n.fallback: 'default-locale'`) is a property of
 * the page being rendered, not of a link, so it does not appear here.
 */
export function doqLocaleLinks(
  i18n: DoqResolvedI18n,
  activeLocaleId: string,
  version: DoqVersion,
  slug: string | null,
  catalogs: Readonly<Record<string, readonly { readonly slug: string }[]>>,
): DoqLocaleLink[] {
  return i18n.locales.flatMap((locale): DoqLocaleLink[] => {
    const basePath = locale.prefix ? joinDoqLocalePath(locale.prefix, version.basePath) : version.basePath;
    // `catalogs` is keyed by locale id and holds only the active version's documents.
    const documents = catalogs[locale.id];
    if (!documents) return [];
    const active = locale.id === activeLocaleId;
    if (slug && documents.some(document => document.slug === slug)) {
      return [{ id: locale.id, label: locale.label, dir: locale.dir, href: joinDoqPath(basePath, slug), active, sameDocument: true }];
    }
    return [{ id: locale.id, label: locale.label, dir: locale.dir, href: basePath, active, sameDocument: !slug }];
  });
}

/**
 * First-segment values a current-version slug must never use, because they are claimed by the routing
 * table: the archive prefix and every non-default locale prefix. Only meaningful for a root-mounted
 * documentation tree, where `/es/getting-started` would otherwise read as the slug `es/getting-started`.
 */
export function doqReservedSegments(i18n: DoqResolvedI18n | undefined, versioning: DoqResolvedVersioning | undefined): readonly string[] {
  const segments = versioning ? [versioning.pathSegment] : [];
  if (i18n) segments.push(...i18n.locales.filter(locale => !locale.default).map(locale => locale.id));
  return segments;
}

/**
 * Reject a current-version slug whose first segment is claimed by the routing table. The single-segment
 * `assertDoqSlugNotReserved` stays for the archive prefix; this covers the locale prefixes too.
 */
export function assertDoqSlugAvailable(slug: string, reserved: readonly string[], source: string): void {
  const first = slug.split('/')[0];
  const clash = reserved.find(segment => segment.toLowerCase() === first?.toLowerCase());
  if (clash) {
    throw new Error(`Doq: slug "${slug}" in ${source} collides with the reserved URL prefix "${clash}/"; rename the document, or change the locale id or versioning.pathSegment.`);
  }
}

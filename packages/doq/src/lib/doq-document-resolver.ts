import { inject, PendingTasks } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { ContentRenderer, injectContentFilesMap, parseRawContentFile } from '@analogjs/content';
import { DoqDocumentAttributes, normalizeDoqPathsFull } from '@doqs/analog/config';
import { DOQ_CONFIG } from '@doqs/analog/config';
import { injectDoqDocuments, resolveDoqRouteCatalog } from './doq-catalog';

interface DocAttributes extends DoqDocumentAttributes {}

export interface DoqResolvedDocument {
  readonly filename: string;
  readonly slug: string;
  readonly attributes: DocAttributes;
  readonly content: string;
  readonly toc: readonly { id: string; text: string; level: number }[];
  /** Catalog mount path, which differs from the active locale when configured fallback selects the default locale. */
  readonly basePath: string;
}

/** Resolve content before DoqDocsComponent creates its first view, on SSR and on initial client navigation. */
export const resolveDoqDocument: ResolveFn<DoqResolvedDocument | null> = async (route, state) => {
  const config = inject(DOQ_CONFIG);
  const slug = route.paramMap.get(config.routeParam ?? 'slug') ?? '';
  if (!slug || route.data['doqUnknownVersion']) return null;

  const catalog = resolveDoqRouteCatalog(config, route.data, state.url);
  const catalogs = normalizeDoqPathsFull(config);
  let sourceCatalog = catalog;
  let sourceDocuments = injectDoqDocuments(config, catalog.version.id, catalog.locale.id || undefined);
  let source = sourceDocuments.find(document => document.slug === slug);

  if (!source && catalogs.i18n?.fallback === 'default-locale' && !catalog.locale.default) {
    const defaultLocale = catalogs.i18n.locales.find(locale => locale.id === catalogs.i18n!.defaultLocale);
    if (defaultLocale) {
      sourceCatalog = resolveDoqRouteCatalog(config, { ...route.data, doqLocale: defaultLocale.id }, state.url);
      sourceDocuments = injectDoqDocuments(config, sourceCatalog.version.id, defaultLocale.id);
      source = sourceDocuments.find(document => document.slug === slug);
    }
  }

  if (!source) return null;

  const contentMap = injectContentFilesMap();
  const renderer = inject(ContentRenderer);
  const pendingTasks = inject(PendingTasks);
  const contentBase = `src/content/${sourceCatalog.contentDirectory}/${slug}`;
  const candidates = new Set([`${contentBase}.md`, `${contentBase}/index.md`]);
  const key = Object.keys(contentMap).find(candidate => candidates.has(canonicalFilename(candidate, sourceCatalog.contentDirectory)));
  const load = key ? contentMap[key] : undefined;
  if (!load) return null;

  const clearPendingTask = pendingTasks.add();
  try {
    const raw = await load();
    const parsed = parseRawContentFile<DocAttributes>(raw);
    const rendered = await renderer.render(parsed.content);
    return {
      filename: `${sourceCatalog.contentDirectory}/${slug}.md`,
      slug,
      attributes: parsed.attributes,
      content: parsed.content,
      toc: rendered.toc,
      basePath: sourceCatalog.basePath,
    };
  } catch (error) {
    console.error(`Doq: failed to resolve src/content/${sourceCatalog.contentDirectory}/${slug}.md`, error);
    return null;
  } finally {
    clearPendingTask();
  }
};

function canonicalFilename(filename: string, contentDirectory: string): string {
  const normalized = filename.replace(/\\/g, '/');
  const marker = `src/content/${contentDirectory}/`;
  const index = normalized.lastIndexOf(marker);
  return index < 0 ? normalized : normalized.slice(index);
}

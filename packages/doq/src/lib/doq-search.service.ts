import { Injectable } from '@angular/core';
import { DoqSearchResult, mapPagefindFragment, PagefindFragment } from '@doqs/analog/config';
import { DOQ_LOCALE_FILTER, DOQ_VERSION_FILTER } from '@doqs/analog/config';

interface PagefindModule {
  search(query: string, options?: { filters?: Record<string, string> }): Promise<{ results: { data(): Promise<PagefindFragment> }[] }>;
  filters?(): Promise<Record<string, Record<string, number> | undefined>>;
}

/** The index has no pages carrying the requested documentation version. */
export class DoqVersionNotIndexedError extends Error {}

const MAX_PAGES = 8;
const MAX_ROWS = 12;

/**
 * Data access for the optional static search. The Pagefind bundle is a runtime import from `bundlePath`, so it is never
 * part of the application bundle and is requested only when the reader first searches.
 */
@Injectable({ providedIn: 'root' })
export class DoqSearchService {
  private loading?: { bundlePath: string; module: Promise<PagefindModule> };

  /**
   * Rejects when the index cannot be loaded; a later call retries. With `versionId` and/or `localeId` the
   * query is filtered by Pagefind itself, before ranking and truncation, so results never spill across a
   * version or a language; a version or locale that was never indexed rejects with
   * DoqVersionNotIndexedError.
   */
  search(query: string, bundlePath: string, basePath: string, versionId?: string, localeId?: string): Promise<DoqSearchResult[]> {
    return this.load(bundlePath).then(async pagefind => {
      const filters: Record<string, string> = {};
      if (versionId !== undefined) filters[DOQ_VERSION_FILTER] = versionId;
      if (localeId !== undefined) filters[DOQ_LOCALE_FILTER] = localeId;
      const scoped = Object.keys(filters).length ? filters : undefined;
      if (scoped) {
        const known = await pagefind.filters?.();
        // A locale is only enforced when the index actually carries locale filters; an index built
        // before localization was enabled still has to answer, just unscoped by locale.
        if (versionId !== undefined) {
          const versions = known?.[DOQ_VERSION_FILTER];
          if (!versions || !(versionId in versions)) throw new DoqVersionNotIndexedError(versionId);
        }
        if (localeId !== undefined) {
          const locales = known?.[DOQ_LOCALE_FILTER];
          if (locales && !(localeId in locales)) throw new DoqVersionNotIndexedError(localeId);
          else if (!locales) delete filters[DOQ_LOCALE_FILTER];
        }
      }
      const { results } = await pagefind.search(query, scoped && Object.keys(scoped).length ? { filters: scoped } : undefined);
      const pages = await Promise.all(results.slice(0, MAX_PAGES).map(result => result.data()));
      return pages.flatMap(page => mapPagefindFragment(page, basePath)).slice(0, MAX_ROWS);
    });
  }

  private load(bundlePath: string): Promise<PagefindModule> {
    if (this.loading?.bundlePath !== bundlePath) {
      const module = import(/* @vite-ignore */ `${bundlePath}pagefind.js`) as Promise<PagefindModule>;
      const entry = { bundlePath, module };
      this.loading = entry;
      module.catch(() => { if (this.loading === entry) this.loading = undefined; });
    }
    return this.loading.module;
  }
}

/**
 * Static documentation integrity: `pnpm docs:check [--dist=<public dir> --source=<app dir>]...`
 *
 * For each target (default: both showcases) it verifies the prerendered output against the content source:
 *  - every Markdown document has a static route with meaningful HTML, and no documentation route lacks a source;
 *  - heading ids equal a strictly sequential render of that page (the heading-ID race can never ship), are unique, and
 *    every table-of-contents fragment resolves;
 *  - every same-site link (navigation, version switcher, Markdown, generated API pages) reaches an existing route and,
 *    when it has a fragment, an existing id on that page;
 *  - canonical links, where present, are single and match the route.
 * `--link-scope=/handbook` (repeatable) limits link validation to targets below that prefix, for hosts that prerender only part of
 * their routes; everything else on those pages is the host's own.
 * External links are never fetched. The process exits 1 with one actionable line per problem.
 */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  checkPage,
  expectedRoute,
  extractPageFacts,
  formatDiagnostics,
  frontmatterSlug,
  inLinkScope,
  resolveLink,
  routeOfHtmlFile,
  type Diagnostic,
  type PageFacts,
} from './docs-check/lib.ts';

const repo = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name: string) =>
  args.filter((arg) => arg.startsWith(`--${name}=`)).map((arg) => arg.slice(name.length + 3));

async function walk(directory: string, match: (file: string) => boolean): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path, match)));
    else if (match(path)) out.push(path);
  }
  return out.sort();
}

interface Versions {
  readonly contentDirectory: string;
  readonly basePath: string;
}

/** Content directories and their base paths, read from the app's build-safe `doq.paths.ts` the same way Doq normalizes them. */
async function readVersions(source: string): Promise<Versions[]> {
  // The config is intentionally build-safe and plain data. Importing it avoids guessing at nested
  // locale/archive object boundaries with regexes, which misclassified locale IDs as version IDs.
  const { doqPaths } = (await import(pathToFileURL(join(source, 'src/doq.paths.ts')).href)) as {
    doqPaths: {
      contentDirectory?: string;
      basePath?: string;
      versioning?: {
        pathSegment?: string;
        current?: { id?: string };
        archives?: readonly { id: string; contentDirectory?: string }[];
      };
      i18n?: {
        defaultLocale: string;
        locales: readonly {
          id: string;
          contentDirectory?: string;
          archives?: Readonly<Record<string, string>>;
        }[];
      };
    };
  };
  const root = doqPaths.basePath ?? '/docs';
  const segment = doqPaths.versioning?.pathSegment ?? 'v';
  const joinBase = (...parts: string[]) => `/${parts.flatMap((part) => part.split('/').filter(Boolean)).join('/')}`;
  const defaultLocale = doqPaths.i18n?.defaultLocale;
  const locales = doqPaths.i18n?.locales ?? [{ id: '', contentDirectory: doqPaths.contentDirectory }];
  const archives = doqPaths.versioning?.archives ?? [];
  const versions: Versions[] = [];
  for (const locale of locales) {
    const prefix = locale.id && locale.id !== defaultLocale ? `/${locale.id}` : '';
    const currentDirectory = locale.contentDirectory ?? doqPaths.contentDirectory ?? 'docs';
    versions.push({ contentDirectory: currentDirectory, basePath: joinBase(prefix, root) });
    for (const archive of archives) {
      const directory =
        locale.archives?.[archive.id] ??
        (!doqPaths.i18n || locale.id === defaultLocale ? archive.contentDirectory : undefined);
      if (directory)
        versions.push({ contentDirectory: directory, basePath: joinBase(prefix, root, segment, archive.id) });
    }
  }
  return versions;
}

const { default: GithubSlugger } = await import('github-slugger');
const createSlugger = () => new GithubSlugger();

async function checkTarget(dist: string, source: string | undefined): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  const pages = new Map<string, PageFacts>();
  for (const file of await walk(dist, (path) => path.endsWith('.html'))) {
    const route = routeOfHtmlFile(relative(dist, file));
    if (route) pages.set(route, extractPageFacts(await readFile(file, 'utf8')));
  }
  if (!pages.size)
    return [{ kind: 'missing-route', page: dist, message: 'No prerendered HTML found; run the build first.' }];

  const resolvable = (path: string): string | undefined => {
    const normalized = path.replace(/\/+$/, '') || '/';
    if (pages.has(normalized)) return normalized;
    return existsSync(join(dist, normalized)) && !normalized.endsWith('/') && /\.[a-z0-9]+$/i.test(normalized)
      ? normalized
      : undefined;
  };

  if (source) {
    const promised = new Set<string>();
    for (const version of await readVersions(source)) {
      const root = join(source, 'src/content', version.contentDirectory);
      for (const file of await walk(root, (path) => path.endsWith('.md'))) {
        const route = expectedRoute(
          version.basePath,
          relative(root, file).split('\\').join('/'),
          frontmatterSlug(await readFile(file, 'utf8')),
        );
        promised.add(route);
        if (!pages.has(route))
          diagnostics.push({
            kind: 'missing-route',
            page: route,
            message: `${relative(repo, file)} has no prerendered page.`,
          });
      }
    }
    for (const [route, facts] of pages) {
      if (facts.isDocumentation && !promised.has(route))
        diagnostics.push({
          kind: 'unexpected-route',
          page: route,
          message: 'Documentation page without a Markdown source.',
        });
    }
  }

  for (const [route, facts] of pages) {
    diagnostics.push(
      ...checkPage({ route, facts, createSlugger, canonicalOrigin: process.env['DOQ_SITE_ORIGIN'] || undefined }),
    );
    for (const href of new Set(facts.links)) {
      const link = resolveLink(
        href,
        route,
        process.env['DOQ_SITE_ORIGIN'] ? [new URL(process.env['DOQ_SITE_ORIGIN']).origin] : [],
      );
      if (link.kind !== 'internal' || !inLinkScope(link.path, linkScopes)) continue;
      const target = resolvable(link.path);
      if (!target) {
        diagnostics.push({
          kind: 'broken-link',
          page: route,
          message: `Link ${href} reaches ${link.path}, which has no static route or file.`,
        });
        continue;
      }
      const targetFacts = pages.get(target);
      if (link.fragment && targetFacts && !targetFacts.ids.has(link.fragment)) {
        diagnostics.push({
          kind: 'broken-fragment',
          page: route,
          message: `Link ${href} targets #${link.fragment}, which is not an id on ${target}.`,
        });
      }
    }
  }
  console.log(
    `docs:check: ${pages.size} pages, ${[...pages.values()].filter((page) => page.isDocumentation).length} documentation pages, ${[...pages.values()].reduce((sum, page) => sum + page.markdownHeadings.length, 0)} headings, ${[...pages.values()].reduce((sum, page) => sum + new Set(page.links).size, 0)} distinct links`,
  );
  return diagnostics;
}

const dists = flag('dist');
const sources = flag('source');
const linkScopes = flag('link-scope');
const targets = dists.length
  ? dists.map((dist, index) => ({ dist: resolve(dist), source: sources[index] ? resolve(sources[index]) : undefined }))
  : ['showcase-a', 'showcase-b', 'site'].map((app) => ({
      dist: resolve(repo, `apps/${app}/dist/analog/public`),
      source: resolve(repo, `apps/${app}`),
    }));

let failed = false;
for (const { dist, source } of targets) {
  const diagnostics = await checkTarget(dist, source);
  const label = relative(repo, dist) || dist;
  if (diagnostics.length) {
    failed = true;
    console.error(
      `docs:check FAILED for ${label}: ${diagnostics.length} problem(s)\n${formatDiagnostics(diagnostics)}`,
    );
  } else console.log(`docs:check ok: ${label}`);
}
process.exit(failed ? 1 : 0);

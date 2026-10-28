/**
 * Pure logic of `pnpm docs:check`: what a generated documentation page contains and which rules its output must satisfy.
 * The pages are Doq's own server-rendered HTML, so a small tokenizer is enough; there is no general HTML parser and no
 * network access. Everything here is deterministic and unit tested; the filesystem walk lives in ../docs-check.ts.
 */

export interface PageHeading {
  readonly level: number;
  readonly id: string;
  /** Inner HTML with tags removed and entities decoded. */
  readonly text: string;
}

export interface PageFacts {
  readonly title: string;
  readonly canonicals: readonly string[];
  /** Every id attribute on the page. */
  readonly ids: ReadonlySet<string>;
  readonly h1Count: number;
  /** Headings produced by the Markdown renderer, in document order (the search dialog and page chrome are excluded). */
  readonly markdownHeadings: readonly PageHeading[];
  /** Fragments the table of contents links to. */
  readonly tocFragments: readonly string[];
  readonly hasToc: boolean;
  readonly isDocumentation: boolean;
  /** Visible characters inside the article. */
  readonly articleTextLength: number;
  readonly links: readonly string[];
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  nbsp: ' ',
};
export const decodeEntities = (value: string): string =>
  value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
    if (name.startsWith('#x')) return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith('#') && name !== '#39') return String.fromCodePoint(Number(name.slice(1)));
    return ENTITIES[name.toLowerCase()] ?? match;
  });
const stripTags = (html: string): string =>
  decodeEntities(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ''));

const attribute = (tag: string, name: string): string | undefined => {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  const value = match?.[1] ?? match?.[2];
  return value === undefined ? undefined : decodeEntities(value);
};

export function extractPageFacts(html: string): PageFacts {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const canonicals = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => attribute(tag, 'rel')?.toLowerCase().split(/\s+/).includes('canonical'))
    .map((tag) => attribute(tag, 'href') ?? '');
  const ids = new Set(
    [...html.matchAll(/<[a-z][^>]*?\sid\s*=\s*"([^"]*)"[^>]*>/gi)].map((match) => decodeEntities(match[1]!)),
  );
  const h1Count = [...html.matchAll(/<h1[\s>]/gi)].length;

  const markdownHeadings: PageHeading[] = [];
  for (const region of html.matchAll(/<analog-markdown\b[^>]*>([\s\S]*?)<\/analog-markdown>/gi)) {
    for (const heading of region[1]!.matchAll(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi)) {
      const id = attribute(`<h ${heading[2]}>`, 'id');
      if (id !== undefined) markdownHeadings.push({ level: Number(heading[1]), id, text: stripTags(heading[3]!) });
    }
  }

  const toc = /<aside\b[^>]*class="[^"]*\bdoq-toc\b[^"]*"[^>]*>([\s\S]*?)<\/aside>/i.exec(html);
  const tocFragments = toc
    ? [...toc[1]!.matchAll(/<a\b[^>]*>/gi)]
        .map((match) => attribute(match[0], 'href') ?? '')
        .filter((href) => href.includes('#'))
        .map((href) => decodeURIComponent(href.slice(href.indexOf('#') + 1)))
    : [];

  const article = /<article\b[^>]*class="[^"]*\bdoq-article\b[^"]*"[^>]*>([\s\S]*?)<\/article>/i.exec(html);
  const articleBody = article ? article[1]!.replace(/<(script|style|dialog)\b[\s\S]*?<\/\1>/gi, '') : '';
  const links = [...html.matchAll(/<a\b[^>]*>/gi)]
    .map((match) => attribute(match[0], 'href'))
    .filter((href): href is string => href !== undefined);
  return {
    title: titleMatch ? stripTags(titleMatch[1]!).trim() : '',
    canonicals,
    ids,
    h1Count,
    markdownHeadings,
    tocFragments,
    hasToc: !!toc,
    isDocumentation: !!article,
    articleTextLength: stripTags(articleBody).replace(/\s+/g, ' ').trim().length,
    links,
  };
}

/** The id marked-gfm-heading-id gives a heading: the slug of its text, lower-cased, made unique in document order. */
export function expectedHeadingIds(
  texts: readonly string[],
  createSlugger: () => { slug(value: string): string },
): string[] {
  const slugger = createSlugger();
  return texts.map((text) => slugger.slug(text.trim().toLowerCase()));
}

export type DiagnosticKind =
  | 'empty-page'
  | 'missing-h1'
  | 'multiple-h1'
  | 'duplicate-id'
  | 'heading-id'
  | 'toc-fragment'
  | 'toc-missing'
  | 'broken-link'
  | 'broken-fragment'
  | 'canonical'
  | 'missing-route'
  | 'unexpected-route';

export interface Diagnostic {
  readonly kind: DiagnosticKind;
  /** Route or file the problem was found on. */
  readonly page: string;
  readonly message: string;
}

export interface PageChecks {
  readonly route: string;
  readonly facts: PageFacts;
  /** The page must be a documentation article that is complete (not an index or not-found page). */
  readonly createSlugger: () => { slug(value: string): string };
  /** Origin that canonical URLs are expected to carry, when the build configured one. */
  readonly canonicalOrigin?: string;
  readonly minimumArticleText?: number;
}

/** Rules that depend only on one page. */
export function checkPage({
  route,
  facts,
  createSlugger,
  canonicalOrigin,
  minimumArticleText = 40,
}: PageChecks): Diagnostic[] {
  const out: Diagnostic[] = [];
  const add = (kind: DiagnosticKind, message: string) => out.push({ kind, page: route, message });
  if (!facts.isDocumentation) return out;
  if (facts.h1Count === 0) add('missing-h1', 'The documentation page has no <h1>.');
  if (facts.h1Count > 1) add('multiple-h1', `The documentation page has ${facts.h1Count} <h1> elements.`);
  if (facts.articleTextLength < minimumArticleText) {
    add(
      'empty-page',
      `The article holds ${facts.articleTextLength} characters of text; a successful page must not be empty.`,
    );
  }

  const seen = new Set<string>();
  for (const heading of facts.markdownHeadings) {
    if (seen.has(heading.id))
      add('duplicate-id', `Heading id "${heading.id}" (${heading.text}) appears more than once.`);
    seen.add(heading.id);
  }
  const expected = expectedHeadingIds(
    facts.markdownHeadings.map((heading) => heading.text),
    createSlugger,
  );
  facts.markdownHeadings.forEach((heading, index) => {
    if (heading.id !== expected[index]) {
      add(
        'heading-id',
        `Heading #${index + 1} "${heading.text}" has id "${heading.id}" but a sequential render of this page gives "${expected[index]}".`,
      );
    }
  });

  for (const fragment of facts.tocFragments) {
    if (!facts.ids.has(fragment))
      add('toc-fragment', `The table of contents links to #${fragment}, which is not an id on the page.`);
  }
  if (
    facts.hasToc &&
    facts.tocFragments.length !==
      facts.markdownHeadings.filter((heading) => heading.level >= 2 && heading.level <= 3).length
  ) {
    add(
      'toc-missing',
      `The table of contents lists ${facts.tocFragments.length} headings but the article has ${facts.markdownHeadings.filter((heading) => heading.level >= 2 && heading.level <= 3).length} h2/h3 headings.`,
    );
  }

  if (facts.canonicals.length > 1)
    add('canonical', `${facts.canonicals.length} canonical links; exactly one is allowed.`);
  for (const canonical of facts.canonicals) {
    let url: URL | undefined;
    try {
      url = new URL(canonical);
    } catch {
      /* handled below */
    }
    if (!url) add('canonical', `Canonical "${canonical}" is not an absolute URL.`);
    else {
      if (canonicalOrigin && url.origin !== new URL(canonicalOrigin).origin)
        add('canonical', `Canonical origin ${url.origin} differs from the configured ${canonicalOrigin}.`);
      if (url.pathname.replace(/\/$/, '') !== route.replace(/\/$/, ''))
        add('canonical', `Canonical path ${url.pathname} is not this page's route ${route}.`);
    }
  }
  return out;
}

export type LinkResolution =
  | { readonly kind: 'external' | 'ignored' }
  | { readonly kind: 'internal'; readonly path: string; readonly fragment?: string };

/** Classify an href found on page `route`. Only same-site links are validated; nothing is fetched. */
export function resolveLink(href: string, route: string, origins: readonly string[] = []): LinkResolution {
  const trimmed = href.trim();
  if (!trimmed || /^(mailto|tel|javascript|data|blob):/i.test(trimmed)) return { kind: 'ignored' };
  let url: URL;
  try {
    url = new URL(trimmed, `http://site.invalid${route}`);
  } catch {
    return { kind: 'ignored' };
  }
  if (url.origin !== 'http://site.invalid' && !origins.includes(url.origin)) return { kind: 'external' };
  return {
    kind: 'internal',
    path: decodeURIComponent(url.pathname),
    fragment: url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined,
  };
}

/** Routes the content source promises, from `.md` paths below a content directory and their frontmatter slugs. */
export function expectedRoute(basePath: string, relativeMarkdownPath: string, slug: string | undefined): string {
  const sourceSlug = relativeMarkdownPath.replace(/\.md$/, '').replace(/\/index$/, '');
  const chosen = slug?.trim().replace(/^\/+|\/+$/g, '') || sourceSlug;
  return `/${[...basePath.split('/').filter(Boolean), chosen].filter(Boolean).join('/')}`;
}

export function frontmatterSlug(markdown: string): string | undefined {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1];
  const value = block ? /^slug:\s*(.+?)\s*$/m.exec(block)?.[1] : undefined;
  return value?.replace(/^["']|["']$/g, '');
}

/**
 * Whether a link target is the documentation's to validate. With no scope every same-site target is; with scopes (host sites
 * that prerender only part of their routes) only targets at or below a scope prefix are, the rest are the host's own routes.
 */
export function inLinkScope(path: string, scopes: readonly string[]): boolean {
  if (!scopes.length) return true;
  return scopes.some((scope) => {
    const prefix = scope.replace(/\/+$/, '');
    return prefix === '' || path === prefix || path.startsWith(`${prefix}/`);
  });
}

export function formatDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return diagnostics.map((item) => `  ${item.page}  [${item.kind}] ${item.message}`).join('\n');
}

/**
 * The route a prerendered HTML file answers, or undefined for files that are not pages. Both Nitro layouts are understood:
 * `docs/guide/index.html` (the default) and `docs/guide.html` (`prerender.autoSubfolderIndex: false`, which Cloudflare Pages
 * serves at the slash-less URL). `404.html` and `200.html` are host fallbacks, not routes.
 */
export function routeOfHtmlFile(relativePath: string): string | undefined {
  const normalized = relativePath.split('\\').join('/');
  if (!normalized.endsWith('.html')) return undefined;
  if (/^(404|200)\.html$/.test(normalized)) return undefined;
  const route = normalized.replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '');
  return `/${route}`.replace(/\/+$/, '') || '/';
}

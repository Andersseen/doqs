// Build-safe: imported by vite.config.ts, so it must stay free of Angular and browser code.
export const siteLinks = {
  github: 'https://github.com/Andersseen/doqs',
  npm: 'https://www.npmjs.com/package/@doqs/analog',
  readme: 'https://github.com/Andersseen/doqs/blob/main/packages/doq/README.md',
  changelog: 'https://github.com/Andersseen/doqs/blob/main/packages/doq/CHANGELOG.md',
  license: 'https://github.com/Andersseen/doqs/blob/main/LICENSE',
  parity: 'https://github.com/Andersseen/doqs/blob/main/docs/adoption/consumer-parity.md',
} as const;

export const installCommand = 'pnpm add @doqs/analog @analogjs/content @analogjs/router prismjs';

export const site = {
  title: 'Doqs — Documentation that lives in your Angular app',
  description:
    'Doqs adds Markdown documentation to an existing Angular and Analog.js app — SSR/SSG, sidebar, table of contents and search — while your branding, routing and Angular components stay yours.',
  /** Every site-owned route the build prerenders; the sitemap lists these plus the documentation routes. */
  routes: ['/', '/examples'],
} as const;

/** The global navigation: real application routes only, Docs last. `exact` keeps Home from matching every route. */
export const navItems = [
  { label: 'Home', path: '/', exact: true },
  { label: 'Examples', path: '/examples', exact: false },
  { label: 'Docs', path: '/docs', exact: false },
] as const;

/** Per-page metadata for the pages the site owns; documentation pages set their own title and description. */
export const pageMeta: Readonly<Record<string, { readonly title: string; readonly description: string }>> = {
  '/': { title: site.title, description: site.description },
  '/examples': {
    title: 'Examples — Doqs',
    description:
      'Live Doqs examples: an Angular component placed from Markdown, a playground that rewrites its own usage code, an install command demo and generated API reference pages.',
  },
};

/** The social card; it is only referenced when an absolute origin is known. */
export const socialImage = { path: '/og.png', width: 1200, height: 630, alt: 'Doqs — documentation that lives in your Angular app' } as const;

/**
 * The public origin comes from the DOQ_SITE_ORIGIN build variable, never from a guess. Returns undefined when it is
 * unset or not a plain https origin (http is accepted for localhost only), so canonical URLs are simply omitted.
 */
export function normalizeOrigin(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return undefined;
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return undefined;
  if (url.username || url.password) return undefined;
  return url.origin;
}

export const canonicalUrl = (origin: string, path = '/'): string => new URL(path, `${origin}/`).href;

const escapeXml = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const escapeAttr = escapeXml;

export function buildRobots(origin: string | undefined): string {
  const lines = ['User-agent: *', 'Allow: /'];
  if (origin) lines.push('', `Sitemap: ${canonicalUrl(origin, '/sitemap.xml')}`);
  return `${lines.join('\n')}\n`;
}

export function buildSitemap(origin: string, paths: readonly string[] = site.routes): string {
  const urls = paths.map((path) => `  <url><loc>${escapeXml(canonicalUrl(origin, path))}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Tags that depend on the origin; the origin-independent metadata lives in index.html. */
export function originHeadTags(origin: string | undefined, path = '/'): string {
  if (!origin) return '';
  const url = escapeAttr(canonicalUrl(origin, path));
  return [`<link rel="canonical" href="${url}">`, `<meta property="og:url" content="${url}">`].join('\n    ');
}

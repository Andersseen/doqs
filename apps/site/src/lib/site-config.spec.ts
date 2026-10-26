import { describe, expect, it } from 'vitest';
import { buildRobots, buildSitemap, canonicalUrl, installCommand, navItems, normalizeOrigin, originHeadTags, pageMeta, site, siteLinks } from './site-config.ts';

describe('UNIT-025 canonical origin and crawler files', () => {
  it('accepts only a plain https origin (http for localhost) and strips any path', () => {
    expect(normalizeOrigin('https://docs.example.com/')).toBe('https://docs.example.com');
    expect(normalizeOrigin('https://docs.example.com/some/path?q=1')).toBe('https://docs.example.com');
    expect(normalizeOrigin('http://localhost:4300')).toBe('http://localhost:4300');
    for (const bad of [undefined, '', '   ', 'docs.example.com', 'http://docs.example.com', 'ftp://x.test', 'https://u:p@x.test'])
      expect(normalizeOrigin(bad), String(bad)).toBeUndefined();
  });

  it('builds absolute canonical URLs', () => {
    expect(canonicalUrl('https://docs.example.com')).toBe('https://docs.example.com/');
    expect(canonicalUrl('https://docs.example.com', '/docs')).toBe('https://docs.example.com/docs');
  });

  it('omits every absolute-URL feature without an origin instead of inventing a domain', () => {
    expect(originHeadTags(undefined)).toBe('');
    expect(buildRobots(undefined)).toBe('User-agent: *\nAllow: /\n');
  });

  it('emits canonical, robots sitemap line and a valid sitemap for the configured origin', () => {
    const origin = 'https://docs.example.com';
    expect(originHeadTags(origin)).toContain('<link rel="canonical" href="https://docs.example.com/">');
    expect(buildRobots(origin)).toContain('Sitemap: https://docs.example.com/sitemap.xml');
    const sitemap = buildSitemap(origin);
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(sitemap).toContain('<loc>https://docs.example.com/</loc>');
  });

  it('escapes XML special characters in sitemap locations', () => {
    expect(buildSitemap('https://x.test', ['/a?b=1&c=2'])).toContain('<loc>https://x.test/a?b=1&amp;c=2</loc>');
  });

  it('points to the real repository and package, and installs the scoped package', () => {
    expect(siteLinks.github).toBe('https://github.com/Andersseen/doqs');
    expect(siteLinks.npm).toBe('https://www.npmjs.com/package/@doqs/analog');
    expect(installCommand).toContain('@doqs/analog');
    expect(site.routes).toEqual(['/', '/examples']);
  });
});

describe('site navigation and page metadata', () => {
  it('lists real routes only, with Docs last', () => {
    expect(navItems.map((item) => item.path)).toEqual(['/', '/examples', '/docs']);
    expect(navItems.some((item) => item.path.includes('#'))).toBe(false);
    expect(navItems.filter((item) => item.exact).map((item) => item.path)).toEqual(['/']);
  });

  it('gives every site-owned route its own title and description', () => {
    for (const route of site.routes) {
      expect(pageMeta[route]?.title, route).toBeTruthy();
      expect(pageMeta[route]?.description, route).toBeTruthy();
    }
    expect(new Set(site.routes.map((route) => pageMeta[route]?.title)).size).toBe(site.routes.length);
  });

  it('lists the site routes and the documentation routes in the sitemap', () => {
    const sitemap = buildSitemap('https://docs.example.com', [...site.routes, '/docs']);
    for (const path of ['/', '/examples', '/docs']) expect(sitemap).toContain(`<loc>${canonicalUrl('https://docs.example.com', path)}</loc>`);
  });
});

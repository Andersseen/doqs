import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import analog from '@analogjs/platform';
import tailwindcss from '@tailwindcss/vite';
import { doqPrerenderRoutes } from '@doqs/analog';
import { doqDeterministicMarkdown } from '@doqs/analog/vite';
import { doqPaths } from './src/doq.paths';
import { docsRoutes } from './src/lib/docs-routes';
import { buildRobots, buildSitemap, normalizeOrigin, site } from './src/lib/site-config';

// DOQ_SITE_ORIGIN (for example the production Pages URL or custom domain) enables canonical URLs and the sitemap.
// Without it the site still builds; those absolute-URL features are simply left out.
const origin = normalizeOrigin(process.env['DOQ_SITE_ORIGIN']);
if (process.env['DOQ_SITE_ORIGIN'] && !origin) throw new Error('DOQ_SITE_ORIGIN must be an https origin such as https://example.com');

const documentationRoutes = docsRoutes(doqPaths, join(import.meta.dirname, 'src/content'));

function siteMetadata(): Plugin {
  return {
    name: 'doq-site-metadata',
    // Canonical and og:url depend on the page, so they are written per route by the app (see src/app/seo.ts).
    transformIndexHtml: (html) => html.replace('<!-- origin-tags -->', ''),
    generateBundle() {
      if (this.environment.name !== 'client') return;
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobots(origin) });
      if (origin) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemap(origin, [...site.routes, ...documentationRoutes]) });
    },
  };
}

/**
 * Builds the client and SSR environments one after the other. Analog's Nitro plugin starts both at once with shared
 * plugins, and the Angular plugin releases its compilation in `buildEnd`: when SSR finished first, the client was still
 * transforming lazy chunks (the landing page among them), which then shipped uncompiled. The browser failed with
 * "JIT compiler unavailable" and the prerendered page never hydrated, so nothing on it reacted, the theme switch included.
 */
function sequentialEnvironmentBuilds(): Plugin {
  return {
    name: 'doq-site-sequential-environment-builds',
    buildApp(builder) {
      const build = builder.build.bind(builder);
      let queue: Promise<unknown> = Promise.resolve();
      builder.build = (environment) => {
        const run = queue.then(() => build(environment));
        queue = run.catch(() => undefined);
        return run;
      };
    },
  };
}

export default defineConfig({
  build: { target: ['es2022'] },
  resolve: { mainFields: ['module'] },
  define: { __DOQ_SITE_ORIGIN__: JSON.stringify(origin ?? '') },
  plugins: [
    analog({
      ssr: true,
      static: true,
      content: { highlighter: 'prism' },
      prerender: { routes: async () => [...site.routes, ...doqPrerenderRoutes(doqPaths)] },
    }),
    // Renders Markdown one file at a time so duplicate-heading ids stay identical between builds.
    doqDeterministicMarkdown(),
    tailwindcss(),
    siteMetadata(),
    sequentialEnvironmentBuilds(),
  ],
});

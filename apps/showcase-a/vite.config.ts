import { defineConfig } from 'vite';
import analog from '@analogjs/platform';
import tailwindcss from '@tailwindcss/vite';
import { doqPrerenderRoutes } from '@doqs/analog';
import { doqContent } from '@doqs/analog/content';
import { doqDeterministicMarkdown } from '@doqs/analog/vite';
import { doqPaths } from './src/doq.paths';

export default defineConfig({
  build: { target: ['es2022'] },
  resolve: { mainFields: ['module'] },
  plugins: [
    // Resolves ::source, ::include and [[api:]] from src/authoring into src/content before Analog loads the pages.
    doqContent(),
    analog({
      ssr: true,
      static: true,
      content: { highlighter: 'prism' },
      prerender: { routes: async () => ['/', '/docs/host-route', ...doqPrerenderRoutes(doqPaths)] },
    }),
    // Renders Markdown one file at a time so duplicate-heading ids stay identical between builds.
    doqDeterministicMarkdown(),
    tailwindcss(),
  ],
});

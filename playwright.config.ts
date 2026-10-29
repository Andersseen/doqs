import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

// Production builds served by the repository's static preview server. Ports differ from the CDP harness
// (4173-4175) so both suites can run at the same time.
export const apps = {
  a: { url: 'http://127.0.0.1:4273', root: 'apps/showcase-a/dist/analog/public' },
  b: { url: 'http://127.0.0.1:4274', root: 'apps/showcase-b/dist/analog/public' },
  // Showcase B built with `vite build --mode nosearch`: the same app and content with search disabled.
  noSearch: { url: 'http://127.0.0.1:4276', root: 'apps/showcase-b/dist/analog-nosearch/public' },
  site: { url: 'http://127.0.0.1:4277', root: 'apps/site/dist/analog/public' },
  // Angular Movement adoption proof (scripts/adoption.ts); only served when DOQ_ADOPTION_DIR points at a built checkout.
  adoption: {
    url: 'http://127.0.0.1:4278',
    root: resolve(
      process.env.DOQ_ADOPTION_DIR ?? resolve(tmpdir(), 'doq-adoption-angular-movement'),
      'dist/analog/public',
    ),
  },
  // Angular Movement route-preserving proof (scripts/adoption-routes.ts): migrated pages keep their /docs/* URLs next to host-owned /demos/*.
  adoptionRoutes: {
    url: 'http://127.0.0.1:4284',
    root: resolve(
      process.env.DOQ_ADOPTION_ROUTES_DIR ?? resolve(tmpdir(), 'doq-adoption-angular-movement-routes'),
      'dist/analog/public',
    ),
  },
  // Angular Movement as it is today, already integrated with Doqs (scripts/adoption-existing.ts): the packed tarball replaces the installed one.
  adoptionExisting: {
    url: 'http://127.0.0.1:4287',
    root: resolve(
      process.env.DOQ_ADOPTION_EXISTING_DIR ?? resolve(tmpdir(), 'doq-adoption-angular-movement-existing'),
      'dist/analog/public',
    ),
  },
  // Bare Analog apps that adopted Doqs with `doq init` (scripts/init-consumer.ts), built from the packed tarball.
  initEmbedded: {
    url: 'http://127.0.0.1:4282',
    root: resolve(
      process.env.DOQ_INIT_EMBEDDED_DIR ?? resolve(tmpdir(), 'doq-init-consumer-embedded'),
      'dist/analog/public',
    ),
  },
  initDocsFirst: {
    url: 'http://127.0.0.1:4283',
    root: resolve(
      process.env.DOQ_INIT_DOCS_FIRST_DIR ?? resolve(tmpdir(), 'doq-init-consumer-docs-first'),
      'dist/analog/public',
    ),
  },
  consumer: {
    url: 'http://127.0.0.1:4275',
    root: resolve(process.env.DOQ_CONSUMER_DIR ?? resolve(tmpdir(), 'doq-e2e-consumer'), 'dist/analog/public'),
  },
  // The embedded scenario (Showcase A copy, documentation under /docs) built from the packed tarball.
  consumerA: {
    url: 'http://127.0.0.1:4279',
    root: resolve(process.env.DOQ_CONSUMER_A_DIR ?? resolve(tmpdir(), 'doq-e2e-consumer-a'), 'dist/analog/public'),
  },
  // Volt UI route-preserving proof (scripts/adoption-volt.ts): migrated component pages keep their /docs/* URLs next to host-owned pages.
  adoptionVolt: {
    url: 'http://127.0.0.1:4286',
    root: resolve(process.env.DOQ_ADOPTION_VOLT_DIR ?? resolve(tmpdir(), 'doq-adoption-volt-ui'), 'dist/analog/public'),
  },
  // The embedded consumer as a Zone.js application (`scripts/consumer.ts --zone`): zone.js loaded, provideZoneChangeDetection().
  consumerZone: {
    url: 'http://127.0.0.1:4285',
    root: resolve(
      process.env.DOQ_CONSUMER_ZONE_DIR ?? resolve(tmpdir(), 'doq-e2e-consumer-zone'),
      'dist/analog/public',
    ),
  },
  // Doqs 0.5-style consumers (no `versioning`), built from the same tarball: they must behave exactly as in 0.5.
  consumerLegacyA: {
    url: 'http://127.0.0.1:4280',
    root: resolve(
      process.env.DOQ_CONSUMER_LEGACY_A_DIR ?? resolve(tmpdir(), 'doq-e2e-consumer-legacy-a'),
      'dist/analog/public',
    ),
  },
  consumerLegacyB: {
    url: 'http://127.0.0.1:4281',
    root: resolve(
      process.env.DOQ_CONSUMER_LEGACY_B_DIR ?? resolve(tmpdir(), 'doq-e2e-consumer-legacy-b'),
      'dist/analog/public',
    ),
  },
} as const;

// E2E_SKIP_CONSUMER=1 (focused local runs) skips the tarball-installed consumer and its tests.
const withConsumer = !process.env.E2E_SKIP_CONSUMER;
const withAdoption = !!process.env.DOQ_ADOPTION_DIR;
const withAdoptionRoutes = !!process.env.DOQ_ADOPTION_ROUTES_DIR;
const withAdoptionVolt = !!process.env.DOQ_ADOPTION_VOLT_DIR;
const withAdoptionExisting = !!process.env.DOQ_ADOPTION_EXISTING_DIR;

// Specs that run in Firefox and WebKit as well as Chromium: routing, history, fragments, TOC, search, versions, tabs,
// copy, drawer, focus, themes, overflow and axe. The rest of the suite is engine-independent and stays Chromium-only.
const crossBrowserSpecs = [
  /adoption-routes-browsers|adoption-volt-browsers|docs-open|consumer-zone|playgrounds|slugs|toc|search\.spec|multilingual|versions\.spec|mobile-navigation|code-copy|rich-content|responsive|theme|accessibility|pagination|hardening|determinism|official-docs|authoring/,
];

const server = (app: (typeof apps)[keyof typeof apps], port: number) => ({
  command: `node scripts/preview-static.ts ${app.root}`,
  url: app.url,
  env: { PORT: String(port) },
  reuseExistingServer: false,
  timeout: 30_000,
});

export default defineConfig({
  testDir: 'e2e',
  testIgnore: [
    ...(process.env['E2E_WINDOWS_ACCEPTANCE'] ? [] : [/windows-browser\.spec/]),
    // One cell of the Angular compatibility matrix: runs against a dedicated consumer (playwright.compat.config.ts).
    /compat\.spec/,
    ...(withConsumer ? [] : [/consumer(-rich|-api|-init|-playgrounds|-zone)?\.spec/, /legacy\.spec/]),
    ...(withAdoption ? [] : [/adoption\.spec/]),
    ...(withAdoptionRoutes ? [] : [/adoption-routes/]),
    ...(withAdoptionVolt ? [] : [/adoption-volt/]),
    ...(withAdoptionExisting ? [] : [/adoption-existing/]),
  ],
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // The complete suite. PW_CHANNEL=chrome runs the installed Google Chrome instead of the downloaded Chromium build.
    // Only Chromium can grant clipboard permissions, so only here the copy test reads the clipboard back.
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        channel: process.env.PW_CHANNEL || undefined,
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
    // The focused cross-browser matrix (`pnpm test:e2e:browsers`): the journeys whose behavior depends on the engine.
    { name: 'firefox', testMatch: crossBrowserSpecs, use: { browserName: 'firefox' } },
    { name: 'webkit', testMatch: crossBrowserSpecs, use: { browserName: 'webkit' } },
  ],
  webServer: [
    server(apps.a, 4273),
    server(apps.b, 4274),
    server(apps.noSearch, 4276),
    server(apps.site, 4277),
    ...(withConsumer
      ? [
          server(apps.consumer, 4275),
          server(apps.consumerA, 4279),
          server(apps.consumerLegacyA, 4280),
          server(apps.consumerLegacyB, 4281),
          server(apps.consumerZone, 4285),
          server(apps.initEmbedded, 4282),
          server(apps.initDocsFirst, 4283),
        ]
      : []),
    ...(withAdoption ? [server(apps.adoption, 4278)] : []),
    ...(withAdoptionRoutes ? [server(apps.adoptionRoutes, 4284)] : []),
    ...(withAdoptionVolt ? [server(apps.adoptionVolt, 4286)] : []),
    ...(withAdoptionExisting ? [server(apps.adoptionExisting, 4287)] : []),
  ],
});

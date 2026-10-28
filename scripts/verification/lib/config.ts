import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Showcase, VerifiedApp, V01Expectations, Viewport } from './types.ts';

export const repo = resolve(fileURLToPath(new URL('../../..', import.meta.url)));

export const viewports: readonly Viewport[] = [
  [375, 812],
  [768, 1024],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
];

export const showcases: readonly Showcase[] = [
  {
    key: 'a',
    name: 'Showcase A',
    port: 4173,
    root: 'apps/showcase-a/dist/analog/public',
    paths: ['/', '/docs', '/docs/components/button', '/docs/overview'],
    doc: '/docs/components/button',
    nested: '/docs/components/navigation',
    toc: true,
    side: 'left',
    codePath: '/docs/components/button',
    tocPath: '/docs/overview',
    v01: {
      docsBase: '/docs',
      unknownRouteOwnedByHost: true,
      hostRoute: true,
      hostTitle: 'Vanta UI — Components with good energy',
      hostDescription: 'Vanta UI is an Angular component library with sensible defaults.',
      suffix: 'Vanta UI',
      indexTitle: 'Build with Vanta UI',
      indexSlot: '[data-testid="vanta-start"]',
      docSlot: '[data-testid="vanta-help"]',
    },
  },
  {
    key: 'b',
    name: 'Showcase B',
    port: 4174,
    root: 'apps/showcase-b/dist/analog/public',
    paths: ['/', '/onboarding/first-application', '/concepts/models'],
    doc: '/onboarding/first-application',
    nested: '/architecture/content-delivery',
    toc: false,
    side: 'right',
    codePath: '/onboarding/first-application',
    v01: {
      docsBase: '',
      hostRoute: false,
      hostTitle: 'ForgeCMS — Developer platform',
      hostDescription: 'ForgeCMS is a developer-first content platform.',
      suffix: 'ForgeCMS Developers',
      indexTitle: 'ForgeCMS developer hub',
      indexSlot: '[data-testid="forge-onboarding"]',
      docSlot: '[data-testid="forge-token-note"]',
      noDescriptionPath: '/reference/changelog',
    },
  },
];

const args = process.argv.slice(2);
const appArg = args.find((arg) => arg.startsWith('--app='))?.slice('--app='.length);

export const selectedShowcases = showcases.filter((app) => !appArg || appArg === 'both' || app.key === appArg);

/** Check keys from `--check=a,b`; empty means every check. */
export const checkFilters = (args.find((arg) => arg.startsWith('--check='))?.slice('--check='.length) ?? '')
  .split(',')
  .filter(Boolean);

export const isSelected = (check: string): boolean => !checkFilters.length || checkFilters.includes(check);

/** The tarball-installed external consumer, when MVP_CONSUMER_ROOT is set. */
export const consumerApp: VerifiedApp | null = process.env['MVP_CONSUMER_ROOT']
  ? {
      key: 'consumer',
      name: 'External consumer',
      port: 4175,
      distRoot: resolve(process.env['MVP_CONSUMER_ROOT']),
      doc: '/onboarding/first-application',
      nested: '/concepts/models',
      // `pnpm consumer:build` produces a copy of Showcase B, so its expectations are the default.
      v01: process.env['MVP_CONSUMER_V01']
        ? (JSON.parse(process.env['MVP_CONSUMER_V01']) as V01Expectations)
        : (showcases[1]?.v01 ?? null),
    }
  : null;

export const artifactDir = resolve(process.env['MVP_ARTIFACT_DIR'] ?? join(tmpdir(), 'doq-mvp-evidence'));
export const tocFixtureDir = join(repo, 'apps/showcase-a/src/content/docs/verification');

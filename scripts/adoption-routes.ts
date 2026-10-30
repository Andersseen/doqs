/**
 * Angular Movement route-preserving adoption proof (Doqs 0.11): the packed @doqs/analog tarball replaces four of the host's
 * hand-built /docs pages IN PLACE, at their original URLs, while the host keeps /, /demos/* and the remaining /docs pages.
 *
 *   node scripts/adoption-routes.ts [outDir] [--test]   --test also runs e2e/adoption-routes.spec.ts against the result
 *
 * Complements scripts/adoption.ts (a separate /handbook region with versioning). Nothing is pushed anywhere and the checkout
 * lives outside this repository. The overlay is tests/adoption/angular-movement-routes; AM_REPO / AM_REF override the source.
 * Needs network access to clone the repository.
 */
import { spawnSync } from 'node:child_process';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { assertAotBuild } from './aot-guard.ts';
import {
  assertDisposable,
  checkout,
  editor,
  expectStatus as expectStatusFor,
  repo,
  runner,
  tarballPath,
  upstream,
} from './adoption-lib.ts';

/** Pre-integration revision (Angular Movement v1.4.0 era, before it adopted Doqs): the historical onboarding contract. */
const pinnedRef = '4e71e2f75be3c82ec4f10ca80dc91d08562efa1b';
const overlay = resolve(repo, 'tests/adoption/angular-movement-routes');
const { tarball } = await tarballPath();
const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const outDir = resolve(
  args[0] ?? process.env['DOQ_ADOPTION_ROUTES_DIR'] ?? resolve(tmpdir(), 'doq-adoption-angular-movement-routes'),
);
assertDisposable(outDir);

const run = runner('adoption-routes');
const edit = editor('adoption-routes', outDir);
const expectStatus = expectStatusFor('adoption-routes');

const source = upstream('AM', 'https://github.com/Andersseen/angular-movement.git', pinnedRef);
const sha = await checkout('adoption-routes', source, outDir);

run('pnpm', ['install', '--ignore-scripts', '--no-frozen-lockfile'], outDir);
// The pinned revision predates the Analog 2.9.2 peer floor (PR #30); doctor's own fix for the failing peer check is to upgrade it.
run('pnpm', ['add', `file:${tarball}`, '@analogjs/content@^2.9.2', 'pagefind@1.5.2', '--ignore-scripts'], outDir);

// The host pages that Doqs replaces. Everything else under /docs, /demos and the landing stays exactly as upstream wrote it.
const migrated = ['get-started', 'api-selection', 'accessibility', 'reference'];
for (const page of migrated) await rm(resolve(outDir, `src/app/pages/docs/${page}.page.ts`));

await cp(resolve(overlay, 'src'), resolve(outDir, 'src'), { recursive: true });
await edit('vite.config.ts', (text) =>
  text
    .replace(
      "import { resolve } from 'path';",
      "import { resolve } from 'path';\nimport { doqPrerenderRoutes } from '@doqs/analog/config';\nimport { doqDeterministicMarkdown } from '@doqs/analog/vite';\nimport { doqPaths } from './src/doq.paths';",
    )
    .replace('    }),\n  ],\n  test: {', '    }),\n    doqDeterministicMarkdown(),\n  ],\n  test: {')
    .replace('content: {\n        prismOptions', "content: {\n        highlighter: 'prism',\n        prismOptions")
    .replace(
      '      ssr: true,\n',
      "      ssr: true,\n      prerender: { routes: async () => ['/', '/demos/enter', '/docs/introduction', ...doqPrerenderRoutes(doqPaths)] },\n",
    ),
);
const append = await readFile(resolve(overlay, 'styles.append.css'), 'utf8');
await edit(
  'src/styles.css',
  (text) =>
    `${text.replace("@import 'tailwindcss';\n", "@import 'tailwindcss';\n@import '@doqs/analog/styles.css';\n")}\n${append}`,
);
await edit('package.json', (text) =>
  text.replace(
    '"build": "pnpm exec vite build"',
    '"build": "pnpm exec vite build && doq-search index dist/analog/public"',
  ),
);

// Generated API reference at the host's existing /docs/reference URL, from the checkout's own TypeScript.
const doqApi = (command: 'generate' | 'check') =>
  spawnSync(
    'pnpm',
    [
      '--silent',
      'exec',
      'doq-api',
      command,
      '--project',
      'projects/movement/tsconfig.lib.json',
      '--entry',
      'projects/movement/src/public-api.ts',
      '--content-dir',
      'src/content/docs',
      '--out',
      'src/content/docs/reference',
      '--base-path',
      '/docs',
      '--group',
      'Reference',
      '--title',
      'API reference',
    ],
    { cwd: outDir, encoding: 'utf8' },
  );
// One region marker in the real provider source (disposable checkout only); fails loudly if upstream's layout moves.
await edit('projects/movement/src/lib/providers/provide-movement.ts', (text) =>
  text
    .replace('export function provideMovement(', '// #region doqs:provide-movement\nexport function provideMovement(')
    .replace(/(\n {2}\]\);\n\}\n)(?![\s\S]*\n {2}\]\);\n\}\n)/, '$1// #endregion doqs:provide-movement\n'),
);
const generated = doqApi('generate');
console.log(generated.stdout + generated.stderr);
expectStatus('doq-api generate', generated.status, 0);
expectStatus('doq-api check', doqApi('check').status, 0);

await writeFile(
  resolve(outDir, 'doq.content.json'),
  `${JSON.stringify(
    {
      targets: [
        {
          name: 'docs',
          authoring: 'src/authoring/docs',
          out: 'src/content/docs',
          sourceRoots: ['projects/movement/src'],
          api: ['src/content/docs/reference'],
        },
      ],
    },
    null,
    2,
  )}\n`,
);
const content = spawnSync('pnpm', ['--silent', 'exec', 'doq', 'content', 'generate'], {
  cwd: outDir,
  encoding: 'utf8',
});
console.log(content.stdout + content.stderr);
expectStatus('doq content generate', content.status, 0);

run('pnpm', ['run', 'build'], outDir);
assertAotBuild('adoption-routes', outDir);
run(
  'node',
  [
    'scripts/docs-check.ts',
    `--dist=${resolve(outDir, 'dist/analog/public')}`,
    `--source=${outDir}`,
    '--link-scope=/docs/reference',
  ],
  repo,
);
const doctor = spawnSync('pnpm', ['--silent', 'exec', 'doq', 'doctor', '--build', '--json'], {
  cwd: outDir,
  encoding: 'utf8',
});
const report = JSON.parse(doctor.stdout) as { summary: { FAIL: number }; findings: { id: string; status: string }[] };
if (report.summary.FAIL !== 0)
  throw new Error(
    `adoption-routes: doctor FAIL: ${JSON.stringify(report.findings.filter((f) => f.status === 'FAIL'))}`,
  );
console.log(`adoption-routes: ready ${resolve(outDir, 'dist/analog/public')} (Angular Movement ${sha})`);

if (process.argv.includes('--test')) {
  const result = spawnSync('pnpm', ['exec', 'playwright', 'test', 'e2e/adoption-routes.spec.ts'], {
    cwd: repo,
    stdio: 'inherit',
    env: {
      ...process.env,
      DOQ_ADOPTION_ROUTES_DIR: outDir,
      // The proof needs its own checkout and the workspace builds, not the tarball consumers of the main E2E suite.
      E2E_SKIP_CONSUMER: '1',
      PLAYWRIGHT_BROWSERS_PATH: process.env['PLAYWRIGHT_BROWSERS_PATH'] ?? '0',
    },
  });
  process.exit(result.status ?? 1);
}

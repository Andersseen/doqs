/**
 * Builds the Angular Movement adoption proof: a disposable checkout of the real Angular Movement site with
 * the packed @doqs/analog tarball and a /handbook documentation region added next to its existing /docs.
 *
 *   node scripts/adoption.ts [outDir] [--test]   --test also runs e2e/adoption.spec.ts against the result
 *
 * Nothing is pushed anywhere and the checkout lives outside this repository. The overlay is
 * tests/adoption/angular-movement; AM_REPO / AM_REF override the source (default: the public repository's default branch).
 * Needs network access to clone the repository.
 */
import { spawnSync } from 'node:child_process';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
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
const overlay = resolve(repo, 'tests/adoption/angular-movement');
const { tarball } = await tarballPath();
const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const outDir = resolve(
  args[0] ?? process.env['DOQ_ADOPTION_DIR'] ?? resolve(tmpdir(), 'doq-adoption-angular-movement'),
);
assertDisposable(outDir);

const run = runner('adoption');
const edit = editor('adoption', outDir);
const expectStatus = expectStatusFor('adoption');

const source = upstream('AM', 'https://github.com/Andersseen/angular-movement.git', pinnedRef);
const sha = await checkout('adoption', source, outDir);

// Doqs 0.8 onboarding on the real checkout, before anything is integrated by hand: install the packed tarball, let `doq doctor`
// report the real gaps, scaffold a SEPARATE documentation region (/handbook; the host's /docs and /demos stay untouched) with
// `doq init`, and prove that the dry run writes nothing and that nothing outside the region is touched.
run('pnpm', ['install', '--ignore-scripts', '--no-frozen-lockfile'], outDir);
run('pnpm', ['add', `file:${tarball}`, 'pagefind@1.5.2', '--ignore-scripts'], outDir);
const doq = (cliArgs: string[], expected: number) => {
  const result = spawnSync('pnpm', ['--silent', 'exec', 'doq', ...cliArgs, '--json'], {
    cwd: outDir,
    encoding: 'utf8',
  });
  if (result.status !== expected)
    throw new Error(
      `adoption: doq ${cliArgs.join(' ')} exited ${result.status}, expected ${expected}\n${result.stdout}${result.stderr}`,
    );
  return JSON.parse(result.stdout) as any;
};
const status = (report: any, id: string) => report.findings.find((item: any) => item.id === id)?.status;
const before = doq(['doctor'], 1);
for (const id of ['config.paths', 'setup.providers', 'setup.stylesheet', 'setup.prerender'])
  if (status(before, id) !== 'FAIL')
    throw new Error(`adoption: doctor must report ${id} as FAIL before integration, got ${status(before, id)}`);
if (status(before, 'peer.@angular/core') !== 'PASS')
  throw new Error('adoption: Angular 22 must satisfy the declared peer range');
if (before.findings.some((item: any) => item.status === 'FAIL' && !item.fix))
  throw new Error('adoption: every failing finding needs a fix');
console.log(`adoption: doctor before integration: ${JSON.stringify(before.summary)}`);
const hostFilesBefore = spawnSync('git', ['status', '--porcelain'], { cwd: outDir, encoding: 'utf8' }).stdout;
const initArgs = ['init', '--content-dir', 'handbook', '--base-path', '/handbook'];
const dry = doq([...initArgs, '--dry-run'], 0);
if (spawnSync('git', ['status', '--porcelain'], { cwd: outDir, encoding: 'utf8' }).stdout !== hostFilesBefore)
  throw new Error('adoption: doq init --dry-run changed the working tree');
if (!dry.files.every((file: any) => file.status === 'create'))
  throw new Error('adoption: dry run did not plan to create every file');
const initialized = doq(initArgs, 0);
if (initialized.scaffold !== 'complete' || initialized.integration !== 'incomplete')
  throw new Error(
    `adoption: expected scaffold complete / integration incomplete, got ${initialized.scaffold} / ${initialized.integration}`,
  );
const touched = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: outDir, encoding: 'utf8' })
  .stdout.split('\n')
  .filter((line) => line && !/package\.json|pnpm-lock/.test(line));
if (touched.some((line) => !/^\?\? src\/(doq\.paths\.ts|content\/handbook\/)/.test(line)))
  throw new Error(`adoption: doq init touched files outside its region:\n${touched.join('\n')}`);
// The proof's own handbook content replaces the generated starter pages (the paths file is overwritten with the versioned one).
await rm(resolve(outDir, 'src/content/handbook'), { recursive: true, force: true });

await cp(resolve(overlay, 'src'), resolve(outDir, 'src'), { recursive: true });
await edit('vite.config.ts', (text) =>
  text
    .replace(
      "import { resolve } from 'path';",
      "import { resolve } from 'path';\nimport { doqPrerenderRoutes } from '@doqs/analog';\nimport { doqDeterministicMarkdown } from '@doqs/analog/vite';\nimport { doqPaths } from './src/doq.paths';",
    )
    // Deterministic heading ids (Doqs 0.7): Markdown files are rendered one at a time, so no rebuild lottery is needed.
    .replace('    }),\n  ],\n  test: {', '    }),\n    doqDeterministicMarkdown(),\n  ],\n  test: {')
    .replace('content: {\n        prismOptions', "content: {\n        highlighter: 'prism',\n        prismOptions")
    .replace(
      '      ssr: true,\n',
      "      ssr: true,\n      prerender: { routes: async () => ['/', '/docs/introduction', '/demos/enter', ...doqPrerenderRoutes(doqPaths)] },\n",
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

// Doctor after the integration (overlay + patches above): every check it can establish passes, and `doq init` agrees that the
// integration is complete and changes nothing.
const afterIntegration = doq(['doctor'], 0);
if (afterIntegration.summary.FAIL !== 0)
  throw new Error(
    `adoption: doctor FAIL after integration:\n${JSON.stringify(
      afterIntegration.findings.filter((item: any) => item.status === 'FAIL'),
      null,
      2,
    )}`,
  );
for (const id of [
  'setup.providers',
  'setup.stylesheet',
  'setup.prerender',
  'setup.deterministic',
  'search.pagefind',
  'search.index-step',
  'versions.config',
])
  if (status(afterIntegration, id) !== 'PASS')
    throw new Error(`adoption: doctor ${id} is ${status(afterIntegration, id)}, expected PASS`);
console.log(`adoption: doctor after integration: ${JSON.stringify(afterIntegration.summary)}`);
const again = doq(initArgs, 0);
if (again.integration !== 'complete' || again.files.some((file: any) => file.status === 'create'))
  throw new Error(
    `adoption: init after integration should be complete and create nothing: ${JSON.stringify(again.files)}`,
  );
// API reference (Doqs 0.5): generated from the real public entry point with the checkout's own TypeScript, then
// proven stale-sensitive. The checkout is disposable; nothing is committed to the Angular Movement repository.
const apiArgs = [
  '--project',
  'projects/movement/tsconfig.lib.json',
  '--entry',
  'projects/movement/src/public-api.ts',
  '--content-dir',
  'src/content/handbook',
  '--out',
  'src/content/handbook/api',
  '--base-path',
  '/handbook',
  '--group',
  'API reference',
  '--title',
  'Movement API reference',
];
const doqApi = (command: 'generate' | 'check', extraArgs = apiArgs) => {
  const started = Date.now();
  const result = spawnSync('pnpm', ['exec', 'doq-api', command, ...extraArgs], { cwd: outDir, encoding: 'utf8' });
  console.log(
    `adoption: doq-api ${command} exit ${result.status} in ${Date.now() - started} ms\n${result.stdout}${result.stderr}`,
  );
  return result;
};
const typescriptVersion = spawnSync('pnpm', ['exec', 'tsc', '--version'], {
  cwd: outDir,
  encoding: 'utf8',
}).stdout.trim();
console.log(`adoption: checkout compiler: ${typescriptVersion}`);
// Content authoring (Doqs 0.10) needs one region marker in the real source, added in this disposable checkout only. The edit fails
// loudly if upstream's file layout moves.
const wrapProvider = (text: string) =>
  text
    .replace('export function provideMovement(', '// #region doqs:provide-movement\nexport function provideMovement(')
    .replace(/(\n {2}\]\);\n\}\n)(?![\s\S]*\n {2}\]\);\n\}\n)/, '$1// #endregion doqs:provide-movement\n');
await edit('projects/movement/src/lib/providers/provide-movement.ts', wrapProvider);
expectStatus('generate', doqApi('generate').status, 0);
expectStatus('check right after generate', doqApi('check').status, 0);
// Versioned documentation (Doqs 0.6): a GENUINE historical source. The upstream tag below is cloned, its library project is
// placed next to the current one and documented by the same installed doq-api into a separate archive directory. Nothing is
// invented: the archive's generated pages are whatever that tag's public API really was.
const archiveRef = process.env['AM_ARCHIVE_REF'] ?? 'v0.9.0';
const history = resolve(outDir, '..', `${outDir.split('/').pop()}-history`);
await rm(history, { recursive: true, force: true });
run('git', ['clone', '--depth', '1', '--branch', archiveRef, source.url, history], repo);
await cp(resolve(history, 'projects/movement'), resolve(outDir, 'projects/movement-v0-9'), {
  recursive: true,
  filter: (path) => !path.includes('node_modules'),
});
await rm(history, { recursive: true, force: true });
const archiveApiArgs = [
  '--project',
  'projects/movement-v0-9/tsconfig.lib.json',
  '--entry',
  'projects/movement-v0-9/src/public-api.ts',
  '--content-dir',
  'src/content/handbook-v0-9',
  '--out',
  'src/content/handbook-v0-9/api',
  '--base-path',
  '/handbook/v/0.9',
  '--group',
  'API reference',
  '--title',
  'Movement API reference',
];
expectStatus('archive generate', doqApi('generate', archiveApiArgs).status, 0);
expectStatus('archive check', doqApi('check', archiveApiArgs).status, 0);
await edit('projects/movement-v0-9/src/lib/providers/provide-movement.ts', wrapProvider);
const archiveManifest = resolve(outDir, 'src/content/handbook-v0-9/api/.doq-api.json');
const archiveBefore = await readFile(archiveManifest, 'utf8');
const provide = resolve(outDir, 'projects/movement/src/lib/providers/provide-movement.ts');
const original = await readFile(provide, 'utf8');
const changed = original.replace(
  'export function provideMovement(config: MovementConfigInput = {}): EnvironmentProviders',
  'export function provideMovement(config: MovementConfigInput = {}, label?: string): EnvironmentProviders',
);
if (changed === original)
  throw new Error('adoption: provideMovement signature changed upstream; update the stale-check probe.');
await writeFile(provide, changed);
const stale = doqApi('check');
expectStatus('check after a public API change', stale.status, 1);
if (!/modified\s+provide-movement\.md/.test(stale.stderr))
  throw new Error('adoption: stale check did not name provide-movement.md');
expectStatus('generate after the change', doqApi('generate').status, 0);
expectStatus('check after regeneration', doqApi('check').status, 0);
await writeFile(provide, original);
expectStatus('generate after restoring the source', doqApi('generate').status, 0);
expectStatus('check after restoring the source', doqApi('check').status, 0);
// Regenerating the current reference never touches the archive's pages or manifest, and the archive still checks clean.
if ((await readFile(archiveManifest, 'utf8')) !== archiveBefore)
  throw new Error('adoption: current regeneration changed the archive manifest');
expectStatus('archive check after current regeneration', doqApi('check', archiveApiArgs).status, 0);

// Content authoring (Doqs 0.10): the authored guide shows the real provider source (current checkout and the v0.9.0 snapshot),
// links the generated API pages of its own version, includes a shared fragment and sits next to a live playground. Stale-output
// detection is proven on the real source: changing the region makes `check` fail without writing, `generate` repairs it.
await writeFile(
  resolve(outDir, 'doq.content.json'),
  `${JSON.stringify(
    {
      targets: [
        {
          name: 'latest',
          authoring: 'src/authoring/handbook',
          out: 'src/content/handbook',
          sourceRoots: ['projects/movement/src'],
          api: ['src/content/handbook/api'],
        },
        {
          name: 'v0.9',
          authoring: 'src/authoring/handbook-v0-9',
          out: 'src/content/handbook-v0-9',
          sourceRoots: ['projects/movement-v0-9/src'],
          api: ['src/content/handbook-v0-9/api'],
        },
      ],
    },
    null,
    2,
  )}\n`,
);
const content = (command: 'generate' | 'check') => {
  const started = Date.now();
  const result = spawnSync('pnpm', ['--silent', 'exec', 'doq', 'content', command], { cwd: outDir, encoding: 'utf8' });
  console.log(
    `adoption: doq content ${command} exit ${result.status} in ${Date.now() - started} ms\n${result.stdout}${result.stderr}`,
  );
  return result;
};
expectStatus('content check before the first generate', content('check').status, 1);
expectStatus('content generate', content('generate').status, 0);
expectStatus('content check right after generate', content('check').status, 0);
const generatedGuide = resolve(outDir, 'src/content/handbook/guides/source-backed.md');
const guideBefore = await readFile(generatedGuide, 'utf8');
if (
  !/\[`provideMovement`\]\(\/handbook\/api\/provide-movement\)/.test(guideBefore) ||
  !guideBefore.includes('normalizeTime')
)
  throw new Error('adoption: the generated guide lacks the API link or the real source');
const archivedGuide = await readFile(resolve(outDir, 'src/content/handbook-v0-9/guides/source-backed.md'), 'utf8');
if (!archivedGuide.includes('(/handbook/v/0.9/api/provide-movement)') || archivedGuide.includes('normalizeTime'))
  throw new Error('adoption: the archived guide must link the archived reference and show the historical source');
await writeFile(provide, changed);
const staleContent = content('check');
expectStatus('content check after a source change', staleContent.status, 1);
if (!/modified\s+guides\/source-backed\.md/.test(staleContent.stdout))
  throw new Error('adoption: content check did not name guides/source-backed.md');
if ((await readFile(generatedGuide, 'utf8')) !== guideBefore) throw new Error('adoption: content check wrote a file');
await writeFile(provide, original);
expectStatus('content check after restoring the source', content('check').status, 0);

// Heading ids: the upstream race (concurrent Markdown renders share marked-gfm-heading-id's slugger, see docs/repro) is contained
// by doqDeterministicMarkdown() in the patched vite.config.ts, so ONE build must already be canonical. `docs:check` compares every
// prerendered handbook page with a strictly sequential render of that page and validates routes, TOC fragments and links; there
// is no retry loop. The disposable checkout is built exactly once.
run('pnpm', ['run', 'build'], outDir);
// Angular Movement prerenders only a few of its own routes, so links to its other pages are not the handbook's to validate.
run(
  'node',
  [
    'scripts/docs-check.ts',
    `--dist=${resolve(outDir, 'dist/analog/public')}`,
    `--source=${outDir}`,
    '--link-scope=/handbook',
  ],
  repo,
);
const built = doq(['doctor', '--build'], 0);
for (const id of ['build.routes', 'build.pagefind'])
  if (status(built, id) !== 'PASS')
    throw new Error(`adoption: doctor ${id} is ${status(built, id)} after the build, expected PASS`);
console.log(`adoption: ready ${resolve(outDir, 'dist/analog/public')} (Angular Movement ${sha})`);

if (process.argv.includes('--test')) {
  const result = spawnSync('pnpm', ['exec', 'playwright', 'test', 'e2e/adoption.spec.ts'], {
    cwd: repo,
    stdio: 'inherit',
    env: {
      ...process.env,
      DOQ_ADOPTION_DIR: outDir,
      PLAYWRIGHT_BROWSERS_PATH: process.env['PLAYWRIGHT_BROWSERS_PATH'] ?? '0',
    },
  });
  process.exit(result.status ?? 1);
}

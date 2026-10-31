/**
 * Builds an independent consumer of the packed @doqs/analog tarball.
 *
 * The consumer is a copy of a showcase's sources with its own manifest and lockfile, installed outside
 * this workspace from the tarball (`file:`), so nothing resolves through `workspace:` links or library sources.
 * Showcase B (docs-first, mounted at the root) is the default; `--app=showcase-a` builds the embedded scenario
 * (documentation under /docs inside a host site). `--zone` (embedded scenario only) turns the copy into a Zone.js application: `zone.js`
 * is installed and imported on the client and the server and `provideZoneChangeDetection()` replaces the zoneless default of
 * Angular 21. `--no-authoring` removes the 0.10 content authoring (authored pages, the
 * generated pages, `doq.content.json`, the Vite plugin), which reproduces a 0.9-style consumer that must keep working
 * unchanged. `--unversioned` strips the versioning configuration and the archive
 * fixtures, which reproduces a Doqs 0.5-style consumer that must keep working unchanged on 0.6.
 *
 *   node scripts/consumer.ts [tarball] [outDir] [--app=showcase-a|showcase-b] [--unversioned]
 *
 * Defaults: artifacts/doqs-analog-<version>.tgz and, for outDir, $DOQ_CONSUMER_DIR (B) or $DOQ_CONSUMER_A_DIR (A),
 * else <tmp>/doq-e2e-consumer or <tmp>/doq-e2e-consumer-a. The static output is written to <outDir>/dist/analog/public.
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { analogOverrides } from './analog-pin.ts';
import { writeDocsFixture } from './fixtures/docs.ts';
import { buildAot } from './aot-guard.ts';

const repo = resolve(import.meta.dirname, '..');
const flags = process.argv.slice(2).filter((arg) => arg.startsWith('--'));
const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const app = flags.find((flag) => flag.startsWith('--app='))?.slice('--app='.length) ?? 'showcase-b';
if (app !== 'showcase-a' && app !== 'showcase-b') throw new Error(`Unknown --app=${app}`);
const source = resolve(repo, `apps/${app}`);
const { version } = JSON.parse(await readFile(resolve(repo, 'packages/doq/package.json'), 'utf8')) as {
  version: string;
};
const unversioned = flags.includes('--unversioned');
// --stress=<n>: add n generated documents (with duplicate headings and rich Markdown) to the current docs and to each archive.
const stress = Number(flags.find((flag) => flag.startsWith('--stress='))?.slice('--stress='.length) ?? 0);
const skipApi = flags.includes('--skip-api');
const noAuthoring = flags.includes('--no-authoring');
const zone = flags.includes('--zone');
if (zone && app !== 'showcase-a') throw new Error('--zone is only defined for --app=showcase-a');
// --angular=22: install Angular 22 with TypeScript 6 (the range Angular 22 supports) instead of the workspace's Angular 21.
// Every other package keeps the version range of the showcase, and peer dependencies are checked strictly, never silenced.
const angular = flags.find((flag) => flag.startsWith('--angular='))?.slice('--angular='.length);
if (angular !== undefined && angular !== '21' && angular !== '22') throw new Error(`Unknown --angular=${angular}`);
// --slow-markdown: add an asynchronous marked step, like Shiki's, so Markdown renders really interleave (determinism stress).
// --without-deterministic-markdown: the control; remove the guard from vite.config.ts.
const slowMarkdown = flags.includes('--slow-markdown');
const withoutGuard = flags.includes('--without-deterministic-markdown');
const tarball = resolve(positional[0] ?? `artifacts/doqs-analog-${version}.tgz`);
const outDir = resolve(
  positional[1] ??
    (zone
      ? (process.env['DOQ_CONSUMER_ZONE_DIR'] ?? resolve(tmpdir(), 'doq-e2e-consumer-zone'))
      : noAuthoring
        ? (process.env['DOQ_CONSUMER_PLAIN_DIR'] ??
          resolve(tmpdir(), `doq-e2e-consumer-plain${app === 'showcase-a' ? '-a' : ''}`))
        : unversioned
          ? app === 'showcase-a'
            ? (process.env['DOQ_CONSUMER_LEGACY_A_DIR'] ?? resolve(tmpdir(), 'doq-e2e-consumer-legacy-a'))
            : (process.env['DOQ_CONSUMER_LEGACY_B_DIR'] ?? resolve(tmpdir(), 'doq-e2e-consumer-legacy-b'))
          : app === 'showcase-a'
            ? (process.env['DOQ_CONSUMER_A_DIR'] ?? resolve(tmpdir(), 'doq-e2e-consumer-a'))
            : (process.env['DOQ_CONSUMER_DIR'] ?? resolve(tmpdir(), 'doq-e2e-consumer'))),
);

if (outDir === repo || outDir.startsWith(`${repo}/`))
  throw new Error(`The consumer must live outside the repository: ${outDir}`);
await readFile(tarball).catch(() => {
  throw new Error(`Tarball not found: ${tarball}. Run "pnpm pack:doq" first.`);
});

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
const skip = new Set(['node_modules', 'dist', '.turbo', '.angular', 'AGENTS.md', 'CLAUDE.md']);
await cp(source, outDir, { recursive: true, filter: (path) => !skip.has(path.split('/').pop() ?? '') });

if (zone) {
  const patch = async (file: string, change: (text: string) => string) => {
    const path = resolve(outDir, file);
    const before = await readFile(path, 'utf8');
    const after = change(before);
    if (after === before) throw new Error(`--zone: patch for ${file} changed nothing`);
    await writeFile(path, after);
  };
  await patch('src/main.ts', (text) => `import 'zone.js';\n${text}`);
  await patch('src/main.server.ts', (text) => `import 'zone.js/node';\n${text}`);
  await patch('src/app/app.config.ts', (text) =>
    text
      .replace(
        "import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';",
        "import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';",
      )
      .replace(
        'provideBrowserGlobalErrorListeners(),',
        'provideBrowserGlobalErrorListeners(),\n    provideZoneChangeDetection({ eventCoalescing: true }),',
      ),
  );
}

if (unversioned) {
  // A 0.5-style configuration: only contentDirectory and basePath, no archives, no versioned fixtures.
  const basePath = app === 'showcase-a' ? '/docs' : '/';
  await writeFile(
    resolve(outDir, 'src/doq.paths.ts'),
    `export const doqPaths = {\n  contentDirectory: 'docs',\n  basePath: '${basePath}',\n} as const;\n`,
  );
  for (const archive of ['src/content/docs-v1', 'vanta-ui-v1', 'forge-sdk-v1'])
    await rm(resolve(outDir, archive), { recursive: true, force: true });
}

if (noAuthoring || unversioned) {
  // Content authoring is opt-in: a project without it has no configuration, no authored pages and no generated pages.
  const configFile = resolve(outDir, 'doq.content.json');
  const config = JSON.parse(await readFile(configFile, 'utf8')) as {
    targets: { name: string; authoring: string; out: string }[];
  };
  for (const target of config.targets) {
    if (!noAuthoring && !target.out.endsWith('docs-v1')) continue;
    const manifestFile = resolve(outDir, target.authoring, '.doq-content.json');
    const owned = Object.keys(JSON.parse(await readFile(manifestFile, 'utf8')).files as Record<string, string>);
    for (const file of owned) await rm(resolve(outDir, target.out, file), { force: true });
    await rm(resolve(outDir, target.authoring), { recursive: true, force: true });
  }
  if (noAuthoring) {
    await rm(configFile);
    await rm(resolve(outDir, 'src/authoring'), { recursive: true, force: true });
    const viteFile = resolve(outDir, 'vite.config.ts');
    await writeFile(
      viteFile,
      (await readFile(viteFile, 'utf8'))
        .replace(/import \{ doqContent \}[^\n]*\n/, '')
        .replace(/\s*\/\/ Resolves ::source[^\n]*\n\s*doqContent\(\),/, ''),
    );
  } else {
    config.targets = config.targets.filter((target) => !target.out.endsWith('docs-v1'));
    await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`);
  }
}

if (stress > 0) {
  const demo = app === 'showcase-a' ? 'vanta-button' : 'forge-schema';
  await writeDocsFixture(resolve(outDir, 'src/content/docs'), { count: stress, demo, label: 'current' });
  if (!unversioned) {
    await writeDocsFixture(resolve(outDir, 'src/content/docs-v1'), {
      count: Math.ceil(stress / 2),
      demo,
      label: 'archive',
    });
  }
}

if (slowMarkdown || withoutGuard) {
  const configFile = resolve(outDir, 'vite.config.ts');
  let config = await readFile(configFile, 'utf8');
  if (withoutGuard)
    config = config
      .replace(/import \{ doqDeterministicMarkdown \}[^\n]*\n/, '')
      .replace(/\s*\/\/ Renders Markdown one file[^\n]*\n\s*doqDeterministicMarkdown\(\),/, '');
  if (slowMarkdown) {
    config = config.replace(
      "content: { highlighter: 'prism' }",
      "content: { highlighter: 'prism', markedOptions: { extensions: [{ async: true, walkTokens: () => new Promise<void>(done => setTimeout(done, 1)) }] } }",
    );
  }
  await writeFile(configFile, config);
}

const manifest = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'));
manifest.name = `${app === 'showcase-a' ? 'doq-external-consumer-embedded' : 'doq-external-consumer'}${noAuthoring ? '-plain' : ''}${zone ? '-zone' : ''}${unversioned ? '-unversioned' : ''}${angular ? `-ng${angular}` : ''}`;
manifest.dependencies['@doqs/analog'] = `file:${tarball}`;
manifest.pnpm = { ...manifest.pnpm, overrides: { ...manifest.pnpm?.overrides, ...analogOverrides } };
if (zone) manifest.dependencies['zone.js'] = '~0.15.1';
if (angular === '22') {
  for (const group of ['dependencies', 'devDependencies'] as const)
    for (const name of Object.keys(manifest[group] ?? {}))
      if (name.startsWith('@angular/')) manifest[group][name] = '^22.0.0';
  manifest.devDependencies['typescript'] = '~6.0.0';
  // Unused by the showcase's vite.config.ts, and its tsconfck dependency only supports TypeScript 5 (a tooling peer, not Doqs's).
  delete manifest.devDependencies['vite-tsconfig-paths'];
  if (manifest.dependencies['typescript']) manifest.dependencies['typescript'] = '~6.0.0';
  // Strict peers apply to everything except one upstream packaging defect: @angular/build's optional WASM binding
  // (@oxc-parser/binding-wasm32-wasi 0.150) pins @emnapi/*@2.0.0-alpha.3 while its own @napi-rs/wasm-runtime asks for
  // ^1.7.1 || 2.0.0-beta.2. Nothing in it involves Doqs.
  manifest.pnpm = {
    ...manifest.pnpm,
    peerDependencyRules: { allowedVersions: { '@emnapi/core': '2.0.0-alpha.3', '@emnapi/runtime': '2.0.0-alpha.3' } },
  };
}
manifest.scripts = {
  ...Object.fromEntries(
    Object.entries(manifest.scripts).filter(
      ([name]) => name.startsWith('api') || (!noAuthoring && name.startsWith('content')),
    ),
  ),
  build: 'vite build && doq-search index dist/analog/public',
};
if (unversioned) {
  for (const name of Object.keys(manifest.scripts)) if (name.endsWith(':v1')) delete manifest.scripts[name];
  manifest.scripts['api'] = manifest.scripts['api:latest'];
  manifest.scripts['api:check'] = manifest.scripts['api:check:latest'];
}
await writeFile(resolve(outDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const pnpm = (args: string[], expected = 0) => {
  console.log(`consumer: pnpm ${args.join(' ')}`);
  const result = spawnSync('pnpm', args, { cwd: outDir, stdio: 'inherit', env: { ...process.env, CI: 'true' } });
  if (result.status !== expected) {
    console.error(`consumer: "pnpm ${args.join(' ')}" exited ${result.status}, expected ${expected}`);
    process.exit(1);
  }
};
pnpm(['install', ...(angular ? ['--config.strict-peer-dependencies=true'] : [])]);
if (skipApi) {
  if (!flags.includes('--no-build')) {
    buildAot('consumer', outDir, () => pnpm(['build']));
  }
  console.log(`consumer ready: ${resolve(outDir, 'dist/analog/public')}`);
  process.exit(0);
}

// API reference through the installed `doq-api` binary and the consumer's own TypeScript: the committed pages must be
// current, a public API change must make `check` fail until `generate` runs, and regenerating restores the pages.
const entry = resolve(outDir, app === 'showcase-a' ? 'vanta-ui/src/public-api.ts' : 'forge-sdk/src/public-api.ts');
const original = await readFile(entry, 'utf8');
pnpm(['run', 'api:check']);
await writeFile(entry, `${original}\n/** Added by the consumer proof. */\nexport const consumerProbe = 1;\n`);
pnpm(['run', 'api:check'], 1);
pnpm(['run', 'api']);
pnpm(['run', 'api:check']);
await writeFile(entry, original);
pnpm(['run', 'api']);
pnpm(['run', 'api:check']);

if (!noAuthoring) {
  // Content authoring through the installed `doq` binary: committed pages are current, a source change makes `check`
  // fail without writing, `generate` restores them, and an edited generated page is a conflict that is never overwritten.
  const region = resolve(
    outDir,
    app === 'showcase-a' ? 'vanta-ui/src/vanta-alert.component.ts' : 'forge-sdk/src/config.ts',
  );
  const regionOriginal = await readFile(region, 'utf8');
  pnpm(['run', 'content:check']);
  await writeFile(
    region,
    regionOriginal.replace(/(\/\/ #region doqs:[a-z-]+\n)/, '$1  // Changed by the consumer proof.\n'),
  );
  pnpm(['run', 'content:check'], 1);
  pnpm(['run', 'content']);
  pnpm(['run', 'content:check']);
  await writeFile(region, regionOriginal);
  pnpm(['run', 'content']);
  pnpm(['run', 'content:check']);
}

buildAot('consumer', outDir, () => pnpm(['build']));
console.log(`consumer ready: ${resolve(outDir, 'dist/analog/public')}`);

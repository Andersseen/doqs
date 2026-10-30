/**
 * Runs the Playwright suite against production builds.
 *
 *   pnpm test:e2e [--skip-consumer] [playwright args...]     e.g. pnpm test:e2e e2e/toc.spec.ts --headed
 *
 * Needs `pnpm build` (both showcases) first. The tarball consumer is (re)built from artifacts/ when missing or older
 * than the tarball. Browsers are installed inside node_modules (PLAYWRIGHT_BROWSERS_PATH=0), never under $HOME:
 *   PLAYWRIGHT_BROWSERS_PATH=0 pnpm exec playwright install chromium
 * Set PW_CHANNEL=chrome to use an installed Google Chrome instead.
 * `pnpm test:e2e:browsers` runs the focused cross-browser matrix (Firefox and WebKit):
 *   PLAYWRIGHT_BROWSERS_PATH=0 pnpm exec playwright install firefox webkit
 */
import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const skipConsumer = args.includes('--skip-consumer') || !!process.env['E2E_SKIP_CONSUMER'];
// Default to the full Chromium suite; `--browsers` runs the focused Firefox + WebKit matrix instead (pnpm test:e2e:browsers).
const browsers = args.includes('--browsers');
const passthrough = args.filter((arg) => arg !== '--skip-consumer' && arg !== '--browsers');
if (!passthrough.some((arg) => arg.startsWith('--project'))) {
  passthrough.push(...(browsers ? ['--project=firefox', '--project=webkit'] : ['--project=chromium']));
}

const mtime = async (path: string) => (await stat(path).catch(() => undefined))?.mtimeMs;
const run = (command: string, commandArgs: string[], env: NodeJS.ProcessEnv = {}) =>
  spawnSync(command, commandArgs, { cwd: repo, stdio: 'inherit', env: { ...process.env, ...env } }).status ?? 1;

for (const output of ['showcase-a/dist/analog', 'showcase-b/dist/analog', 'showcase-b/dist/analog-nosearch']) {
  if ((await mtime(resolve(repo, `apps/${output}/public/index.html`))) === undefined) {
    console.error(`e2e: apps/${output} has no production build. Run "pnpm build" first.`);
    process.exit(1);
  }
}

const consumers = [
  { app: 'showcase-b', dir: resolve(process.env['DOQ_CONSUMER_DIR'] ?? resolve(tmpdir(), 'doq-e2e-consumer')) },
  { app: 'showcase-a', dir: resolve(process.env['DOQ_CONSUMER_A_DIR'] ?? resolve(tmpdir(), 'doq-e2e-consumer-a')) },
  // Doqs 0.5-style configuration (no versioning) built from the same tarball: backward compatibility proof.
  {
    app: 'showcase-a',
    unversioned: true,
    dir: resolve(process.env['DOQ_CONSUMER_LEGACY_A_DIR'] ?? resolve(tmpdir(), 'doq-e2e-consumer-legacy-a')),
  },
  {
    app: 'showcase-b',
    unversioned: true,
    dir: resolve(process.env['DOQ_CONSUMER_LEGACY_B_DIR'] ?? resolve(tmpdir(), 'doq-e2e-consumer-legacy-b')),
  },
  // The embedded consumer as a Zone.js application (zone.js loaded, provideZoneChangeDetection()).
  {
    app: 'showcase-a',
    zone: true,
    dir: resolve(process.env['DOQ_CONSUMER_ZONE_DIR'] ?? resolve(tmpdir(), 'doq-e2e-consumer-zone')),
  },
];
const initConsumers = [
  {
    mode: 'embedded',
    dir: resolve(process.env['DOQ_INIT_EMBEDDED_DIR'] ?? resolve(tmpdir(), 'doq-init-consumer-embedded')),
  },
  {
    mode: 'docs-first',
    dir: resolve(process.env['DOQ_INIT_DOCS_FIRST_DIR'] ?? resolve(tmpdir(), 'doq-init-consumer-docs-first')),
  },
  {
    mode: 'embedded',
    angular: '22',
    dir: resolve(process.env['DOQ_INIT_EMBEDDED_NG22_DIR'] ?? resolve(tmpdir(), 'doq-init-consumer-embedded-ng22')),
  },
];
if (!skipConsumer) {
  const { version } = JSON.parse(await readFile(resolve(repo, 'packages/doq/package.json'), 'utf8')) as {
    version: string;
  };
  const tarball = resolve(repo, `artifacts/doqs-analog-${version}.tgz`);
  const tarballTime = await mtime(tarball);
  if (tarballTime === undefined) {
    console.error('e2e: no tarball. Run "pnpm pack:doq" first (or pass --skip-consumer).');
    process.exit(1);
  }
  for (const consumer of consumers) {
    const builtTime = await mtime(resolve(consumer.dir, 'dist/analog/public/index.html'));
    if (builtTime === undefined || builtTime < tarballTime) {
      const status = run('node', [
        'scripts/consumer.ts',
        tarball,
        consumer.dir,
        `--app=${consumer.app}`,
        ...('unversioned' in consumer ? ['--unversioned'] : []),
        ...('zone' in consumer ? ['--zone', '--skip-api'] : []),
      ]);
      if (status !== 0) process.exit(status);
    }
  }
  // Applications initialized with `doq init`: rebuilt like the showcase consumers when missing or older than the tarball.
  for (const consumer of initConsumers) {
    const builtTime = await mtime(resolve(consumer.dir, 'dist/analog/public/index.html'));
    if (builtTime === undefined || builtTime < tarballTime) {
      const status = run('node', [
        'scripts/init-consumer.ts',
        tarball,
        consumer.dir,
        `--mode=${consumer.mode}`,
        ...('angular' in consumer ? [`--angular=${consumer.angular}`] : []),
      ]);
      if (status !== 0) process.exit(status);
    }
  }
}

// Calling the pnpm shim through spawnSync fails on Windows because the shim is a .CMD file
// and spawnSync does not use a shell. pnpm sets npm_execpath to its JS entrypoint for scripts.
const pnpmEntrypoint = process.env['npm_execpath'];
if (!pnpmEntrypoint) {
  console.error('e2e: npm_execpath is unavailable; run this command through pnpm.');
  process.exit(1);
}
const status = run(process.execPath, [pnpmEntrypoint, 'exec', 'playwright', 'test', ...passthrough], {
  PLAYWRIGHT_BROWSERS_PATH: process.env['PLAYWRIGHT_BROWSERS_PATH'] ?? '0',
  DOQ_CONSUMER_DIR: consumers[0]!.dir,
  DOQ_CONSUMER_A_DIR: consumers[1]!.dir,
  DOQ_CONSUMER_LEGACY_A_DIR: consumers[2]!.dir,
  DOQ_CONSUMER_LEGACY_B_DIR: consumers[3]!.dir,
  DOQ_CONSUMER_ZONE_DIR: consumers[4]!.dir,
  DOQ_INIT_EMBEDDED_DIR: initConsumers[0]!.dir,
  DOQ_INIT_DOCS_FIRST_DIR: initConsumers[1]!.dir,
  DOQ_INIT_EMBEDDED_NG22_DIR: initConsumers[2]!.dir,
  ...(skipConsumer ? { E2E_SKIP_CONSUMER: '1' } : {}),
});
process.exit(status);

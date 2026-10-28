/**
 * One command per gate, deterministic and independent of any AI model.
 *
 *   pnpm verify:change   fast local gate: format, types, specs, Agentyx lock, unit, components, builds, docs:check, perf:check, package, public API, contract, negative controls
 *   pnpm quality:gate    mandatory pre-PR gate: verify:change + tarball consumers (showcases and initialized apps), Playwright E2E (Chromium, then Firefox and WebKit), determinism, Angular 21/22 compatibility and the CDP acceptance harness
 *
 * Steps run in order and stop at the first failure. E2E and harness steps need a browser (see CONTRIBUTING.md).
 */
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const mode = process.argv[2];
if (mode !== 'change' && mode !== 'full') {
  console.error('usage: node scripts/verify.ts <change|full>');
  process.exit(2);
}

const { version } = JSON.parse(await readFile(resolve(repo, 'packages/doq/package.json'), 'utf8')) as {
  version: string;
};
const tarball = `artifacts/doqs-analog-${version}.tgz`;
const consumerDir = resolve(process.env['DOQ_CONSUMER_DIR'] ?? resolve(tmpdir(), 'doq-e2e-consumer'));

interface Step {
  name: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}
const pnpm = (...args: string[]): Step => ({ name: `pnpm ${args.join(' ')}`, args });

const steps: Step[] = [
  pnpm('format:check'),
  pnpm('typecheck:scripts'),
  pnpm('sdd:check'),
  pnpm('api:check'),
  pnpm('content:check'),
  pnpm('agentyx:check'),
  pnpm('test:unit'),
  pnpm('test:components'),
  pnpm('build'),
  pnpm('docs:check'),
  pnpm('perf:check'),
  pnpm('pack:doq'),
  { name: `pnpm verify:package ${tarball}`, args: ['verify:package', tarball] },
  pnpm('verify:public-api'),
  pnpm('test:contract'),
  pnpm('verify:negative-controls'),
];
if (mode === 'full') {
  // The unversioned (0.5-style) tarball consumers exist after consumer:build, so the contract suite must require them here.
  steps.push(
    pnpm('consumer:build'),
    // Bare Analog applications that adopt Doqs through doq doctor / doq init: Angular 21 embedded and docs-first, Angular 22 embedded.
    pnpm('verify:init'),
    {
      name: 'pnpm test:contract (with unversioned consumers)',
      args: ['test:contract'],
      env: { DOQ_REQUIRE_LEGACY: '1' },
    },
    pnpm('test:e2e'),
    pnpm('test:e2e:browsers'),
    // Heading determinism (repeated clean builds and the guard-removed control) and the Angular 21 / 22 consumer matrix.
    { name: 'pnpm perf:scale --check', args: ['perf:scale', '--sizes=20,200', '--navigations=0', '--check'] },
    { name: 'pnpm verify:determinism', args: ['verify:determinism', '--builds=5', '--docs=60'] },
    { name: 'pnpm verify:determinism --control', args: ['verify:determinism', '--builds=3', '--docs=60', '--control'] },
    { name: 'pnpm verify:compat --angular=21', args: ['verify:compat', '--angular=21'] },
    { name: 'pnpm verify:compat --angular=22', args: ['verify:compat', '--angular=22'] },
    {
      name: 'pnpm verify:mvp (with tarball consumer)',
      args: ['verify:mvp'],
      env: { MVP_CONSUMER_ROOT: resolve(consumerDir, 'dist/analog/public') },
    },
    // Platform smoke of the Node tooling and the measured effect of the configuration-only entry point.
    pnpm('verify:portable'),
    { name: 'pnpm bundle:impact --check', args: ['bundle:impact', '--check'] },
  );
  // The real-site proofs clone public repositories, so they need network access: `pnpm quality:gate --adoption`.
  if (process.argv.includes('--adoption'))
    steps.push(
      pnpm('verify:adoption'),
      pnpm('verify:adoption:routes'),
      pnpm('verify:adoption:existing'),
      pnpm('verify:adoption:volt'),
    );
}

const results: { name: string; seconds: number; ok: boolean }[] = [];
let failed = false;
for (const step of steps) {
  console.log(`\n=== ${step.name}`);
  const started = Date.now();
  const status =
    spawnSync('pnpm', step.args, { cwd: repo, stdio: 'inherit', env: { ...process.env, ...step.env } }).status ?? 1;
  results.push({ name: step.name, seconds: Math.round((Date.now() - started) / 1000), ok: status === 0 });
  if (status !== 0) {
    failed = true;
    break;
  }
}

console.log(`\nverify:${mode === 'full' ? 'full (quality:gate)' : 'change'} summary`);
for (const result of results)
  console.log(`  ${result.ok ? 'PASS' : 'FAIL'}  ${String(result.seconds).padStart(4)}s  ${result.name}`);
const skipped = steps.length - results.length;
if (skipped) console.log(`  NOT RUN  ${skipped} step(s) after the first failure`);
process.exit(failed ? 1 : 0);

/**
 * Measures what a configuration-only import costs (BUNDLE-01/03): `pnpm bundle:impact [--check]`.
 *
 * Builds the SAME host twice from the packed tarball, outside this workspace: an application that provides its Doqs
 * configuration in the root providers (the README pattern) and loads the documentation UI only through a lazy route.
 *   main    imports defineDoqConfig/provideDoq from '@doqs/analog'
 *   config  imports them from '@doqs/analog/config'
 * and compares the gzip size of the JavaScript the landing page loads, the JavaScript a documentation page loads, and the
 * total. Nothing is estimated from source: both sizes come from `vite build` output.
 * It also loads each entry in plain Node (what vite.config.ts, scripts and SSR tooling do) and records which packages each
 * entry's compiled file imports.
 *   --check   fail if the config entry adds more than 0.1% to initial JavaScript, or if it cannot be imported in plain Node
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { measureSite } from './perf.ts';

const repo = resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const { version } = JSON.parse(await readFile(resolve(repo, 'packages/doq/package.json'), 'utf8')) as {
  version: string;
};
const tarball = resolve(repo, `artifacts/doqs-analog-${version}.tgz`);
const dir = resolve(process.env['DOQ_BUNDLE_DIR'] ?? resolve(tmpdir(), 'doq-bundle-impact'));
if (dir === repo || dir.startsWith(`${repo}/`)) throw new Error(`The probe must live outside the repository: ${dir}`);

const run = (command: string, args: string[], cwd: string) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, CI: 'true' },
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})`);
};

// A bare copy of the embedded showcase, installed from the tarball; the build is done per variant below.
run('node', ['scripts/consumer.ts', tarball, dir, '--app=showcase-a', '--skip-api', '--no-build'], repo);
await cp(resolve(dir, 'src/app/app.config.ts'), resolve(dir, 'app.config.original.ts'));
// Showcase A now has extra host-owned localized routes. This benchmark compares the library entry points,
// so keep its disposable consumer on the original embedded, single-locale route shape.
await writeFile(
  resolve(dir, 'src/doq.paths.ts'),
  `export const doqPaths = { contentDirectory: 'docs', basePath: '/docs' } as const;\n`,
);
await rm(resolve(dir, 'src/app/pages/[locale]'), { recursive: true, force: true });
await rm(resolve(dir, 'src/app/pages/docs/host-route.page.ts'), { force: true });

const variant = async (entry: '@doqs/analog' | '@doqs/analog/config') => {
  await writeFile(
    resolve(dir, 'src/app/doq.config.ts'),
    `import { defineDoqConfig } from '${entry}';\nimport { doqPaths } from '../doq.paths';\nexport const doqConfig = defineDoqConfig({ ...doqPaths, search: { enabled: true } });\n`,
  );
  await writeFile(
    resolve(dir, 'src/app/docs.routes.ts'),
    `import { provideContent, withMarkdownRenderer } from '@analogjs/content';\nimport { Routes } from '@angular/router';\nimport { doqRoutes } from '@doqs/analog';\nimport { doqConfig } from './doq.config';\nexport const docsRoutes: Routes = [{ path: '', providers: [provideContent(withMarkdownRenderer())], children: doqRoutes(doqConfig) }];\n`,
  );
  await writeFile(
    resolve(dir, 'src/app/app.config.ts'),
    `import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { Route } from '@angular/router';
import { provideFileRouter, requestContextInterceptor, withExtraRoutes } from '@analogjs/router';
import { provideDoq } from '${entry}';
import { doqConfig } from './doq.config';

const docsRoute: Route = { path: '', canMatch: [(_route, segments) => segments[0]?.path === 'docs'], loadChildren: () => import('./docs.routes').then((m) => m.docsRoutes) };
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideFileRouter(withExtraRoutes([docsRoute])), provideDoq(doqConfig), provideHttpClient(withInterceptors([requestContextInterceptor])), provideClientHydration(withEventReplay())],
};
`,
  );
  await rm(resolve(dir, 'dist'), { recursive: true, force: true });
  run('pnpm', ['exec', 'vite', 'build'], dir);
  const publicDir = resolve(dir, 'dist/analog/public');
  const landing = await measureSite(publicDir, '.');
  const docs = await measureSite(publicDir, 'docs/installation');
  return { landing: landing.initialJsGzip, docs: docs.initialJsGzip, total: landing.allJsGzip };
};

const importsOf = async (file: string) =>
  [
    ...new Set(
      (await readFile(resolve(dir, 'node_modules/@doqs/analog/fesm2022', file), 'utf8'))
        .match(/^import [^\n]* from '([^']+)'/gm)
        ?.map((line) => /'([^']+)'/.exec(line)![1]!) ?? [],
    ),
  ].sort();
const nodeImport = (entry: string) => {
  const started = Date.now();
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `const m = await import('${entry}'); console.log(Object.keys(m).length)`],
    { cwd: dir, encoding: 'utf8' },
  );
  return {
    ok: result.status === 0,
    ms: Date.now() - started,
    error: result.status === 0 ? '' : (/Error: (.*)/.exec(result.stderr)?.[1] ?? 'failed'),
  };
};

const main = await variant('@doqs/analog');
const config = await variant('@doqs/analog/config');
const row = (name: string, a: number, b: number) =>
  `  ${name.padEnd(34)} ${String(a).padStart(9)} ${String(b).padStart(9)} ${String(b - a).padStart(9)}`;
console.log('bundle:impact (gzip bytes, from vite build output)');
console.log(`  ${''.padEnd(34)} ${'main'.padStart(9)} ${'config'.padStart(9)} ${'delta'.padStart(9)}`);
console.log(row('landing page initial JavaScript', main.landing, config.landing));
console.log(row('documentation page initial JavaScript', main.docs, config.docs));
console.log(row('all JavaScript (lazy chunks included)', main.total, config.total));
const mainImports = await importsOf('doqs-analog.mjs');
const configImports = await importsOf('doqs-analog-config.mjs');
const mainNode = nodeImport('@doqs/analog');
const configNode = nodeImport('@doqs/analog/config');
console.log(`  imports of the compiled entry: main = ${mainImports.join(', ')}`);
console.log(`                                 config = ${configImports.join(', ')}`);
console.log(
  `  plain Node import: main ${mainNode.ok ? `ok (${mainNode.ms} ms)` : `FAILS: ${mainNode.error}`}; config ${configNode.ok ? `ok (${configNode.ms} ms)` : `FAILS: ${configNode.error}`}`,
);
await mkdir(resolve(dir, 'report'), { recursive: true });
await writeFile(
  resolve(dir, 'report/bundle-impact.json'),
  `${JSON.stringify({ version, main, config, mainImports, configImports, mainNode, configNode }, null, 2)}\n`,
);
if (check) {
  const problems: string[] = [];
  // Keep a small allowance for host/build metadata bytes while guarding against a material regression.
  if (config.landing > main.landing * 1.001)
    problems.push('the landing page got materially heavier with the config entry');
  if (config.docs > main.docs * 1.02) problems.push('the documentation page got heavier with the config entry');
  if (!configNode.ok) problems.push(`the config entry cannot be imported in plain Node: ${configNode.error}`);
  if (configImports.some((name) => name !== '@angular/core'))
    problems.push(`the config entry imports more than @angular/core: ${configImports.join(', ')}`);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('bundle:impact PASS');
}

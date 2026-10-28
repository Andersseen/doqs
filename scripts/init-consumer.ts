/**
 * Proves the onboarding path on an independent project: a bare Analog application (no Doqs wiring) installs the packed
 * tarball, `doq doctor` reports the real gaps, `doq init` scaffolds, the printed snippets are applied the way a developer would,
 * `doq doctor` then passes, and a production build prerenders and indexes the documentation.
 *
 *   node scripts/init-consumer.ts [tarball] [outDir] [--mode=embedded|docs-first] [--angular=21|22]
 *
 * outDir defaults to $DOQ_INIT_CONSUMER_DIR or <tmp>/doq-init-consumer-<mode>[-ng22]. No workspace links, no repository sources.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const flags = process.argv.slice(2).filter((arg) => arg.startsWith('--'));
const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const flag = (name: string) => flags.find((entry) => entry.startsWith(`--${name}=`))?.slice(name.length + 3);
const mode = flag('mode') ?? 'embedded';
const angular = flag('angular') ?? '21';
if (mode !== 'embedded' && mode !== 'docs-first') throw new Error(`Unknown --mode=${mode}`);
if (angular !== '21' && angular !== '22') throw new Error(`Unknown --angular=${angular}`);
const { version } = JSON.parse(await readFile(resolve(repo, 'packages/doq/package.json'), 'utf8')) as {
  version: string;
};
const tarball = resolve(positional[0] ?? `artifacts/doqs-analog-${version}.tgz`);
const outDir = resolve(
  positional[1] ??
    process.env['DOQ_INIT_CONSUMER_DIR'] ??
    resolve(tmpdir(), `doq-init-consumer-${mode}${angular === '22' ? '-ng22' : ''}`),
);
if (outDir === repo || outDir.startsWith(`${repo}/`))
  throw new Error(`The consumer must live outside the repository: ${outDir}`);
await readFile(tarball).catch(() => {
  throw new Error(`Tarball not found: ${tarball}. Run "pnpm pack:doq" first.`);
});

const write = async (path: string, text: string) => {
  await mkdir(resolve(outDir, path, '..'), { recursive: true });
  await writeFile(resolve(outDir, path), text);
};
const read = (path: string) => readFile(resolve(outDir, path), 'utf8');
const run = (command: string, args: string[], expected: number | undefined = 0) => {
  console.log(`init-consumer: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: outDir, encoding: 'utf8', env: { ...process.env, CI: 'true' } });
  if (expected !== undefined && result.status !== expected) {
    console.error(result.stdout, result.stderr);
    throw new Error(`"${command} ${args.join(' ')}" exited ${result.status}, expected ${expected}`);
  }
  return result;
};
const json = (args: string[], expected?: number) => {
  const result = run('pnpm', ['--silent', 'exec', 'doq', ...args, '--json'], expected);
  return JSON.parse(result.stdout) as any;
};

// 1. A bare Analog host: router and platform only. Content, prismjs and Doqs are what the documentation says to add.
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
const showcase = resolve(repo, 'apps/showcase-b');
for (const file of [
  'tsconfig.json',
  'tsconfig.app.json',
  'angular.json',
  'index.html',
  'src/main.ts',
  'src/main.server.ts',
  'src/vite-env.d.ts',
  'src/app/app.config.server.ts',
  '.gitignore',
])
  await cp(resolve(showcase, file), resolve(outDir, file));
await cp(resolve(showcase, 'public'), resolve(outDir, 'public'), { recursive: true });
await write(
  'src/app/app.ts',
  `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<header><a href="/">Acme</a> · <a href="${mode === 'embedded' ? '/docs' : '/introduction'}">Docs</a></header><router-outlet />\`,
})
export class App {}
`,
);
await write(
  'src/app/app.config.ts',
  `import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideFileRouter, requestContextInterceptor } from '@analogjs/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideFileRouter(),
    provideHttpClient(withInterceptors([requestContextInterceptor])),
    provideClientHydration(withEventReplay()),
  ],
};
`,
);
const page = (name: string, text: string) => `import { Component } from '@angular/core';

@Component({ selector: 'app-${name}', template: \`<main><h1>${text}</h1></main>\` })
export default class Page {}
`;
await write(
  mode === 'embedded' ? 'src/app/pages/index.page.ts' : 'src/app/pages/about.page.ts',
  page('page', mode === 'embedded' ? 'Acme home' : 'About Acme'),
);
await write('src/styles.css', 'body { font-family: system-ui, sans-serif; }\n');
const hostRoutes = mode === 'embedded' ? "['/']" : "['/about']";
await write(
  'vite.config.ts',
  `import { defineConfig } from 'vite';
import analog from '@analogjs/platform';

export default defineConfig({
  build: { target: ['es2022'] },
  resolve: { mainFields: ['module'] },
  plugins: [analog({ ssr: true, static: true, prerender: { routes: async () => ${hostRoutes} } })],
});
`,
);
const ng = (range: string) => (angular === '22' ? '^22.0.0' : range);
await write(
  'package.json',
  `${JSON.stringify(
    {
      name: `doq-init-consumer-${mode}${angular === '22' ? '-ng22' : ''}`,
      version: '0.0.0',
      private: true,
      type: 'module',
      scripts: { build: 'vite build' },
      dependencies: {
        '@analogjs/router': '^2.9.0',
        '@angular/common': ng('^21.2.2'),
        '@angular/compiler': ng('^21.2.2'),
        '@angular/core': ng('^21.2.2'),
        '@angular/forms': ng('^21.2.2'),
        '@angular/platform-browser': ng('^21.2.2'),
        '@angular/platform-server': ng('^21.2.2'),
        '@angular/router': ng('^21.2.2'),
        h3: '^1.13.0',
        rxjs: '~7.8.0',
        tslib: '^2.3.0',
      },
      // Strict peers apply to everything except one upstream packaging defect: @angular/build's optional WASM binding
      // (@oxc-parser/binding-wasm32-wasi 0.150) pins @emnapi/*@2.0.0-alpha.3 while its own @napi-rs/wasm-runtime asks for
      // ^1.7.1 || 2.0.0-beta.2. It is reached before Doqs is installed and has nothing to do with it.
      pnpm: {
        peerDependencyRules: {
          allowedVersions: { '@emnapi/core': '2.0.0-alpha.3', '@emnapi/runtime': '2.0.0-alpha.3' },
        },
      },
      devDependencies: {
        '@analogjs/platform': '^2.9.0',
        '@analogjs/vite-plugin-angular': '^2.9.0',
        '@angular/build': ng('^21.2.2'),
        '@angular/cli': ng('^21.2.2'),
        '@angular/compiler-cli': ng('^21.2.2'),
        typescript: angular === '22' ? '~6.0.0' : '~5.9.3',
        vite: '^8.0.0',
      },
    },
    null,
    2,
  )}\n`,
);
const peerFlag = ['--config.strict-peer-dependencies=true'];
run('pnpm', ['install', ...peerFlag]);

// 2. Install Doqs exactly as the documentation says, from the packed tarball.
run('pnpm', ['add', `@doqs/analog@file:${tarball}`, '@analogjs/content', 'prismjs', ...peerFlag]);
assert.match(
  (await run('pnpm', ['--silent', 'exec', 'doq', '--version'])).stdout.trim(),
  new RegExp(`^${version.replace(/\./g, '\\.')}$`),
);

// 3. Doctor before integration: real, actionable gaps and a failing exit code.
const before = json(['doctor'], 1);
const failing = new Set(before.findings.filter((item: any) => item.status === 'FAIL').map((item: any) => item.id));
for (const id of ['config.paths', 'setup.providers', 'setup.stylesheet', 'setup.prerender'])
  assert.ok(failing.has(id), `doctor must report ${id} before integration; got ${[...failing].join(', ')}`);
assert.ok(
  before.findings.filter((item: any) => item.status === 'FAIL').every((item: any) => item.fix),
  'every failure carries a fix',
);
assert.equal(before.findings.find((item: any) => item.id === 'peer.@angular/core')?.status, 'PASS');
assert.equal(before.findings.find((item: any) => item.id === 'search.enabled')?.status, 'PASS');
assert.equal(
  before.findings.some((item: any) => item.id === 'search.pagefind'),
  false,
  'no Pagefind demand while search is off',
);

// 4. Init: dry run writes nothing, the real run scaffolds, a second run changes nothing.
const modeArgs = mode === 'docs-first' ? ['--mode', 'docs-first'] : [];
const dry = json(['init', '--dry-run', ...modeArgs], 0);
assert.ok(dry.files.every((file: any) => file.status === 'create'));
await assert.rejects(read('src/doq.paths.ts'), /ENOENT/);
const init = json(['init', ...modeArgs], 0);
assert.equal(init.scaffold, 'complete');
assert.equal(init.integration, 'incomplete');
assert.equal(init.basePath, mode === 'embedded' ? '/docs' : '/');
const again = json(['init', ...modeArgs], 0);
assert.deepEqual(
  again.files.map((file: any) => file.status),
  ['unchanged', 'unchanged', 'unchanged'],
);

// 5. Apply what init printed. Each snippet is used as printed (imports and option lines are taken from it).
const step = (id: string) => init.steps.find((entry: any) => entry.id === id);
const lines = (id: string) => step(id).snippet.code.split('\n') as string[];
const imports = (id: string) => lines(id).filter((line) => line.startsWith('import '));
const stylesheetLine = step('stylesheet').snippet.code;
await write('src/styles.css', `${stylesheetLine}\n${await read('src/styles.css')}`);

const prerenderLine = lines('prerender').find((line) => line.startsWith('prerender:'))!;
const highlighterLine = lines('prerender').find((line) => line.startsWith('content:'))!;
// Docs-first: the snippet has no '/' entry (the helper includes the root); the host keeps its own /about route.
const hostPrerender =
  mode === 'docs-first'
    ? prerenderLine.replace('doqPrerenderRoutes(doqPaths)]', "doqPrerenderRoutes(doqPaths), '/about']")
    : prerenderLine;
const vite = `import { defineConfig } from 'vite';
import analog from '@analogjs/platform';
${[...imports('prerender'), ...imports('deterministic-markdown')].join('\n')}

export default defineConfig({
  build: { target: ['es2022'] },
  resolve: { mainFields: ['module'] },
  plugins: [
    analog({
      ssr: true,
      static: true,
      ${highlighterLine}
      ${hostPrerender}
    }),
    doqDeterministicMarkdown(),
  ],
});
`;
await write('vite.config.ts', vite);

let appConfig = await read('src/app/app.config.ts');
appConfig = `${imports('providers')
  .filter((line) => !line.includes('provideFileRouter, withExtraRoutes'))
  .join('\n')}\nimport { withExtraRoutes } from '@analogjs/router';\n${appConfig}`;
appConfig = appConfig
  .replace(
    'provideFileRouter(),',
    'provideFileRouter(withExtraRoutes(doqRoutes(doqConfig))),\n    provideContent(withMarkdownRenderer()),\n    provideDoq(doqConfig),',
  )
  .replace('export const appConfig', `const doqConfig = defineDoqConfig({ ...doqPaths });\n\nexport const appConfig`);
await write('src/app/app.config.ts', appConfig);
console.log(`init-consumer: applied snippets\n${vite}\n${appConfig}`);

// 6. Doctor passes everything it can establish; init reports the integration complete.
const after = json(['doctor']);
assert.equal(
  after.summary.FAIL,
  0,
  JSON.stringify(
    after.findings.filter((item: any) => item.status === 'FAIL'),
    null,
    2,
  ),
);
assert.equal(after.findings.find((item: any) => item.id === 'setup.deterministic')?.status, 'PASS');
assert.equal(json(['init', ...modeArgs]).integration, 'complete');

// 7. A production build, then the output checks.
run('pnpm', ['build']);
const built = json(['doctor', '--build'], 0);
assert.equal(built.findings.find((item: any) => item.id === 'build.routes')?.status, 'PASS');
console.log(`init-consumer ready (${mode}, Angular ${angular}): ${resolve(outDir, 'dist/analog/public')}`);

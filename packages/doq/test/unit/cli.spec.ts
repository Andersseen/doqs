import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseCli } from '../../bin/cli/args.mjs';
import { formatDoctor, runDoctor } from '../../bin/cli/doctor.mjs';
import { formatInit, initProject } from '../../bin/cli/init.mjs';
import { isSupportedNode } from '../../bin/cli/node-support.mjs';
import { satisfies } from '../../bin/cli/semver.mjs';
import { stripComments } from '../../bin/cli/source.mjs';

const BIN = join(import.meta.dirname, '../../bin/doq.mjs');
let root: string;
const write = async (path: string, text: string) => {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), text);
};
const manifest = (name: string, version: string, extra: object = {}) => write(`node_modules/${name}/package.json`, JSON.stringify({ name, version, ...extra }));
const files = async (dir: string): Promise<string[]> =>
  (await readdir(dir, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name)).sort();

const initOptions = (over: object = {}) => ({ command: 'init', dir: root, json: false, srcDir: 'src', mode: 'embedded', contentDir: 'docs', basePath: '/docs', dryRun: false, ...over });
const doctorOptions = (over: object = {}) => ({ command: 'doctor', dir: root, json: false, srcDir: 'src', build: false, strict: false, ...over });
const status = (result: { findings: { id: string; status: string }[] }, id: string) => result.findings.find(item => item.id === id)?.status;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'doq-cli-'));
  await write('package.json', JSON.stringify({ name: 'app', dependencies: { '@angular/core': '^21.2.2' } }));
});
afterEach(() => rm(root, { recursive: true, force: true }));

describe('UNIT-070 argument parsing', () => {
  it('defaults to embedded mode at /docs and docs-first at the root', () => {
    expect(parseCli(['init'])).toMatchObject({ mode: 'embedded', basePath: '/docs', contentDir: 'docs', dryRun: false });
    expect(parseCli(['init', '--mode', 'docs-first'])).toMatchObject({ mode: 'docs-first', basePath: '/' });
    expect(parseCli(['init', '--base-path', '/guide', '--content-dir', 'handbook', '--dry-run'])).toMatchObject({ basePath: '/guide', contentDir: 'handbook', dryRun: true });
  });
  it('rejects bad usage with exit code 2', () => {
    for (const argv of [['bogus'], ['init', '--mode', 'huge'], ['init', '--nope'], ['init', 'extra'], ['init', '--mode', 'docs-first', '--base-path', '/x'], ['doctor', '--mode', 'embedded']]) {
      expect(() => parseCli(argv), argv.join(' ')).toThrow(expect.objectContaining({ exitCode: 2 }));
    }
  });
  it('treats help and no arguments as help', () => {
    expect(parseCli([])).toEqual({ command: 'help' });
    expect(parseCli(['init', '--help'])).toEqual({ command: 'help', topic: 'init' });
  });
});

describe('UNIT-071 semver ranges', () => {
  it.each([
    ['21.2.4', '^21.2.2 || ^22.0.0', true],
    ['22.1.0', '^21.2.2 || ^22.0.0', true],
    ['20.3.0', '^21.2.2 || ^22.0.0', false],
    ['21.2.1', '^21.2.2 || ^22.0.0', false],
    ['2.9.1', '^2.9.0', true],
    ['3.0.0', '^2.9.0', false],
    ['6.0.2', '^5.5.0 || ^6.0.0', true],
    ['24.1.0', '^20.19.0 || ^22.12.0 || >=24.0.0', true],
    ['22.11.0', '^20.19.0 || ^22.12.0 || >=24.0.0', false],
  ])('%s against %s is %s', (version, range, expected) => expect(satisfies(version, range)).toBe(expected));
  it('reports unsupported syntax as undefined instead of guessing', () => expect(satisfies('1.0.0', 'latest')).toBeUndefined());
});

describe('UNIT-072 supported Node.js range', () => {
  it.each([
    ['18.20.4', false],
    ['20.18.0', false],
    ['20.19.0', true],
    ['21.7.0', false],
    ['22.11.0', false],
    ['22.12.0', true],
    ['23.1.0', false],
    ['24.0.0', true],
    ['25.2.1', true],
  ])('Node %s is supported: %s', (version, expected) => expect(isSupportedNode(version)).toBe(expected));
});

describe('UNIT-072 comment stripping', () => {
  it('removes comments but keeps string contents', () => {
    expect(stripComments("a // doqRoutes\nb = '// not a comment' /* provideDoq */ c")).toBe("a \nb = '// not a comment'  c");
  });
});

describe('UNIT-073 doq init', () => {
  it('creates the paths file and two starter pages for embedded mode', async () => {
    const result = await initProject(root, initOptions());
    expect(result.scaffold).toBe('complete');
    expect(result.files.map(file => [file.path, file.status])).toEqual([
      ['src/doq.paths.ts', 'create'],
      ['src/content/docs/introduction.md', 'create'],
      ['src/content/docs/getting-started.md', 'create'],
    ]);
    const paths = await readFile(join(root, 'src/doq.paths.ts'), 'utf8');
    expect(paths).toContain("contentDirectory: 'docs'");
    expect(paths).toContain("basePath: '/docs'");
    expect(await readFile(join(root, 'src/content/docs/introduction.md'), 'utf8')).toMatch(/^---\ntitle: Introduction\n[\s\S]*\n---\n/);
    expect(await readFile(join(root, 'src/content/docs/introduction.md'), 'utf8')).toContain('(/docs/getting-started)');
  });

  it('mounts docs-first documentation at the root and links accordingly', async () => {
    await initProject(root, initOptions({ mode: 'docs-first', basePath: '/' }));
    expect(await readFile(join(root, 'src/doq.paths.ts'), 'utf8')).toContain("basePath: '/'");
    expect(await readFile(join(root, 'src/content/docs/introduction.md'), 'utf8')).toContain('(/getting-started)');
  });

  it('honours a custom content directory and base path', async () => {
    await initProject(root, initOptions({ contentDir: 'handbook', basePath: '/learn/' }));
    expect(await readFile(join(root, 'src/doq.paths.ts'), 'utf8')).toContain("basePath: '/learn'");
    expect(await files(join(root, 'src/content'))).toHaveLength(2);
    expect(await readFile(join(root, 'src/content/handbook/introduction.md'), 'utf8')).toContain('(/learn/getting-started)');
  });

  it('is deterministic', async () => {
    const other = await mkdtemp(join(tmpdir(), 'doq-cli-'));
    try {
      await writeFile(join(other, 'package.json'), '{"name":"app"}');
      await initProject(root, initOptions());
      await initProject(other, initOptions({ dir: other }));
      for (const path of ['src/doq.paths.ts', 'src/content/docs/introduction.md', 'src/content/docs/getting-started.md']) {
        expect(await readFile(join(root, path), 'utf8')).toBe(await readFile(join(other, path), 'utf8'));
      }
    } finally {
      await rm(other, { recursive: true, force: true });
    }
  });

  it('dry run writes nothing', async () => {
    const before = await files(root);
    const result = await initProject(root, initOptions({ dryRun: true }));
    expect(result.files.every(file => file.status === 'create')).toBe(true);
    expect(await files(root)).toEqual(before);
    expect(formatInit(result)).toContain('would create');
  });

  it('is idempotent and never overwrites edited files', async () => {
    await initProject(root, initOptions());
    await writeFile(join(root, 'src/content/docs/introduction.md'), '---\ntitle: Mine\n---\nhello\n');
    const again = await initProject(root, initOptions());
    expect(again.files.map(file => file.status)).toEqual(['unchanged', 'kept', 'unchanged']);
    expect(await readFile(join(root, 'src/content/docs/introduction.md'), 'utf8')).toBe('---\ntitle: Mine\n---\nhello\n');
    expect(again.exitCode).toBe(0);
  });

  it('reports a conflicting paths file and writes nothing at all', async () => {
    await write('src/doq.paths.ts', "export const doqPaths = { contentDirectory: 'guides', basePath: '/guides' } as const;\n");
    const result = await initProject(root, initOptions());
    expect(result.scaffold).toBe('blocked');
    expect(result.exitCode).toBe(1);
    expect(result.files[0]).toMatchObject({ status: 'conflict' });
    expect(await files(join(root, 'src'))).toEqual([join(root, 'src/doq.paths.ts')]);
    expect(await readFile(join(root, 'src/doq.paths.ts'), 'utf8')).toContain("'guides'");
  });

  it('accepts an existing paths file that already defines the requested paths', async () => {
    await write('src/doq.paths.ts', "// mine\nexport const doqPaths = { contentDirectory: 'docs', basePath: '/docs', versioning: { current: { id: 'latest' } } } as const;\n");
    const result = await initProject(root, initOptions());
    expect(result.files[0]).toMatchObject({ status: 'kept' });
    expect(result.exitCode).toBe(0);
  });

  it('leaves a content directory that already has Markdown alone', async () => {
    await write('src/content/docs/guide.md', '---\ntitle: Guide\n---\n');
    const result = await initProject(root, initOptions());
    expect(result.files.filter(file => file.status === 'skipped')).toHaveLength(2);
    expect((await files(join(root, 'src/content/docs'))).length).toBe(1);
  });

  it.each([['../escape'], ['/abs'], ['a/../../b'], ['bad name'], ['']])('rejects unsafe --content-dir %j', async value => {
    await expect(initProject(root, initOptions({ contentDir: value }))).rejects.toThrow(/content-dir/);
    expect(await files(root)).toEqual([join(root, 'package.json')]);
  });

  it.each([['docs'], ['/a/../b'], ['/ba d'], ['']])('rejects invalid --base-path %j', async value => {
    await expect(initProject(root, initOptions({ basePath: value }))).rejects.toThrow(/base-path/);
  });

  it('refuses to write through a symlink that leaves the project', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'doq-outside-'));
    try {
      await symlink(outside, join(root, 'src'));
      await expect(initProject(root, initOptions())).rejects.toThrow(/outside the project/);
      expect(await readdir(outside)).toEqual([]);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('requires a package.json', async () => {
    await rm(join(root, 'package.json'));
    await expect(initProject(root, initOptions())).rejects.toThrow(/No package.json/);
  });

  it('distinguishes scaffold from integration and lists what remains', async () => {
    const result = await initProject(root, initOptions());
    expect(result.integration).toBe('incomplete');
    const text = formatInit(result);
    expect(text).toContain('Scaffold complete.');
    expect(text).toContain('Integration incomplete');
    expect(text).not.toContain('Integration complete');
    expect(result.steps.find(step => step.id === 'deterministic-markdown')).toMatchObject({ required: false, done: false });
    expect(result.steps.find(step => step.id === 'dependencies')?.command).toMatch(/@doqs\/analog/);
  });

  it('reports integration complete only when every required step is detected, without duplicating anything', async () => {
    await write('package.json', JSON.stringify({ name: 'app', dependencies: { '@angular/core': '21', '@doqs/analog': '0.8.0', '@analogjs/content': '2', '@analogjs/router': '2', prismjs: '1' } }));
    await write('vite.config.ts', "import { doqPrerenderRoutes } from '@doqs/analog';\nanalog({ content: { highlighter: 'prism' }, prerender: { routes: async () => doqPrerenderRoutes(p) } });\n");
    await write('src/app/app.config.ts', 'provideFileRouter(withExtraRoutes(doqRoutes(c))); provideContent(withMarkdownRenderer()); provideDoq(c);\n');
    await write('src/styles.css', "@import '@doqs/analog/styles.css';\n");
    const result = await initProject(root, initOptions());
    expect(result.integration).toBe('complete');
    expect(result.recommendationsOpen).toBe(1);
    expect(formatInit(result)).toContain('Integration complete');
  });

  it('does not count commented-out configuration as integrated', async () => {
    await write('vite.config.ts', "// doqPrerenderRoutes(doqPaths) and highlighter: 'prism'\n");
    const result = await initProject(root, initOptions());
    expect(result.steps.find(step => step.id === 'prerender')?.done).toBe(false);
  });
});

describe('UNIT-074 doq doctor', () => {
  async function healthy() {
    await write('package.json', JSON.stringify({ name: 'app', scripts: { build: 'vite build && doq-search index dist/analog/public' }, dependencies: { '@angular/core': '^21.2.2', '@doqs/analog': '0.8.0' } }));
    await manifest('@doqs/analog', '0.8.0', { peerDependencies: { '@angular/core': '^21.2.2 || ^22.0.0', pagefind: '^1.5.0', rxjs: '^7.8.0' }, peerDependenciesMeta: { pagefind: { optional: true } } });
    await manifest('@angular/core', '21.2.4');
    await manifest('rxjs', '7.8.2');
    await manifest('@analogjs/router', '2.9.1');
    await manifest('@analogjs/platform', '2.9.1');
    await initProject(root, initOptions());
    await write('vite.config.ts', "analog({ content: { highlighter: 'prism' }, prerender: { routes: async () => doqPrerenderRoutes(doqPaths) } }); doqDeterministicMarkdown();\n");
    await write('src/app/app.config.ts', 'provideFileRouter(withExtraRoutes(doqRoutes(c))); provideContent(withMarkdownRenderer()); provideDoq(c);\n');
    await write('src/styles.css', "@import '@doqs/analog/styles.css';\n");
  }

  it('passes a complete integration and does not demand Pagefind when search is off', async () => {
    await healthy();
    const result = await runDoctor(doctorOptions());
    expect(result.summary).toMatchObject({ FAIL: 0, WARN: 0, UNKNOWN: 0 });
    expect(result.exitCode).toBe(0);
    expect(result.findings.some(item => item.id === 'search.pagefind')).toBe(false);
    expect(status(result, 'search.enabled')).toBe('PASS');
  });

  it('fails on a missing Angular peer and a wrong Angular version', async () => {
    await healthy();
    await rm(join(root, 'node_modules/@angular'), { recursive: true });
    expect(status(await runDoctor(doctorOptions()), 'peer.@angular/core')).toBe('FAIL');
    await manifest('@angular/core', '20.3.0');
    const wrong = await runDoctor(doctorOptions());
    expect(status(wrong, 'peer.@angular/core')).toBe('FAIL');
    expect(wrong.exitCode).toBe(1);
    expect(wrong.findings.find(item => item.id === 'peer.@angular/core')?.found).toContain('20.3.0');
  });

  it('accepts Angular 22 as the package declares', async () => {
    await healthy();
    await manifest('@angular/core', '22.0.1');
    expect(status(await runDoctor(doctorOptions()), 'peer.@angular/core')).toBe('PASS');
  });

  it('detects duplicate canonical slugs and invalid slugs', async () => {
    await healthy();
    await write('src/content/docs/a.md', '---\ntitle: A\nslug: same\n---\n');
    await write('src/content/docs/b.md', '---\ntitle: B\nslug: same\n---\n');
    await write('src/content/docs/c.md', '---\ntitle: C\nslug: bad slug\n---\n');
    const result = await runDoctor(doctorOptions());
    expect(status(result, 'content.duplicate-routes')).toBe('FAIL');
    expect(status(result, 'content.slugs')).toBe('FAIL');
    expect(result.exitCode).toBe(1);
  });

  it('detects frontmatter problems as warnings or failures', async () => {
    await healthy();
    await write('src/content/docs/no-fm.md', '# hello\n');
    await write('src/content/docs/open.md', '---\ntitle: x\n');
    await write('src/content/docs/untitled.md', '---\ndescription: d\norder: soon\n---\n');
    const result = await runDoctor(doctorOptions());
    expect(status(result, 'content.frontmatter')).toBe('WARN');
    expect(status(result, 'content.frontmatter-closed')).toBe('FAIL');
    expect(status(result, 'content.title')).toBe('WARN');
    expect(status(result, 'content.order')).toBe('WARN');
  });

  it('warns about a missing deterministic plugin and fails a missing prerender entry', async () => {
    await healthy();
    await write('vite.config.ts', "analog({ content: { highlighter: 'prism' } });\n");
    const result = await runDoctor(doctorOptions());
    expect(status(result, 'setup.deterministic')).toBe('WARN');
    expect(status(result, 'setup.prerender')).toBe('FAIL');
    expect(result.exitCode).toBe(1);
  });

  it('fails when the stylesheet or providers are missing', async () => {
    await healthy();
    await rm(join(root, 'src/styles.css'));
    await write('src/app/app.config.ts', 'provideFileRouter();\n');
    const result = await runDoctor(doctorOptions());
    expect(status(result, 'setup.stylesheet')).toBe('FAIL');
    expect(status(result, 'setup.providers')).toBe('FAIL');
    expect(status(result, 'setup.markdown-provider')).toBe('FAIL');
  });

  it('requires Pagefind and the index step only when search is enabled', async () => {
    await healthy();
    await write('src/app/app.config.ts', 'provideFileRouter(withExtraRoutes(doqRoutes(c))); provideContent(withMarkdownRenderer()); provideDoq(c); const x = { search: { enabled: true } };\n');
    let result = await runDoctor(doctorOptions());
    expect(status(result, 'search.pagefind')).toBe('FAIL');
    expect(status(result, 'search.index-step')).toBe('PASS');
    await manifest('pagefind', '1.5.2');
    await write('package.json', JSON.stringify({ name: 'app', scripts: { build: 'vite build' } }));
    result = await runDoctor(doctorOptions());
    expect(status(result, 'search.pagefind')).toBe('PASS');
    expect(status(result, 'search.index-step')).toBe('WARN');
  });

  it('reports computed values as UNKNOWN, not PASS', async () => {
    await healthy();
    await write('src/doq.paths.ts', "export const doqPaths = { contentDirectory: process.env.DIR, basePath: '/docs' } as const;\n");
    const result = await runDoctor(doctorOptions());
    expect(status(result, 'config.paths')).toBe('UNKNOWN');
    expect(result.exitCode).toBe(0);
    expect((await runDoctor(doctorOptions({ strict: true }))).exitCode).toBe(1);
  });

  it('fails on a missing paths file, content directory and invalid base path', async () => {
    await healthy();
    await rm(join(root, 'src/doq.paths.ts'));
    expect(status(await runDoctor(doctorOptions()), 'config.paths')).toBe('FAIL');
    await write('src/doq.paths.ts', "export const doqPaths = { contentDirectory: 'nowhere', basePath: '/a/../b' } as const;\n");
    const result = await runDoctor(doctorOptions());
    expect(status(result, 'config.base-path')).toBe('FAIL');
    await write('src/doq.paths.ts', "export const doqPaths = { contentDirectory: 'nowhere', basePath: '/docs' } as const;\n");
    expect(status(await runDoctor(doctorOptions()), 'content.directory')).toBe('FAIL');
  });

  it('detects overlapping and missing version archives', async () => {
    await healthy();
    await write('src/doq.paths.ts', "export const doqPaths = { contentDirectory: 'docs', basePath: '/docs', versioning: { current: { id: 'latest' }, archives: [{ id: '1', contentDirectory: 'docs/old' }, { id: '2', contentDirectory: 'docs-2' }] } } as const;\n");
    const result = await runDoctor(doctorOptions());
    expect(status(result, 'versions.config')).toBe('FAIL');
    expect(status(result, 'versions.archive.docs-2')).toBe('FAIL');
  });

  it('inspects built output only with --build and never builds', async () => {
    await healthy();
    expect((await runDoctor(doctorOptions())).findings.some(item => item.id.startsWith('build.'))).toBe(false);
    const missing = await runDoctor(doctorOptions({ build: true }));
    expect(status(missing, 'build.output')).toBe('FAIL');
    await write('dist/analog/public/docs/introduction/index.html', '<html></html>');
    const partial = await runDoctor(doctorOptions({ build: true }));
    expect(status(partial, 'build.routes')).toBe('FAIL');
    await write('dist/analog/public/docs/getting-started/index.html', '<html></html>');
    expect(status(await runDoctor(doctorOptions({ build: true })), 'build.routes')).toBe('PASS');
  });

  it('does not call a build that cannot hydrate a pass (build.aot)', async () => {
    await healthy();
    const out = 'dist/analog/public';
    await write(`${out}/docs/introduction/index.html`, '<html></html>');
    await write(`${out}/docs/getting-started/index.html`, '<html></html>');
    await write(`${out}/assets/index-ok.js`, 'export const ok = () => 1;');
    await write(`${out}/pagefind/pagefind.js`, 'throw Error(`JIT compiler unavailable`)');
    const clean = await runDoctor(doctorOptions({ build: true }));
    expect(status(clean, 'build.aot')).toBe('PASS');
    expect(clean.exitCode).toBe(0);

    // An application chunk that kept decorator output: Angular's runtime throws when it is created in the browser.
    await write(`${out}/assets/index-bad.js`, 'function rc(){throw Error(`JIT compiler unavailable`)}');
    const broken = await runDoctor(doctorOptions({ build: true }));
    expect(status(broken, 'build.aot')).toBe('FAIL');
    expect(broken.findings.find(item => item.id === 'build.aot')?.found).toContain('assets/index-bad.js');
    expect(broken.exitCode).toBe(1);

    // The compiler is bundled on purpose: components work, but the weight is reported.
    await write(`${out}/assets/index-bad.js`, 'function rc(){throw Error(`JIT compiler unavailable`)}n.ɵcompilerFacade=new X');
    expect(status(await runDoctor(doctorOptions({ build: true })), 'build.aot')).toBe('WARN');
  });

  it('fails clearly outside a project', async () => {
    await rm(join(root, 'package.json'));
    const result = await runDoctor(doctorOptions());
    expect(status(result, 'project.package')).toBe('FAIL');
    expect(result.exitCode).toBe(1);
  });

  it('formats findings with the fix next to the problem', async () => {
    await healthy();
    await rm(join(root, 'src/styles.css'));
    const text = formatDoctor(await runDoctor(doctorOptions()));
    expect(text).toMatch(/FAIL\s+Doqs stylesheet/);
    expect(text).toContain('fix: Add @import');
  });
});

describe('UNIT-075 doq binary', () => {
  const run = (...args: string[]) => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8', cwd: root });

  it('prints one valid JSON document on stdout in --json mode', async () => {
    const result = run('doctor', '--json');
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toMatchObject({ command: 'doctor', exitCode: 1 });
    expect(result.stderr).toBe('');
  });

  it('writes usage errors to stderr with exit code 2, as JSON when asked', () => {
    const plain = run('init', '--mode', 'nope');
    expect([plain.status, plain.stdout, plain.stderr]).toEqual([2, '', expect.stringContaining('Invalid --mode')]);
    const json = run('init', '--mode', 'nope', '--json');
    expect(json.stdout).toBe('');
    expect(JSON.parse(json.stderr)).toMatchObject({ exitCode: 2 });
  });

  it('runs init end to end from a project directory', async () => {
    const result = run('init');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Scaffold complete.');
    expect(await readFile(join(root, 'src/doq.paths.ts'), 'utf8')).toContain('/docs');
  });

  it('prints help and the package version', () => {
    expect(run('--help').stdout).toContain('doq init');
    expect(run('--version').stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

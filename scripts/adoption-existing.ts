/**
 * Existing-integration adoption proof: Angular Movement as it is TODAY, with its own Doqs integration, rebuilt against the packed
 * @doqs/analog tarball of this workspace.
 *
 *   node scripts/adoption-existing.ts [outDir] [--test]   --test also runs e2e/adoption-existing.spec.ts against the result
 *
 * Unlike scripts/adoption.ts and scripts/adoption-routes.ts (historical onboarding of an UNintegrated revision), nothing here is
 * scaffolded or overlaid: the checkout's own configuration, routes and content are the subject. Only the installed Doqs package is
 * swapped for the tarball. The route list the browser spec visits is derived from the checkout's real content tree at run time.
 *
 * Source: AM_EXISTING_REF (a commit, tag or branch; `HEAD` probes the current default branch) and AM_REPO; the default is a pinned
 * commit so the result does not drift with upstream. Nothing is pushed anywhere and the checkout is disposable.
 */
import { spawnSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { assertDisposable, checkout, doqJson, repo, runner, tarballPath, upstream } from './adoption-lib.ts';

/** First Angular Movement revision that shipped its own Doqs integration (@doqs/analog 0.11.0, lazy /docs region). */
const pinnedRef = 'ce9b03d547bc774268768e5f57c028452e70b9ad';
const { tarball, version } = await tarballPath();
const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const outDir = resolve(
  args[0] ?? process.env['DOQ_ADOPTION_EXISTING_DIR'] ?? resolve(tmpdir(), 'doq-adoption-angular-movement-existing'),
);
assertDisposable(outDir);

const name = 'adoption-existing';
const run = runner(name);
const doq = doqJson(name, outDir);

const source = upstream('AM_EXISTING', 'https://github.com/Andersseen/angular-movement.git', pinnedRef);
// AM_REPO is honoured as well so a fork can be probed with the same switch the other proofs use.
if (process.env['AM_REPO']) source.url = process.env['AM_REPO'];
const sha = await checkout(name, source, outDir);

// 1. The checkout must really be an integrated consumer. If it is not, this is the wrong proof (use verify:adoption), and we say so
//    instead of silently doing something else.
const manifest = JSON.parse(await readFile(resolve(outDir, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
};
const declared = manifest.dependencies?.['@doqs/analog'];
if (!declared)
  throw new Error(
    `${name}: ${sha} does not depend on @doqs/analog. It is not an integrated consumer; use "pnpm verify:adoption" for onboarding.`,
  );
console.log(`${name}: upstream declares @doqs/analog ${declared}; replacing it with the packed ${version} tarball`);

// 2. Reproduce the consumer's own lockfile, then swap only the Doqs package.
run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], outDir);
run('pnpm', ['add', `file:${tarball}`, '--ignore-scripts'], outDir);
const installed = JSON.parse(await readFile(resolve(outDir, 'node_modules/@doqs/analog/package.json'), 'utf8')) as {
  version: string;
};
if (installed.version !== version)
  throw new Error(`${name}: installed @doqs/analog is ${installed.version}, expected the packed ${version}`);

// 3. The consumer's own build (it indexes with doq-search itself) and the structural checks Doqs owns.
run('pnpm', ['run', 'build'], outDir);
const dist = resolve(outDir, 'dist/analog/public');
const doctor = doq(['doctor', '--build'], 0);
if (doctor.summary.FAIL !== 0)
  throw new Error(
    `${name}: doctor FAIL: ${JSON.stringify(doctor.findings.filter((item: any) => item.status === 'FAIL'))}`,
  );
for (const id of ['build.routes', 'build.pagefind'])
  if (doctor.findings.find((item: any) => item.id === id)?.status !== 'PASS')
    throw new Error(`${name}: doctor ${id} is not PASS after the build`);
console.log(`${name}: doctor ${JSON.stringify(doctor.summary)}`);
run('node', ['scripts/docs-check.ts', `--dist=${dist}`, `--source=${outDir}`, '--link-scope=/docs'], repo);

// 4. Derive what the browser must visit from the REAL tree: every Markdown page under the consumer's content directory, plus the
//    host's own page files. Nothing about upstream's file names is assumed.
const flatten = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map((entry) => (entry.isDirectory() ? flatten(resolve(dir, entry.name)) : [resolve(dir, entry.name)])),
  );
  return nested.flat();
};
const docsRoot = resolve(outDir, 'src/content/docs');
const docs = (await flatten(docsRoot))
  .filter((file) => file.endsWith('.md'))
  .map((file) =>
    `/docs/${relative(docsRoot, file)
      .replace(/\.md$/, '')
      .replace(/(^|\/)index$/, '')}`.replace(/\/$/, ''),
  )
  .sort();
const hostPages = (await flatten(resolve(outDir, 'src/app/pages')))
  .map((file) => relative(resolve(outDir, 'src/app/pages'), file))
  .filter((file) => /\.page\.ts$/.test(file));
const demos = hostPages
  .filter((file) => /^demos\/[^/[(]+\.page\.ts$/.test(file) && !file.startsWith('demos/index'))
  .map((file) => `/demos/${file.slice('demos/'.length).replace(/\.page\.ts$/, '')}`)
  .sort();
if (docs.length === 0) throw new Error(`${name}: no Markdown pages under src/content/docs; the integration moved?`);
await writeFile(
  resolve(outDir, '.doq-adoption-routes.json'),
  `${JSON.stringify({ sha, version, docs, demos, hostPages }, null, 2)}\n`,
);
console.log(
  `${name}: ${docs.length} documentation routes, ${demos.length} host demo routes, ${hostPages.length} host page files`,
);
console.log(`${name}: ready ${dist} (Angular Movement ${sha}, @doqs/analog ${installed.version})`);

if (process.argv.includes('--test')) {
  const result = spawnSync('pnpm', ['exec', 'playwright', 'test', 'e2e/adoption-existing.spec.ts'], {
    cwd: repo,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: {
      ...process.env,
      DOQ_ADOPTION_EXISTING_DIR: outDir,
      PLAYWRIGHT_BROWSERS_PATH: process.env['PLAYWRIGHT_BROWSERS_PATH'] ?? '0',
    },
  });
  process.exit(result.status ?? 1);
}

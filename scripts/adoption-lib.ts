/**
 * Small helpers shared by the external adoption proofs (scripts/adoption*.ts). They only ever write inside the disposable
 * output directory; nothing here pushes to, or modifies, the upstream repository.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

export const repo = resolve(import.meta.dirname, '..');

/** A 40-character commit id; anything else is treated as a branch or tag name. */
export const isSha = (ref: string) => /^[0-9a-f]{40}$/i.test(ref);

export interface UpstreamSource {
  /** Clone URL (`*_REPO` overrides it). */
  url: string;
  /** Commit, tag or branch to check out (`*_REF` overrides it). */
  ref: string;
  /** True when the revision was chosen by the environment instead of the pinned default. */
  overridden: boolean;
}

/** Resolves the upstream under test: the pinned default revision unless `<prefix>_REPO` / `<prefix>_REF` say otherwise. */
export const upstream = (prefix: string, defaultUrl: string, pinnedRef: string): UpstreamSource => {
  const ref = process.env[`${prefix}_REF`];
  return {
    url: process.env[`${prefix}_REPO`] ?? defaultUrl,
    ref: ref || pinnedRef,
    overridden: Boolean(ref || process.env[`${prefix}_REPO`]),
  };
};

export const tarballPath = async () => {
  const { version } = JSON.parse(await readFile(resolve(repo, 'packages/doq/package.json'), 'utf8')) as {
    version: string;
  };
  const tarball = resolve(repo, `artifacts/doqs-analog-${version}.tgz`);
  await readFile(tarball).catch(() => {
    throw new Error(`Tarball not found: ${tarball}. Run "pnpm pack:doq" first.`);
  });
  return { tarball, version };
};

/** Refuses to create, remove or write anything inside this repository or outside a path that is clearly disposable. */
export const assertDisposable = (outDir: string) => {
  if (outDir === repo || outDir.startsWith(`${repo}/`))
    throw new Error(`The proof must live outside the repository: ${outDir}`);
  if (outDir === '/' || outDir.split('/').filter(Boolean).length < 2)
    throw new Error(`Refusing to use ${outDir} as a disposable directory`);
  // A non-empty directory is replaced only when an adoption run owns it: it carries the run's marker, or it has the harness's own
  // `doq-adoption-*` name (the default under the temp directory, which older runs created without a marker). Never somebody's work.
  const owned = existsSync(resolve(outDir, '.doq-adoption-sha')) || basename(outDir).startsWith('doq-adoption-');
  if (existsSync(outDir) && readdirSync(outDir).length > 0 && !owned)
    throw new Error(`Refusing to replace ${outDir}: it is not empty and was not created by an adoption run`);
};

export const logger = (name: string) => (message: string) => console.log(`${name}: ${message}`);

export const runner = (name: string) => (command: string, args: string[], cwd: string) => {
  console.log(`${name}: ${command} ${args.join(' ')}`);
  // stdin is closed on purpose: a build tool that probes the terminal must never stall a proof that runs in the background.
  const result = spawnSync(command, args, {
    cwd,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, CI: 'true' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

/** Runs a command like `runner` does, but also returns its combined output so the caller can classify what it printed. */
export const capture = (name: string) => (command: string, args: string[], cwd: string) => {
  console.log(`${name}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, CI: 'true' },
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
  return `${result.stdout}\n${result.stderr}`;
};

/** Fetches exactly one revision (SHA, tag or branch) into `dir` and returns the commit that ended up checked out. */
export const checkout = async (name: string, source: UpstreamSource, dir: string) => {
  assertDisposable(dir);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dirname(dir), { recursive: true });
  const git = (args: string[], cwd = dir) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (result.status !== 0)
      throw new Error(`${name}: git ${args.join(' ')} failed (${result.status})\n${result.stdout}${result.stderr}`);
    return result.stdout.trim();
  };
  console.log(`${name}: checking out ${source.url} @ ${source.ref}${source.overridden ? ' (override)' : ' (pinned)'}`);
  await mkdir(dir, { recursive: true });
  git(['init', '-q']);
  git(['remote', 'add', 'origin', source.url]);
  // GitHub serves any reachable commit by id, so a shallow fetch of a pinned SHA needs no history and no moving branch.
  git(['fetch', '-q', '--depth', '1', 'origin', source.ref]);
  git(['-c', 'advice.detachedHead=false', 'checkout', '-q', 'FETCH_HEAD']);
  const sha = git(['rev-parse', 'HEAD']);
  if (isSha(source.ref) && sha !== source.ref.toLowerCase())
    throw new Error(`${name}: pinned ${source.ref} resolved to ${sha}`);
  console.log(`${name}: ${name} checkout ${sha}`);
  await writeFile(resolve(dir, '.doq-adoption-sha'), `${sha}\n`);
  // The marker is the harness's, not the host's: keep it out of the host's `git status`.
  await appendFile(resolve(dir, '.git/info/exclude'), '.doq-adoption-sha\n');
  return sha;
};

/** Applies a text patch to a checkout file and fails loudly when upstream's layout has moved. */
export const editor = (name: string, outDir: string) => async (file: string, change: (text: string) => string) => {
  const path = resolve(outDir, file);
  const before = await readFile(path, 'utf8');
  const after = change(before);
  if (after === before)
    throw new Error(`${name}: overlay patch for ${file} changed nothing; the upstream layout may have moved.`);
  await writeFile(path, after);
};

export const expectStatus = (name: string) => (what: string, actual: number | null, expected: number) => {
  if (actual !== expected) throw new Error(`${name}: ${what}: expected exit ${expected}, got ${actual}`);
};

/** Reads an executable's JSON report from a checkout. */
export const doqJson = (name: string, cwd: string) => (cliArgs: string[], expected: number) => {
  const result = spawnSync('pnpm', ['--silent', 'exec', 'doq', ...cliArgs, '--json'], { cwd, encoding: 'utf8' });
  if (result.status !== expected)
    throw new Error(
      `${name}: doq ${cliArgs.join(' ')} exited ${result.status}, expected ${expected}\n${result.stdout}${result.stderr}`,
    );
  return JSON.parse(result.stdout) as any;
};

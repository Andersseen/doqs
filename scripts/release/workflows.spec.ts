import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repo = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFile(resolve(repo, path), 'utf8');
const releaseWorkflow = () => read('.github/workflows/release.yml');
const deployWorkflow = () => read('.github/workflows/deploy-site.yml');

/** Text of one top-level job (from `  name:` to the next job). */
const job = (workflow: string, name: string): string => {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  expect(start, `job ${name}`).toBeGreaterThan(-1);
  const rest = workflow.slice(start + 1);
  const next = rest.slice(1).search(/\n  [a-z-]+:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
};

describe('UNIT-023 workflow permission and trust invariants', () => {
  it('never lets ordinary CI jobs publish, deploy or write', async () => {
    const ci = await read('.github/workflows/ci.yml');
    expect(ci).not.toMatch(/id-token:\s*write/);
    expect(ci).not.toMatch(/contents:\s*write/);
    expect(ci).not.toMatch(/npm publish|wrangler|secrets\./);
    expect(ci).toMatch(/permissions:\n\s+contents: read/);
  });

  it('releases only after CI succeeded on main, never from pull_request, and never cancels a publication', async () => {
    const workflow = await releaseWorkflow();
    expect(workflow).toMatch(
      /on:\n\s+workflow_run:\n\s+workflows: \[CI\]\n\s+types: \[completed\]\n\s+branches: \[main\]/,
    );
    const triggers = workflow.split('\non:\n')[1]!.split('\n\n')[0]!;
    expect(triggers).not.toMatch(/pull_request|workflow_dispatch|push:/);
    expect(workflow).toMatch(/concurrency:\n\s+group: release\n\s+cancel-in-progress: false/);
    const plan = job(workflow, 'plan');
    for (const condition of [
      "conclusion == 'success'",
      "event == 'push'",
      "head_branch == 'main'",
      'head_repository.full_name == github.repository',
    ])
      expect(plan, condition).toContain(condition);
  });

  it('grants id-token: write to the publishing job only, behind the npm-publish environment', async () => {
    const workflow = await releaseWorkflow();
    expect(workflow.match(/id-token:\s*write/g)).toHaveLength(1);
    expect(job(workflow, 'publish')).toMatch(/id-token:\s*write/);
    expect(job(workflow, 'publish')).toContain('environment: npm-publish');
    expect(job(workflow, 'plan')).not.toMatch(/id-token|contents: write/);
    expect(workflow.match(/contents:\s*write/g)).toHaveLength(1);
    expect(job(workflow, 'github-release')).toMatch(/contents:\s*write/);
    expect(workflow).toMatch(/^permissions: \{\}$/m);
  });

  it('uses no persistent npm token and publishes the CI tarball through npm with provenance', async () => {
    const workflow = await releaseWorkflow();
    expect(workflow).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN|_authToken|registry-url|secrets\./);
    expect(job(workflow, 'publish')).toMatch(/node scripts\/release\/cli\.ts publish artifacts\/\*\.tgz/);
    expect(job(workflow, 'publish')).not.toMatch(/npm publish artifacts/);
    expect(job(workflow, 'publish')).toContain('sha256sum --check');
    expect(job(workflow, 'publish')).toMatch(/run-id: \$\{\{ github\.event\.workflow_run\.id \}\}/);
    expect(job(workflow, 'publish')).not.toMatch(/pnpm (install|build|pack)/);
  });

  it('UNIT-066: installs the workspace before the structural tarball check, which imports TypeScript (0.8.0 release regression)', async () => {
    const plan = job(await releaseWorkflow(), 'plan');
    const install = plan.indexOf('pnpm install --frozen-lockfile --ignore-scripts');
    expect(install).toBeGreaterThan(-1);
    expect(install).toBeLessThan(plan.indexOf('node scripts/verification/package.ts'));
  });

  it('only creates the GitHub Release after a verified publication or to repair a missing one', async () => {
    const release = job(await releaseWorkflow(), 'github-release');
    expect(release).toContain("needs.publish.result == 'success'");
    expect(release).toContain("== 'repair-github-release'");
    expect(release.indexOf('verify-published')).toBeGreaterThan(-1);
    expect(release.indexOf('verify-published')).toBeLessThan(release.indexOf('gh release create'));
  });

  it('pins every action in the privileged workflows to a full commit SHA', async () => {
    for (const workflow of [await releaseWorkflow(), await deployWorkflow()]) {
      const uses = [...workflow.matchAll(/uses:\s*(\S+)/g)].map((match) => match[1]!);
      expect(uses.length).toBeGreaterThan(0);
      for (const reference of uses) expect(reference, reference).toMatch(/@[0-9a-f]{40}$/);
    }
  });

  it('deploys Cloudflare Pages from completed CI only, with scoped secrets and separate preview/production', async () => {
    const workflow = await deployWorkflow();
    expect(workflow).not.toMatch(/pull_request_target|id-token|contents: write/);
    const triggers = workflow.split('\non:\n')[1]!.split('\n\n')[0]!;
    expect(triggers).toMatch(/^\s+workflow_run:/);
    expect(triggers).not.toMatch(/pull_request|push:/);
    const production = job(workflow, 'production');
    expect(production).toContain("head_branch == 'main'");
    expect(production).toContain("event == 'push'");
    expect(production).toContain('--branch=main');
    const preview = job(workflow, 'preview');
    expect(preview).toContain('head_repository.full_name == github.repository');
    expect(preview).toContain("head_branch != 'main'");
    expect(preview).not.toContain('--branch=main');
    expect(preview).toContain('--branch="${PREVIEW_BRANCH}"');
    // The preview job must run default-branch code: its checkout has no `ref:` of the pull request.
    expect(preview.match(/actions\/checkout[^\n]*\n\s+with:\n(\s+[^\n]+\n)+/)?.[0] ?? '').not.toContain('ref:');
    expect(workflow).toMatch(/secrets\.CLOUDFLARE_API_TOKEN/);
    expect(workflow).toMatch(/secrets\.CLOUDFLARE_ACCOUNT_ID/);
    expect(workflow).not.toMatch(/--project-name/); // one source of truth: apps/site/wrangler.jsonc
  });

  it('keeps Wrangler pinned and the Pages project a Direct Upload target', async () => {
    const manifest = JSON.parse(await read('apps/site/package.json')) as { devDependencies: Record<string, string> };
    expect(manifest.devDependencies['wrangler']).toMatch(/^\d+\.\d+\.\d+$/);
    const config = await read('apps/site/wrangler.jsonc');
    expect(config).toContain('"pages_build_output_dir": "./dist/analog/public"');
    expect(config).toMatch(/"name": "[a-z0-9-]+"/);
  });
});

describe('pull request CI time budget', () => {
  const jobs = (workflow: string) => [...workflow.matchAll(/\n  ([a-z0-9-]+):\n    name:/g)].map((match) => match[1]!);

  it('UNIT-177: bounds every CI job so a stalled step cannot hold a pull request past 30 minutes', async () => {
    const ci = await read('.github/workflows/ci.yml');
    for (const name of jobs(ci)) {
      const minutes = Number(job(ci, name).match(/timeout-minutes: (\d+)/)?.[1]);
      expect(minutes, name).toBeGreaterThan(0);
      // A job that waits for `build` (at most 15 minutes) must still end inside the budget.
      expect(minutes + (job(ci, name).includes('needs: build') ? 15 : 0), name).toBeLessThanOrEqual(35);
    }
  });

  it('UNIT-178: installs browsers through the cached action without orphaning apt processes', async () => {
    for (const file of ['.github/workflows/ci.yml', '.github/workflows/ci-extended.yml']) {
      const workflow = await read(file);
      expect(workflow, file).not.toMatch(/playwright install/);
      expect(workflow, file).toContain('uses: ./.github/actions/playwright-browsers');
    }
    const action = await read('.github/actions/playwright-browsers/action.yml');
    expect(action).toContain('sudo fuser /var/lib/dpkg/lock-frontend');
    expect(action.match(/pnpm exec playwright install --with-deps/g)).toHaveLength(1);
    expect(action).not.toMatch(/timeout \d+ pnpm exec playwright install --with-deps/);
    expect(action).toContain('let the job timeout bound it');
    expect(action).toContain("PLAYWRIGHT_BROWSERS_PATH: '0'");
    expect(action).toContain('actions/cache@');
  });

  it('UNIT-179: starts jobs that build their own package without waiting for the build job', async () => {
    const ci = await read('.github/workflows/ci.yml');
    for (const name of jobs(ci)) {
      const text = job(ci, name);
      if (text.includes('needs: build')) expect(text, name).toContain('name: builds');
    }
  });

  it('UNIT-180: runs the Firefox/WebKit matrix weekly, on demand or by label, read-only and never as a release gate', async () => {
    const ci = await read('.github/workflows/ci.yml');
    expect(ci).not.toContain('test:e2e:browsers');
    const extended = await read('.github/workflows/ci-extended.yml');
    expect(extended).toMatch(/name: CI extended\n/);
    expect(extended).toMatch(/schedule:\n\s+- cron: '[^']+'/);
    expect(extended).toContain('workflow_dispatch:');
    expect(extended).toContain("contains(github.event.pull_request.labels.*.name, 'full-ci')");
    expect(extended).toContain('pnpm test:e2e:browsers');
    expect(extended).toMatch(/permissions:\n\s+contents: read/);
    expect(extended).not.toMatch(/id-token:\s*write|contents:\s*write|secrets\./);
    expect(await releaseWorkflow()).not.toContain('CI extended');
    expect(await deployWorkflow()).not.toContain('CI extended');
  });
});

describe('UNIT-024 package publishing metadata', () => {
  it('is a public scoped package with provenance-ready repository metadata', async () => {
    const manifest = JSON.parse(await read('packages/doq/package.json'));
    expect(manifest.name).toBe('@doqs/analog');
    expect(manifest.publishConfig).toEqual({ access: 'public' });
    expect(manifest.repository).toMatchObject({
      type: 'git',
      url: 'git+https://github.com/Andersseen/doqs.git',
      directory: 'packages/doq',
    });
    expect(manifest.license).toBe('MIT');
    expect(manifest.engines.node).toBeTruthy();
    expect(manifest.bin).toEqual({
      doq: './bin/doq.mjs',
      'doq-search': './bin/doq-search.mjs',
      'doq-api': './bin/doq-api.mjs',
    });
    expect(manifest.files).toEqual(
      expect.arrayContaining(['fesm2022', 'types', 'bin', 'styles.css', 'README.md', 'LICENSE']),
    );
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('keeps one version source of truth: no other file hard-codes the package version as a competing value', async () => {
    const root = JSON.parse(await read('package.json')) as { version?: string };
    expect(root.version).toBeUndefined();
    const release = await releaseWorkflow();
    expect(release).not.toMatch(/\b0\.\d+\.\d+\b/);
  });
});

# Release and deployment runbook

Two independent pipelines, both started only by a **successful CI run** on `main`:

| Pipeline    | Workflow                            | Trigger                                                            | Publishes                                                                          |
| ----------- | ----------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| npm release | `.github/workflows/release.yml`     | CI succeeded for a push to `main`                                  | `@doqs/analog` when `packages/doq/package.json` holds a version that is not on npm |
| Website     | `.github/workflows/deploy-site.yml` | CI succeeded (push to `main` → production, same-repo PR → preview) | `apps/site/dist/analog/public` to Cloudflare Pages                                 |

Committed code cannot configure npm, Cloudflare or GitHub account settings. Every step marked **[owner]** below must be done by the account owner; until then the workflows skip safely and say so in their job summary. A skipped job is never a published or deployed release.

## Security boundaries

- Pull requests only run `ci.yml` and, when labelled `full-ci`, `ci-extended.yml` (both `contents: read`). No secrets, no `id-token`, no write permission. `ci-extended.yml` (the Firefox/WebKit matrix, also weekly and on demand) is never a release or deploy gate.
- `release.yml` and `deploy-site.yml` start from `workflow_run`, so they run the workflow file from `main`. They act only when the CI run was a push to this repository's `main` (releases) or a same-repository branch (previews). Fork pull requests never reach them.
- The npm job is the only job with `id-token: write`, runs in the `npm-publish` environment, installs no dependencies and executes no repository build code; it publishes the exact tarball CI built and verified (checked by SHA-256 against the eligibility job).
- No npm token exists anywhere. npm authenticates the job through OIDC (Trusted Publishing) and attaches provenance automatically.
- Cloudflare uses a Pages-scoped API token held in GitHub environment secrets. Preview deployments run default-branch scripts only and treat the pull request's site as static data; they refuse worker/routing files and can never use the production branch.
- Third-party actions in the privileged workflows are pinned to commit SHAs (Dependabot's monthly `github-actions` group proposes updates).

## npm: version policy

`packages/doq/package.json` is the single source of truth. A release is a PR that bumps `version` (and the `CHANGELOG.md` section) and nothing else is needed: after merge and green CI, `release.yml` publishes it, tags `v<version>` at the validated commit and creates the GitHub Release from the changelog section. Only stable `x.y.z` versions are accepted; no major bump is ever automatic. Without a bump nothing is published.

## npm: first publication (bootstrap) — [owner]

State checked on 2026-10-21 with unauthenticated registry reads: `https://registry.npmjs.org/@doqs%2Fanalog` returns **404**, so `@doqs/analog` is **not published** (0.2.0 included). The organization page and your membership and 2FA settings cannot be read without your login; they are unverified. A Trusted Publisher can only be configured on an existing package, so the first version is published by hand:

```sh
git switch main && git pull --ff-only
pnpm install --frozen-lockfile && pnpm build && pnpm pack:doq
pnpm verify:package artifacts/doqs-analog-0.2.0.tgz
tar -tzf artifacts/doqs-analog-0.2.0.tgz          # inspect the contents
npm login                                           # your account, with 2FA, member of the doqs organization
npm publish ./artifacts/doqs-analog-0.2.0.tgz --access public
git tag -a v0.2.0 -m "@doqs/analog 0.2.0" <commit-that-was-built> && git push origin v0.2.0
```

Then: package page → **Settings → Trusted Publisher → GitHub Actions**: organization/user `Andersseen`, repository `doq`, workflow filename `release.yml`, environment `npm-publish`. Afterwards consider **Publishing access → Require two-factor authentication and disallow tokens**. The first OIDC publication happens with the next version bump; confirm it in the Actions summary and on the package page (provenance badge). Only after that, update the README's "Not yet published" line.

Note: a manual publication from a different build has a different tarball hash than CI's, so the workflow will not auto-create the GitHub Release for it (it reports "already on npm with different content"); creating the tag and release by hand, as above, completes it.

## npm: GitHub setup — [owner]

- Settings → Environments → create `npm-publish`. Optionally add required reviewers: then every publication waits for approval. Restrict deployment branches to `main`.
- Branch protection on `main`: require the CI checks and pull requests. The workflows do not weaken it.
- Settings → Actions → General: workflow permissions can stay read-only (jobs request what they need).

## npm: rollback, deprecation and recovery

- Published versions are immutable; `npm unpublish` is not a rollback. Fix forward with a new patch version.
- Problematic version: `npm deprecate @doqs/analog@0.2.1 "reason; use 0.2.2"` (needs your login). Move the `latest` tag with `npm dist-tag add @doqs/analog@<good> latest` if required.
- npm published but the GitHub Release failed: re-run the failed `github-release` job, or the next push to `main` re-plans it as `repair-github-release`. Nothing is republished.
- Publish job failed before `npm publish`: re-run it. `assert-unpublished` re-checks the registry and never publishes an existing version.
- Plan says "refuse" (tag exists for an unpublished version, tarball/version mismatch, version lower than latest): read the reason in the job summary, fix the tag or version, push again.

## 0.4.0 publication and the registry lag (found during the 0.5.0 work)

**Status on 2026-10-22.** `npm view @doqs/analog` lists `0.0.0-stage`, `0.2.0` and `0.4.0`, and `latest` is `0.4.0`. The release run for the PR #16 merge (<https://github.com/Andersseen/doqs/actions/runs/39758517223>) published `0.4.0` with Trusted Publishing (the publish job succeeded at 09:51 UTC, no npm token involved), but its `github-release` job **failed**: `verify-published` polled the registry for two minutes (12 × 10 s) and reported `registry state is version-missing`; npm's own `time["0.4.0"]` is 09:57:20 UTC, about six minutes after the publish. So the OIDC process is correct and the version is public, but **no `v0.4.0` tag or GitHub Release exists** (the latest GitHub Release is still `v0.2.0`).

**Fix (0.5.0 branch).** The visibility window is now `PUBLISH_VISIBILITY` in `scripts/release/lib.ts` (60 × 10 s = ten minutes), used by `verify-published`; regression test `UNIT-100` fails for a window shorter than ten minutes or for the old fixed `12` attempts. Nothing else in the release workflow changed.

**What is not done automatically.** The release planner works on the tarball of the commit being released, so after the `0.5.0` merge it will plan `0.5.0`, not repair `v0.4.0`. Creating the missing `v0.4.0` GitHub Release is a deliberate step for the maintainer (tag at the commit that built `0.4.0`, `3f28186`, with the `0.4.0` changelog section as notes); it was not done here and nothing backfills it without authorization. `0.3.0` remains unpublished (see above).

## Release state and the 0.3.0 gap

**Status on 2026-10-22.** `npm view @doqs/analog versions` lists `0.0.0-stage` and `0.2.0` only. `0.3.0` was **never published**: its release run (<https://github.com/Andersseen/doqs/actions/runs/39737424518>, and again for the PR #15 merge, run 39749811460) failed in the publish step before anything reached the registry, so no `v0.3.0` tag or GitHub Release exists either. The failure was path interpretation, not Trusted Publishing: `npm publish artifacts/<file>.tgz` was read by npm 11 as a Git repository shorthand and npm tried `git ls-remote ssh://git@github.com/artifacts/doqs-analog-0.3.0.tgz.git` (exit 128, `Permission denied (publickey)`).

**Fix (0.4.0 branch).** The publish step is now `node scripts/release/cli.ts publish artifacts/*.tgz`, which resolves the validated tarball to an **absolute path** (`npmPublishArgs` in `scripts/release/lib.ts`, so npm can never read it as a package spec) and runs `npm publish <absolute path> --access public --provenance`. Everything else is unchanged: OIDC with `id-token: write` on that job only, no npm token, the sha256 check of the CI artifact, the exact-version eligibility gate, `assert-unpublished`, and the GitHub Release recovery path. Regression coverage: `UNIT-070` (the old relative argument is rejected, the absolute one is built) and the workflow test that forbids `npm publish artifacts/…`. No other script passes an artifact path to npm (`pack` uses `pnpm pack`; `verify:package` and `consumer.ts` read tarballs through `tar` or a `file:` absolute path).

**What the maintainer decides.** Versions are immutable and `0.4.0` supersedes the unpublished `0.3.0` (it contains everything in it). The default is to publish `0.4.0` through the normal path: merge the PR, let CI pass on `main`, approve the `npm-publish` environment, and the release workflow publishes `0.4.0` and creates `v0.4.0`. If the maintainer also wants a `0.3.0` on the registry for history, that needs a deliberate, authorized step: check out the commit that built it (`cc34391`), run the same release workflow from a branch that can run it (the workflow only runs for CI on `main`, so this means a temporary, reviewed maintenance branch or a manual one-off `npm publish` by the owner), and tag it `v0.3.0` at that commit. Nothing here does that automatically, and a feature branch must never publish.

## Website: Cloudflare Pages — [owner]

The project is configured in `apps/site/wrangler.jsonc` (`name: doq-site`; change it there if you pick another name). Nothing was created in any Cloudflare account by this repository.

**Status on 2026-10-22 (rechecked during the 0.4.0 work: the production deploy of the PR #15 merge, run 39749811377, failed with the same `The Pages project "doq-site" does not exist` against the account behind `CLOUDFLARE_ACCOUNT_ID`; nothing in the repository changed it). Earlier note, 2026-10-21 (0.3.0 work).** The deploy runs for `main` failed with `The Pages project "doq-site" does not exist`. A read-only `wrangler pages project list` with the maintainer's local OAuth login showed no Pages project named `doq-site`, `doqs-site` or anything else containing `doq`, so the failure is an account state, not a build problem; the latest run (after PR #13) was skipped by its job conditions and was not investigated further. The repository contains no project name that is known to be right, so none was guessed and `wrangler.jsonc` still says `doq-site`. **Maintainer action:** create the Direct Upload project (step 1; keep `doq-site` or choose another name and change `apps/site/wrangler.jsonc` in the same PR), confirm the `CLOUDFLARE_ACCOUNT_ID` secret is the account that owns it, then re-run the failed workflow. Until then the site is **not deployed**. **Update, 2026-10-22 (0.5.0 work):** the production deployment job for the PR #16 merge (run 39758517222) concluded `success` (log: "Deployment complete" at `https://73606b95.doq-site-75j.pages.dev`), so a Pages project exists and the deploy path works; this note is kept as history. (npm, by contrast: `@doqs/analog@0.2.0` is `latest` on the public registry as of this check.)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → **Direct Upload** with that project name (or `pnpm --filter site exec wrangler pages project create doq-site --production-branch=main` after `wrangler login`). Do **not** connect the project to Git builds; Wrangler from GitHub Actions is the only deployer.
2. Note the **Account ID**. Create an **API token** (My Profile → API Tokens → custom) with only _Account → Cloudflare Pages → Edit_. Never use the Global API Key.
3. GitHub → Settings → Environments → create `cloudflare-pages-production` (restrict to `main`) and `cloudflare-pages-preview`. In each add secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Optional reviewers on the preview environment approve every preview.
4. Repository variable `DOQ_SITE_ORIGIN` (Settings → Variables) = the public origin, e.g. the `https://<project>.pages.dev` URL once known, or the custom domain later. It turns on canonical URL, `og:url` and `sitemap.xml`; unset, the site builds without them. No domain is hard-coded.
5. Merge to `main`; confirm the **Deploy site / production** summary says "Deployed", and open the Pages URL. A summary saying "NOT DEPLOYED" means credentials were missing.
6. Custom domain: Pages project → Custom domains. Update `DOQ_SITE_ORIGIN` afterwards.

Preview deployments use `--branch=<pr-branch>`, which Cloudflare treats as preview (production is `--branch=main` only). The site links to `npmjs.com/package/@doqs/analog`, which resolves only after the first publication: deploy production after the bootstrap.

Local work needs none of this: `pnpm dev:site`, `pnpm --filter site build`, `pnpm --filter site preview`. To deploy by hand after `wrangler login` (and creating the Pages project): `pnpm deploy:site` builds the site and deploys it to production (`--branch=main`); `pnpm deploy:site:preview` deploys a preview (`--branch=preview`).

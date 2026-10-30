// `doq doctor`: read-only diagnosis of the Doqs integration in a consumer project. Never executes project code.
import { join, resolve } from 'node:path';
import { CliError, exists, parseFrontmatter, readText, rel, walk } from './source.mjs';
import { inspectProject, publicPath, readInstalled, readPackage } from './project.mjs';
import { satisfies } from './semver.mjs';

const SLUG_SEGMENT = /^[\p{L}\p{N}_~-]+$/u;
const ID = /^[A-Za-z0-9][\w.-]*$/;
const NODE_RANGE = '^20.19.0 || ^22.12.0 || >=24.0.0';

/** Statuses, from most to least severe. */
export const STATUS = ['FAIL', 'WARN', 'UNKNOWN', 'PASS'];

const finding = (id, status, check, found, why, fix, path) => ({ id, status, check, found, why, ...(fix ? { fix } : {}), ...(path ? { path } : {}) });

async function analyzeContent(root, srcDir, directory, basePath, reserved) {
  const dir = join(root, srcDir, 'content', directory);
  const files = await walk(dir, name => name.endsWith('.md'));
  const routes = new Map();
  const issues = { noFrontmatter: [], unclosed: [], noTitle: [], badSlug: [], badOrder: [], duplicates: [], reserved: [] };
  for (const file of files) {
    const name = rel(root, file);
    const parsed = parseFrontmatter((await readText(file)) ?? '');
    if (parsed.state === 'none') issues.noFrontmatter.push(name);
    if (parsed.state === 'unclosed') issues.unclosed.push(name);
    if (parsed.state === 'ok' && !parsed.attributes.title) issues.noTitle.push(name);
    if (parsed.attributes.order !== undefined && !Number.isFinite(Number(parsed.attributes.order))) issues.badOrder.push(name);
    const source = rel(join(root, srcDir, 'content', directory), file).replace(/\.md$/, '').replace(/\/index$/, '');
    const explicit = parsed.attributes.slug;
    const slug = (explicit !== undefined ? explicit : source).trim().replace(/^\/+|\/+$/g, '');
    if (!slug || slug.split('/').some(part => !SLUG_SEGMENT.test(part))) {
      issues.badSlug.push(`${name} (slug "${slug}")`);
      continue;
    }
    if (reserved && slug.split('/')[0] === reserved) issues.reserved.push(name);
    const route = publicPath(basePath, slug);
    if (routes.has(route)) issues.duplicates.push(`${route}: ${routes.get(route)} and ${name}`);
    else routes.set(route, name);
  }
  return { directory, dir, files, routes, issues };
}

const list = items => (items.length > 3 ? `${items.slice(0, 3).join(', ')} and ${items.length - 3} more` : items.join(', '));

/**
 * Runs every check and returns the findings. The result is plain data (see `formatDoctor` for the text form).
 * @param {{ dir: string, srcDir: string, build: boolean, siteDir?: string, strict: boolean }} options
 */
export async function runDoctor(options) {
  const root = resolve(process.cwd(), options.dir);
  const findings = [];
  const add = (...args) => findings.push(finding(...args));

  const nodeOk = satisfies(process.versions.node, NODE_RANGE);
  add('env.node', nodeOk ? 'PASS' : 'FAIL', 'Node.js version', `Node ${process.versions.node}`, `Doqs supports Node ${NODE_RANGE}; other versions are untested.`, nodeOk ? undefined : 'Install a supported Node.js version.');

  const pkg = await readPackage(root);
  if (pkg === undefined || pkg === null) {
    add('project.package', 'FAIL', 'package.json', pkg === null ? 'not valid JSON' : `no package.json in ${root}`, 'Doctor reads the project from its package.json.', 'Run doq doctor in the Angular application directory or pass --dir <path>.', 'package.json');
    return summarize(root, findings);
  }
  const declared = { ...pkg.devDependencies, ...pkg.dependencies };

  // Installed packages and peer compatibility, from the real metadata in node_modules.
  const doqs = await readInstalled(root, '@doqs/analog');
  if (!doqs) {
    add('dep.doqs', '@doqs/analog' in declared ? 'FAIL' : 'FAIL', '@doqs/analog installed', '@doqs/analog' in declared ? `declared (${declared['@doqs/analog']}) but not installed` : 'not declared in package.json', 'The documentation library is missing.', 'Install it: add @doqs/analog with your package manager, then install dependencies.', 'package.json');
  } else {
    add('dep.doqs', 'PASS', '@doqs/analog installed', `version ${doqs.version}`, 'Doctor checks the integration against this version’s own peer ranges.');
    for (const [name, range] of Object.entries(doqs.peerDependencies ?? {})) {
      const optional = doqs.peerDependenciesMeta?.[name]?.optional === true;
      const installed = await readInstalled(root, name);
      if (!installed) {
        if (optional) continue;
        add(`peer.${name}`, name in declared ? 'FAIL' : 'FAIL', `Peer ${name}`, name in declared ? `declared (${declared[name]}) but not installed` : 'not installed', `@doqs/analog@${doqs.version} requires ${name} ${range}.`, `Install ${name} within ${range}.`, 'package.json');
        continue;
      }
      const ok = satisfies(installed.version, range);
      if (ok === true) add(`peer.${name}`, 'PASS', `Peer ${name}`, `${installed.version} satisfies ${range}`, 'Inside the range Doqs declares.');
      else if (ok === false) {
        add(`peer.${name}`, 'FAIL', `Peer ${name}`, `${installed.version} does not satisfy ${range}`, `@doqs/analog@${doqs.version} was not built or tested against this version.`, `Use ${name} ${range}, or an earlier/later @doqs/analog that supports ${installed.version}.`, 'package.json');
      } else add(`peer.${name}`, 'UNKNOWN', `Peer ${name}`, `${installed.version} against ${range}`, 'The range uses syntax doctor cannot evaluate.', 'Compare manually.');
    }
    // Analog packages are required by the Markdown/routing pipeline but are not all declared peers.
    for (const name of ['@analogjs/router', '@analogjs/platform']) {
      const installed = await readInstalled(root, name);
      add(`dep.${name}`, installed ? 'PASS' : name in declared ? 'FAIL' : 'WARN', `${name} installed`, installed ? `version ${installed.version}` : name in declared ? 'declared but not installed' : 'not found', `Analog's ${name === '@analogjs/router' ? 'file router and content routes' : 'Vite plugin renders and prerenders the Markdown'}.`, installed ? undefined : `Install ${name} (the tested range is ^2.9.0).`);
    }
  }

  const project = await inspectProject(root, { srcDir: options.srcDir });
  const paths = project.paths;
  let docsRoot;
  if (!project.hasSrc) {
    add('config.src', 'FAIL', 'Source directory', `${options.srcDir}/ does not exist`, 'Doqs reads Markdown from src/content.', 'Use --src-dir if your sources live elsewhere.');
  } else if (!paths) {
    add('config.paths', 'FAIL', 'Shared paths file', `${options.srcDir}/doq.paths.ts not found`, 'The paths file lets vite.config.ts and the Angular app agree on the content directory and mount path.', 'Run "doq init" or create it with contentDirectory and basePath.', `${options.srcDir}/doq.paths.ts`);
  } else if (paths.computed) {
    add('config.paths', 'UNKNOWN', 'Shared paths file', 'values are not plain string literals', 'Doctor does not run project code, so it cannot read computed values.', 'Check contentDirectory and basePath manually.', paths.path);
  } else {
    const dir = paths.contentDirectory;
    const dirOk = typeof dir === 'string' && dir.split('/').filter(Boolean).length > 0 && !dir.split(/[\\/]/).some(part => part === '.' || part === '..');
    add('config.content-directory', dirOk ? 'PASS' : 'FAIL', 'contentDirectory', dirOk ? `"${dir}"` : dir === undefined ? 'missing' : `invalid value "${dir}"`, 'Documents are read from src/content/<contentDirectory>.', dirOk ? undefined : 'Use a directory below src/content, for example "docs".', paths.path);
    const base = paths.basePath ?? '/docs';
    const baseSegments = base.split('/').filter(Boolean);
    const baseOk = base.startsWith('/') && baseSegments.every(part => SLUG_SEGMENT.test(part));
    add('config.base-path', baseOk ? 'PASS' : 'FAIL', 'basePath', baseOk ? `"${base}"${paths.basePath === undefined ? ' (default)' : ''}` : `invalid value "${base}"`, 'The public URL prefix of the documentation.', baseOk ? undefined : 'Use "/docs", another mount path, or "/" for a docs-first application.', paths.path);
    if (dirOk && baseOk) docsRoot = { directory: dir.split(/[\\/]/).filter(Boolean).join('/'), basePath: `/${baseSegments.join('/')}` };
  }

  const archives = [];
  if (docsRoot && paths?.versioning) {
    const seen = [docsRoot.directory];
    const bad = [];
    paths.archiveDirectories.forEach((raw, index) => {
      const directory = raw.split(/[\\/]/).filter(Boolean).join('/');
      const clash = seen.find(other => other === directory || other.startsWith(`${directory}/`) || directory.startsWith(`${other}/`));
      if (!directory) bad.push(`archive ${index + 1} has no contentDirectory`);
      else if (clash) bad.push(`"${directory}" overlaps "${clash}"`);
      else seen.push(directory);
      archives.push(directory);
    });
    const ids = paths.archiveIds;
    const badIds = ids.filter(id => !ID.test(id));
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    const problems = [...bad, ...badIds.map(id => `invalid version id "${id}"`), ...duplicateIds.map(id => `duplicate version id "${id}"`)];
    add('versions.config', problems.length ? 'FAIL' : 'PASS', 'Versioning configuration', problems.length ? problems.join('; ') : `${archives.length} archive(s), each in its own directory`, 'Every version needs its own unique id and a separate content directory.', problems.length ? 'Give each archive a unique id and a contentDirectory that does not overlap another.' : undefined, paths.path);
    for (const directory of archives.filter(Boolean)) {
      const present = await exists(join(root, options.srcDir, 'content', directory));
      add(`versions.archive.${directory}`, present ? 'PASS' : 'FAIL', `Archive directory "${directory}"`, present ? 'exists' : `src/content/${directory} is missing`, 'A configured archive without content renders no pages.', present ? undefined : `Create src/content/${directory} or remove the archive.`, `${options.srcDir}/content/${directory}`);
    }
  }

  let current;
  if (docsRoot) {
    const reserved = paths?.versioning ? 'v' : undefined;
    current = await analyzeContent(root, options.srcDir, docsRoot.directory, docsRoot.basePath, reserved);
    const where = `${options.srcDir}/content/${docsRoot.directory}`;
    if (!(await exists(current.dir))) add('content.directory', 'FAIL', 'Content directory', `${where} does not exist`, 'No documents are available to render.', 'Run "doq init" or create the directory and add Markdown files.', where);
    else if (!current.files.length) add('content.directory', 'FAIL', 'Content directory', `${where} has no Markdown files`, 'No documents are available to render.', 'Add at least one .md file with frontmatter.', where);
    else {
      add('content.directory', 'PASS', 'Content directory', `${current.files.length} Markdown file(s) in ${where}`, 'Documents are available to render.');
      const { issues } = current;
      const report = (id, status, check, items, why, fix) => add(id, items.length ? status : 'PASS', check, items.length ? list(items) : 'none found', why, items.length ? fix : undefined, items[0]?.split(' ')[0]);
      report('content.frontmatter-closed', 'FAIL', 'Frontmatter blocks are closed', issues.unclosed, 'An unclosed "---" block turns the whole file into frontmatter.', 'Close the block with a second "---" line.');
      report('content.frontmatter', 'WARN', 'Frontmatter present', issues.noFrontmatter, 'Without frontmatter the title falls back to the file name and the page has no group or order.', 'Add title, description, group and order.');
      report('content.title', 'WARN', 'Documents have a title', issues.noTitle, 'Navigation and page titles fall back to the file name.', 'Add a "title:" frontmatter key.');
      report('content.order', 'WARN', 'Numeric order', issues.badOrder, 'A non-numeric order is ignored and the page sorts last.', 'Use a number such as "order: 10".');
      report('content.slugs', 'FAIL', 'Valid slugs', issues.badSlug, 'Slugs may contain letters, numbers, "_", "-" and "~" only.', 'Rename the file or fix the "slug:" key.');
      report('content.duplicate-routes', 'FAIL', 'Unique canonical routes', issues.duplicates, 'Two documents on one URL fail the build.', 'Change one slug or file name.');
      if (paths?.versioning) report('content.reserved-segment', 'FAIL', 'Slugs avoid the version prefix', issues.reserved, 'The first path segment "v" is reserved for archived versions.', 'Rename the document or set versioning.pathSegment.');
    }
    for (const directory of archives.filter(Boolean)) {
      const archive = await analyzeContent(root, options.srcDir, directory, publicPath(docsRoot.basePath, `v/${paths.archiveIds[archives.indexOf(directory)] ?? directory}`), undefined);
      const problems = [...archive.issues.duplicates, ...archive.issues.badSlug, ...archive.issues.unclosed];
      if (archive.files.length) add(`versions.content.${directory}`, problems.length ? 'FAIL' : 'PASS', `Archive "${directory}" content`, problems.length ? list(problems) : `${archive.files.length} Markdown file(s), unique routes`, 'Archived pages follow the same rules as the current version.', problems.length ? 'Fix the listed files.' : undefined, `${options.srcDir}/content/${directory}`);
    }
  }

  // Wiring: reads the host's source text; a different structure than expected yields UNKNOWN, never a false PASS.
  const wired = (id, check, names, why, fix, optional = false) => {
    const missing = names.filter(name => project.where(name).length === 0);
    if (!project.sources.length) return add(id, 'UNKNOWN', check, `no TypeScript sources found in ${options.srcDir}/`, why, 'Check manually.');
    add(id, missing.length ? (optional ? 'WARN' : 'FAIL') : 'PASS', check, missing.length ? `not found in ${options.srcDir}/: ${missing.join(', ')}` : `found in ${project.where(names[0])[0]}`, why, missing.length ? fix : undefined);
  };
  wired('setup.providers', 'Doqs providers and routes', ['doqRoutes', 'provideDoq'], 'The documentation routes and configuration are registered in the Angular application.', 'Add doqRoutes(doqConfig) via withExtraRoutes() and provideDoq(doqConfig) to the application providers (run "doq init" for a snippet).');
  wired('setup.markdown-provider', 'Analog Markdown renderer', ['provideContent', 'withMarkdownRenderer'], 'Analog renders the Markdown documents.', 'Add provideContent(withMarkdownRenderer()) once to the application providers.');

  const hasStyles = Boolean(project.stylesheet);
  add('setup.stylesheet', hasStyles ? 'PASS' : 'FAIL', 'Doqs stylesheet', hasStyles ? `imported in ${project.stylesheet}` : '@doqs/analog/styles.css is not imported', 'Without it the documentation renders unstyled.', hasStyles ? undefined : `Add @import '@doqs/analog/styles.css'; to your global stylesheet.`);

  const vite = project.viteConfig;
  if (!vite) {
    add('setup.vite', 'FAIL', 'Vite configuration', 'no vite.config.ts/js found in the project root', 'The documentation routes must be prerendered by Analog.', 'Add the Doqs entries to the file that calls analog().');
  } else {
    const has = pattern => pattern.test(vite.code);
    add('setup.prerender', has(/doqPrerenderRoutes/) ? 'PASS' : 'FAIL', 'Prerender routes', has(/doqPrerenderRoutes/) ? 'doqPrerenderRoutes() is used' : 'doqPrerenderRoutes() is not used', 'Static output only contains documentation pages that are prerendered.', has(/doqPrerenderRoutes/) ? undefined : 'Spread doqPrerenderRoutes(doqPaths) into analog({ prerender: { routes } }).', vite.path);
    add('setup.highlighter', has(/highlighter\s*:/) ? 'PASS' : 'WARN', 'Markdown highlighter', has(/highlighter\s*:/) ? 'analog({ content: { highlighter } }) is set' : 'no content.highlighter option found', 'Doqs README requires a highlighter ("prism" or "shiki") for code blocks, tabs and demos.', has(/highlighter\s*:/) ? undefined : "Set analog({ content: { highlighter: 'prism' } }).", vite.path);
    add('setup.deterministic', has(/doqDeterministicMarkdown/) ? 'PASS' : 'WARN', 'Deterministic Markdown plugin', has(/doqDeterministicMarkdown/) ? 'doqDeterministicMarkdown() is used' : 'not used', 'Without it, an upstream Analog race can give duplicate headings different ids between builds (heading links and search anchors then disagree).', has(/doqDeterministicMarkdown/) ? undefined : "Add doqDeterministicMarkdown() from '@doqs/analog/vite' next to analog().", vite.path);
    if (has(/doqDeterministicMarkdown/)) {
      const platform = await readInstalled(root, '@analogjs/platform');
      add('setup.deterministic-target', platform ? 'PASS' : 'UNKNOWN', 'Deterministic plugin target', platform ? `@analogjs/platform ${platform.version} installed` : '@analogjs/platform not installed', 'The helper wraps the "analogjs-content-file" plugin and fails the build when it is absent.', platform ? undefined : 'Install @analogjs/platform and keep analog() in the same Vite config.');
    }
  }

  // Search is optional: nothing here is checked unless the host enables it.
  const searchSources = project.sources.filter(source => /search\s*:/.test(source.code));
  const enabledLiteral = searchSources.find(source => /search\s*:\s*\{[^}]*enabled\s*:\s*true/.test(source.code));
  const enabledDynamic = searchSources.find(source => /search\s*:\s*\{[^}]*enabled\s*:\s*(?!true|false)/.test(source.code));
  let searchEnabled = false;
  if (enabledLiteral) searchEnabled = true;
  else if (enabledDynamic) add('search.enabled', 'UNKNOWN', 'Search configuration', 'search.enabled is computed', 'Doctor does not run project code.', 'If search is enabled, make sure pagefind is installed and doq-search index runs after the build.', enabledDynamic.path);
  if (searchEnabled) {
    const pagefind = await readInstalled(root, 'pagefind');
    add('search.pagefind', pagefind ? 'PASS' : 'FAIL', 'Pagefind installed (search enabled)', pagefind ? `version ${pagefind.version}` : 'pagefind is not installed', 'The search index is built by Pagefind.', pagefind ? undefined : 'Install pagefind (^1.5.0) as a dev dependency.');
    const scripts = Object.values(pkg.scripts ?? {}).join('\n');
    add('search.index-step', /doq-search\s+index/.test(scripts) ? 'PASS' : 'WARN', 'Indexing step (search enabled)', /doq-search\s+index/.test(scripts) ? 'a package.json script runs doq-search index' : 'no package.json script runs "doq-search index"', 'Pagefind indexes the prerendered HTML after the build; without it the search box finds nothing.', /doq-search\s+index/.test(scripts) ? undefined : 'Run "doq-search index dist/analog/public" after the build, for example "vite build && doq-search index dist/analog/public".', 'package.json');
  } else if (!enabledDynamic) {
    add('search.enabled', 'PASS', 'Search', 'not enabled', 'Search is optional; no Pagefind checks are needed.');
  }

  if (options.build) {
    const siteDir = resolve(root, options.siteDir ?? 'dist/analog/public');
    if (!(await exists(siteDir))) {
      add('build.output', 'FAIL', 'Static output', `${rel(root, siteDir)} does not exist`, '--build inspects an existing build; doctor never builds for you.', 'Build the application first (for example "pnpm build"), or pass --site-dir.');
    } else {
      add('build.output', 'PASS', 'Static output', rel(root, siteDir), 'Existing build output.');
      if (current?.routes.size) {
        const missing = [];
        for (const route of current.routes.keys()) {
          const base = join(siteDir, ...route.split('/').filter(Boolean));
          if (!(await exists(join(base, 'index.html'))) && !(await exists(`${base}.html`))) missing.push(route);
        }
        add('build.routes', missing.length ? 'FAIL' : 'PASS', 'Documentation routes prerendered', missing.length ? `missing: ${list(missing)}` : `${current.routes.size} route(s) have static HTML`, 'A route without static HTML is not served by static hosting.', missing.length ? 'Check the prerender configuration and rebuild.' : undefined);
      }
      add(...(await aotFinding(siteDir)));
      if (searchEnabled) {
        const hasIndex = await exists(join(siteDir, 'pagefind', 'pagefind.js'));
        add('build.pagefind', hasIndex ? 'PASS' : 'FAIL', 'Pagefind index in output', hasIndex ? 'pagefind/pagefind.js exists' : 'pagefind/pagefind.js is missing', 'Search needs the static index next to the pages.', hasIndex ? undefined : 'Run "doq-search index <output dir>" after the build.');
      }
    }
  }

  return summarize(root, findings, options.strict);
}

// Angular's runtime throws this when a component was never compiled ahead of time and no compiler is in the bundle. A
// successful build can still ship that code path (the bundler keeps `Reflect.decorate` output), so the page prerenders
// but never hydrates. The text is tree-shaken out of a fully AOT-compiled application.
const JIT_UNAVAILABLE = 'JIT compiler unavailable';
const JIT_COMPILER_PRESENT = /[\w$]\.\u0275compilerFacade\s*=/;

async function aotFinding(siteDir) {
  const check = 'Browser bundles compiled ahead of time';
  const files = (await walk(siteDir, name => name.endsWith('.js'))).filter(file => !rel(siteDir, file).startsWith('pagefind'));
  const uncompiled = [];
  let withCompiler = 0;
  for (const file of files) {
    const text = (await readText(file)) ?? '';
    if (!text.includes(JIT_UNAVAILABLE)) continue;
    if (JIT_COMPILER_PRESENT.test(text)) withCompiler++;
    else uncompiled.push(rel(siteDir, file));
  }
  if (uncompiled.length)
    return ['build.aot', 'FAIL', check, `needs the JIT compiler, which is not bundled: ${list(uncompiled)}`, 'A component that was not compiled ahead of time throws "JIT compiler unavailable" in the browser: the page is prerendered but does not hydrate.', 'Rebuild (this is an intermittent upstream race in the Angular compilation of concurrent client and SSR builds, see the 0.13.0 changelog); if it persists, check that every component file is in the application tsconfig.'];
  if (withCompiler)
    return ['build.aot', 'WARN', check, `@angular/compiler is bundled for the browser (${withCompiler} file(s))`, 'The runtime compiler adds a large amount of JavaScript and means components are compiled in the browser.', 'Compile components ahead of time and do not import @angular/compiler from application code.'];
  return ['build.aot', 'PASS', check, `${files.length} script(s) contain no runtime-compilation path`, 'No bundle depends on the Angular JIT compiler.'];
}

function summarize(root, findings, strict = false) {
  const counts = Object.fromEntries(STATUS.map(status => [status, findings.filter(item => item.status === status).length]));
  const failed = counts.FAIL > 0 || (strict && (counts.WARN > 0 || counts.UNKNOWN > 0));
  return { command: 'doctor', projectDir: root, summary: counts, findings, exitCode: failed ? 1 : 0 };
}

export function formatDoctor(result) {
  const lines = [`doq doctor: ${result.projectDir}`, ''];
  for (const status of STATUS) {
    for (const item of result.findings.filter(entry => entry.status === status)) {
      lines.push(`${status.padEnd(7)} ${item.check}: ${item.found}${item.path ? `  [${item.path}]` : ''}`);
      if (status !== 'PASS') {
        lines.push(`        why: ${item.why}`);
        if (item.fix) lines.push(`        fix: ${item.fix}`);
      }
    }
  }
  const { summary } = result;
  lines.push('', `${summary.PASS} passed, ${summary.WARN} warning(s), ${summary.FAIL} failed, ${summary.UNKNOWN} unknown (check manually).`);
  return lines.join('\n');
}

export { CliError };

---
title: The doq CLI
description: doq init scaffolds the documentation files; doq doctor diagnoses the integration; doq content resolves authored pages.
group: Start here
order: 3
---

The `doq` command is installed with `@doqs/analog`. Run it through your package manager, with no global install:

```bash
pnpm exec doq --help
```

It reads and writes plain files, needs no network, loads neither Angular nor the TypeScript compiler, and never runs your application code.

## doq init

Prepares an existing Angular and Analog application. It creates the smallest useful set of files and tells you what is still to connect.

```bash
pnpm exec doq init [--mode embedded|docs-first] [--content-dir docs] [--base-path /docs] [--dir <path>] [--dry-run] [--json]
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--mode` | `embedded` | `embedded` mounts the docs at `--base-path` (default `/docs`); `docs-first` mounts them at `/` |
| `--content-dir` | `docs` | Folder below `src/content` |
| `--base-path` | `/docs` | Mount path (embedded mode only) |
| `--dir` | current directory | The project to prepare |
| `--src-dir` | `src` | The source folder |
| `--dry-run` | off | Print the plan; write nothing |
| `--json` | off | One JSON document on stdout |

### Files it creates

```text
src/doq.paths.ts                      contentDirectory and basePath, shared with vite.config.ts
src/content/docs/introduction.md      starter page
src/content/docs/getting-started.md   starter page
```

### Safety rules

- **It never overwrites.** Files are created exclusively; an existing file is reported as `unchanged` (identical), `kept` (yours, left alone) or `skipped`.
- **A conflict writes nothing.** If an existing `doq.paths.ts` defines different paths than you asked for, the command stops with exit code 1 and creates no file at all.
- **Existing documentation is respected.** If the content folder already holds Markdown, the starter pages are skipped.
- **Paths are validated.** `..`, absolute paths and symbolic links that leave the project are rejected.
- **It is repeatable.** Running it again reports what exists and what remains; it never duplicates content.
- **It does not edit your configuration.** `vite.config.ts`, your Angular providers and your stylesheet differ in every project, so the CLI inspects them and prints exact snippets for what is missing instead of rewriting them.

### Scaffold versus integration

The command ends with one of two verdicts, never a blanket "done":

- **Scaffold complete.** The files exist.
- **Integration complete** only when it finds the dependencies, the stylesheet import, the providers, `doqPrerenderRoutes()` and an Analog highlighter in your project. Otherwise it prints **Integration incomplete** and each remaining step with its snippet.

The deterministic Markdown plugin is listed as a recommendation, not a requirement; see [the plugin page](/docs/operations/deterministic-vite-plugin).

## doq doctor

Reads your project and classifies each check as `PASS`, `WARN`, `FAIL` or `UNKNOWN`.

```bash
pnpm exec doq doctor [--dir <path>] [--build] [--site-dir <path>] [--strict] [--json]
```

Each finding says what was checked, what was found, why it matters, how to fix it and which file it concerns. The exit code is `1` when any check fails and `0` otherwise; `--strict` also fails on warnings and unknown results.

| Area | Checks |
| --- | --- |
| Environment | Node.js version; installed Doqs version and each of its peer ranges against your installed packages |
| Configuration | `doq.paths.ts`, `contentDirectory`, `basePath`, content folder, frontmatter, duplicate and invalid slugs, version archives |
| Wiring | Doqs providers and routes, the Markdown renderer, the stylesheet, prerender routes, the highlighter, the deterministic plugin |
| Search | Only when search is enabled: `pagefind` installed, and an indexing step in `package.json` |
| Output (`--build`) | Static HTML for every documentation route, the Pagefind bundle, and that no browser script depends on the Angular JIT compiler it does not contain (`build.aot`) |

> [!NOTE]
> Three different things can be true of a new integration: `doq init` succeeded (files were written), `vite build` exited `0` (a bundle was produced), and the page hydrates in a browser. Static HTML and a green build prove only the first two. `doq doctor --build` reads the built scripts so a build that cannot run is not reported as passing; opening the pages in a browser (or an end-to-end test) remains the proof of the third.

> [!IMPORTANT]
> Doctor does not execute your project. When a value is computed rather than written as a literal, the result is `UNKNOWN` ("check manually"), never a guessed `PASS`. `--build` inspects an existing build; it never starts one.

### Machine-readable output

`--json` prints exactly one JSON document to stdout and nothing else. Usage errors go to stderr (also as JSON) with exit code `2`.

```bash
pnpm exec doq doctor --json | jq '.findings[] | select(.status == "FAIL")'
```

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success (`init`), or no failed check (`doctor`) |
| `1` | A conflict (`init`) or a failed check (`doctor`) |
| `2` | Invalid usage or an unusable project directory |

## doq content

```bash
pnpm exec doq content generate [--dir <path>] [--config <file>] [--json]
pnpm exec doq content check    [--dir <path>] [--config <file>] [--json]
pnpm exec doq content watch    [--dir <path>] [--config <file>]
```

Resolves `::source{}`, `::include{}` and `[[api:Name]]` in the pages of your authoring directory into ordinary Markdown (see [Content authoring](/docs/guides/content-authoring)). `check` writes nothing and exits 1 when the generated pages are stale; the other exit codes are 2 (configuration), 3 (an output conflict) and 4 (invalid authoring). Details and troubleshooting: [Content tooling](/docs/operations/content-tooling).

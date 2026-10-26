import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, type Type } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VoltBadge, VoltNativeButton } from '@voltui/components';
import { MoveEnterDirective, MoveHoverDirective, MoveInViewDirective, MoveStaggerDirective, MoveTapDirective } from 'angular-movement';
import { LmnArrowRightIcon } from 'lumen-icons/arrow-right';
import { LmnCodeBracketIcon } from 'lumen-icons/code-bracket';
import { LmnCommandLineIcon } from 'lumen-icons/command-line';
import { LmnMagnifyingGlassIcon } from 'lumen-icons/magnifying-glass';
import { LmnPuzzlePieceIcon } from 'lumen-icons/puzzle-piece';
import { LmnServerStackIcon } from 'lumen-icons/server-stack';
import { LmnSquaresPlusIcon } from 'lumen-icons/squares-plus';
import { LmnSwatchIcon } from 'lumen-icons/swatch';
import { LmnTagIcon } from 'lumen-icons/tag';
import { CodeTabs, type CodeExample } from '../code-tabs';
import { CodeBlock } from '../components/code-block';
import { ProductPreview } from '../components/product-preview';
import { CopyCommand } from '../copy-command';
import { installCommand, siteLinks } from '../../lib/site-config';

interface Capability {
  readonly icon: Type<unknown>;
  readonly title: string;
  readonly text: string;
}

const steps = [
  ['Install', 'Add the package next to Analog’s content packages.'],
  ['Configure', 'Share the paths, prerender with Analog and register Doqs in your app config.'],
  ['Write Markdown', 'Drop files into src/content/docs. Routes, sidebar and table of contents follow.'],
  ['Build and deploy', 'vite build prerenders everything to static files you can host anywhere.'],
] as const;

/** The smaller capabilities, shown as a quiet list so the three differentiators above keep the weight. */
const capabilities: readonly Capability[] = [
  { icon: LmnMagnifyingGlassIcon, title: 'Static full-text search', text: 'Optional Pagefind index built from your prerendered output. No backend, off by default.' },
  { icon: LmnServerStackIcon, title: 'SSR and SSG', text: 'doqPrerenderRoutes() feeds Analog’s prerenderer: every page ships as static HTML and hydrates cleanly.' },
  { icon: LmnTagIcon, title: 'Versioned documentation', text: 'Keep older releases readable at stable /v/<id> URLs, with a version selector and version-filtered search.' },
  { icon: LmnSwatchIcon, title: 'Host-owned theme and layout', text: 'Restyle with --host-docs-* CSS tokens. Doqs sets no global html or body styles.' },
  { icon: LmnSquaresPlusIcon, title: 'Composition slots', text: 'Add your own standalone components after the docs index intro or after every document.' },
  { icon: LmnCommandLineIcon, title: 'CLI', text: 'doq init scaffolds the files, doq doctor checks the integration and reports what it cannot verify.' },
];

const demoDirective = `## Try it

::demo[enter-animation]`;

const sourceDirective = `::source{file="src/button.ts" region="usage" title="button.ts"}`;

const apiCommand = `pnpm exec doq-api generate --entry src/public-api.ts
pnpm exec doq-api check --entry src/public-api.ts`;

const examples: readonly CodeExample[] = [
  {
    id: 'paths',
    tab: 'Shared paths',
    file: 'src/doq.paths.ts',
    code: `// shared by vite.config.ts, so no Angular components here
export const doqPaths = {
  contentDirectory: 'docs',
  basePath: '/docs',
  // optional: keep older releases readable at /docs/v/1.3
  versioning: {
    current: { id: 'latest', label: 'Latest' },
    archives: [{ id: '1.3', label: 'v1.3', contentDirectory: 'docs-v1-3' }],
  },
} as const;`,
  },
  {
    id: 'analog',
    tab: 'Analog prerender',
    file: 'vite.config.ts',
    code: `// Analog configuration: prerender routes
import { doqPrerenderRoutes } from '@doqs/analog';
import { doqPaths } from './src/doq.paths';

analog({
  ssr: true,
  static: true,
  content: { highlighter: 'prism' },
  prerender: { routes: async () => ['/', ...doqPrerenderRoutes(doqPaths)] },
});`,
  },
  {
    id: 'providers',
    tab: 'Angular providers',
    file: 'src/app/app.config.ts',
    code: `// Doqs configuration next to Analog's providers
import { provideContent, withMarkdownRenderer } from '@analogjs/content';
import { provideFileRouter, withExtraRoutes } from '@analogjs/router';
import { defineDoqConfig, doqRoutes, provideDoq } from '@doqs/analog';
import { doqPaths } from '../doq.paths';

const doqConfig = defineDoqConfig({ ...doqPaths, sidebar: 'left', showTableOfContents: true });

export const appConfig: ApplicationConfig = {
  providers: [
    provideFileRouter(withExtraRoutes(doqRoutes(doqConfig))),
    provideContent(withMarkdownRenderer()),
    provideDoq(doqConfig),
  ],
};`,
  },
  {
    id: 'api',
    tab: 'API reference',
    file: 'package.json',
    code: `// optional: reference pages generated from your public TypeScript API
"scripts": {
  "api": "doq-api generate --entry src/public-api.ts",
  "api:check": "doq-api check --entry src/public-api.ts"
}`,
  },
  {
    id: 'demos',
    tab: 'Demo registration',
    file: 'src/app/app.config.ts',
    code: `// one registry for inline and frontmatter demos
const doqConfig = defineDoqConfig({
  ...doqPaths,
  demos: {
    'install-command': InstallCommandComponent,
    'enter-animation': EnterAnimationDemoComponent,
  },
});`,
  },
];

@Component({
  imports: [
    NgComponentOutlet,
    RouterLink,
    VoltBadge,
    VoltNativeButton,
    MoveEnterDirective,
    MoveHoverDirective,
    MoveInViewDirective,
    MoveStaggerDirective,
    MoveTapDirective,
    LmnArrowRightIcon,
    LmnPuzzlePieceIcon,
    LmnCodeBracketIcon,
    CodeBlock,
    CodeTabs,
    CopyCommand,
    ProductPreview,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main id="main">
      <section class="relative" aria-labelledby="hero-title">
        <div class="hero-grid pointer-events-none absolute inset-0 -z-10 opacity-40" aria-hidden="true"></div>
        <div class="hero-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem]" aria-hidden="true"></div>
        <div class="mx-auto w-[min(100%-2rem,70rem)] pt-12 pb-10 sm:pt-16 lg:pt-24">
          <div class="max-w-3xl">
            <volt-badge variant="secondary" class="font-mono text-[0.7rem] tracking-wider uppercase">Angular · Analog.js · Markdown</volt-badge>
            <h1 id="hero-title" class="mt-5 text-[clamp(2.5rem,7vw,4.6rem)] leading-[1.04] font-bold text-balance">
              Your documentation, inside your Angular app.
            </h1>
            <p class="mt-6 max-w-2xl text-lg text-muted-foreground">
              Doqs adds Markdown documentation to the Angular and Analog.js application you already have: server-rendered, statically generated and searchable,
              with real Angular components living between the paragraphs. Your layout, routes and theme stay yours.
            </p>
            <p class="mt-8 flex flex-wrap gap-3">
              <a voltButton size="lg" routerLink="/docs/getting-started" moveWhileHover="lift" moveWhileTap="press">
                Get started <lmn-arrow-right [size]="16" />
              </a>
              <a voltButton size="lg" variant="outline" routerLink="/examples" moveWhileHover="lift" moveWhileTap="press">Explore examples</a>
            </p>
            <div class="mt-6 max-w-2xl"><app-copy-command [command]="installCommand" /></div>
          </div>
          <div class="mt-12" [moveEnter]="{ y: [16, 0] }" moveDuration="500ms"><app-product-preview /></div>
        </div>
      </section>

      <section class="mx-auto w-[min(100%-2rem,70rem)] border-t border-border py-14 sm:py-20" aria-labelledby="differentiators-title">
        <p class="m-0 font-mono text-xs tracking-wider text-primary uppercase">What Doqs adds</p>
        <h2 id="differentiators-title" class="mt-2 max-w-2xl text-[clamp(1.8rem,4vw,2.6rem)] leading-tight">Documentation that is made of your app, not wrapped around it</h2>

        <div class="mt-10 grid gap-10">
          <article class="grid items-center gap-6 lg:grid-cols-2 lg:gap-12">
            <div>
              <lmn-puzzle-piece class="flex" [size]="24" tone="primary" aria-hidden="true" />
              <h3 class="mt-3 text-2xl">Angular components inside Markdown</h3>
              <p class="mt-3 text-muted-foreground">
                Register a standalone component once and place it between paragraphs with one line. It renders on the server and hydrates in the browser.
                Register it as a playground and readers can change its inputs, watch its outputs and copy usage code.
                Doqs is not MDX: a directive only names a component your application registered.
              </p>
              <a class="mt-4 inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline" routerLink="/examples">See it working <lmn-arrow-right [size]="14" /></a>
            </div>
            <app-code-block file="docs/guides/example.md" [code]="demoDirective" />
          </article>

          <article class="grid items-center gap-6 lg:grid-cols-2 lg:gap-12">
            <div class="lg:order-2">
              <lmn-code-bracket class="flex" [size]="24" tone="primary" aria-hidden="true" />
              <h3 class="mt-3 text-2xl">API reference generated from your source</h3>
              <p class="mt-3 text-muted-foreground">
                doq-api reads your library’s public TypeScript API, with signal inputs, outputs, models and JSDoc, and writes ordinary Markdown pages that share the sidebar, search and theme.
                A check command fails CI when they are stale.
              </p>
              <a class="mt-4 inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline" routerLink="/docs/guides/api-reference">Angular API reference <lmn-arrow-right [size]="14" /></a>
            </div>
            <app-code-block class="lg:order-1" file="terminal" [code]="apiCommand" />
          </article>

          <article class="grid items-center gap-6 lg:grid-cols-2 lg:gap-12">
            <div>
              <lmn-code-bracket class="flex" [size]="24" tone="primary" aria-hidden="true" />
              <h3 class="mt-3 text-2xl">Examples that cannot drift</h3>
              <p class="mt-3 text-muted-foreground">
                Pull a named region or line range straight from a file in your repository. The page is generated, committed and checked, so a code sample always matches the code it documents.
              </p>
              <a class="mt-4 inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline" routerLink="/docs/guides/content-authoring" fragment="source-backed-code">Source-backed code <lmn-arrow-right [size]="14" /></a>
            </div>
            <app-code-block file="docs/guides/example.md" [code]="sourceDirective" />
          </article>
        </div>

        <ul class="mt-14 grid list-none gap-x-8 gap-y-8 border-t border-border p-0 pt-10 sm:grid-cols-2 lg:grid-cols-3" moveStagger moveStaggerStep="50ms">
          @for (item of capabilities; track item.title) {
            <li moveInView="fade-up" [moveInViewOnce]="true">
              <span class="flex"><ng-container *ngComponentOutlet="item.icon; inputs: { size: 24, tone: 'primary' }" /></span>
              <h3 class="mt-3 text-lg">{{ item.title }}</h3>
              <p class="mt-1.5 mb-0 text-sm text-muted-foreground">{{ item.text }}</p>
            </li>
          }
        </ul>
      </section>

      <section id="getting-started" class="mx-auto w-[min(100%-2rem,70rem)] border-t border-border py-14 sm:py-20" aria-labelledby="start-title">
        <p class="m-0 font-mono text-xs tracking-wider text-primary uppercase">Quick start</p>
        <h2 id="start-title" class="mt-2 text-[clamp(1.8rem,4vw,2.6rem)] leading-tight">Up and running in four steps</h2>
        <p class="mt-4 mb-8 max-w-2xl text-muted-foreground">
          Doqs plugs into an Analog app. Analog keeps its own configuration; Doqs adds its own. The two are separate on purpose.
        </p>
        <ol class="m-0 mb-10 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          @for (step of steps; track step[0]; let i = $index) {
            <li class="border-t-2 border-primary/40 pt-4">
              <span class="font-mono text-xs text-muted-foreground" aria-hidden="true">0{{ i + 1 }}</span>
              <h3 class="mt-1 text-lg">{{ step[0] }}</h3>
              <p class="mt-1 mb-0 text-sm text-muted-foreground">{{ step[1] }}</p>
            </li>
          }
        </ol>
        <app-code-tabs [examples]="examples" />
        <p class="mt-6 max-w-3xl text-muted-foreground">
          Import <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">&#64;doqs/analog/styles.css</code> once in your global stylesheet, then run
          <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">pnpm exec doq init</code> to scaffold the files. The complete walkthrough is the
          <a class="text-primary underline underline-offset-4" routerLink="/docs/getting-started">getting started guide</a>.
        </p>
      </section>

      <section class="mx-auto w-[min(100%-2rem,70rem)] border-t border-border py-14 sm:py-20" aria-labelledby="proof-title">
        <p class="m-0 font-mono text-xs tracking-wider text-primary uppercase">In use</p>
        <h2 id="proof-title" class="mt-2 text-[clamp(1.8rem,4vw,2.6rem)] leading-tight">Built with Doqs, checked against real sites</h2>
        <div class="mt-8 grid gap-8 md:grid-cols-2">
          <div>
            <h3 class="text-lg">You are looking at it</h3>
            <p class="mt-2 text-muted-foreground">
              The documentation of this site is a Doqs consumer: Markdown files, the Doqs sidebar, table of contents and Pagefind search, Angular demos and playgrounds,
              generated API pages, all prerendered and loaded as a lazy route.
            </p>
            <a class="mt-3 inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline" routerLink="/docs">Open the documentation <lmn-arrow-right [size]="14" /></a>
          </div>
          <div>
            <h3 class="text-lg">Verified on real documentation sites</h3>
            <p class="mt-2 text-muted-foreground">
              The repository’s adoption checks migrate disposable copies of the Angular Movement and Volt UI documentation sites onto Doqs, keep their URLs,
              build them from the packed tarball and run them in a browser. Each capability is classified as replaced, host-owned or blocked.
            </p>
            <a class="mt-3 inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline" [href]="links.parity" rel="noopener">Read the parity report <lmn-arrow-right [size]="14" /></a>
          </div>
        </div>
      </section>

      <section class="mx-auto w-[min(100%-2rem,70rem)] pb-16 sm:pb-24" aria-labelledby="cta-title">
        <div class="cta-band rounded-2xl border border-border px-6 py-10 text-center sm:px-12 sm:py-14">
          <h2 id="cta-title" class="mx-auto max-w-2xl text-[clamp(1.8rem,4vw,2.6rem)] leading-tight text-balance">Put your documentation where your components already are.</h2>
          <p class="mt-4 mb-0 flex flex-wrap justify-center gap-3">
            <a voltButton size="lg" routerLink="/docs/getting-started" moveWhileHover="lift" moveWhileTap="press">Get started <lmn-arrow-right [size]="16" /></a>
            <a voltButton size="lg" variant="outline" [href]="links.github" rel="noopener" moveWhileHover="lift" moveWhileTap="press">View on GitHub</a>
          </p>
        </div>
      </section>
    </main>
  `,
})
export default class HomePage {
  protected readonly links = siteLinks;
  protected readonly installCommand = installCommand;
  protected readonly capabilities = capabilities;
  protected readonly steps = steps;
  protected readonly examples = examples;
  protected readonly demoDirective = demoDirective;
  protected readonly sourceDirective = sourceDirective;
  protected readonly apiCommand = apiCommand;
}

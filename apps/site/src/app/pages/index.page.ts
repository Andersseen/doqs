import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, type Type } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VoltBadge, VoltCard, VoltCardContent, VoltCardDescription, VoltCardHeader, VoltCardTitle, VoltNativeButton } from '@voltui/components';
import {
  MoveEnterDirective,
  MoveHoverDirective,
  MoveInViewDirective,
  MoveLoopDirective,
  MoveStaggerDirective,
  MoveTapDirective,
  MoveTextDirective,
} from 'angular-movement';
import { LmnArrowRightIcon } from 'lumen-icons/arrow-right';
import { LmnBookOpenIcon } from 'lumen-icons/book-open';
import { LmnCheckBadgeIcon } from 'lumen-icons/check-badge';
import { LmnCodeBracketIcon } from 'lumen-icons/code-bracket';
import { LmnDocumentCheckIcon } from 'lumen-icons/document-check';
import { LmnGithubIcon } from 'lumen-icons/github';
import { LmnCommandLineIcon } from 'lumen-icons/command-line';
import { LmnMagnifyingGlassIcon } from 'lumen-icons/magnifying-glass';
import { LmnPuzzlePieceIcon } from 'lumen-icons/puzzle-piece';
import { LmnServerStackIcon } from 'lumen-icons/server-stack';
import { LmnSquaresPlusIcon } from 'lumen-icons/squares-plus';
import { LmnSwatchIcon } from 'lumen-icons/swatch';
import { LmnTagIcon } from 'lumen-icons/tag';
import { CodeTabs, type CodeExample } from '../code-tabs';
import { CodeBlock } from '../components/code-block';
import { HeroStage } from '../components/hero-stage';
import { SectionHeading } from '../components/section-heading';
import { ProductPreview } from '../components/product-preview';
import { CopyCommand } from '../copy-command';
import { installCommand, siteLinks } from '../../lib/site-config';

interface Capability {
  readonly icon: Type<unknown>;
  readonly title: string;
  readonly text: string;
}

/** The stack Doqs is built on and with, shown as a quiet strip under the hero. */
const stack = ['Angular 21', 'Analog.js', 'Vite', 'Signals', 'Pagefind', 'Volt UI', 'Angular Movement'] as const;

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
    VoltCard,
    VoltCardContent,
    VoltCardDescription,
    VoltCardHeader,
    VoltCardTitle,
    VoltNativeButton,
    MoveEnterDirective,
    MoveHoverDirective,
    MoveInViewDirective,
    MoveLoopDirective,
    MoveStaggerDirective,
    MoveTapDirective,
    MoveTextDirective,
    LmnArrowRightIcon,
    LmnBookOpenIcon,
    LmnCheckBadgeIcon,
    LmnCodeBracketIcon,
    LmnDocumentCheckIcon,
    LmnGithubIcon,
    LmnPuzzlePieceIcon,
    CodeBlock,
    CodeTabs,
    CopyCommand,
    HeroStage,
    ProductPreview,
    SectionHeading,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main id="main">
      <section class="hero relative isolate overflow-hidden" aria-labelledby="hero-title">
        <div class="hero-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true"></div>
        <div class="hero-glow pointer-events-none absolute inset-0 -z-10" aria-hidden="true"></div>
        <div class="mx-auto grid w-[min(100%-2rem,70rem)] items-center gap-12 pt-12 pb-14 sm:pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-8 lg:pt-20 lg:pb-20">
          <div class="min-w-0">
            <a
              class="announce group inline-flex items-center gap-2 rounded-full border border-border bg-background/70 py-1 pr-3 pl-1 text-sm text-muted-foreground no-underline shadow-sm backdrop-blur hover:text-foreground"
              routerLink="/docs/guides/api-reference"
              moveWhileHover="lift"
            >
              <volt-badge variant="solid" class="gap-1.5 rounded-full">
                <span class="relative flex size-1.5" aria-hidden="true">
                  <span class="absolute inline-flex size-full rounded-full bg-primary-foreground" [moveLoop]="{ scale: [1, 2.4], opacity: [0.8, 0] }" moveDuration="1400ms"></span>
                  <span class="relative inline-flex size-1.5 rounded-full bg-primary-foreground"></span>
                </span>
                New
              </volt-badge>
              API reference from your TypeScript source
              <lmn-arrow-right class="transition-transform group-hover:translate-x-0.5" [size]="14" />
            </a>
            <h1 id="hero-title" class="mt-6 text-[clamp(2.5rem,5.4vw,4.25rem)] leading-[1.02] font-bold tracking-tight text-balance hero-title">
              Your documentation, inside your Angular app.
            </h1>
            <p class="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Doqs adds Markdown documentation to the Angular and Analog.js application you already have: server-rendered, statically generated and searchable,
              with real Angular components living between the paragraphs. Your layout, routes and theme stay yours.
            </p>
            <p class="mt-8 flex flex-wrap gap-3">
              <a voltButton size="lg" class="cta-primary rounded-full px-7" routerLink="/docs/getting-started" moveWhileHover="lift" moveWhileTap="press">
                Get started <lmn-arrow-right [size]="16" />
              </a>
              <a voltButton size="lg" variant="outline" class="rounded-full px-7" routerLink="/examples" moveWhileHover="lift" moveWhileTap="press">Explore examples</a>
            </p>
            <div class="mt-6 max-w-xl"><app-copy-command [command]="installCommand" /></div>
          </div>
          <app-hero-stage class="min-w-0" />
        </div>

        <div class="border-y border-border/70 bg-background/60 backdrop-blur">
          <ul class="stack-strip mx-auto m-0 flex w-[min(100%-2rem,70rem)] list-none flex-wrap items-center justify-center gap-x-8 gap-y-2 p-0 py-4" aria-label="Built on">
            @for (name of stack; track name) {
              <li class="font-mono text-xs tracking-wider text-muted-foreground uppercase">{{ name }}</li>
            }
          </ul>
        </div>

        <div class="mx-auto w-[min(100%-2rem,70rem)] py-14 sm:py-20" moveInView="fade-up" [moveInViewOnce]="true" moveDuration="600ms">
          <app-product-preview />
        </div>
      </section>

      <section class="mx-auto w-[min(100%-2rem,70rem)] py-16 sm:py-24" aria-labelledby="differentiators-title">
        <app-section-heading eyebrow="What Doqs adds" heading="Documentation that is made of your app, not wrapped around it" headingId="differentiators-title">
          Three things a separate documentation site cannot do, because Doqs runs inside the application it documents.
        </app-section-heading>

        <div class="mt-12 grid gap-5 lg:grid-cols-2">
          <article class="min-w-0 lg:col-span-2" moveInView="fade-up" [moveInViewOnce]="true" moveDuration="550ms">
            <volt-card class="feature-card h-full p-4 sm:p-8">
              <div class="grid items-center gap-8 lg:grid-cols-2 [&>*]:min-w-0">
                <div>
                  <lmn-puzzle-piece class="self-start" [size]="24" tone="primary" background="soft" backgroundTone="primary" [padding]="10" radius="0.75rem" />
                  <h3 class="mt-4 text-2xl">Angular components inside Markdown</h3>
                  <p class="mt-3 text-muted-foreground">
                    Register a standalone component once and place it between paragraphs with one line. It renders on the server and hydrates in the browser.
                    Register it as a playground and readers can change its inputs, watch its outputs and copy usage code.
                    Doqs is not MDX: a directive only names a component your application registered.
                  </p>
                  <a class="feature-link mt-4" routerLink="/examples">See it working <lmn-arrow-right [size]="14" /></a>
                </div>
                <app-code-block file="docs/guides/example.md" [code]="demoDirective" />
              </div>
            </volt-card>
          </article>

          <article class="min-w-0" moveInView="fade-up" [moveInViewOnce]="true" moveDuration="550ms">
            <volt-card class="feature-card flex h-full flex-col p-4 sm:p-8">
              <lmn-code-bracket class="self-start" [size]="24" tone="info" background="soft" backgroundTone="info" [padding]="10" radius="0.75rem" />
              <h3 class="mt-4 text-2xl">API reference generated from your source</h3>
              <p class="mt-3 text-muted-foreground">
                doq-api reads your library’s public TypeScript API, with signal inputs, outputs, models and JSDoc, and writes ordinary Markdown pages that share the sidebar, search and theme.
                A check command fails CI when they are stale.
              </p>
              <app-code-block class="mt-auto pt-5" file="terminal" [code]="apiCommand" />
              <a class="feature-link mt-4" routerLink="/docs/guides/api-reference">Angular API reference <lmn-arrow-right [size]="14" /></a>
            </volt-card>
          </article>

          <article class="min-w-0" moveInView="fade-up" [moveInViewOnce]="true" moveDuration="550ms" moveDelay="100ms">
            <volt-card class="feature-card flex h-full flex-col p-4 sm:p-8">
              <lmn-document-check class="self-start" [size]="24" tone="success" background="soft" backgroundTone="success" [padding]="10" radius="0.75rem" />
              <h3 class="mt-4 text-2xl">Examples that cannot drift</h3>
              <p class="mt-3 text-muted-foreground">
                Pull a named region or line range straight from a file in your repository. The page is generated, committed and checked, so a code sample always matches the code it documents.
              </p>
              <app-code-block class="mt-auto pt-5" file="docs/guides/example.md" [code]="sourceDirective" />
              <a class="feature-link mt-4" routerLink="/docs/guides/content-authoring" fragment="source-backed-code">Source-backed code <lmn-arrow-right [size]="14" /></a>
            </volt-card>
          </article>
        </div>

        <ul class="mt-5 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3" moveStagger moveStaggerStep="60ms">
          @for (item of capabilities; track item.title) {
            <li class="capability rounded-xl border border-border bg-surface p-5" moveInView="fade-up" [moveInViewOnce]="true">
              <ng-container *ngComponentOutlet="item.icon; inputs: { size: 20, tone: 'primary', background: 'soft', backgroundTone: 'primary', padding: 8, radius: '0.6rem' }" />
              <h3 class="mt-4 text-lg">{{ item.title }}</h3>
              <p class="mt-1.5 mb-0 text-sm leading-relaxed text-muted-foreground">{{ item.text }}</p>
            </li>
          }
        </ul>
      </section>

      <section id="getting-started" class="quickstart border-y border-border/70 py-16 sm:py-24" aria-labelledby="start-title">
        <div class="mx-auto w-[min(100%-2rem,70rem)]">
          <app-section-heading eyebrow="Quick start" heading="Up and running in four steps" headingId="start-title">
            Doqs plugs into an Analog app. Analog keeps its own configuration; Doqs adds its own. The two are separate on purpose.
          </app-section-heading>
          <ol class="steps m-0 mt-12 mb-12 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4" moveStagger moveStaggerStep="90ms">
            @for (step of steps; track step[0]; let i = $index) {
              <li class="step relative" moveInView="fade-up" [moveInViewOnce]="true">
                <span class="step-number" aria-hidden="true">{{ i + 1 }}</span>
                <h3 class="mt-4 text-lg">{{ step[0] }}</h3>
                <p class="mt-1 mb-0 text-sm text-muted-foreground">{{ step[1] }}</p>
              </li>
            }
          </ol>
          <div moveInView="fade-up" [moveInViewOnce]="true" moveDuration="550ms"><app-code-tabs [examples]="examples" /></div>
          <p class="mt-6 max-w-3xl text-muted-foreground">
            Import <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">&#64;doqs/analog/styles.css</code> once in your global stylesheet, then run
            <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">pnpm exec doq init</code> to scaffold the files. The complete walkthrough is the
            <a class="text-primary underline underline-offset-4" routerLink="/docs/getting-started">getting started guide</a>.
          </p>
        </div>
      </section>

      <section class="mx-auto w-[min(100%-2rem,70rem)] py-16 sm:py-24" aria-labelledby="proof-title">
        <app-section-heading eyebrow="In use" heading="Built with Doqs, checked against real sites" headingId="proof-title" />
        <div class="mt-10 grid gap-5 md:grid-cols-2" moveStagger moveStaggerStep="100ms">
          <volt-card class="feature-card" moveInView="fade-up" [moveInViewOnce]="true">
            <volt-card-header class="gap-3">
              <lmn-book-open class="self-start" [size]="20" tone="primary" background="soft" backgroundTone="primary" [padding]="8" radius="0.6rem" />
              <volt-card-title><h3 class="text-xl">You are looking at it</h3></volt-card-title>
              <volt-card-description>
                The documentation of this site is a Doqs consumer: Markdown files, the Doqs sidebar, table of contents and Pagefind search, Angular demos and playgrounds,
                generated API pages, all prerendered and loaded as a lazy route.
              </volt-card-description>
            </volt-card-header>
            <volt-card-content>
              <a class="feature-link" routerLink="/docs">Open the documentation <lmn-arrow-right [size]="14" /></a>
            </volt-card-content>
          </volt-card>
          <volt-card class="feature-card" moveInView="fade-up" [moveInViewOnce]="true">
            <volt-card-header class="gap-3">
              <lmn-check-badge class="self-start" [size]="20" tone="success" background="soft" backgroundTone="success" [padding]="8" radius="0.6rem" />
              <volt-card-title><h3 class="text-xl">Verified on real documentation sites</h3></volt-card-title>
              <volt-card-description>
                The repository’s adoption checks migrate disposable copies of the Angular Movement and Volt UI documentation sites onto Doqs, keep their URLs,
                build them from the packed tarball and run them in a browser. Each capability is classified as replaced, host-owned or blocked.
              </volt-card-description>
            </volt-card-header>
            <volt-card-content>
              <a class="feature-link" [href]="links.parity" rel="noopener">Read the parity report <lmn-arrow-right [size]="14" /></a>
            </volt-card-content>
          </volt-card>
        </div>
      </section>

      <section class="mx-auto w-[min(100%-2rem,70rem)] pb-16 sm:pb-24" aria-labelledby="cta-title">
        <div class="cta-band relative isolate overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12 sm:py-20" moveInView="zoom-in" [moveInViewOnce]="true" moveDuration="600ms">
          <div class="cta-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true"></div>
          <h2 id="cta-title" class="mx-auto max-w-2xl text-[clamp(1.9rem,4.5vw,3rem)] leading-[1.08] font-bold text-balance" moveText="fade-up" moveTextSplit="words" moveTextStagger="45">
            Put your documentation where your components already are.
          </h2>
          <p class="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">Install one package, keep your app. Markdown in, prerendered pages out.</p>
          <p class="mt-8 mb-0 flex flex-wrap justify-center gap-3">
            <a voltButton size="lg" class="cta-primary rounded-full px-7" routerLink="/docs/getting-started" moveWhileHover="lift" moveWhileTap="press">Get started <lmn-arrow-right [size]="16" /></a>
            <a voltButton size="lg" variant="outline" class="rounded-full px-7" [href]="links.github" rel="noopener" moveWhileHover="lift" moveWhileTap="press">
              <lmn-github [size]="16" /> View on GitHub
            </a>
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
  protected readonly stack = stack;
  protected readonly steps = steps;
  protected readonly examples = examples;
  protected readonly demoDirective = demoDirective;
  protected readonly sourceDirective = sourceDirective;
  protected readonly apiCommand = apiCommand;
}

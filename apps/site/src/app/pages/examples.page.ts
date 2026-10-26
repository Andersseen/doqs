import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VoltBadge, VoltCard, VoltCardContent, VoltCardDescription, VoltCardHeader, VoltCardTitle } from '@voltui/components';
import { MoveEnterDirective } from 'angular-movement';
import { LmnArrowRightIcon } from 'lumen-icons/arrow-right';
import { CodeBlock } from '../components/code-block';
import { ExampleFrame } from '../components/example-frame';
import { MovementLab } from '../components/movement-lab';
import { EnterDemo } from '../enter-demo';
import { InstallDemo } from '../install-demo';

const markdownSource = `## Try it

::demo[enter-animation]

The text after a demo is still ordinary, searchable Markdown.`;

const registration = `const doqConfig = defineDoqConfig({
  ...doqPaths,
  demos: { 'install-command': InstallDemo, 'enter-animation': EnterDemo },
  playgrounds: {
    'movement-enter': { component: MovementPlaygroundComponent, controls: [/* preset, duration, … */] },
  },
});`;

const sourceDirective = `::source{file="packages/doq/bin/content/regions.mjs" region="marker" title="regions.mjs"}`;

const apiCommand = `pnpm exec doq-api generate --entry src/public-api.ts
pnpm exec doq-api check --entry src/public-api.ts`;

@Component({
  imports: [
    RouterLink,
    VoltBadge,
    VoltCard,
    VoltCardContent,
    VoltCardDescription,
    VoltCardHeader,
    VoltCardTitle,
    MoveEnterDirective,
    LmnArrowRightIcon,
    CodeBlock,
    ExampleFrame,
    MovementLab,
    EnterDemo,
    InstallDemo,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main id="main">
      <header class="mx-auto w-[min(100%-2rem,70rem)] pt-12 pb-10 sm:pt-16 lg:pt-20" [moveEnter]="{ y: [12, 0] }" moveDuration="400ms">
        <volt-badge variant="secondary" class="font-mono text-[0.7rem] tracking-wider uppercase">Live examples</volt-badge>
        <h1 class="mt-4 max-w-3xl text-[clamp(2.2rem,5.5vw,3.6rem)] leading-[1.08] font-bold text-balance">See Doqs work, then read how.</h1>
        <p class="mt-5 max-w-2xl text-lg text-muted-foreground">
          Everything on this page is a real Angular component or a real link into the documentation, which is itself built with Doqs.
          Change a control and the component answers; copy the code and it is the code that is on screen.
        </p>
      </header>

      <div class="mx-auto w-[min(100%-2rem,70rem)]">
        <app-example-frame id="component" eyebrow="Markdown" heading="An Angular component, placed from Markdown" guide="/docs/guides/interactive-components" guideLabel="Interactive components">
          <span intro>
            One line names a component your application registered. It is rendered on the server, hydrated in the browser and sits between ordinary paragraphs.
            Doqs is not MDX: nothing in the Markdown is evaluated.
          </span>
          <div class="grid gap-4 md:grid-cols-2">
            <app-code-block file="docs/guides/example.md" [code]="markdownSource" />
            <volt-card>
              <volt-card-header>
                <volt-card-title><h3 class="text-lg">Rendered</h3></volt-card-title>
                <volt-card-description><span class="font-mono">::demo[enter-animation]</span>, animated with Angular Movement</volt-card-description>
              </volt-card-header>
              <volt-card-content><app-enter-demo /></volt-card-content>
            </volt-card>
          </div>
          <div class="mt-4"><app-code-block file="src/app/doq.config.ts" [code]="registration" /></div>
        </app-example-frame>

        <app-example-frame id="playground" eyebrow="Playground" heading="Inputs, outputs and usage code that stay in sync" guide="/docs/guides/interactive-playgrounds" guideLabel="Interactive playgrounds">
          <span intro>
            A playground lets readers change the inputs of a real component and watch its outputs. Here the controls are Volt UI and the component is the
            Angular Movement wrapper the documentation registers as <code class="font-mono text-[0.9em]">movement-enter</code>.
          </span>
          <volt-card>
            <volt-card-content class="p-5"><app-movement-lab /></volt-card-content>
          </volt-card>
        </app-example-frame>

        <app-example-frame id="install" eyebrow="Demo" heading="A copyable install command" guide="/docs/getting-started" guideLabel="Getting started">
          <span intro>
            The same component that sits in the Getting started guide: pick a package manager and copy the exact command.
          </span>
          <volt-card>
            <volt-card-content class="p-5"><app-install-demo /></volt-card-content>
          </volt-card>
        </app-example-frame>

        <app-example-frame id="source" eyebrow="Content tooling" heading="Code that comes from your source" guide="/docs/guides/content-authoring" guideFragment="source-backed-code" guideLabel="Source-backed code">
          <span intro>
            A directive pulls a region or line range straight from a file in your repository, so a code sample cannot drift from the code it documents.
            <code class="font-mono text-[0.9em]">doq content check</code> fails CI when a generated page is stale.
          </span>
          <app-code-block file="docs/guides/content-authoring.md" [code]="sourceDirective" />
          <p class="mt-4 mb-0 text-sm text-muted-foreground">
            The guide shows the attributes, how regions are marked in the source and a block rendered from Doqs's own code:
            <a class="font-medium text-primary underline-offset-4 hover:underline" routerLink="/docs/guides/content-authoring" fragment="regions">see regions in the documentation</a>.
          </p>
        </app-example-frame>

        <app-example-frame id="api" eyebrow="API reference" heading="Reference pages generated from TypeScript" guide="/docs/guides/api-reference" guideLabel="Angular API reference">
          <span intro>
            <code class="font-mono text-[0.9em]">doq-api</code> reads a public entry point with your own TypeScript and writes ordinary Markdown pages: one per symbol, with signatures and JSDoc.
          </span>
          <app-code-block file="terminal" [code]="apiCommand" />
          <ul class="mt-4 mb-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            @for (page of apiPages; track page.href) {
              <li>
                <a class="group flex h-full items-center justify-between gap-3 rounded-lg border border-border p-4 text-foreground no-underline hover:border-primary/50 hover:bg-muted" [routerLink]="page.href">
                  <span><span class="block font-mono text-sm font-medium">{{ page.name }}</span><span class="block text-sm text-muted-foreground">{{ page.text }}</span></span>
                  <lmn-arrow-right class="shrink-0 text-muted-foreground group-hover:text-primary" [size]="16" />
                </a>
              </li>
            }
          </ul>
        </app-example-frame>

        <app-example-frame id="search" eyebrow="Navigation" heading="Search and navigation, without a backend" guide="/docs/guides/navigation-and-search" guideLabel="Navigation and search">
          <span intro>
            The sidebar, the sticky table of contents and Pagefind full-text search come with the documentation region. Open it and try them.
          </span>
          <volt-card>
            <volt-card-content class="flex flex-wrap items-center justify-between gap-4 p-5">
              <p class="m-0 max-w-md text-sm text-muted-foreground">
                The search box is at the top of every documentation page. The index is static and built from the prerendered pages.
              </p>
              <a class="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground no-underline hover:opacity-90" routerLink="/docs">
                Open the documentation <lmn-arrow-right [size]="14" />
              </a>
            </volt-card-content>
          </volt-card>
        </app-example-frame>
      </div>
    </main>
  `,
})
export default class ExamplesPage {
  protected readonly markdownSource = markdownSource;
  protected readonly registration = registration;
  protected readonly sourceDirective = sourceDirective;
  protected readonly apiCommand = apiCommand;
  protected readonly apiPages = [
    { name: 'generateContent', text: 'Function: build the pages from your sources.', href: '/docs/reference/content-api/generate-content' },
    { name: 'DoqContentTarget', text: 'Interface: one authored content target.', href: '/docs/reference/content-api/doq-content-target' },
  ] as const;
}

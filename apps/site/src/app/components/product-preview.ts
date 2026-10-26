import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VoltBadge, VoltTabs, VoltTabsContent, VoltTabsList, VoltTabsTrigger } from '@voltui/components';
import { LmnArrowRightIcon } from 'lumen-icons/arrow-right';
import { EnterDemo } from '../enter-demo';

const guide = '/docs/guides/interactive-playgrounds';

const markdown = `## Register

Register the component once, then place it:

::demo[enter-animation]

## Place

The text after a demo is still ordinary,
searchable Markdown.`;

/**
 * A compact picture of a Doqs documentation page: sidebar, article and "On this page". It is deliberately not a second
 * renderer. The sidebar and the table of contents link to the real documentation, the article switches between the
 * Markdown source and a real Angular component (the one `::demo[enter-animation]` places), and everything is plain
 * server-rendered markup, so the landing page loads none of the Doqs runtime.
 */
@Component({
  selector: 'app-product-preview',
  imports: [RouterLink, VoltBadge, VoltTabs, VoltTabsList, VoltTabsTrigger, VoltTabsContent, LmnArrowRightIcon, EnterDemo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <figure class="preview m-0" aria-labelledby="preview-caption">
      <div class="preview-chrome" aria-hidden="true">
        <span></span><span></span><span></span>
        <code class="ml-3 truncate text-xs text-muted-foreground">doqs.andersseen.dev{{ guide }}</code>
      </div>
      <div class="grid lg:grid-cols-[13rem_minmax(0,1fr)_11rem]">
        <nav class="hidden border-r border-border p-4 text-sm lg:block" aria-label="Preview: documentation">
          <p class="m-0 mb-2 font-mono text-[0.68rem] tracking-wider text-muted-foreground uppercase">Guides</p>
          <ul class="m-0 grid list-none gap-0.5 p-0">
            @for (item of sidebar; track item.href) {
              <li>
                <a
                  class="block rounded-md px-2.5 py-1.5 text-muted-foreground no-underline hover:bg-muted hover:text-foreground"
                  [class.preview-current]="item.href === guide"
                  [routerLink]="item.href"
                  [attr.aria-current]="item.href === guide ? 'page' : null"
                  >{{ item.label }}</a
                >
              </li>
            }
          </ul>
        </nav>

        <div class="min-w-0 p-5 sm:p-7">
          <volt-badge variant="secondary" class="font-mono text-[0.68rem] tracking-wider uppercase">Guides</volt-badge>
          <p class="mt-3 mb-1 font-serif text-3xl leading-tight font-bold tracking-tight">Interactive playgrounds</p>
          <p class="m-0 mb-5 text-sm text-muted-foreground">
            Let readers change a real Angular component's inputs, watch its outputs and copy usage code.
          </p>
          <volt-tabs value="rendered">
            <volt-tabs-list class="mb-3 h-auto flex-wrap" aria-label="Preview of the page">
              <volt-tabs-trigger value="rendered">Rendered</volt-tabs-trigger>
              <volt-tabs-trigger value="markdown">Markdown</volt-tabs-trigger>
            </volt-tabs-list>
            <volt-tabs-content value="rendered">
              <div class="rounded-lg border border-border bg-background p-4"><app-enter-demo /></div>
            </volt-tabs-content>
            <volt-tabs-content value="markdown">
              <pre class="m-0 overflow-x-auto rounded-lg border border-border bg-muted p-4 font-mono text-[0.8rem] leading-relaxed" tabindex="0"><code>{{ markdown }}</code></pre>
            </volt-tabs-content>
          </volt-tabs>
        </div>

        <nav class="hidden border-l border-border p-4 text-sm lg:block" aria-label="Preview: on this page">
          <p class="m-0 mb-2 font-mono text-[0.68rem] tracking-wider text-muted-foreground uppercase">On this page</p>
          <ul class="m-0 grid list-none gap-1 p-0">
            @for (item of toc; track item.id) {
              <li>
                <a class="text-muted-foreground no-underline hover:text-foreground" [routerLink]="guide" [fragment]="item.id">{{ item.label }}</a>
              </li>
            }
          </ul>
        </nav>
      </div>
    </figure>
    <p id="preview-caption" class="mt-3 mb-0 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
      <span>A page from the Doqs documentation: real navigation, a real Angular component.</span>
      <a class="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline" [routerLink]="guide">
        Open the full page <lmn-arrow-right [size]="14" />
      </a>
    </p>
  `,
})
export class ProductPreview {
  protected readonly guide = guide;
  protected readonly markdown = markdown;
  protected readonly sidebar = [
    { label: 'Writing Markdown', href: '/docs/guides/writing-markdown' },
    { label: 'Interactive components', href: '/docs/guides/interactive-components' },
    { label: 'Interactive playgrounds', href: guide },
    { label: 'Angular API reference', href: '/docs/guides/api-reference' },
    { label: 'Navigation and search', href: '/docs/guides/navigation-and-search' },
  ] as const;
  protected readonly toc = [
    { id: 'demo-or-playground', label: 'Demo or playground?' },
    { id: 'register', label: 'Register' },
    { id: 'place', label: 'Place' },
    { id: 'controls', label: 'Controls' },
  ] as const;
}

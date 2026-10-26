import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VoltBadge, VoltCard, VoltNativeButton, VoltSkeleton } from '@voltui/components';
import { MoveEnterDirective, MoveLoopDirective } from 'angular-movement';
import { LmnArrowLongDownIcon } from 'lumen-icons/arrow-long-down';
import { LmnBoltIcon } from 'lumen-icons/bolt';
import { LmnDocumentTextIcon } from 'lumen-icons/document-text';
import { LmnMagnifyingGlassIcon } from 'lumen-icons/magnifying-glass';
import { LmnServerStackIcon } from 'lumen-icons/server-stack';

/**
 * The hero illustration: a Markdown file and the page Doqs renders from it, built from Volt atoms and moved by Angular
 * Movement. It only repeats what the text and the documentation preview below say, so it is decorative: hidden from
 * assistive technology and inert, so none of its Volt buttons can take focus.
 */
@Component({
  selector: 'app-hero-stage',
  imports: [
    VoltBadge,
    VoltCard,
    VoltNativeButton,
    VoltSkeleton,
    MoveEnterDirective,
    MoveLoopDirective,
    LmnArrowLongDownIcon,
    LmnBoltIcon,
    LmnDocumentTextIcon,
    LmnMagnifyingGlassIcon,
    LmnServerStackIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', 'aria-hidden': 'true', inert: '' },
  template: `
    <div class="hero-stage relative mx-auto max-w-md pt-4 pb-10 lg:max-w-none lg:pl-6">
      <volt-card class="stage-card relative z-10 overflow-hidden p-0" [moveEnter]="{ y: [24, 0], opacity: [0, 1] }" moveDuration="700ms">
        <div class="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2.5">
          <lmn-document-text [size]="16" tone="primary" />
          <span class="font-mono text-xs text-muted-foreground">docs/guides/buttons.md</span>
        </div>
        <pre class="stage-code m-0 overflow-hidden p-4 font-mono text-[0.78rem] leading-relaxed"><code><span class="tok-muted">---</span>
<span class="tok-key">title</span>: Buttons
<span class="tok-key">order</span>: <span class="tok-num">2</span>
<span class="tok-muted">---</span>

<span class="tok-head"># Buttons</span>

Every variant, rendered live:

<span class="tok-directive">::demo[button-variants]</span></code></pre>
      </volt-card>

      <div class="relative z-20 -my-3 flex justify-center">
        <span class="stage-arrow" [moveLoop]="{ y: [-3, 3] }" moveLoopType="reverse" moveDuration="1200ms">
          <lmn-arrow-long-down [size]="20" tone="primary" background="soft" backgroundTone="primary" [padding]="8" radius="999px" />
        </span>
      </div>

      <volt-card class="stage-card stage-card-front relative z-10 ml-auto w-[92%] p-5" [moveEnter]="{ y: [32, 0], opacity: [0, 1] }" moveDuration="800ms" moveDelay="150ms">
        <volt-badge variant="secondary" class="font-mono text-[0.62rem] tracking-wider uppercase">Guides</volt-badge>
        <p class="mt-2 mb-3 font-serif text-2xl leading-tight font-bold">Buttons</p>
        <volt-skeleton class="block rounded-full" height="0.55rem" width="85%" />
        <volt-skeleton class="mt-2 block rounded-full" height="0.55rem" width="60%" />
        <div class="mt-4 flex flex-wrap gap-2 rounded-lg border border-dashed border-border p-3">
          <button voltButton size="sm" type="button" tabindex="-1">Solid</button>
          <button voltButton size="sm" variant="outline" type="button" tabindex="-1">Outline</button>
          <button voltButton size="sm" variant="ghost" type="button" tabindex="-1">Ghost</button>
        </div>
      </volt-card>

      <span class="stage-chip bottom-1/4 left-0 -translate-x-2 lg:-translate-x-4" [moveLoop]="{ y: [0, -10] }" moveLoopType="reverse" moveDuration="2600ms">
        <volt-badge variant="outline" class="stage-badge"><lmn-server-stack [size]="14" tone="primary" /> SSR + SSG</volt-badge>
      </span>
      <span class="stage-chip top-2 right-0 translate-x-2" [moveLoop]="{ y: [0, 8] }" moveLoopType="reverse" moveDuration="3100ms">
        <volt-badge variant="outline" class="stage-badge"><lmn-magnifying-glass [size]="14" tone="info" /> Static search</volt-badge>
      </span>
      <span class="stage-chip right-6 bottom-0" [moveLoop]="{ y: [0, -7] }" moveLoopType="reverse" moveDuration="2800ms">
        <volt-badge variant="outline" class="stage-badge"><lmn-bolt [size]="14" tone="warning" /> Signals · OnPush</volt-badge>
      </span>
    </div>
  `,
})
export class HeroStage {}

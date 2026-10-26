import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LmnArrowRightIcon } from 'lumen-icons/arrow-right';

/** One section of the examples page: a heading, what it proves, the live example (projected) and the matching guide. */
@Component({
  selector: 'app-example-frame',
  imports: [RouterLink, LmnArrowRightIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section class="border-t border-border py-12 sm:py-16" [attr.aria-labelledby]="id() + '-title'">
      <div class="grid gap-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-12">
        <header>
          <p class="m-0 font-mono text-xs tracking-wider text-primary uppercase">{{ eyebrow() }}</p>
          <h2 [id]="id() + '-title'" class="mt-2 text-[clamp(1.5rem,3vw,2rem)] leading-tight">{{ heading() }}</h2>
          <p class="mt-3 mb-4 text-muted-foreground"><ng-content select="[intro]" /></p>
          <a class="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline" [routerLink]="guide()" [fragment]="guideFragment()">
            {{ guideLabel() }} <lmn-arrow-right [size]="14" />
          </a>
        </header>
        <div class="min-w-0"><ng-content /></div>
      </div>
    </section>
  `,
})
export class ExampleFrame {
  readonly id = input.required<string>();
  readonly eyebrow = input.required<string>();
  readonly heading = input.required<string>();
  readonly guide = input.required<string>();
  readonly guideLabel = input('Read the guide');
  readonly guideFragment = input<string | undefined>(undefined);
}

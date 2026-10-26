import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { VoltBadge } from '@voltui/components';
import { MoveInViewDirective } from 'angular-movement';

/** The site's section opener: a Volt badge eyebrow, an h2 that labels the section, and an optional projected lead. */
@Component({
  selector: 'app-section-heading',
  imports: [VoltBadge, MoveInViewDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div [class]="center() ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'" moveInView="fade-up" [moveInViewOnce]="true" moveDuration="500ms">
      <volt-badge variant="outline" class="eyebrow rounded-full font-mono text-[0.68rem] tracking-[0.14em] uppercase">
        <span class="size-1.5 rounded-full bg-primary" aria-hidden="true"></span>{{ eyebrow() }}
      </volt-badge>
      <h2 [id]="headingId()" class="mt-4 text-[clamp(1.9rem,4vw,2.9rem)] leading-[1.08] font-bold text-balance">{{ heading() }}</h2>
      <div class="mt-4 text-lg text-muted-foreground empty:hidden"><ng-content /></div>
    </div>
  `,
})
export class SectionHeading {
  readonly eyebrow = input.required<string>();
  readonly heading = input.required<string>();
  readonly headingId = input.required<string>();
  readonly center = input(false);
}

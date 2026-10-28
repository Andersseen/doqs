import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DoqVersionLink } from '@doqs/analog/config';
import { DoqI18n } from './doq-i18n';

/**
 * Version selector: a native disclosure whose items are real links, so every destination is a prerendered URL that also works
 * without JavaScript. The active version is announced with `aria-current`; Escape closes the list and returns focus to the summary.
 */
@Component({
  selector: 'doq-version-switcher',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details #disclosure class="doq-version doq-version-switcher" data-pagefind-ignore (keydown.escape)="close(true)">
      <summary class="doq-version-summary"><span class="doq-version-prefix">{{ i18n.t('version.prefix') }}</span> <strong>{{ active()?.label }}</strong></summary>
      <ul class="doq-version-list" [attr.aria-label]="i18n.t('version.listLabel')">
        @for (item of versions(); track item.id) {
          <li>
            <a class="doq-version-link" [routerLink]="i18n.localize(item.href)" [attr.aria-current]="item.active ? 'true' : null" [class.is-active]="item.active" (click)="select()">
              <span>{{ item.label }}</span>
              <small>{{ item.current ? i18n.t('version.current') : i18n.t('version.archived') }}@if (!item.sameDocument) { {{ i18n.t('version.opensIndex') }} }</small>
            </a>
          </li>
        }
      </ul>
    </details>
  `,
})
export class DoqVersionSwitcherComponent {
  readonly versions = input.required<readonly DoqVersionLink[]>();
  /** Emitted after a version link was chosen, so a containing drawer can close. */
  readonly chosen = output<void>();
  readonly i18n = inject(DoqI18n);
  readonly active = computed(() => this.versions().find(item => item.active));
  private readonly disclosure = viewChild.required<ElementRef<HTMLDetailsElement>>('disclosure');

  select(): void {
    this.close(false);
    this.chosen.emit();
  }

  close(restoreFocus: boolean): void {
    const details = this.disclosure().nativeElement;
    if (!details.open) return;
    details.open = false;
    if (restoreFocus) details.querySelector<HTMLElement>('summary')?.focus();
  }
}

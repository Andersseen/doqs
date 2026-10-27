import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DoqLocaleLink } from '@doqs/analog/config';
import { DoqI18n } from './doq-i18n';

/**
 * Language selector: a native disclosure whose items are real links, so every destination is a
 * prerendered URL that also works without JavaScript and no locale state is duplicated.
 *
 * A locale that does not publish the current document links to that locale's index and says so, rather
 * than pretending a translation exists. When the host provides `switchLocale` the links stay links —
 * the URL remains the source of truth — and the host hook is only used for a switcher Doqs does not
 * render itself.
 */
@Component({
  selector: 'doq-locale-switcher',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details #disclosure class="doq-version doq-locale" data-pagefind-ignore (keydown.escape)="close(true)">
      <summary class="doq-version-summary doq-locale-summary"><span class="doq-version-prefix">{{ i18n.t('locale.prefix') }}</span> <strong>{{ active()?.label }}</strong></summary>
      <ul class="doq-version-list" [attr.aria-label]="i18n.t('locale.listLabel')">
        @for (item of locales(); track item.id) {
          <li>
            <a class="doq-version-link" [routerLink]="i18n.localize(item.href, item.id)" [attr.aria-current]="item.active ? 'true' : null" [attr.hreflang]="item.id" [attr.lang]="item.id" [class.is-active]="item.active" (click)="select()">
              <span>{{ item.label }}</span>
              @if (!item.sameDocument) { <small>{{ i18n.t('locale.opensIndex') }}</small> }
            </a>
          </li>
        }
      </ul>
    </details>
  `,
})
export class DoqLocaleSwitcherComponent {
  readonly locales = input.required<readonly DoqLocaleLink[]>();
  /** Emitted after a language link was chosen, so a containing drawer can close. */
  readonly chosen = output<void>();
  readonly i18n = inject(DoqI18n);
  readonly active = computed(() => this.locales().find(item => item.active));
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

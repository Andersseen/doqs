import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { DOQ_CONFIG } from '@doqs/analog/config';
import { createLatestGate, DoqSearchResult, normalizeDoqSearchConfig } from '@doqs/analog/config';
import { DoqLocaleNotIndexedError, DoqSearchService, DoqVersionNotIndexedError } from './doq-search.service';
import { DoqI18n } from './doq-i18n';
import { DoqVersion } from '@doqs/analog/config';

type SearchStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'unavailable' | 'unindexed' | 'unindexedLocale' | 'invalidLocaleIndex';

const DEBOUNCE_MS = 120;

/**
 * Search trigger and modal dialog for Doq documentation views. It renders nothing visible beyond the trigger until
 * opened and loads the static index only when the reader types. Mount it only when `search.enabled` is true.
 */
@Component({
  selector: 'doq-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button #trigger class="doq-search-trigger" type="button" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" (click)="show()">
      <span>{{ i18n.t('search.trigger') }}</span><kbd aria-hidden="true">{{ shortcutHint() }}</kbd>
    </button>
    <dialog #dialog class="doq-search-dialog" aria-labelledby="doq-search-title" (close)="reset()" (click)="dismissOnBackdrop($event)" (keydown)="onKeydown($event)">
      <h2 id="doq-search-title" class="doq-search-title">{{ i18n.t('search.dialogTitle') }}</h2>
      <form class="doq-search-form" role="search" (submit)="$event.preventDefault(); openFirst()">
        <label class="doq-visually-hidden" for="doq-search-input">{{ i18n.t('search.label') }}</label>
        <input #input id="doq-search-input" class="doq-search-input" type="search" autocomplete="off" spellcheck="false" [placeholder]="i18n.t('search.placeholder')" [value]="query()" (input)="onInput(input.value)" />
        <button class="doq-search-close" type="button" (click)="close()">{{ i18n.t('search.close') }}</button>
      </form>
      <p class="doq-search-status" role="status" [class.is-error]="status() === 'unavailable' || status() === 'unindexed'">{{ statusText() }}</p>
      @if (results().length) {
        <ul class="doq-search-results" [attr.aria-label]="i18n.t('search.resultsLabel')">
          @for (result of results(); track result.url + $index) {
            <li>
              <a class="doq-search-result" [href]="result.url" (click)="choose($event, result)">
                <span class="doq-search-result-title">{{ result.title }}@if (result.section) { <span class="doq-search-result-section"> › {{ result.section }}</span> }</span>
                <span class="doq-search-result-excerpt">@for (segment of result.excerpt; track $index) {@if (segment.mark) {<mark>{{ segment.text }}</mark>} @else {<span>{{ segment.text }}</span>}}</span>
              </a>
            </li>
          }
        </ul>
      }
    </dialog>
  `,
})
export class DoqSearchComponent {
  /** Version being read on a versioned site; results are filtered to it. Omit on an unversioned site. */
  readonly version = input<DoqVersion>();
  /** Locale being read on a localized site; results are filtered to it so no cross-language rows appear. */
  readonly locale = input<string>();
  private readonly config = inject(DOQ_CONFIG);
  readonly i18n = inject(DoqI18n);
  private readonly search = normalizeDoqSearchConfig(this.config.search);
  private readonly service = inject(DoqSearchService);
  private readonly router = inject(Router);
  private readonly documentRef = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly gate = createLatestGate();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private opener: Element | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  readonly query = signal('');
  readonly status = signal<SearchStatus>('idle');
  readonly results = signal<DoqSearchResult[]>([]);
  readonly shortcutHint = signal('Ctrl K');

  constructor() {
    afterNextRender(() => {
      if (/Mac|iPhone|iPad/.test(this.documentRef.defaultView?.navigator.platform ?? '')) this.shortcutHint.set('⌘K');
      const listener = (event: KeyboardEvent) => this.onGlobalKeydown(event);
      this.documentRef.addEventListener('keydown', listener);
      this.destroyRef.onDestroy(() => this.documentRef.removeEventListener('keydown', listener));
    });
    this.destroyRef.onDestroy(() => { clearTimeout(this.timer); this.gate.cancel(); });
  }

  statusText(): string {
    switch (this.status()) {
      case 'loading': return this.i18n.t('search.loading');
      case 'ready': {
        const count = this.results().length;
        return this.i18n.t(count === 1 ? 'search.resultOne' : 'search.resultMany', { count });
      }
      case 'empty': return this.i18n.t('search.empty', { query: this.query().trim() });
      case 'unindexed': return this.i18n.t('search.unindexed', { version: this.version()?.label ?? 'this version' });
      case 'invalidLocaleIndex': return this.i18n.t('search.invalidLocaleIndex');
      case 'unindexedLocale': return this.i18n.t('search.localeNotIndexed', { locale: this.locale() ?? this.i18n.locale() });
      case 'unavailable': return this.i18n.t('search.unavailable');
      default: return this.i18n.t('search.idle');
    }
  }

  show(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) return;
    this.opener = this.documentRef.activeElement;
    dialog.showModal();
    this.input().nativeElement.focus();
    this.input().nativeElement.select();
  }

  close(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) dialog.close();
  }

  /** Cancels pending work when the dialog closes by any route (Escape, Close, backdrop, navigation). */
  reset(): void {
    clearTimeout(this.timer);
    this.gate.cancel();
    // The dialog restores focus to its opener; when the shortcut opened it from the page itself, use the trigger.
    const opener = this.opener;
    this.opener = null;
    if (!opener || opener === this.documentRef.body || !opener.isConnected) this.trigger().nativeElement.focus();
  }

  onInput(value: string): void {
    this.query.set(value);
    clearTimeout(this.timer);
    if (!value.trim()) {
      this.gate.cancel();
      this.results.set([]);
      this.status.set('idle');
      return;
    }
    const ticket = this.gate.next();
    this.status.set('loading');
    this.timer = setTimeout(() => void this.run(value.trim(), ticket), DEBOUNCE_MS);
  }

  choose(event: MouseEvent, result: DoqSearchResult): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    this.open(result);
  }

  openFirst(): void {
    const first = this.results()[0];
    if (first) this.open(first);
  }

  dismissOnBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // A search field would otherwise use the first Escape to clear its text and leave the dialog open.
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const links = Array.from(this.dialog().nativeElement.querySelectorAll<HTMLElement>('.doq-search-result'));
    if (!links.length) return;
    const index = links.indexOf(this.documentRef.activeElement as HTMLElement);
    event.preventDefault();
    if (event.key === 'ArrowDown') links[Math.min(index + 1, links.length - 1)]?.focus();
    else if (index <= 0) this.input().nativeElement.focus();
    else links[index - 1]?.focus();
  }

  private open(result: DoqSearchResult): void {
    this.close();
    void this.router.navigateByUrl(result.url).then(() => this.focusFragmentTarget(result.url));
  }

  /** Same-document results: the heading is already rendered, so move focus to it like a followed in-page link. */
  private focusFragmentTarget(url: string): void {
    const id = decodeURIComponent(url.split('#')[1] ?? '');
    const target = id ? this.documentRef.querySelector<HTMLElement>('.doq-markdown')?.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`) : null;
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  private async run(query: string, ticket: number): Promise<void> {
    try {
      const version = this.version();
      const results = await this.service.search(query, this.search.bundlePath, version?.basePath ?? this.config.basePath ?? '/docs', version?.id, this.locale());
      if (!this.gate.isCurrent(ticket)) return;
      this.results.set(results);
      this.status.set(results.length ? 'ready' : 'empty');
    } catch (error) {
      if (!this.gate.isCurrent(ticket)) return;
      this.results.set([]);
      this.status.set(error instanceof DoqLocaleNotIndexedError ? error.reason === 'missing-metadata' ? 'invalidLocaleIndex' : 'unindexedLocale' : error instanceof DoqVersionNotIndexedError ? 'unindexed' : 'unavailable');
    }
  }

  private onGlobalKeydown(event: KeyboardEvent): void {
    if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.defaultPrevented) return;
    const target = event.target as HTMLElement | null;
    const inDialog = !!target && this.dialog().nativeElement.contains(target);
    const editable = !!target && !inDialog && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if (editable) return;
    event.preventDefault();
    if (!this.dialog().nativeElement.open) this.show();
  }
}

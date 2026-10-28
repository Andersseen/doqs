import { computed, inject, Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import {
  DOQ_DEFAULT_MESSAGES,
  DOQ_I18N_ADAPTER,
  DoqI18nAdapter,
  DoqMessageKey,
  DoqMessageParams,
  DoqResolvedI18n,
  DoqResolvedLocale,
  DoqTextDirection,
  formatDoqMessage,
} from '@doqs/analog/config';
import { DOQ_CONFIG } from '@doqs/analog/config';
import { normalizeDoqPathsFull } from '@doqs/analog/config';
import { resolveDoqCopy } from './doq-catalog';

/**
 * Doqs's own interface text and locale state.
 *
 * Two independent questions are kept apart here. *Which locale is active* belongs to the host: it comes
 * from the injected adapter when there is one, and otherwise from the URL prefix Doqs's own routing
 * wrote — both are derived, so Doqs never holds a second copy of the host's locale state and there is
 * no mutable global to fall out of sync during SSR. *What the chrome says* belongs to Doqs: the English
 * defaults live in `DOQ_DEFAULT_MESSAGES` and an adapter may override any of them.
 *
 * Provided by the documentation views rather than at root, because `DOQ_CONFIG` is routinely provided in
 * a lazy route's injector (the official site does exactly that) and a root-provided service could not
 * see it. Child controls resolve this instance from the view's injector.
 *
 * With no adapter and no `i18n` configuration this resolves to fixed English and identity links, which
 * is exactly the 0.11 behavior.
 */
@Injectable()
export class DoqI18n {
  private readonly config = inject(DOQ_CONFIG);
  private readonly adapter: DoqI18nAdapter | null = inject(DOQ_I18N_ADAPTER, { optional: true });
  private readonly paths = normalizeDoqPathsFull(this.config);
  readonly i18n: DoqResolvedI18n | undefined = this.paths.i18n;
  /** True when the configuration publishes more than one locale. */
  readonly localized = !!this.i18n && this.i18n.locales.length > 1;
  /** Host route ownership is explicit and independent of how many locales Doqs publishes. */
  readonly hostOwnsRouting = this.adapter?.ownsRouting === true;
  private readonly copy = resolveDoqCopy(this.config);

  private readonly router = inject(Router);
  /** The URL after each completed navigation; the initial value covers SSR and the first client render. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** The locale entry the active URL belongs to, or the single synthetic entry of an unlocalized site. */
  readonly localeEntry = computed<DoqResolvedLocale | undefined>(() => {
    if (!this.i18n) return undefined;
    const id = this.adapter ? this.adapter.locale() : this.localeFromUrl(this.url() ?? '');
    return this.i18n.locales.find(locale => locale.id.toLowerCase() === (id ?? '').toLowerCase()) ?? this.defaultLocaleEntry;
  });

  readonly defaultLocaleEntry: DoqResolvedLocale | undefined = this.i18n?.locales.find(locale => locale.default);

  /** Active BCP 47 locale id; `''` on an unlocalized site, where nothing may write `<html lang>`. */
  readonly locale: Signal<string> = computed(() => {
    if (this.adapter) return this.adapter.locale();
    return this.localeEntry()?.id ?? '';
  });

  readonly direction: Signal<DoqTextDirection> = computed(() => this.adapter?.direction() ?? this.localeEntry()?.dir ?? 'ltr');

  /**
   * One Doqs-owned interface string. `override` is host-authored copy (from `presentation`) that takes
   * the place of the English default; an adapter that does not know the key returns it unchanged, so a
   * product-specific label survives a partial translation.
   */
  t(key: DoqMessageKey, params?: DoqMessageParams, override?: string): string {
    const fallback = override ?? DOQ_DEFAULT_MESSAGES[key];
    return this.adapter ? formatDoqMessage(this.adapter.translate(key, fallback, params), params) : formatDoqMessage(fallback, params);
  }

  /** The public URL of an in-app documentation path, locale-prefixed by whoever owns routing. */
  localize(path: string, locale?: string): string {
    if (this.adapter?.ownsRouting) return this.adapter.localize(path, locale);
    if (!this.i18n) return this.adapter ? this.adapter.localize(path, locale) : path;
    const knownPrefix = this.i18n.locales.find(candidate => !candidate.default && path.startsWith(`${candidate.prefix}/`));
    if (knownPrefix) return path;
    const target = this.i18n.locales.find(candidate => candidate.id === (locale ?? this.locale()));
    return target && !target.default ? `${target.prefix}${path.startsWith('/') ? path : `/${path}`}` : path;
  }

  /** Ask the host to switch language; undefined when the host has no switcher, so Doqs renders links. */
  readonly switchLocale: ((locale: string) => void | Promise<void>) | undefined = this.adapter?.switchLocale?.bind(this.adapter);

  /** True when the host already writes `<html lang>`, `dir`, canonical and hreflang. */
  readonly hostOwnsHead = this.adapter?.ownsHead === true;

  /**
   * Presentation copy with the same precedence the templates already had: an explicit `presentation`
   * value wins over the English default, and an adapter may translate either.
   */
  readonly label = computed(() => this.t('documentation.label', undefined, this.copy.label === 'Documentation' ? undefined : this.copy.label));
  readonly breadcrumbRoot = computed(() => this.t('documentation.breadcrumbRoot', undefined, this.copy.breadcrumbRoot === 'Docs' ? undefined : this.copy.breadcrumbRoot));
  readonly indexTitle = computed(() => this.t('index.title', undefined, this.copy.hasIndexTitle ? this.copy.indexTitle : undefined));
  readonly indexDescription = computed(() => this.t('index.description', undefined, this.copy.hasIndexDescription ? this.copy.indexDescription : undefined));
  readonly pageTitleSuffix = this.copy.pageTitleSuffix;

  /** The locale id a URL's first segment names, or the default locale when it names none. */
  private localeFromUrl(url: string): string {
    if (!this.i18n) return '';
    const first = url.split('?')[0].split('#')[0].split('/').filter(Boolean)[0];
    const match = first && this.i18n.locales.find(locale => !locale.default && locale.id.toLowerCase() === first.toLowerCase());
    return match ? match.id : this.i18n.defaultLocale;
  }
}

import { InjectionToken, Provider, Signal, signal } from '@angular/core';
import { DoqTextDirection } from './doq-i18n';

/**
 * The provider-agnostic i18n contract.
 *
 * Doqs owns documentation content and its own UI text. The host owns its translation provider, its
 * locale routing and its locale lifecycle. This interface is the whole boundary between them: it is
 * small enough to implement against any provider (Etyma, Transloco, ngx-translate, a hand-rolled
 * signal) and it never asks a host to hand over its locale state.
 *
 * Nothing here is mandatory. An application that provides no adapter gets English chrome, no language
 * switcher and unprefixed URLs — exactly the 0.11 behavior.
 */
export interface DoqI18nAdapter {
  /**
   * The active BCP 47 locale id, as a signal so Doqs chrome re-renders when the host switches language.
   * Must return the same value on the server and the client for one request, or hydration mismatches.
   */
  readonly locale: Signal<string>;
  /** Text direction of the active locale, for `<html dir>` and logical-property layouts. */
  readonly direction: Signal<DoqTextDirection>;
  /**
   * Translate one Doqs-owned interface key. `fallback` is Doqs's English default and must be returned
   * unchanged when the key is missing, so a partially translated catalog degrades to readable text
   * instead of showing raw keys. `params` values are substituted into `{name}` placeholders by Doqs;
   * the result is always bound as text, never as HTML.
   */
  translate(key: string, fallback: string, params?: DoqMessageParams): string;
  /**
   * The public URL of an in-app documentation path in `locale` (default: the active one).
   *
   * Every link Doqs renders goes through this. A host that owns localized routing — Etyma's
   * `withLocalizedRoutes()`, for example — returns the prefixed path here and Doqs never builds a
   * competing locale router; a host that does not gets the identity function from Doqs's own routing.
   */
  localize(path: string, locale?: string): string;
  /**
   * Ask the host to switch language. Provided only when the host has a switcher of its own; when it is
   * absent Doqs renders a plain link list instead of a control, so the URL stays the source of truth.
   */
  switchLocale?(locale: string): void | Promise<void>;
  /**
   * True when the host already writes `<html lang>`, `<html dir>`, the canonical link and the
   * `hreflang` set — `provideEtymaAnalog()` does, by default. Doqs then leaves the document head
   * alone, which is what keeps two owners from fighting over the same elements.
   */
  readonly ownsHead?: boolean;
}

export type DoqMessageParams = Readonly<Record<string, string | number>>;

/** Injected adapter, or `undefined` when the host provides none. */
export const DOQ_I18N_ADAPTER = new InjectionToken<DoqI18nAdapter>('DOQ_I18N_ADAPTER');

/** Provide a host-owned adapter. Additive: omitting it keeps English chrome and unprefixed URLs. */
export function provideDoqI18n(adapter: DoqI18nAdapter): Provider {
  return { provide: DOQ_I18N_ADAPTER, useValue: adapter };
}

/**
 * Every Doqs-owned interface string, with its English default.
 *
 * These are the defaults, not a catalog: Doqs ships no translations of its own beyond them, and a host
 * that wants Spanish or Ukrainian chrome supplies them through the adapter. Keys are stable public
 * contract — renaming one silently breaks every existing catalog.
 *
 * `{name}` placeholders are filled by `formatDoqMessage`. Values are always rendered as text.
 */
export const DOQ_DEFAULT_MESSAGES = {
  'documentation.label': 'Documentation',
  'documentation.breadcrumbRoot': 'Docs',
  'documentation.loading': 'Loading documentation…',
  'index.title': 'Explore the docs',
  'index.description': 'Browse guides and references for this product.',
  'index.readGuide': 'Read guide →',
  'nav.menu': '{label} menu',
  'nav.close': 'Close navigation',
  'nav.overview': 'Overview',
  'toc.title': 'On this page',
  'pagination.previous': 'Previous',
  'pagination.next': 'Next',
  'notFound.title': 'Documentation page not found',
  'notFound.pageTitle': 'Page not found',
  'notFound.body': 'This page may have moved or does not exist.',
  'notFound.browse': 'Browse documentation',
  'search.trigger': 'Search',
  'search.dialogTitle': 'Search documentation',
  'search.label': 'Search the documentation',
  'search.placeholder': 'Search the documentation',
  'search.close': 'Close',
  'search.resultsLabel': 'Search results',
  'search.idle': 'Type to search the documentation.',
  'search.loading': 'Searching…',
  'search.resultOne': '{count} result',
  'search.resultMany': '{count} results',
  'search.empty': 'No results for “{query}”.',
  'search.unindexed': 'Search has no index for {version}. Rebuild the search index.',
  'search.unavailable': 'Search is unavailable right now. The search index could not be loaded.',
  'version.prefix': 'Version',
  'version.listLabel': 'Documentation versions',
  'version.current': 'current',
  'version.archived': 'archived',
  'version.opensIndex': '· opens the index',
  'version.noticePrefix': 'You are reading the',
  'version.noticeSuffix': 'documentation, an archived version.',
  'version.viewCurrent': 'View {label}',
  'locale.listLabel': 'Documentation languages',
  'locale.prefix': 'Language',
  'locale.opensIndex': '· opens the index',
  'locale.untranslatedNotice': 'This page is not translated yet. You are reading it in {label}.',
  'code.copy': 'Copy',
  'code.copied': 'Copied',
  'code.copyUnavailable': 'Copy unavailable',
  'code.copyLabel': 'Copy code',
  'code.copiedLabel': 'Code copied',
  'code.copyUnavailableLabel': 'Clipboard access unavailable',
  'table.scrollableLabel': 'Scrollable table',
  'demo.notRegistered': 'Demo “{id}” is not registered by this application.',
  'playground.notRegistered': 'Playground “{id}” is not registered by this application.',
  'playground.previewWidth': 'Preview width',
  'playground.reset': 'Reset',
  'playground.expand': 'Expand',
  'playground.close': 'Close',
  'playground.inputs': 'Inputs',
  'playground.notSet': 'Not set',
  'playground.events': 'Events',
  'playground.clearEvents': 'Clear',
  'playground.noEvents': 'No events yet. Interact with the preview to see them here.',
  'playground.usageCode': 'Usage code',
  'playground.resetAnnouncement': 'Playground reset to its initial values.',
  'playground.previewAnnouncement': 'Preview width: {label}, {width}.',
  'playground.previewFullWidth': 'full width',
  'playground.copy': 'Copy',
  'playground.copied': 'Copied',
  'playground.copyUnavailable': 'Copy unavailable',
  'playground.copyLabel': 'Copy {label} code',
  'playground.copiedLabel': '{label} code copied',
  'playground.copyUnavailableLabel': 'Clipboard access unavailable',
  'playground.clipboardUnavailable': 'Clipboard access is unavailable.',
} as const satisfies Record<string, string>;

export type DoqMessageKey = keyof typeof DOQ_DEFAULT_MESSAGES;

/** Substitute `{name}` placeholders. Unknown placeholders are left as written rather than blanked. */
export function formatDoqMessage(message: string, params?: DoqMessageParams): string {
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/**
 * The adapter Doqs uses when the host provides none: fixed English, no direction change, and identity
 * link resolution. Exported so a host can extend it instead of writing an adapter from scratch.
 */
export function createDoqStaticI18nAdapter(locale = '', direction: DoqTextDirection = 'ltr'): DoqI18nAdapter {
  const localeSignal = signal(locale);
  const directionSignal = signal(direction);
  return {
    locale: localeSignal.asReadonly(),
    direction: directionSignal.asReadonly(),
    translate: (_key, fallback, params) => formatDoqMessage(fallback, params),
    localize: path => path,
  };
}

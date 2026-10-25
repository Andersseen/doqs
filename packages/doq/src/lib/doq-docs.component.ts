import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, PendingTasks, PLATFORM_ID, RESPONSE_INIT, signal, Type, untracked } from '@angular/core';
import { DOCUMENT, isPlatformBrowser, isPlatformServer, NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, Router, RouterLink } from '@angular/router';
import { catchError, finalize, from, map, of, startWith, switchMap } from 'rxjs';
import { ContentRenderer, injectContentFilesMap, MarkdownComponent, parseRawContentFile } from '@analogjs/content';
import { injectDoqCatalog, injectDoqCatalogs, injectDoqDocuments, injectDoqLocaleCatalogs, resolveDoqCopy } from './doq-catalog';
import { DOQ_CONFIG, DOQ_LOCALE_FILTER, DOQ_VERSION_FILTER } from '@doqs/analog/config';
import { doqPageTitle, DoqPageMetadata } from './doq-metadata';
import { DoqButtonDemoComponent } from './doq-demo.component';
import { DoqI18n } from './doq-i18n';
import { DoqLocaleSwitcherComponent } from './doq-locale-switcher.component';
import { DoqNavigationNode, DoqNavigationTreeComponent } from './doq-nav-tree.component';
import { DoqPlaygroundComponent } from './doq-playground.component';
import { DoqPlaygroundDefinition } from '@doqs/analog/config';
import { DoqSearchComponent } from './doq-search.component';
import { DoqVersionSwitcherComponent } from './doq-version-switcher.component';
import { doqCanonicalUrl, doqLocaleLinks, doqVersionLinks, getDoqVersions } from '@doqs/analog/config';
import { normalizeDoqPaths } from '@doqs/analog/config';
import { parseDoqContent, parseDoqDocument } from './doq-rich-content';
import { DoqTabsComponent } from './doq-tabs.component';

interface DocAttributes { title?: string; description?: string; order?: number; group?: string; slug?: string; demo?: string; }

@Component({
  selector: 'doq-docs',
  standalone: true,
  providers: [DoqI18n],
  imports: [RouterLink, MarkdownComponent, DoqButtonDemoComponent, DoqPlaygroundComponent, DoqNavigationTreeComponent, DoqSearchComponent, DoqTabsComponent, DoqVersionSwitcherComponent, DoqLocaleSwitcherComponent, NgComponentOutlet, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #notFound><h1>{{ i18n.t('notFound.title') }}</h1><p>{{ i18n.t('notFound.body') }}</p><a [routerLink]="localize(catalog.basePath)">{{ i18n.t('notFound.browse') }}</a></ng-template>
    @if (document(); as doc) {
      @if (doc.attributes.title) {
      <ng-template #body>
        @if (config.sidebar !== 'hidden') {
        <button class="doq-mobile-trigger" type="button" aria-controls="doq-mobile-navigation" [attr.aria-expanded]="mobileNavigationOpen()" (click)="toggleMobileNavigation()">{{ i18n.t('nav.menu', { label: navLabel() }) }}</button>
        <nav id="doq-mobile-navigation" class="doq-sidebar" [class.is-open]="mobileNavigationOpen()" [attr.aria-label]="navLabel()" (keydown.escape)="closeMobileNavigation()">
          <button class="doq-mobile-close" type="button" (click)="closeMobileNavigation()">{{ i18n.t('nav.close') }}</button>
          @if (versionLinks().length > 1) { <doq-version-switcher [versions]="versionLinks()" (chosen)="closeMobileNavigation()" /> }
          @if (localeLinks().length > 1) { <doq-locale-switcher [locales]="localeLinks()" (chosen)="closeMobileNavigation()" /> }
          <a class="doq-overview" [routerLink]="localize(catalog.basePath)" (click)="closeMobileNavigation()">{{ i18n.t('nav.overview') }}</a>
          <doq-nav-tree [nodes]="navigationTree()" (navigate)="closeMobileNavigation()" />
        </nav>
        }
        @if (config.showTableOfContents && headings().length) {
          <aside class="doq-toc" [attr.aria-label]="i18n.t('toc.title')" data-pagefind-ignore>
            <p>{{ i18n.t('toc.title') }}</p>
            @for (heading of headings(); track heading.id) { <a [routerLink]="[]" [fragment]="heading.id" [class.level-three]="heading.level === 3" [class.is-active]="activeHeading() === heading.id">{{ heading.text }}</a> }
          </aside>
        }
        <article class="doq-article" data-pagefind-body [attr.data-pagefind-filter]="pagefindFilter()">
          @if (untranslatedFallback()) {
            <p class="doq-version-notice" role="note" data-pagefind-ignore>{{ i18n.t('locale.untranslatedNotice', { label: defaultLocaleLabel() }) }}</p>
          }
          @if (versioned && !catalog.current) {
            <p class="doq-version-notice" role="note" data-pagefind-ignore>{{ i18n.t('version.noticePrefix') }} <strong>{{ catalog.version.label }}</strong> {{ i18n.t('version.noticeSuffix') }} <a [routerLink]="localize(versionLinks()[0]?.href ?? catalog.basePath)">{{ i18n.t('version.viewCurrent', { label: currentVersionLabel() }) }}</a></p>
          }
          <div class="doq-topbar" data-pagefind-ignore>
            <div class="doq-breadcrumb"><a [routerLink]="localize(catalog.basePath)">{{ i18n.breadcrumbRoot() }}@if (versioned && !catalog.current) { ({{ catalog.version.label }}) }</a><span>/</span><span>{{ doc.attributes.title }}</span></div>
            @if (versionLinks().length > 1 && config.sidebar === 'hidden') { <doq-version-switcher [versions]="versionLinks()" /> }
            @if (localeLinks().length > 1 && config.sidebar === 'hidden') { <doq-locale-switcher [locales]="localeLinks()" /> }
            @if (config.search?.enabled) { <doq-search [version]="searchVersion" [locale]="searchLocale" /> }
          </div>
          <header class="doq-doc-header"><p class="doq-eyebrow" data-pagefind-ignore>{{ doc.attributes.group || navLabel() }}</p><h1 tabindex="-1">{{ doc.attributes.title }}</h1>@if (doc.attributes.description) { <p class="doq-description">{{ doc.attributes.description }}</p> }</header>
          <div class="doq-content">
            @for (segment of parts(); track $index) {
              @if (segment.kind === 'html') { <analog-markdown class="doq-markdown" [content]="segment.html" /> }
              @else if (segment.kind === 'tabs') { <doq-tabs [uid]="'doq-tabs-' + $index" [label]="segment.label" [tabs]="segment.tabs" [codeOnly]="segment.codeOnly" /> }
              @else if (segment.kind === 'playground') {
                @if (playgroundDefinition(segment.id); as definition) { <doq-playground [uid]="'doq-playground-' + $index" [playgroundId]="segment.id" [definition]="definition" /> }
                @else { <p class="doq-demo-fallback" data-pagefind-ignore role="status">{{ i18n.t('playground.notRegistered', { id: segment.id }) }}</p> }
              }
              @else {
                <div class="doq-region doq-inline-demo" data-pagefind-ignore [attr.data-doq-demo]="segment.id">
                @if (demoComponent(segment.id); as demo) { <ng-container *ngComponentOutlet="demo" /> }
                @else { <p class="doq-demo-fallback" role="status">{{ i18n.t('demo.notRegistered', { id: segment.id }) }}</p> }
                </div>
              }
            }
          </div>
          @if (trailingDemo(); as demoId) {
            <div class="doq-region" data-pagefind-ignore>
            @if (demoComponent(demoId); as demo) { <ng-container *ngComponentOutlet="demo" /> }
            @else { <p class="doq-demo-fallback" role="status">{{ i18n.t('demo.notRegistered', { id: demoId }) }}</p> }
            </div>
          }
          @if (config.slots?.documentAfterContent; as slot) { <div class="doq-region" data-pagefind-ignore><ng-container *ngComponentOutlet="slot" /></div> }
          <nav class="doq-pagination" aria-label="Page navigation" data-pagefind-ignore>
            @if (previous(); as prev) { <a [routerLink]="localize(prev.routePath)"><span>{{ i18n.t('pagination.previous') }}</span><strong>← {{ prev.title }}</strong></a> }
            @if (next(); as nxt) { <a class="next" [routerLink]="localize(nxt.routePath)"><span>{{ i18n.t('pagination.next') }}</span><strong>{{ nxt.title }} →</strong></a> }
          </nav>
        </article>
      </ng-template>
      @if (config.landmark === 'host') { <div class="doq-root" [style.--doq-content-width]="config.contentWidth" [style.--doq-sidebar-width]="config.sidebarWidth" [attr.data-sidebar]="config.sidebar" [attr.data-toc]="tocEnabled() ? 'shown' : 'none'" [attr.data-doq-version]="versioned ? catalog.version.id : null" [attr.data-doq-locale]="catalog.locale.id || null" [attr.dir]="dirAttribute()"><ng-container *ngTemplateOutlet="body" /></div> }
      @else { <main class="doq-root" [style.--doq-content-width]="config.contentWidth" [style.--doq-sidebar-width]="config.sidebarWidth" [attr.data-sidebar]="config.sidebar" [attr.data-toc]="tocEnabled() ? 'shown' : 'none'" [attr.data-doq-version]="versioned ? catalog.version.id : null" [attr.data-doq-locale]="catalog.locale.id || null" [attr.dir]="dirAttribute()"><ng-container *ngTemplateOutlet="body" /></main> }
      } @else { @if (config.landmark === 'host') { <div class="doq-not-found"><ng-container *ngTemplateOutlet="notFound" /></div> } @else { <main class="doq-not-found"><ng-container *ngTemplateOutlet="notFound" /></main> } }
    } @else if (document() === undefined) { <div class="doq-loading" aria-live="polite">{{ i18n.t('documentation.loading') }}</div> }
    @else { @if (config.landmark === 'host') { <div class="doq-not-found"><ng-container *ngTemplateOutlet="notFound" /></div> } @else { <main class="doq-not-found"><ng-container *ngTemplateOutlet="notFound" /></main> } }
  `,
})
export class DoqDocsComponent {
  readonly config = inject(DOQ_CONFIG);
  readonly i18n = inject(DoqI18n);
  /** The (locale, version) tree this route renders. Document identity is always all three of locale, version and slug. */
  readonly catalog = injectDoqCatalog(this.config);
  readonly versioned = !!normalizeDoqPaths(this.config).versioning;
  readonly activeHeading = signal('');
  readonly mobileNavigationOpen = signal(false);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly routeSlug = toSignal(this.route.paramMap.pipe(map(params => params.get(this.config.routeParam ?? 'slug') ?? '')), { initialValue: '' });
  readonly fragment = toSignal(this.route.fragment, { initialValue: null });
  /** True once the current document's Markdown is in the DOM, so fragment targets exist. */
  private readonly rendered = signal(false);
  private navigationTrigger: string | undefined;
  private lastSlug = this.routeSlug();
  private currentNavigationId?: number;
  private restoreNavigationId?: number;
  private scrollPositions = new Map<number, number>();
  private restorePosition?: number;
  /** Set for an in-app document change: start at the top and move focus once the new document is rendered. */
  private arrival = this.router.navigated && this.router.currentNavigation()?.trigger === 'imperative';
  private readonly trackNavigation = this.router.events.pipe(takeUntilDestroyed()).subscribe(event => {
    if (event instanceof NavigationStart) {
      // On Back/Forward the browser may already have restored the destination's scroll, so use the last position the reader had.
      const leavingScroll = event.navigationTrigger === 'popstate' ? this.lastScrollY : this.documentRef.defaultView?.scrollY ?? 0;
      if (this.currentNavigationId !== undefined) this.scrollPositions.set(this.currentNavigationId, leavingScroll);
      this.navigationTrigger = event.navigationTrigger;
      this.restoreNavigationId = event.restoredState?.navigationId;
      this.restorePosition = undefined;
    } else if (event instanceof NavigationCancel || event instanceof NavigationError || event instanceof NavigationSkipped) {
      this.traversing = false;
    } else if (event instanceof NavigationEnd) {
      this.traversing = false;
      this.currentNavigationId = event.id;
      const slug = this.routeSlug();
      const documentChanged = slug !== this.lastSlug;
      this.lastSlug = slug;
      const navigation = this.hostElement.querySelector<HTMLElement>('.doq-sidebar');
      const focusWasInNavigation = !!navigation?.contains(this.documentRef.activeElement);
      this.mobileNavigationOpen.set(false);
      if (this.navigationTrigger === 'popstate' && this.restoreNavigationId !== undefined) this.restorePosition = this.scrollPositions.get(this.restoreNavigationId);
      if (documentChanged && this.navigationTrigger === 'imperative') this.arrival = true;
      else if (focusWasInNavigation && !documentChanged) this.hostElement.querySelector<HTMLElement>('.doq-mobile-trigger')?.focus();
    }
  });
  private readonly copy = resolveDoqCopy(this.config);
  private readonly canonicalVersioning = normalizeDoqPaths(this.config).versioning;
  /** Every configured version, current first; the locale never changes this list. */
  private readonly versions = getDoqVersions(normalizeDoqPaths(this.config));
  readonly documents = this.unknownVersion() ? [] : injectDoqDocuments(this.config, this.catalog.version.id, this.catalog.locale.id || undefined);
  /** Catalogs of every version of *this* locale: the version switcher must never leave the language. */
  private readonly versionCatalogs = this.versioned && !this.unknownVersion() ? injectDoqCatalogs(this.config, this.catalog.locale.id || undefined) : {};
  /** Catalogs of every locale for *this* version: the language switcher must never leave the version. */
  private readonly localeCatalogs = this.i18n.localized ? injectDoqLocaleCatalogs(this.config, this.catalog.version.id) : {};
  readonly versionLinks = computed(() => this.versioned ? doqVersionLinks(this.versionList(), this.catalog.version.id, this.ownSlug(), this.versionCatalogs) : []);
  readonly localeLinks = computed(() => this.i18n.i18n ? doqLocaleLinks(this.i18n.i18n, this.catalog.locale.id, this.catalog.version, this.ownSlug(), this.localeCatalogs) : []);
  private readonly contentMap = injectContentFilesMap();
  private readonly renderer = inject(ContentRenderer);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly documentRef = inject(DOCUMENT);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly metadata = inject(DoqPageMetadata);
  private readonly claimMetadata = this.metadata.claim(inject(DestroyRef));
  /**
   * The reader's last known scroll position, from scroll events, frozen while a Back/Forward traversal is under way.
   * Engines restore the destination's scroll at different moments (WebKit before `popstate`, Chromium right after it), so
   * `scrollY` at NavigationStart is the destination's position there; this is where the reader was leaving from.
   */
  private lastScrollY = 0;
  private traversing = false;
  private readonly trackScroll = (() => {
    const view = isPlatformBrowser(this.platformId) ? this.documentRef.defaultView : null;
    if (!view) return;
    this.lastScrollY = view.scrollY;
    const onScroll = () => { if (!this.traversing) this.lastScrollY = view.scrollY; };
    const onPopstate = () => { this.traversing = true; };
    view.addEventListener('scroll', onScroll, { passive: true });
    view.addEventListener('popstate', onPopstate);
    inject(DestroyRef).onDestroy(() => { view.removeEventListener('scroll', onScroll); view.removeEventListener('popstate', onPopstate); });
  })();
  readonly navigation = computed(() => this.documents.map(document => ({ ...document, href: this.localize(document.routePath) })));
  readonly navigationTree = computed(() => {
    const roots: DoqNavigationNode[] = [];
    for (const document of this.navigation()) {
      const groups = document.group.split('/').map(part => part.trim()).filter(Boolean);
      const sourceDirectories = document.sourceSlug.split('/').slice(0, -1);
      if (groups.length === 1 && sourceDirectories.length > 1) groups.push(...sourceDirectories.slice(1));
      let branch = roots;
      const path: string[] = [];
      for (const label of groups) {
        path.push(label);
        const key = path.join('/');
        let node = branch.find(item => item.key === key);
        if (!node) {
          node = { key, label, containsActive: false, children: [] };
          branch.push(node);
        }
        node.containsActive ||= document.slug === this.routeSlug();
        branch = node.children!;
      }
      branch.push({ key: document.routePath, label: document.title, href: this.localize(document.routePath) });
    }
    return roots;
  });
  /**
   * True when this URL belongs to a locale that does not publish the requested document and the
   * configuration asked for the default locale's copy under a visible notice, rather than a 404.
   */
  readonly untranslatedFallback = computed(() => {
    if (!this.i18n.i18n || this.i18n.i18n.fallback !== 'default-locale') return false;
    const slug = this.routeSlug();
    return !!slug && !this.documents.some(doc => doc.slug === slug) && this.fallbackDocument() !== null;
  });
  readonly document = toSignal(this.route.paramMap.pipe(
    map(params => params.get(this.config.routeParam ?? 'slug') ?? ''),
    switchMap(slug => {
      const entry = this.unknownVersion() ? undefined : this.documents.find(doc => doc.slug === slug);
      // A localized URL with no translation of its own may serve the default locale's document, but only
      // when the host configured that fallback; the notice keeps it from being silent.
      const fallback = !entry && slug && this.i18n.i18n?.fallback === 'default-locale' && !this.catalog.locale.default
        ? this.defaultLocaleDocuments().find(doc => doc.slug === slug)
        : undefined;
      const resolved = entry ?? fallback;
      if (!slug || !resolved) return of(null);
      // Analog's injectContentFilesMap intentionally re-keys loaders by the
      // frontmatter slug. The canonical catalog resolves that public slug to
      // its source entry; use the matching Analog alias to load its module.
      const directory = entry ? this.catalog.contentDirectory : this.defaultLocaleDirectory();
      const basePath = entry ? this.catalog.basePath : this.defaultLocaleBasePath();
      const contentBase = `src/content/${directory}/${resolved.slug}`;
      const candidates = new Set([`${contentBase}.md`, `${contentBase}/index.md`]);
      const key = Object.keys(this.contentMap).find(candidate => candidates.has(this.canonicalFilename(candidate, directory)));
      const load = key ? this.contentMap[key] : undefined;
      if (!load) return of(null);
      const clearPendingTask = this.pendingTasks.add();
      return from(load()).pipe(
        switchMap(raw => {
          const parsed = parseRawContentFile<DocAttributes>(raw);
          return from(this.renderer.render(parsed.content)).pipe(map(rendered => ({ filename: resolved.sourceFilename, slug: resolved.slug, basePath, attributes: parsed.attributes, content: parsed.content, toc: rendered.toc, translated: !!entry })));
        }),
        catchError(error => { console.error(`Doq: failed to resolve ${resolved.sourceFilename}`, error); return of(null); }),
        finalize(clearPendingTask),
        startWith(undefined),
      );
    }),
  ), { initialValue: undefined });
  private ownSlug(): string | null { const slug = this.routeSlug(); return slug && this.documents.some(doc => doc.slug === slug) ? slug : null; }
  playgroundDefinition(id: string): DoqPlaygroundDefinition | undefined { return this.config.playgrounds && Object.prototype.hasOwnProperty.call(this.config.playgrounds, id) ? this.config.playgrounds[id] : undefined; }
  demoComponent(id: string): Type<unknown> | undefined { return id === 'button' ? DoqButtonDemoComponent : this.config.demos?.[id]; }
  /** The document cut at `::demo[id]` and `:::tabs`, without playgrounds: the 0.8 shape, kept for compatibility. The view renders `parts`. */
  readonly segments = computed(() => parseDoqContent(this.document()?.content ?? ''));
  /** The rendered document cut at its `::demo[id]`, `::playground[id]` directives and `:::tabs` groups; plain Markdown is one HTML segment. */
  readonly parts = computed(() => parseDoqDocument(this.document()?.content ?? ''));
  /** The frontmatter demo, unless the Markdown already places that same demo inline. */
  readonly trailingDemo = computed(() => {
    const id = this.document()?.attributes.demo;
    return id && !this.parts().some(segment => segment.kind === 'demo' && segment.id === id) ? id : undefined;
  });
  readonly headings = computed(() => this.document()?.toc ?? []);
  readonly previous = computed(() => this.adjacent(-1));
  readonly next = computed(() => this.adjacent(1));
  private readonly titleEffect = effect(() => {
    const doc = this.document();
    if (doc === undefined) return;
    const title = doc?.attributes.title;
    const label = this.versioned && !this.catalog.current ? this.catalog.version.label : undefined;
    if (!title) {
      this.metadata.set(doqPageTitle(this.i18n.t('notFound.pageTitle'), this.copy.pageTitleSuffix, label));
      this.metadata.setCanonical(undefined);
      this.metadata.setAlternates([]);
    } else {
      this.metadata.set(doqPageTitle(title, this.copy.pageTitleSuffix, label), doc?.attributes.description);
      this.metadata.setCanonical(doqCanonicalUrl(this.canonicalVersioning, doc.basePath === '/' ? `/${this.routeSlug()}` : `${doc.basePath}/${this.routeSlug()}`));
      this.metadata.setAlternates(this.hreflangAlternates(this.routeSlug()));
    }
  });
  /**
   * Writes `<html lang>` and `<html dir>` for a localized page. Skipped entirely when the host owns the
   * head (Etyma's `provideEtymaAnalog()` manages both), and a no-op on an unlocalized site, so a 0.11
   * consumer's document element is never touched.
   */
  private readonly localeEffect = effect(() => {
    const locale = this.i18n.locale();
    if (this.i18n.hostOwnsHead || !locale) this.metadata.setLocale(undefined, undefined);
    else this.metadata.setLocale(locale, this.i18n.direction());
  });
  private readonly enhancementEffect = effect(onCleanup => {
    const doc = this.document();
    this.activeHeading.set('');
    this.rendered.set(false);
    onCleanup(() => this.disconnectHeadingObserver());
    if (!doc || !isPlatformBrowser(this.platformId)) return;
    const observer = new MutationObserver(() => {
      if (this.enhanceRenderedDocument()) { observer.disconnect(); this.rendered.set(true); }
    });
    observer.observe(this.hostElement, { childList: true, subtree: true });
    const timer = globalThis.setTimeout(() => {
      if (this.enhanceRenderedDocument()) { observer.disconnect(); this.rendered.set(true); }
    }, 0);
    onCleanup(() => {
      globalThis.clearTimeout(timer);
      observer.disconnect();
    });
  });
  /** Re-runs whenever the document finishes rendering or the fragment changes; one mechanism for every way of arriving. */
  private readonly revealEffect = effect(() => {
    const ready = this.rendered();
    const fragment = this.fragment();
    if (ready) untracked(() => this.reveal(fragment));
  });
  /**
   * An unknown documentation URL must not answer 200. `RESPONSE_INIT` is `ResponseInit | null` and is
   * null for client rendering, SSG and route extraction, so it is only written when a server response
   * actually exists. It is per request, so nothing leaks between requests, and it is decided from the
   * route snapshot and the catalog rather than from async content resolution.
   */
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly notFoundStatus = (() => {
    if (!isPlatformServer(this.platformId) || !this.responseInit) return;
    const slug = this.route.snapshot.params[this.config.routeParam ?? 'slug'] as string | undefined;
    const claimed = !this.config.unmatched || this.config.unmatched === 'not-found';
    const unknownVersion = !!this.route.snapshot.data['doqUnknownVersion'];
    const missing = !!slug && !this.documents.some(doc => doc.slug === slug) && !this.hasFallbackDocument(slug);
    if (claimed && (unknownVersion || !slug || missing)) this.responseInit.status = 404;
  })();
  toggleMobileNavigation(): void {
    this.mobileNavigationOpen.update(open => !open);
    if (this.mobileNavigationOpen()) globalThis.setTimeout(() => this.hostElement.querySelector<HTMLElement>('.doq-sidebar .doq-version-summary, .doq-sidebar .doq-locale-summary, .doq-sidebar .doq-overview')?.focus(), 0);
    else this.hostElement.querySelector<HTMLElement>('.doq-mobile-trigger')?.focus();
  }
  closeMobileNavigation(): void {
    if (!this.mobileNavigationOpen()) return;
    this.mobileNavigationOpen.set(false);
    this.hostElement.querySelector<HTMLElement>('.doq-mobile-trigger')?.focus();
  }
  /** Every Doqs-rendered link goes through the adapter when the host owns localized routing. */
  localize(path: string): string { return this.i18n.localize(path); }
  readonly navLabel = computed(() => this.i18n.label());
  readonly tocEnabled = computed(() => this.config.showTableOfContents !== false);
  /** `dir` is written on the documentation region only when Doqs owns the document head. */
  readonly dirAttribute = computed(() => (this.i18n.localized && !this.i18n.hostOwnsHead ? this.i18n.direction() : null));
  readonly pagefindFilter = computed(() => {
    const filters: string[] = [];
    if (this.versioned) filters.push(`${DOQ_VERSION_FILTER}:${this.catalog.version.id}`);
    if (this.catalog.locale.id) filters.push(`${DOQ_LOCALE_FILTER}:${this.catalog.locale.id}`);
    return filters.length ? filters.join(';') : null;
  });
  readonly searchVersion = this.versioned ? this.catalog.version : undefined;
  readonly searchLocale = this.catalog.locale.id || undefined;
  private unknownVersion(): boolean { return !!this.route.snapshot.data['doqUnknownVersion']; }
  versionList() { return this.versions; }
  currentVersionLabel(): string { return this.versions[0]?.label ?? ''; }
  defaultLocaleLabel(): string { return this.i18n.i18n?.locales.find(locale => locale.default)?.label ?? ''; }
  private defaultLocaleDirectory(): string { return this.i18n.defaultLocaleEntry?.contentDirectory ?? this.catalog.contentDirectory; }
  private defaultLocaleBasePath(): string {
    const paths = normalizeDoqPaths(this.config);
    const version = getDoqVersions(paths).find(candidate => candidate.id === this.catalog.version.id);
    return version?.basePath ?? this.catalog.basePath;
  }
  private defaultLocaleDocuments() {
    return this.i18n.i18n?.fallback === 'default-locale' && !this.catalog.locale.default
      ? injectDoqDocuments(this.config, this.catalog.version.id, this.i18n.i18n.defaultLocale)
      : [];
  }
  private fallbackDocument() { return this.defaultLocaleDocuments().find(doc => doc.slug === this.routeSlug()) ?? null; }
  private hasFallbackDocument(slug: string): boolean { return this.defaultLocaleDocuments().some(doc => doc.slug === slug); }
  /**
   * `hreflang` alternates for the document being read: one per locale that actually publishes it, plus
   * `x-default` for the default locale. A locale without the document is omitted, so no alternate ever
   * advertises a translation that does not exist. Skipped entirely when the host owns the head.
   */
  private hreflangAlternates(slug: string): { hreflang: string; href: string }[] {
    if (this.i18n.hostOwnsHead || !this.i18n.i18n) return [];
    const origin = this.canonicalVersioning?.canonicalOrigin;
    if (!origin) return [];
    const links = doqLocaleLinks(this.i18n.i18n, this.catalog.locale.id, this.catalog.version, slug, this.localeCatalogs)
      .filter(link => link.sameDocument)
      .map(link => ({ hreflang: link.id, href: doqCanonicalUrl(this.canonicalVersioning, link.href) ?? `${origin}${link.href}` }));
    const defaultLink = links.find(link => link.hreflang === this.i18n.i18n!.defaultLocale);
    return defaultLink ? [...links, { hreflang: 'x-default', href: defaultLink.href }] : links;
  }
  private reveal(fragment: string | null): void {
    this.revealTarget(fragment);
    // The position the reader now has is the one to leave from, even when the browser reported no scroll event for it.
    this.lastScrollY = this.documentRef.defaultView?.scrollY ?? 0;
  }
  private revealTarget(fragment: string | null): void {
    const view = this.documentRef.defaultView;
    const markdown = this.hostElement.querySelector<HTMLElement>('.doq-content');
    const target = fragment && markdown ? this.findFragmentTarget(markdown, fragment) : undefined;
    const focusTarget = this.arrival;
    this.arrival = false;
    // A heading inside an inactive tab: activate that tab first so the target can be scrolled to and focused.
    const hiddenPanel = target?.closest<HTMLElement>('[role="tabpanel"][hidden]');
    if (hiddenPanel) {
      this.hostElement.querySelector<HTMLElement>(`[role="tab"][aria-controls="${hiddenPanel.id}"]`)?.click();
      hiddenPanel.hidden = false;
    }
    if (this.restorePosition !== undefined) {
      view?.scrollTo({ top: this.restorePosition, behavior: 'instant' });
      this.restorePosition = undefined;
      return;
    }
    if (target) target.scrollIntoView?.({ block: 'start' });
    else if (focusTarget) view?.scrollTo(0, 0);
    if (!focusTarget) return;
    const focusable = target ?? this.hostElement.querySelector<HTMLElement>('.doq-doc-header h1');
    if (!focusable) return;
    if (!focusable.hasAttribute('tabindex')) focusable.setAttribute('tabindex', '-1');
    focusable.focus({ preventScroll: true });
  }
  private findFragmentTarget(markdown: HTMLElement, fragment: string): HTMLElement | undefined {
    const candidates = [fragment];
    try { candidates.push(decodeURIComponent(fragment)); } catch { /* keep the raw fragment */ }
    for (const id of candidates) {
      for (const node of Array.from(markdown.querySelectorAll<HTMLElement>('[id]'))) if (node.id === id && node.closest('.doq-markdown')) return node;
    }
    return undefined;
  }
  private canonicalFilename(filename: string, contentDirectory: string): string {
    const normalized = filename.replace(/\\/g, '/');
    const marker = `src/content/${contentDirectory}/`;
    const index = normalized.lastIndexOf(marker);
    return index < 0 ? normalized : normalized.slice(index);
  }
  private get hostElement(): HTMLElement { return this.host.nativeElement as HTMLElement; }
  private enhanceRenderedDocument(): boolean {
    const root = this.hostElement.querySelector<HTMLElement>('.doq-root');
    const markdown = root?.querySelector<HTMLElement>('.doq-content');
    if (!root || !markdown || !root.querySelector('.doq-markdown')?.childElementCount) return false;
    // Only Markdown-rendered code gets a copy button; consumer demos keep their own markup untouched.
    for (const pre of Array.from(markdown.querySelectorAll<HTMLElement>('.doq-markdown pre:not([data-doq-copy])'))) {
      pre.dataset['doqCopy'] = 'true';
      const button = this.documentRef.createElement('button');
      button.type = 'button'; button.className = 'doq-code-copy'; button.setAttribute('data-pagefind-ignore', ''); button.setAttribute('aria-label', this.i18n.t('code.copyLabel')); button.textContent = this.i18n.t('code.copy');
      const copy = async () => {
        try {
          if (!globalThis.navigator?.clipboard) throw new Error('Clipboard unavailable');
          await globalThis.navigator.clipboard.writeText((pre.querySelector('code') ?? pre).textContent ?? '');
          button.textContent = this.i18n.t('code.copied'); button.setAttribute('aria-label', this.i18n.t('code.copiedLabel'));
        } catch { button.textContent = this.i18n.t('code.copyUnavailable'); button.setAttribute('aria-label', this.i18n.t('code.copyUnavailableLabel')); }
      };
      button.addEventListener('click', copy);
      pre.appendChild(button);
    }
    const headings = this.headings();
    const nodes = headings.map(heading => this.documentRef.getElementById(heading.id)).filter((node): node is HTMLElement => !!node && !!node.closest('.doq-markdown') && markdown.contains(node));
    // The enhancement may run from both the mutation observer and the timer; replacing the
    // previous observer and resize listener keeps a single active set per rendered document.
    this.disconnectHeadingObserver();
    this.syncScrollableTables(markdown);
    this.syncScrollableToc(root);
    if (!('IntersectionObserver' in globalThis) || !nodes.length) return true;
    const observeHeadings = () => {
      this.enhancementObserver?.disconnect();
      const viewportHeight = this.documentRef.defaultView?.innerHeight ?? 0;
      this.enhancementObserver = new IntersectionObserver(entries => {
        const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target instanceof HTMLElement) {
          this.activeHeading.set(visible.target.id);
          this.revealActiveTocLink(root, visible.target.id);
        }
      }, { rootMargin: `0px 0px -${Math.round(viewportHeight * 0.7)}px 0px` });
      nodes.forEach(node => this.enhancementObserver!.observe(node));
    };
    observeHeadings();
    this.headingResizeHandler = observeHeadings;
    this.documentRef.defaultView?.addEventListener('resize', observeHeadings, { passive: true });
    return true;
  }
  /**
   * A TOC taller than the viewport scrolls inside its own sticky rail. It only becomes a tab stop when
   * it actually overflows, so a short TOC does not add a pointless stop, and keyboard scrolling of the
   * rail never moves the article.
   */
  private syncScrollableToc(root: HTMLElement): void {
    const sync = () => {
      const toc = root.querySelector<HTMLElement>('.doq-toc');
      if (!toc) return;
      if (toc.scrollHeight > toc.clientHeight + 1) {
        if (toc.hasAttribute('tabindex')) return;
        toc.setAttribute('tabindex', '0');
        toc.dataset['doqScrollable'] = 'true';
      } else if (toc.dataset['doqScrollable']) {
        toc.removeAttribute('tabindex');
        toc.removeAttribute('data-doq-scrollable');
      }
    };
    sync();
    if (this.tocResizeHandler) this.documentRef.defaultView?.removeEventListener('resize', this.tocResizeHandler);
    this.tocResizeHandler = sync;
    this.documentRef.defaultView?.addEventListener('resize', sync, { passive: true });
  }
  /** Keep the active link inside the rail's own scrollport, without moving the article or stealing focus. */
  private revealActiveTocLink(root: HTMLElement, id: string): void {
    const toc = root.querySelector<HTMLElement>('.doq-toc');
    const link = toc?.querySelector<HTMLElement>(`a[href$="#${CSS.escape(id)}"]`);
    if (!toc || !link || toc.scrollHeight <= toc.clientHeight + 1) return;
    const top = link.offsetTop - toc.clientHeight / 2 + link.clientHeight / 2;
    toc.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  }
  /** A table wider than the column scrolls on its own (CSS), so it must be reachable by keyboard and have a name. */
  private syncScrollableTables(markdown: HTMLElement): void {
    const sync = () => {
      for (const table of Array.from(markdown.querySelectorAll<HTMLElement>('.doq-markdown table'))) {
        if (table.scrollWidth > table.clientWidth) {
          if (table.hasAttribute('tabindex')) continue;
          let heading = table.previousElementSibling;
          while (heading && !/^H[1-6]$/.test(heading.tagName)) heading = heading.previousElementSibling;
          table.setAttribute('tabindex', '0');
          table.dataset['doqScrollable'] = 'true';
          if (!table.hasAttribute('aria-label')) {
            const name = heading?.textContent?.trim();
            table.setAttribute('aria-label', name ? `${name} table` : this.i18n.t('table.scrollableLabel'));
          }
        } else if (table.dataset['doqScrollable']) {
          table.removeAttribute('tabindex');
          table.removeAttribute('data-doq-scrollable');
        }
      }
    };
    sync();
    if (this.tableResizeHandler) this.documentRef.defaultView?.removeEventListener('resize', this.tableResizeHandler);
    this.tableResizeHandler = sync;
    this.documentRef.defaultView?.addEventListener('resize', sync, { passive: true });
  }
  private tableResizeHandler?: () => void;
  private tocResizeHandler?: () => void;
  private enhancementObserver?: IntersectionObserver;
  private headingResizeHandler?: () => void;
  private disconnectHeadingObserver(): void {
    this.enhancementObserver?.disconnect();
    this.enhancementObserver = undefined;
    const view = this.documentRef.defaultView;
    if (this.tableResizeHandler) view?.removeEventListener('resize', this.tableResizeHandler);
    this.tableResizeHandler = undefined;
    if (this.headingResizeHandler) view?.removeEventListener('resize', this.headingResizeHandler);
    this.headingResizeHandler = undefined;
    if (this.tocResizeHandler) view?.removeEventListener('resize', this.tocResizeHandler);
    this.tocResizeHandler = undefined;
  }
  private adjacent(offset: number) { const items = this.navigation(); const i = items.findIndex(item => item.slug === this.routeSlug()); return items[i + offset]; }
}

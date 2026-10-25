import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject } from '@angular/core';
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { injectDoqCatalog, injectDoqCatalogs, injectDoqDocuments, injectDoqVersion, resolveDoqCopy } from './doq-catalog';
import { DOQ_CONFIG } from '@doqs/analog/config';
import { DoqI18n } from './doq-i18n';
import { DoqLocaleSwitcherComponent } from './doq-locale-switcher.component';
import { DoqPageMetadata } from './doq-metadata';
import { DoqSearchComponent } from './doq-search.component';
import { DoqVersionSwitcherComponent } from './doq-version-switcher.component';
import { doqCanonicalUrl, doqLocaleLinks, doqVersionLinks } from '@doqs/analog/config';
import { normalizeDoqPaths } from '@doqs/analog/config';

@Component({
  selector: 'doq-index',
  standalone: true,
  imports: [RouterLink, NgComponentOutlet, NgTemplateOutlet, DoqSearchComponent, DoqVersionSwitcherComponent, DoqLocaleSwitcherComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #content>
      @if (versionLinks.length > 1 || localeLinks().length > 1 || config.search?.enabled) {
        <div class="doq-topbar">
          @if (versionLinks.length > 1) { <doq-version-switcher [versions]="versionLinks" /> }
          @if (localeLinks().length > 1) { <doq-locale-switcher [locales]="localeLinks()" /> }
          @if (config.search?.enabled) { <doq-search [version]="versioned ? version : undefined" [locale]="catalog.locale.id || undefined" /> }
        </div>
      }
      @if (versioned && !version.current) {
        <p class="doq-version-notice" role="note">{{ i18n.t('version.noticePrefix') }} <strong>{{ version.label }}</strong> {{ i18n.t('version.noticeSuffix') }} <a [routerLink]="i18n.localize(versionLinks[0]?.href ?? version.basePath)">{{ i18n.t('version.viewCurrent', { label: versions[0]?.label ?? '' }) }}</a></p>
      }
      <p class="doq-eyebrow">{{ i18n.label() }}</p><h1 tabindex="-1">{{ i18n.indexTitle() }}</h1>
      <p class="doq-description">{{ i18n.indexDescription() }}</p>
      @if (config.slots?.indexAfterIntro; as slot) { <ng-container *ngComponentOutlet="slot" /> }
      <div class="doq-index-grid">
        @for (item of navigation; track item.routePath) {
          <a class="doq-index-card" [routerLink]="i18n.localize(item.routePath)"><span>{{ item.group }}</span><strong>{{ item.title }}</strong><p>{{ item.description }}</p><span class="doq-index-arrow">{{ i18n.t('index.readGuide') }}</span></a>
        }
      </div>
    </ng-template>
    @if (config.landmark === 'host') {
      <div class="doq-index" [style.--doq-content-width]="config.contentWidth" [attr.data-doq-version]="versioned ? version.id : null" [attr.data-doq-locale]="catalog.locale.id || null" data-toc="none"><ng-container *ngTemplateOutlet="content" /></div>
    } @else {
      <main class="doq-index" [style.--doq-content-width]="config.contentWidth" [attr.data-doq-version]="versioned ? version.id : null" [attr.data-doq-locale]="catalog.locale.id || null" data-toc="none"><ng-container *ngTemplateOutlet="content" /></main>
    }
  `,
})
export class DoqIndexComponent {
  readonly config = inject(DOQ_CONFIG);
  readonly i18n = inject(DoqI18n);
  readonly catalog = injectDoqCatalog(this.config);
  private readonly versionContext = injectDoqVersion(this.config);
  readonly version = this.versionContext.version;
  readonly versions = this.versionContext.versions;
  readonly versioned = this.versionContext.versioned;
  private readonly copy = resolveDoqCopy(this.config);
  readonly navigation = injectDoqDocuments(this.config, this.version.id, this.catalog.locale.id || undefined);
  /** Every version leads to its own index from an index page, staying inside the active locale. */
  readonly versionLinks = this.versioned ? doqVersionLinks(this.versions, this.version.id, null, injectDoqCatalogs(this.config, this.catalog.locale.id || undefined)) : [];
  /** Every locale leads to its own index from an index page, staying inside the active version. */
  readonly localeLinks = computed(() => this.i18n.i18n ? doqLocaleLinks(this.i18n.i18n, this.catalog.locale.id, this.version, null, {}) : []);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const router = inject(Router);
    // Arriving from another page by a link: move focus to the heading instead of leaving it on <body>.
    const arrivedByNavigation = router.navigated && router.currentNavigation()?.trigger === 'imperative';
    if (arrivedByNavigation) afterNextRender(() => host.nativeElement.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true }));
    const metadata = inject(DoqPageMetadata);
    metadata.claim(inject(DestroyRef));
    // The visible heading always shows the index title; the document title falls back to the product
    // label when the host configured none, which is the 0.11 behavior and keeps a generic
    // "Explore the docs" tab off a product site.
    const title = this.copy.hasIndexTitle ? this.i18n.indexTitle() : this.i18n.label();
    metadata.set(this.versioned && !this.version.current ? `${title} · ${this.version.label}` : title, this.copy.hasIndexDescription ? this.i18n.indexDescription() : undefined);
    metadata.setCanonical(doqCanonicalUrl(normalizeDoqPaths(this.config).versioning, this.catalog.basePath));
    metadata.setAlternates([]);
  }
}

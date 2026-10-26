import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { canonicalUrl, pageMeta, socialImage } from '../lib/site-config';

declare const __DOQ_SITE_ORIGIN__: string;

/**
 * Per-route head tags. Title, description and the social text of the pages the site owns (`/`, `/examples`) are set here;
 * documentation pages set their own title and description through Doqs, so only their canonical URL is managed.
 * Canonical, og:url and the social image depend on the page and the public origin, so they cannot live in index.html
 * (every prerendered route starts from that file). Without DOQ_SITE_ORIGIN no absolute URL is written. Runs during
 * prerendering too.
 */
@Injectable({ providedIn: 'root' })
export class SeoLinks {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly origin = typeof __DOQ_SITE_ORIGIN__ === 'string' ? __DOQ_SITE_ORIGIN__ : '';

  constructor() {
    const router = inject(Router);
    const subscription = router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) this.update(event.urlAfterRedirects);
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  private update(url: string): void {
    const path = url.split(/[?#]/)[0] || '/';
    const page = pageMeta[path.length > 1 ? path.replace(/\/$/, '') : path];
    if (page) this.applyPage(page);
    if (!this.origin) return;
    const href = canonicalUrl(this.origin, path);
    this.link('canonical', href);
    this.property('og:url', href);
    const image = canonicalUrl(this.origin, socialImage.path);
    this.property('og:image', image);
    this.property('og:image:width', String(socialImage.width));
    this.property('og:image:height', String(socialImage.height));
    this.property('og:image:alt', socialImage.alt);
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:image', content: image });
  }

  private applyPage(page: { readonly title: string; readonly description: string }): void {
    this.title.setTitle(page.title);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.property('og:title', page.title);
    this.property('og:description', page.description);
    this.meta.updateTag({ name: 'twitter:title', content: page.title });
    this.meta.updateTag({ name: 'twitter:description', content: page.description });
  }

  private link(rel: string, href: string): void {
    const head = this.document.head;
    let element = head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!element) {
      element = this.document.createElement('link');
      element.rel = rel;
      head.appendChild(element);
    }
    element.href = href;
  }

  private property(name: string, content: string): void {
    this.meta.updateTag({ property: name, content }, `property="${name}"`);
  }
}

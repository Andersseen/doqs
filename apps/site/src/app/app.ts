import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SeoLinks } from './seo';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteHeader, SiteFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-background" href="#content" (click)="skipToContent($event)">Skip to content</a>
    <app-site-header />
    <div id="content" tabindex="-1" class="min-h-[85vh] outline-none"><router-outlet /></div>
    <app-site-footer />
  `,
})
export class App {
  private readonly document = inject(DOCUMENT);

  constructor() {
    inject(SeoLinks);
  }

  /**
   * `#content` wraps every routed page. The landing has a `main`, Doqs renders its own `main` (index) or `article`
   * (document), and none of those carries a page-wide id, so the skip link targets the wrapper.
   */
  protected skipToContent(event: Event) {
    const content = this.document.getElementById('content');
    if (!content) return;
    event.preventDefault();
    content.focus();
  }
}

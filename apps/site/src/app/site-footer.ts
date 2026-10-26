import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VoltNativeButton, VoltSeparator } from '@voltui/components';
import { LmnExternalLinkIcon } from 'lumen-icons/external-link';
import { navItems, siteLinks } from '../lib/site-config';

@Component({
  selector: 'app-site-footer',
  imports: [RouterLink, VoltNativeButton, VoltSeparator, LmnExternalLinkIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="mt-8 text-sm text-muted-foreground">
      <volt-separator />
      <div class="mx-auto flex w-[min(100%-2rem,70rem)] flex-wrap items-start justify-between gap-x-8 gap-y-6 py-10">
        <p class="m-0 max-w-xs">
          <strong class="font-serif text-base text-foreground">doqs</strong> — documentation that lives in your Angular app. Released under the MIT license.
        </p>
        <nav class="flex flex-wrap gap-x-1 gap-y-1" aria-label="Footer">
          @for (item of pages; track item.path) {
            <a voltButton variant="link" size="sm" [routerLink]="item.path">{{ item.label }}</a>
          }
          @for (link of items; track link.href) {
            <a voltButton variant="link" size="sm" [href]="link.href" rel="noopener">{{ link.label }}<lmn-external-link [size]="14" /></a>
          }
        </nav>
      </div>
    </footer>
  `,
})
export class SiteFooter {
  protected readonly pages = navItems;
  protected readonly items = [
    { label: 'GitHub', href: siteLinks.github },
    { label: 'npm', href: siteLinks.npm },
    { label: 'Changelog', href: siteLinks.changelog },
    { label: 'MIT License', href: siteLinks.license },
  ] as const;
}

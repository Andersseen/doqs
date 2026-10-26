import { ChangeDetectionStrategy, Component, Directive } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { injectDialogRef } from 'ng-primitives/dialog';
import {
  VoltDrawer,
  VoltDrawerClose,
  VoltDrawerContent,
  VoltDrawerDescription,
  VoltDrawerOverlay,
  VoltDrawerTitle,
  VoltNativeButton,
  VoltSeparator,
} from '@voltui/components';
import { LmnBars3Icon } from 'lumen-icons/bars-3';
import { LmnGithubIcon } from 'lumen-icons/github';
import { LmnPackageIcon } from 'lumen-icons/package';
import { LmnXMarkIcon } from 'lumen-icons/x-mark';
import { navItems, siteLinks } from '../lib/site-config';
import { ThemeToggle } from './theme-toggle';

/** Closes the surrounding Volt drawer when a link inside it is followed; the link itself navigates natively. */
@Directive({ selector: '[appCloseDrawer]', host: { '(click)': 'drawer.close()' } })
class CloseDrawer {
  protected readonly drawer = injectDialogRef();
}

@Component({
  selector: 'app-site-header',
  imports: [
    VoltNativeButton,
    VoltDrawer,
    VoltDrawerOverlay,
    VoltDrawerContent,
    VoltDrawerTitle,
    VoltDrawerDescription,
    VoltDrawerClose,
    VoltSeparator,
    LmnBars3Icon,
    LmnGithubIcon,
    LmnPackageIcon,
    ThemeToggle,
    LmnXMarkIcon,
    CloseDrawer,
    RouterLink,
    RouterLinkActive,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="site-header sticky top-0 z-30 border-b border-border/70 bg-background/75 backdrop-blur-xl backdrop-saturate-150">
      <div class="mx-auto flex min-h-16 w-[min(100%-2rem,70rem)] items-center justify-between gap-4">
        <a
          class="inline-flex items-baseline gap-0.5 rounded-md font-serif text-2xl leading-none font-bold tracking-tighter text-foreground no-underline"
          routerLink="/"
          aria-label="Doqs, home"
        >
          <span aria-hidden="true">doqs</span><i class="size-1.5 rounded-full bg-primary" aria-hidden="true"></i>
        </a>

        <nav class="hidden items-center gap-1 md:flex" aria-label="Main">
          <span class="nav-pill">
          @for (link of sections; track link.path) {
            <a
              voltButton
              variant="ghost"
              size="sm"
              class="nav-link rounded-full"
              [routerLink]="link.path"
              routerLinkActive="is-active"
              ariaCurrentWhenActive="page"
              [routerLinkActiveOptions]="{ exact: link.exact }"
              >{{ link.label }}</a
            >
          }
          </span>
          <volt-separator orientation="vertical" class="mx-2 h-5" />
          <a voltButton variant="ghost" size="sm" [href]="links.github" rel="noopener">
            <lmn-github [size]="16" /> GitHub
          </a>
          <a voltButton variant="ghost" size="sm" [href]="links.npm" rel="noopener">
            <lmn-package [size]="16" /> npm
          </a>
        </nav>

        <div class="flex items-center gap-1">
          <app-theme-toggle />
          <button
            voltButton
            variant="outline"
            size="icon"
            type="button"
            class="md:hidden"
            aria-label="Menu"
            aria-haspopup="dialog"
            [voltDrawer]="menu"
          >
            <lmn-bars-3 [size]="20" />
          </button>
        </div>
      </div>
    </header>

    <ng-template #menu>
      <div voltDrawerOverlay>
        <div voltDrawerContent side="right" class="flex flex-col gap-4 p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 voltDrawerTitle>Menu</h2>
              <p voltDrawerDescription>Browse the site or open the project.</p>
            </div>
            <volt-drawer-close label="Close menu"><lmn-x-mark [size]="16" /></volt-drawer-close>
          </div>
          <volt-separator />
          <nav class="flex flex-col gap-1" aria-label="Main">
            @for (link of sections; track link.path) {
              <a
                voltButton
                variant="ghost"
                class="nav-link justify-start"
                [routerLink]="link.path"
                routerLinkActive="is-active"
                ariaCurrentWhenActive="page"
                [routerLinkActiveOptions]="{ exact: link.exact }"
                appCloseDrawer
                >{{ link.label }}</a
              >
            }
            <volt-separator class="my-1" />
            <a voltButton variant="ghost" class="justify-start" [href]="links.github" rel="noopener" appCloseDrawer>
              <lmn-github [size]="16" /> GitHub
            </a>
            <a voltButton variant="ghost" class="justify-start" [href]="links.npm" rel="noopener" appCloseDrawer>
              <lmn-package [size]="16" /> npm
            </a>
          </nav>
        </div>
      </div>
    </ng-template>
  `,
})
export class SiteHeader {
  protected readonly links = siteLinks;
  protected readonly sections = navItems;
}

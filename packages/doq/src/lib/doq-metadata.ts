import { DestroyRef, inject, Injectable, makeStateKey, PLATFORM_ID, TransferState } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';

type HostMetadata = { title: string; description: string | null };
// The server captures the host's own metadata before Doq changes it; hydration consumes it once so the
// client can restore the host values instead of the already-updated document head.
const HOST_METADATA = makeStateKey<HostMetadata>('doq-host-metadata');

/**
 * Scoped title/description updates: the host's values are captured when the first Doq page becomes
 * active and restored when the last one is destroyed, so metadata never leaks into other routes
 * or lingers from a previous document.
 */
@Injectable({ providedIn: 'root' })
export class DoqPageMetadata {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private owners = 0;
  private readonly transferState = inject(TransferState);
  private readonly server = isPlatformServer(inject(PLATFORM_ID));
  private original?: HostMetadata;

  /** Register the calling component for the lifetime of its injector. */
  claim(destroyRef: DestroyRef): void {
    if (this.owners++ === 0) {
      const transferred = this.server ? null : this.transferState.get(HOST_METADATA, null);
      this.original = transferred ?? { title: this.title.getTitle(), description: this.meta.getTag('name="description"')?.content ?? null };
      if (this.server) this.transferState.set(HOST_METADATA, this.original);
      else this.transferState.remove(HOST_METADATA);
    }
    destroyRef.onDestroy(() => {
      if (--this.owners === 0 && this.original) {
        this.title.setTitle(this.original.title);
        this.writeDescription(this.original.description);
        this.setCanonical(undefined);
        this.original = undefined;
      }
    });
  }

  /** Set the page title; a missing description reverts to the host's own description. */
  set(title: string, description?: string): void {
    this.title.setTitle(title);
    this.writeDescription(description || this.original?.description || null);
  }

  /**
   * Declare this page's own canonical URL (versioned sites with a configured origin). Doq only manages the link it created:
   * a host-authored canonical is never replaced, and Doq's link is removed with the last Doq page.
   */
  setCanonical(href: string | undefined): void {
    const head = this.document.head;
    const existing = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (existing && !existing.hasAttribute('data-doq-canonical')) return;
    if (!href) {
      existing?.remove();
      return;
    }
    const link = existing ?? this.document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', href);
    link.setAttribute('data-doq-canonical', '');
    if (!existing) head.appendChild(link);
  }

  /**
   * Declare the `hreflang` alternates of the document being read, one per locale that actually
   * publishes it. Doq only ever touches links it created: host-authored alternates are left alone, an
   * empty list removes Doq's own, and no element is duplicated across navigations.
   */
  setAlternates(alternates: readonly { hreflang: string; href: string }[]): void {
    const head = this.document.head;
    for (const existing of Array.from(head.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][data-doq-hreflang]'))) existing.remove();
    for (const alternate of alternates) {
      const link = this.document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', alternate.hreflang);
      link.setAttribute('href', alternate.href);
      link.setAttribute('data-doq-hreflang', '');
      head.appendChild(link);
    }
  }

  /**
   * Write the document language and direction for a localized page. Only called when Doqs owns the
   * head: a host using `provideEtymaAnalog()` already manages `lang`, `dir`, canonical and `hreflang`,
   * and two owners writing the same attributes is how a page ends up labelled with the wrong language.
   * The previous values are captured once and restored with the last Doq page.
   */
  setLocale(locale: string | undefined, direction: 'ltr' | 'rtl' | undefined): void {
    const root = this.document.documentElement;
    if (!locale) {
      if (this.originalLang !== undefined) {
        if (this.originalLang === null) root.removeAttribute('lang');
        else root.setAttribute('lang', this.originalLang);
        if (this.originalDir === null) root.removeAttribute('dir');
        else if (this.originalDir !== undefined) root.setAttribute('dir', this.originalDir);
        this.originalLang = undefined;
        this.originalDir = undefined;
      }
      return;
    }
    if (this.originalLang === undefined) {
      this.originalLang = root.getAttribute('lang');
      this.originalDir = root.getAttribute('dir');
    }
    root.setAttribute('lang', locale);
    if (direction) root.setAttribute('dir', direction);
  }

  private originalLang: string | null | undefined;
  private originalDir: string | null | undefined;

  private writeDescription(content: string | null): void {
    if (content) this.meta.updateTag({ name: 'description', content });
    else this.meta.removeTag('name="description"');
  }
}

export function doqPageTitle(title: string, suffix: string, versionLabel?: string): string {
  const base = suffix ? `${title} · ${suffix}` : title;
  return versionLabel ? `${base} · ${versionLabel}` : base;
}

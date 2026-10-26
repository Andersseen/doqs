import { DOCUMENT } from '@angular/common';
import { afterNextRender, Injectable, inject, signal } from '@angular/core';
import { applyVoltTheme } from '@voltui/components';
import { resolveDark, themeStorageKey } from '../lib/theme-preference';

/** Browser-only read of the stored choice and the system preference; safe to call during SSR. */
export function readInitialDark(): boolean {
  if (typeof window === 'undefined') return false;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(themeStorageKey);
  } catch {
    // Storage can be blocked; the system preference still applies.
  }
  return resolveDark(stored, window.matchMedia('(prefers-color-scheme: dark)').matches);
}

/** A point on screen, in CSS pixels, that the theme change grows out of. */
export interface ThemeOrigin {
  readonly x: number;
  readonly y: number;
}

/**
 * Thin host layer over Volt's own theme infrastructure: Volt applies `.dark` and the color scheme,
 * this service only decides the value and remembers an explicit choice.
 */
@Injectable({ providedIn: 'root' })
export class ThemeController {
  private readonly document = inject(DOCUMENT);
  readonly dark = signal(false);

  constructor() {
    // The server and the first client render agree on "light"; the real state is read after hydration.
    afterNextRender(() => this.dark.set(this.document.documentElement.classList.contains('dark')));
  }

  /**
   * Flips the theme. With an `origin` and a browser that supports view transitions, the new theme is revealed as a
   * circle growing from that point; under reduced motion, or without support, it simply switches.
   */
  toggle(origin?: ThemeOrigin) {
    const dark = !this.dark();
    this.dark.set(dark);
    const view = this.document.defaultView;
    const apply = () => {
      // Without this, every control with a color transition would fade between the two themes on its own schedule.
      const freeze = this.document.createElement('style');
      freeze.textContent = '*,*::before,*::after{transition:none!important}';
      this.document.head.appendChild(freeze);
      applyVoltTheme({ dark }, this.document);
      view?.getComputedStyle(this.document.body).color; // commit the new colors while transitions are off
      freeze.remove();
    };
    const reduced = view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
    if (origin && !reduced && typeof this.document.startViewTransition === 'function') {
      const root = this.document.documentElement;
      const radius = Math.hypot(
        Math.max(origin.x, root.clientWidth - origin.x),
        Math.max(origin.y, root.clientHeight - origin.y),
      );
      this.document
        .startViewTransition(apply)
        .ready.then(() =>
          root.animate(
            {
              clipPath: [
                `circle(0px at ${origin.x}px ${origin.y}px)`,
                `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
              ],
            },
            { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
          ),
        )
        .catch(() => {
          // A skipped transition still applied the theme.
        });
    } else {
      apply();
    }
    try {
      view?.localStorage.setItem(themeStorageKey, dark ? 'dark' : 'light');
    } catch {
      // The choice still applies for this visit.
    }
  }
}

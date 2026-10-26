import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { VoltNativeButton } from '@voltui/components';
import { LmnMoonIcon } from 'lumen-icons/moon';
import { LmnSunIcon } from 'lumen-icons/sun';
import { ThemeController } from './theme';

/**
 * The light/dark switch: a Volt button drawn as a track with a sliding thumb.
 *
 * Which icon shows and where the thumb sits follow the `.dark` class on `<html>` in CSS (see `.theme-toggle` in
 * styles.css), not the `dark` signal. The inline script in index.html sets that class before the first paint, so the
 * prerendered switch is already right and nothing jumps on hydration. Lumen icons set `display` inline on their host,
 * so visibility is never toggled on the icons themselves, only on the spans around them.
 *
 * The header is part of the eager bundle, so the press feedback is CSS: importing an Angular Movement directive here
 * would pull the animation engine into the initial JavaScript of every page.
 */
@Component({
  selector: 'app-theme-toggle',
  imports: [VoltNativeButton, LmnMoonIcon, LmnSunIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      voltButton
      variant="outline"
      size="sm"
      type="button"
      class="theme-toggle h-9 w-[4.25rem] rounded-full p-1"
      aria-label="Dark theme"
      [attr.aria-pressed]="theme.dark()"
      (click)="toggle($event)"
    >
      <span class="theme-toggle-track" aria-hidden="true">
        <span class="theme-toggle-hint theme-toggle-hint-sun"><lmn-sun [size]="14" /></span>
        <span class="theme-toggle-hint theme-toggle-hint-moon"><lmn-moon [size]="14" /></span>
        <span class="theme-toggle-thumb">
          <span class="theme-toggle-icon theme-toggle-sun"><lmn-sun [size]="14" tone="warning" /></span>
          <span class="theme-toggle-icon theme-toggle-moon"><lmn-moon [size]="14" tone="primary" /></span>
        </span>
      </span>
    </button>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeController);

  protected toggle(event: MouseEvent) {
    const button = event.currentTarget as HTMLElement;
    const box = button.getBoundingClientRect();
    // A keyboard press reports (0, 0): grow from the middle of the switch instead.
    const fromPointer = event.clientX !== 0 || event.clientY !== 0;
    this.theme.toggle(fromPointer ? { x: event.clientX, y: event.clientY } : { x: box.left + box.width / 2, y: box.top + box.height / 2 });
  }
}

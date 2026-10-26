import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { VoltToggleGroup, VoltToggleGroupItem } from '@voltui/components';
import type { MovePreset } from 'angular-movement';
import { CopyButton } from '../copy-button';
import { MovementPlaygroundComponent } from '../movement-playground';

const presets = ['fade-up', 'zoom-in', 'blur-in'] as const satisfies readonly MovePreset[];
type Preset = (typeof presets)[number];

/**
 * The same component the documentation registers as a playground (`::playground[movement-enter]`), driven here by
 * Volt controls instead of Doqs's generated ones. Every control feeds a signal that is bound to a real input of the
 * component, and the usage code below the preview is computed from the same signals, so it always shows what is on screen.
 */
@Component({
  selector: 'app-movement-lab',
  imports: [VoltToggleGroup, VoltToggleGroupItem, MovementPlaygroundComponent, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="grid gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div class="grid content-start gap-5">
        <div class="grid gap-2">
          <span id="lab-preset" class="text-sm font-medium">Preset</span>
          <volt-toggle-group type="single" [value]="selected()" (valueChange)="choose($event)" aria-labelledby="lab-preset" class="flex-wrap">
            @for (name of presets; track name) {
              <volt-toggle-group-item [value]="name" variant="outline" size="sm">{{ name }}</volt-toggle-group-item>
            }
          </volt-toggle-group>
        </div>
        <div class="grid gap-2">
          <span id="lab-duration" class="text-sm font-medium">Duration</span>
          <volt-toggle-group type="single" [value]="selectedDuration()" (valueChange)="chooseDuration($event)" aria-labelledby="lab-duration" class="flex-wrap">
            @for (ms of durations; track ms) {
              <volt-toggle-group-item [value]="'' + ms" variant="outline" size="sm">{{ ms }} ms</volt-toggle-group-item>
            }
          </volt-toggle-group>
        </div>
        <div class="grid gap-2">
          <span id="lab-motion" class="text-sm font-medium">Animation</span>
          <volt-toggle-group type="single" [value]="selectedMotion()" (valueChange)="chooseMotion($event)" aria-labelledby="lab-motion" class="flex-wrap">
            <volt-toggle-group-item value="on" variant="outline" size="sm">On</volt-toggle-group-item>
            <volt-toggle-group-item value="off" variant="outline" size="sm">Off (jump to end)</volt-toggle-group-item>
          </volt-toggle-group>
        </div>
        @if (lastPlayed(); as last) {
          <p class="m-0 text-sm text-muted-foreground" role="status" data-testid="lab-event">
            Output <code class="font-mono">played</code>: {{ last }}
          </p>
        }
      </div>

      <div class="min-w-0">
        <app-movement-playground
          [preset]="preset()"
          [duration]="duration()"
          [disabled]="disabled()"
          (played)="lastPlayed.set($event.preset + ' · ' + $event.duration + ' ms')"
        />
        <div class="mt-4 overflow-hidden rounded-lg border border-border bg-muted">
          <div class="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
            <span class="font-mono text-xs text-muted-foreground">usage</span>
            <app-copy-button [text]="usage()" label="usage code" announcement="Usage code copied to the clipboard." />
          </div>
          <pre class="m-0 overflow-x-auto p-4 font-mono text-[0.82rem] leading-relaxed" tabindex="0" data-testid="lab-usage"><code>{{ usage() }}</code></pre>
        </div>
      </div>
    </div>
  `,
})
export class MovementLab {
  protected readonly presets = presets;
  protected readonly preset = signal<Preset>('fade-up');
  protected readonly duration = signal(600);
  protected readonly disabled = signal(false);
  protected readonly lastPlayed = signal('');
  protected readonly durations = [300, 600, 1000, 1500] as const;
  protected readonly selected = computed(() => [this.preset()]);
  protected readonly selectedDuration = computed(() => [String(this.duration())]);
  protected readonly selectedMotion = computed(() => [this.disabled() ? 'off' : 'on']);
  protected readonly usage = computed(() => {
    const attrs = [`moveEnter="${this.preset()}"`, `[moveDuration]="${this.duration()}"`];
    if (this.disabled()) attrs.push('[moveDisabled]="true"');
    return `<div\n  ${attrs.join('\n  ')}\n>\n  Content\n</div>`;
  });

  protected chooseDuration(value: readonly string[]) {
    const next = this.durations.find((ms) => String(ms) === value[0]);
    if (next) this.duration.set(next);
  }

  protected chooseMotion(value: readonly string[]) {
    if (value[0] === 'on' || value[0] === 'off') this.disabled.set(value[0] === 'off');
  }

  protected choose(value: readonly string[]) {
    const next = presets.find((name) => name === value[0]);
    if (next) this.preset.set(next); // pressing the active item again reports an empty selection; keep the current one
  }
}

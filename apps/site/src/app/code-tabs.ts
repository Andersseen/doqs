import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { VoltBadge, VoltTabs, VoltTabsContent, VoltTabsList, VoltTabsTrigger } from '@voltui/components';
import { CopyButton } from './copy-button';

export interface CodeExample {
  readonly id: string;
  readonly tab: string;
  readonly file: string;
  readonly code: string;
}

@Component({
  selector: 'app-code-tabs',
  imports: [VoltTabs, VoltTabsList, VoltTabsTrigger, VoltTabsContent, VoltBadge, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <volt-tabs [value]="examples()[0].id">
      <volt-tabs-list class="mb-3 h-auto w-full flex-wrap justify-start" aria-label="Setup steps">
        @for (example of examples(); track example.id) {
          <volt-tabs-trigger [value]="example.id">{{ example.tab }}</volt-tabs-trigger>
        }
      </volt-tabs-list>
      @for (example of examples(); track example.id) {
        <volt-tabs-content [value]="example.id">
          <div class="overflow-hidden rounded-lg border border-border bg-muted">
            <div class="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
              <volt-badge variant="outline" class="font-mono">{{ example.file }}</volt-badge>
              <app-copy-button [text]="example.code" [label]="example.tab" announcement="Code copied to the clipboard." />
            </div>
            <pre class="overflow-x-auto p-4 font-mono text-[0.82rem] leading-relaxed" tabindex="0"><code>{{ example.code }}</code></pre>
          </div>
        </volt-tabs-content>
      }
    </volt-tabs>
  `,
})
export class CodeTabs {
  readonly examples = input.required<readonly CodeExample[]>();
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { VoltBadge } from '@voltui/components';
import { CopyButton } from '../copy-button';

/** A titled, scrollable, copyable code block. Long lines scroll inside the block and never widen the page. */
@Component({
  selector: 'app-code-block',
  imports: [VoltBadge, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    <div class="overflow-hidden rounded-lg border border-border bg-muted">
      <div class="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <volt-badge variant="outline" class="font-mono">{{ file() }}</volt-badge>
        <app-copy-button [text]="code()" [label]="file()" announcement="Code copied to the clipboard." />
      </div>
      <pre class="m-0 overflow-x-auto p-4 font-mono text-[0.82rem] leading-relaxed" tabindex="0"><code>{{ code() }}</code></pre>
    </div>
  `,
})
export class CodeBlock {
  readonly file = input.required<string>();
  readonly code = input.required<string>();
}

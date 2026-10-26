import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { VoltCard, VoltCardContent } from '@voltui/components';
import { LmnCommandLineIcon } from 'lumen-icons/command-line';
import { CopyButton } from './copy-button';

@Component({
  selector: 'app-copy-command',
  imports: [VoltCard, VoltCardContent, CopyButton, LmnCommandLineIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <volt-card class="bg-muted">
      <volt-card-content class="flex items-center gap-3 p-2 pl-4">
        <lmn-command-line class="shrink-0 text-muted-foreground" [size]="20" />
        <code class="min-w-0 flex-1 overflow-x-auto py-2 font-mono text-sm whitespace-nowrap" tabindex="0">{{ command() }}</code>
        <app-copy-button [text]="command()" label="install command" announcement="Install command copied to the clipboard." />
      </volt-card-content>
    </volt-card>
  `,
})
export class CopyCommand {
  readonly command = input.required<string>();
}

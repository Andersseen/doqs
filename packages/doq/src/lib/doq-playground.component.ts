import { ChangeDetectionStrategy, Component, DestroyRef, Directive, ElementRef, EventEmitter, Input, OnChanges, Output, Signal, SimpleChanges, ViewContainerRef, computed, inject, inputBinding, input, linkedSignal, outputBinding, signal, viewChild } from '@angular/core';
import {
  appendDoqEvent, DOQ_DEFAULT_PREVIEW_SIZES, DoqControlValue, DoqNumberControl, DoqPlaygroundControl, DoqPlaygroundDefinition, DoqPlaygroundEvent,
  DoqPlaygroundValues, DoqSelectControl, DoqStringControl, formatDoqEventPayload, initialDoqValues, parseDoqControlText,
} from '@doqs/analog/config';
import { DoqMessageKey, DoqMessageParams } from '@doqs/analog/config';
import { DoqI18n } from './doq-i18n';

/**
 * Creates the registered component with Angular's public `createComponent({ bindings })` API. Bindings use the
 * component's public names (aliases included), run input transforms, deliver required inputs before the first
 * check and follow the `values` signal without recreating the component. The component is recreated only when
 * the definition or `generation` changes (reset). Outputs are observed through `outputBinding`, which Angular
 * unsubscribes when the component is destroyed.
 *
 * The inputs are decorator inputs on purpose: creation must happen during change detection on the server as well,
 * and `ngOnChanges` is the hook that is guaranteed to run there.
 */
@Directive({ selector: '[doqPlaygroundOutlet]', exportAs: 'doqPlaygroundOutlet' })
export class DoqPlaygroundOutletDirective implements OnChanges {
  @Input({ required: true }) definition!: DoqPlaygroundDefinition;
  @Input({ required: true }) values!: Signal<DoqPlaygroundValues>;
  @Input() generation = 0;
  @Output() readonly emitted = new EventEmitter<{ readonly event: string; readonly payload: unknown }>();
  /** Why the component could not be created (unknown output, missing provider…), shown instead of the preview. */
  readonly error = signal<string | undefined>(undefined);
  private readonly container = inject(ViewContainerRef);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['definition'] || changes['generation']) this.create();
  }

  private create(): void {
    this.container.clear();
    this.error.set(undefined);
    const { component, controls = [], outputs = [] } = this.definition;
    const bindings = [
      ...controls.map(control => inputBinding(control.input, () => this.values()[control.input])),
      ...outputs.map(output => outputBinding(output.event, (payload: unknown) => this.emitted.emit({ event: output.event, payload }))),
    ];
    try {
      this.container.createComponent(component, { bindings });
    } catch (error) {
      this.container.clear();
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }
}

interface Snippet { readonly label: string; readonly language?: string; readonly text: string }

/**
 * An interactive documentation environment for one consumer component: typed controls bound to its inputs,
 * observed outputs, preview widths, an expanded preview, reset and copyable usage code. Mounted for each
 * `::playground[id]` directive. Every instance owns its state; nothing is persisted or sent anywhere.
 */
@Component({
  selector: 'doq-playground',
  standalone: true,
  imports: [DoqPlaygroundOutletDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="doq-playground" role="group" data-pagefind-ignore [attr.aria-labelledby]="uid() + '-title'" [attr.data-doq-playground]="playgroundId()">
      <div class="doq-pg-header">
        <div class="doq-pg-heading">
          <p class="doq-pg-title" [id]="uid() + '-title'">{{ title() }}</p>
          @if (definition().description) { <p class="doq-pg-description">{{ definition().description }}</p> }
        </div>
        <div class="doq-pg-toolbar">
          @if (sizes().length > 1) {
            <div class="doq-pg-sizes" role="group" [attr.aria-label]="i18n.t('playground.previewWidths')">
              @for (size of sizes(); track $index) {
                <button type="button" class="doq-pg-button" [attr.aria-pressed]="sizeIndex() === $index" (click)="setSize($index)">{{ size.label }}</button>
              }
            </div>
          }
          <button type="button" class="doq-pg-button" (click)="reset()">{{ i18n.t('playground.reset') }}</button>
          <button #expandButton type="button" class="doq-pg-button" aria-haspopup="dialog" (click)="expand()">{{ i18n.t('playground.expand') }}</button>
        </div>
      </div>
      <div class="doq-pg-slot" #slot>
        <div class="doq-pg-stage" #stage>
          <div class="doq-pg-frame" [style.max-width]="frameWidth()">
            <ng-container doqPlaygroundOutlet #outlet="doqPlaygroundOutlet" [definition]="definition()" [values]="values" [generation]="generation()" (emitted)="onEvent($event)" />
          </div>
          @if (outlet.error(); as message) { <p class="doq-pg-error" role="alert">{{ i18n.t('playground.previewError', { message }) }}</p> }
        </div>
      </div>
      @if (controls().length) {
        <fieldset class="doq-pg-controls">
          <legend>{{ i18n.t('playground.inputs') }}</legend>
          @for (control of controls(); track control.input; let index = $index) {
            <div class="doq-pg-control" [class.is-boolean]="control.kind === 'boolean'">
              @let id = uid() + '-control-' + index;
              @let hint = control.description ? id + '-hint' : null;
              @let failure = errors()[control.input];
              @let described = failure ? (hint ? hint + ' ' : '') + id + '-error' : hint;
              @switch (control.kind) {
                @case ('boolean') {
                  <input type="checkbox" [id]="id" [checked]="values()[control.input] === true" [attr.checked]="values()[control.input] === true ? '' : null" [attr.aria-describedby]="described" (change)="setBoolean(control, $any($event.target).checked)" />
                  <label [for]="id">{{ control.label }}</label>
                }
                @case ('select') {
                  <label [for]="id">{{ control.label }}@if (control.required) { <span class="doq-pg-required" aria-hidden="true"> *</span> }</label>
                  <select [id]="id" [required]="!!control.required" [attr.aria-describedby]="described" (change)="setSelect(control, $any($event.target).value)">
                    @if (!selectRequired(control)) { <option value="" [selected]="values()[control.input] === undefined" [attr.selected]="values()[control.input] === undefined ? '' : null">{{ i18n.t('playground.notSet') }}</option> }
                    @for (option of control.options; track $index) { <option [value]="$index" [selected]="values()[control.input] === option.value" [attr.selected]="values()[control.input] === option.value ? '' : null">{{ option.label }}</option> }
                  </select>
                }
                @case ('number') {
                  <label [for]="id">{{ control.label }}@if (control.required) { <span class="doq-pg-required" aria-hidden="true"> *</span> }</label>
                  <input type="number" inputmode="decimal" [id]="id" [value]="draft(control)" [required]="!!control.required" [attr.min]="control.min ?? null" [attr.max]="control.max ?? null" [attr.step]="control.step ?? 'any'" [attr.aria-invalid]="failure ? 'true' : null" [attr.aria-describedby]="described" (input)="setText(control, $any($event.target).value)" />
                }
                @default {
                  <label [for]="id">{{ control.label }}@if (control.required) { <span class="doq-pg-required" aria-hidden="true"> *</span> }</label>
                  <input type="text" [id]="id" [value]="draft(control)" [required]="!!control.required" [attr.placeholder]="control.placeholder ?? null" [attr.aria-invalid]="failure ? 'true' : null" [attr.aria-describedby]="described" (input)="setText(control, $any($event.target).value)" />
                }
              }
              @if (control.description) { <p class="doq-pg-hint" [id]="id + '-hint'">{{ control.description }}</p> }
              @if (failure) { <p class="doq-pg-invalid" [id]="id + '-error'">{{ inputError(failure) }}</p> }
            </div>
          }
        </fieldset>
      }
      @if (definition().outputs?.length) {
        <div class="doq-pg-events">
          <div class="doq-pg-events-bar">
            <p class="doq-pg-subtitle" [id]="uid() + '-events'">{{ i18n.t('playground.events') }}</p>
            <button type="button" class="doq-pg-button" [disabled]="!events().length" (click)="events.set([])">{{ i18n.t('playground.clearEvents') }}</button>
          </div>
          @if (events().length) {
            <ol class="doq-pg-event-list" [attr.aria-labelledby]="uid() + '-events'">
              @for (event of events(); track event.id) { <li><strong>{{ event.label }}</strong> <code>{{ event.detail }}</code></li> }
            </ol>
          } @else { <p class="doq-pg-empty">{{ i18n.t('playground.noEvents') }}</p> }
        </div>
      }
      @if (snippets().length) {
        <div class="doq-pg-source">
          @if (snippets().length > 1) {
            <div class="doq-tablist doq-pg-tablist" role="tablist" [attr.aria-label]="i18n.t('playground.usageCode')" (keydown)="onTabKeydown($event)">
              @for (snippet of snippets(); track $index) {
                <button type="button" role="tab" class="doq-tab" [id]="uid() + '-tab-' + $index" [attr.aria-selected]="tab() === $index" [attr.aria-controls]="uid() + '-panel-' + $index" [attr.tabindex]="tab() === $index ? 0 : -1" (click)="tab.set($index)">{{ snippet.label }}</button>
              }
            </div>
          } @else { <p class="doq-pg-subtitle">{{ snippets()[0]!.label }}</p> }
          @for (snippet of snippets(); track $index) {
            <div class="doq-pg-panel" [attr.role]="snippets().length > 1 ? 'tabpanel' : null" [id]="uid() + '-panel-' + $index" [attr.aria-labelledby]="snippets().length > 1 ? uid() + '-tab-' + $index : null" [attr.tabindex]="snippets().length > 1 ? 0 : null" [hidden]="tab() !== $index">
              <pre><code [attr.class]="snippet.language ? 'language-' + snippet.language : null">{{ snippet.text }}</code></pre>
              <button type="button" class="doq-pg-copy" [attr.aria-label]="copyLabel(snippet)" (click)="copy(snippet)">{{ copyText(snippet) }}</button>
            </div>
          }
        </div>
      }
      <p class="doq-visually-hidden" role="status" aria-live="polite">{{ statusText() }}</p>
      <dialog #dialog class="doq-pg-dialog" [attr.aria-labelledby]="uid() + '-dialog-title'" (close)="onDialogClose()">
        <div class="doq-pg-dialog-bar">
          <p class="doq-pg-title" [id]="uid() + '-dialog-title'">{{ title() }} — {{ i18n.t('playground.expandedPreview') }}</p>
          <button type="button" class="doq-pg-button" (click)="closeDialog()">{{ i18n.t('playground.close') }}</button>
        </div>
        <div class="doq-pg-dialog-body" #dialogBody></div>
      </dialog>
    </div>
  `,
})
export class DoqPlaygroundComponent {
  readonly i18n = inject(DoqI18n);
  /** Stable per document position, so server and browser render the same ids. */
  readonly uid = input.required<string>();
  readonly playgroundId = input.required<string>();
  readonly definition = input.required<DoqPlaygroundDefinition>();

  readonly title = computed(() => this.definition().title ?? this.playgroundId());
  readonly controls = computed<readonly DoqPlaygroundControl[]>(() => this.definition().controls ?? []);
  /** The valid values bound to the component. Reset by a different definition, so a reused instance never shows stale state. */
  readonly values = linkedSignal<readonly DoqPlaygroundControl[], DoqPlaygroundValues>({ source: this.controls, computation: controls => initialDoqValues(controls) });
  private readonly drafts = linkedSignal<readonly DoqPlaygroundControl[], Record<string, string>>({ source: this.controls, computation: controls => initialDrafts(controls) });
  readonly errors = linkedSignal<readonly DoqPlaygroundControl[], Record<string, string>>({ source: this.controls, computation: () => ({}) });
  readonly generation = linkedSignal<DoqPlaygroundDefinition, number>({ source: this.definition, computation: () => 0 });
  readonly events = linkedSignal<DoqPlaygroundDefinition, readonly DoqPlaygroundEvent[]>({ source: this.definition, computation: () => [] });
  readonly sizes = computed(() => { const sizes = this.definition().previewSizes; return sizes === false ? [] : (sizes ?? DOQ_DEFAULT_PREVIEW_SIZES); });
  readonly sizeIndex = linkedSignal<unknown, number>({ source: this.sizes, computation: () => 0 });
  readonly expanded = signal(false);
  readonly frameWidth = computed(() => (this.expanded() ? 'none' : (this.sizes()[this.sizeIndex()]?.width ?? '100%')));
  readonly status = signal<{ key: DoqMessageKey; params?: DoqMessageParams } | undefined>(undefined);
  readonly statusText = computed(() => {
    const message = this.status();
    return message ? this.i18n.t(message.key, message.params) : '';
  });
  readonly tab = linkedSignal<DoqPlaygroundDefinition, number>({ source: this.definition, computation: () => 0 });
  private readonly copied = signal<{ readonly text: string; readonly ok: boolean } | undefined>(undefined);
  readonly snippets = computed<Snippet[]>(() => {
    const values = this.values();
    return (this.definition().code ?? []).map(entry => ({ label: entry.label, language: entry.language, text: runCode(entry.code, values, message => this.i18n.t('playground.codeExampleError', { message })) }));
  });

  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly slot = viewChild.required<ElementRef<HTMLElement>>('slot');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly dialogBody = viewChild.required<ElementRef<HTMLElement>>('dialogBody');
  private readonly expandButton = viewChild.required<ElementRef<HTMLElement>>('expandButton');
  private eventCounter = 0;

  constructor() {
    // A document change or route teardown while expanded must not leave the preview inside a detached dialog.
    inject(DestroyRef).onDestroy(() => this.restoreStage());
  }

  draft(control: DoqStringControl | DoqNumberControl): string { return this.drafts()[control.input] ?? ''; }
  selectRequired(control: DoqSelectControl): boolean { return !!control.required || control.initial !== undefined; }

  setBoolean(control: DoqPlaygroundControl, checked: boolean): void { this.commit(control, checked); }

  setText(control: DoqStringControl | DoqNumberControl, text: string): void {
    this.drafts.update(drafts => ({ ...drafts, [control.input]: text }));
    const parsed = parseDoqControlText(control, text);
    // An invalid entry keeps the last valid value bound and says why, rather than binding NaN or an out-of-range number.
    if ('message' in parsed) this.errors.update(errors => ({ ...errors, [control.input]: parsed.message }));
    else this.commit(control, parsed.value);
  }

  setSelect(control: DoqSelectControl, index: string): void {
    this.commit(control, index === '' ? undefined : control.options[Number(index)]?.value);
  }

  private commit(control: DoqPlaygroundControl, value: DoqControlValue | undefined): void {
    this.errors.update(errors => { if (!(control.input in errors)) return errors; const { [control.input]: _, ...rest } = errors; return rest; });
    this.values.update(values => {
      const { [control.input]: _, ...rest } = values;
      return value === undefined ? rest : { ...rest, [control.input]: value };
    });
  }

  /**
   * Restores every control to its initial value, clears the event list and recreates the previewed component, so a
   * component with internal state (a counter, a finished animation) starts over. Changing a control never recreates it.
   */
  reset(): void {
    const controls = this.controls();
    this.values.set(initialDoqValues(controls));
    this.drafts.set(initialDrafts(controls));
    this.errors.set({});
    this.events.set([]);
    this.generation.update(generation => generation + 1);
    this.status.set({ key: 'playground.resetAnnouncement' });
  }

  setSize(index: number): void {
    this.sizeIndex.set(index);
    const size = this.sizes()[index];
    this.status.set(size ? { key: 'playground.previewAnnouncement', params: { label: size.label, width: size.width === '100%' ? this.i18n.t('playground.previewFullWidth') : size.width } } : undefined);
  }

  onEvent(event: { readonly event: string; readonly payload: unknown }): void {
    const label = this.definition().outputs?.find(output => output.event === event.event)?.label ?? event.event;
    this.events.update(history => appendDoqEvent(history, { id: ++this.eventCounter, label, detail: formatDoqEventPayload(event.payload) }));
  }

  /**
   * The preview moves into a native modal dialog and back: the same component instance, its state and its output
   * subscriptions all survive; nothing is recreated. Escape, the focus trap and inert background come from `<dialog>`.
   * Overlays a component appends to `<body>` (such as CDK overlays) render below the dialog's top layer.
   */
  expand(): void {
    const dialog = this.dialog().nativeElement;
    this.dialogBody().nativeElement.appendChild(this.stage().nativeElement);
    this.expanded.set(true);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  closeDialog(): void {
    const dialog = this.dialog().nativeElement;
    if (typeof dialog.close === 'function') dialog.close();
    else { dialog.removeAttribute('open'); this.onDialogClose(); }
  }

  onDialogClose(): void {
    if (!this.expanded()) return;
    this.restoreStage();
    this.expanded.set(false);
    this.expandButton().nativeElement.focus();
  }

  private restoreStage(): void {
    const stage = this.stage().nativeElement;
    const slot = this.slot().nativeElement;
    if (stage.parentElement !== slot) slot.appendChild(stage);
  }

  onTabKeydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const count = this.snippets().length;
    const current = this.tab();
    const next = event.key === 'ArrowRight' ? (current + 1) % count : event.key === 'ArrowLeft' ? (current - 1 + count) % count : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault();
    this.tab.set(next);
    this.dialog().nativeElement.ownerDocument.getElementById(`${this.uid()}-tab-${next}`)?.focus();
  }

  copyText(snippet: Snippet): string {
    const copied = this.copied();
    return copied?.text === snippet.text
      ? this.i18n.t(copied.ok ? 'playground.copied' : 'playground.copyUnavailable')
      : this.i18n.t('playground.copy');
  }
  copyLabel(snippet: Snippet): string {
    const copied = this.copied();
    return copied?.text === snippet.text
      ? this.i18n.t(copied.ok ? 'playground.copiedLabel' : 'playground.copyUnavailableLabel', { label: snippet.label })
      : this.i18n.t('playground.copyLabel', { label: snippet.label });
  }

  /** Copies exactly the text on screen. */
  async copy(snippet: Snippet): Promise<void> {
    try {
      if (!globalThis.navigator?.clipboard) throw new Error('Clipboard unavailable');
      await globalThis.navigator.clipboard.writeText(snippet.text);
      this.copied.set({ text: snippet.text, ok: true });
      this.status.set({ key: 'playground.copyAnnouncement', params: { label: snippet.label } });
    } catch {
      this.copied.set({ text: snippet.text, ok: false });
      this.status.set({ key: 'playground.clipboardUnavailable' });
    }
  }

  inputError(message: string): string {
    if (message === 'A value is required.') return this.i18n.t('playground.required');
    if (message === 'A number is required.') return this.i18n.t('playground.numberRequired');
    const notNumber = /^“(.*)” is not a number\.$/.exec(message);
    if (notNumber) return this.i18n.t('playground.notNumber', { value: notNumber[1]! });
    const minimum = /^Must be at least (.*)\.$/.exec(message);
    if (minimum) return this.i18n.t('playground.minimum', { value: minimum[1]! });
    const maximum = /^Must be at most (.*)\.$/.exec(message);
    if (maximum) return this.i18n.t('playground.maximum', { value: maximum[1]! });
    return message;
  }
}

function initialDrafts(controls: readonly DoqPlaygroundControl[]): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const control of controls) if ((control.kind === 'string' || control.kind === 'number') && control.initial !== undefined) drafts[control.input] = String(control.initial);
  return drafts;
}

/** A formatter that throws must not take the page down: the panel says so instead. */
function runCode(code: string | ((values: DoqPlaygroundValues) => string), values: DoqPlaygroundValues, formatError: (message: string) => string): string {
  if (typeof code === 'string') return code;
  try { return String(code(values)); } catch (error) { return formatError(error instanceof Error ? error.message : String(error)); }
}

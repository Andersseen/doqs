import { Component, EventEmitter, Input, OnDestroy, Output, booleanAttribute, input, model, numberAttribute, output, signal } from '@angular/core';
import { fireEvent, screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DoqI18nAdapter, DoqPlaygroundDefinition, formatDoqUsage, provideDoqI18n } from '../../src/public-api';
import { FakeDoc } from './content-state';
import { renderDocs } from './harness';

const destroyed: string[] = [];

/** Modern signal inputs: plain, required, aliased and transformed, plus a signal output and a model. */
@Component({
  selector: 'pg-signal',
  template: '<button type="button" [disabled]="disabled()" (click)="pressed.emit(variant())">{{ variant() }}|{{ size() }}|{{ delay() }}|{{ id() }}</button>',
})
class SignalFixtureComponent implements OnDestroy {
  readonly variant = input.required<string>();
  readonly size = input('medium');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly delay = input(0, { transform: numberAttribute });
  readonly id = input('none', { alias: 'identifier' });
  readonly pressed = output<string>({ alias: 'clicked' });
  readonly value = model(0);
  ngOnDestroy() { destroyed.push('signal'); }
}

/** Legacy decorators: @Input with an alias and an EventEmitter output. */
@Component({ selector: 'pg-legacy', template: '<button type="button" (click)="changed.emit({ n: 1 })">{{ label }}:{{ count }}</button>' })
class LegacyFixtureComponent {
  @Input() label = '';
  @Input('total') count = 0;
  @Output() readonly changed = new EventEmitter<{ n: number }>();
}

@Component({ selector: 'pg-stateful', template: '<button type="button" (click)="n.set(n() + 1)">count {{ n() }}</button>' })
class StatefulComponent { readonly n = signal(0); }

const definition: DoqPlaygroundDefinition = {
  component: SignalFixtureComponent,
  title: 'Signal playground',
  description: 'Real signal inputs.',
  controls: [
    { input: 'variant', kind: 'select', label: 'Variant', initial: 'solid', required: true, options: [{ label: 'Solid', value: 'solid' }, { label: 'Outline', value: 'outline' }] },
    { input: 'size', kind: 'string', label: 'Size', initial: 'medium' },
    { input: 'disabled', kind: 'boolean', label: 'Disabled', initial: false },
    { input: 'delay', kind: 'number', label: 'Delay', initial: 0, min: 0, max: 1000, step: 50 },
    { input: 'identifier', kind: 'string', label: 'Identifier', initial: 'a1' },
  ],
  outputs: [{ event: 'clicked', label: 'Pressed' }, { event: 'valueChange', label: 'Value' }],
  code: [
    { label: 'Template', language: 'html', code: values => formatDoqUsage('pg-signal', values) },
    { label: 'Static', language: 'ts', code: 'const a = 1;' },
  ],
};

const page = (body: string): FakeDoc[] => [{ source: 'guide', body, attributes: { title: 'Guide', order: 1 } }, { source: 'other', body: '<p>Other body</p>', attributes: { title: 'Other', order: 2 } }];
const open = (body: string, playgrounds: Record<string, DoqPlaygroundDefinition>, providers: Parameters<typeof renderDocs>[0]['providers'] = []) => renderDocs({ docs: page(body), config: { playgrounds }, url: '/docs/guide', providers });

beforeAll(() => {
  // jsdom has no <dialog> behavior; model the native contract the component relies on.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
});
beforeEach(() => { destroyed.length = 0; });

describe('playground', () => {
  it('COMP-050: mounts the registered component with initial, aliased, required and transformed inputs on first render', async () => {
    const { container } = await open('<h2 id="a">A</h2><p>before</p><p>::playground[sig]</p><p>after</p>', { sig: definition });
    expect(await screen.findByRole('button', { name: 'solid|medium|0|a1' })).toBeTruthy();
    expect(screen.getByText('before')).toBeTruthy();
    expect(screen.getByText('after')).toBeTruthy();
    expect(screen.queryByText('::playground[sig]')).toBeNull();
    expect(container.querySelector('[data-doq-playground="sig"]')?.hasAttribute('data-pagefind-ignore')).toBe(true);
  });

  it('COMP-051: every control updates the real component, without recreating it', async () => {
    const user = userEvent.setup();
    await open('<p>::playground[sig]</p>', { sig: definition });
    const preview = await screen.findByRole('button', { name: 'solid|medium|0|a1' });
    await user.selectOptions(screen.getByLabelText(/Variant/), 'Outline');
    await user.clear(screen.getByLabelText('Size'));
    await user.type(screen.getByLabelText('Size'), 'large');
    await user.clear(screen.getByLabelText('Delay'));
    await user.type(screen.getByLabelText('Delay'), '250');
    await user.clear(screen.getByLabelText('Identifier'));
    await user.type(screen.getByLabelText('Identifier'), 'zed');
    await user.click(screen.getByLabelText('Disabled'));
    expect(preview.textContent).toBe('outline|large|250|zed');
    expect((preview as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'outline|large|250|zed' })).toBe(preview);
    expect(destroyed).toEqual([]);
  });

  it('COMP-052: rejects invalid numbers with accessible feedback and keeps the last valid value bound', async () => {
    const user = userEvent.setup();
    await open('<p>::playground[sig]</p>', { sig: definition });
    const delay = await screen.findByLabelText('Delay');
    await user.clear(delay);
    await user.type(delay, '5000');
    expect(delay.getAttribute('aria-invalid')).toBe('true');
    const message = screen.getByText('Must be at most 1000.');
    expect(delay.getAttribute('aria-describedby')).toContain(message.id);
    expect(screen.getByRole('button', { name: /solid\|medium\|500\|a1/ })).toBeTruthy();
    await user.clear(delay);
    await user.type(delay, '100');
    expect(delay.getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText('Must be at most 1000.')).toBeNull();
    expect(screen.getByRole('button', { name: /\|100\|/ })).toBeTruthy();
  });

  it('COMP-053: observes modern outputs and model changes by public name, formats payloads, clears and resets', async () => {
    const user = userEvent.setup();
    await open('<p>::playground[sig]</p>', { sig: definition });
    await user.click(await screen.findByRole('button', { name: /solid\|/ }));
    await user.click(screen.getByRole('button', { name: /solid\|/ }));
    const list = screen.getByRole('list', { name: 'Events' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getAllByText('Pressed')).toHaveLength(2);
    expect(within(list).getAllByText('"solid"')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText(/No events yet/)).toBeTruthy();
  });

  it('COMP-054: binds legacy @Input aliases and observes EventEmitter outputs', async () => {
    const user = userEvent.setup();
    await open('<p>::playground[old]</p>', {
      old: { component: LegacyFixtureComponent, controls: [{ input: 'label', kind: 'string', label: 'Label', initial: 'hi' }, { input: 'total', kind: 'number', label: 'Total', initial: 3 }], outputs: [{ event: 'changed' }] },
    });
    await user.click(await screen.findByRole('button', { name: 'hi:3' }));
    expect(within(screen.getByRole('list', { name: 'Events' })).getByText('{ n: 1 }')).toBeTruthy();
  });

  it('COMP-055: reset restores the controls, clears events and recreates the component', async () => {
    const user = userEvent.setup();
    await open('<p>::playground[state]</p>', { state: { component: StatefulComponent, title: 'S' } });
    const button = await screen.findByRole('button', { name: 'count 0' });
    await user.click(button);
    expect(button.textContent).toBe('count 1');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('button', { name: 'count 0' })).not.toBe(button);
    expect(screen.getByRole('status').textContent).toContain('reset');
  });

  it('COMP-056: reset returns every control to its initial value', async () => {
    const user = userEvent.setup();
    await open('<p>::playground[sig]</p>', { sig: definition });
    await user.selectOptions(await screen.findByLabelText(/Variant/), 'Outline');
    await user.click(screen.getByLabelText('Disabled'));
    await user.clear(screen.getByLabelText('Delay'));
    await user.type(screen.getByLabelText('Delay'), '9999');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('button', { name: 'solid|medium|0|a1' })).toBeTruthy();
    expect((screen.getByLabelText('Delay') as HTMLInputElement).value).toBe('0');
    expect((screen.getByLabelText('Disabled') as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByText('Must be at most 1000.')).toBeNull();
  });

  it('COMP-057: keeps several instances, including repeats of one id, independent', async () => {
    const user = userEvent.setup();
    await open('<p>::playground[sig]</p><p>::playground[sig]</p>', { sig: definition });
    const groups = await screen.findAllByRole('group', { name: 'Signal playground' });
    expect(groups).toHaveLength(2);
    await user.selectOptions(within(groups[0]!).getByLabelText(/Variant/), 'Outline');
    expect(within(groups[0]!).getByRole('button', { name: /outline\|/ })).toBeTruthy();
    expect(within(groups[1]!).getByRole('button', { name: /solid\|/ })).toBeTruthy();
    expect(new Set(groups.map((g) => g.getAttribute('aria-labelledby'))).size).toBe(2);
  });

  it('COMP-058: switches preview widths without recreating the component and announces the change', async () => {
    const user = userEvent.setup();
    const { container } = await open('<p>::playground[sig]</p>', { sig: definition });
    const preview = await screen.findByRole('button', { name: /solid\|/ });
    const frame = container.querySelector<HTMLElement>('.doq-pg-frame')!;
    expect(screen.getByRole('button', { name: 'Responsive' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Mobile' }));
    expect(frame.style.maxWidth).toBe('320px');
    expect(screen.getByRole('button', { name: 'Mobile' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Preview width: Mobile, 320px.');
    await user.click(screen.getByRole('button', { name: 'Tablet' }));
    expect(frame.style.maxWidth).toBe('768px');
    expect(screen.getByRole('button', { name: /solid\|/ })).toBe(preview);
  });

  it('COMP-059: lets a consumer customise or hide the width presets', async () => {
    await open('<p>::playground[a]</p><p>::playground[b]</p>', {
      a: { component: StatefulComponent, title: 'A', previewSizes: [{ label: 'Tiny', width: '200px' }, { label: 'Huge', width: '90%' }] },
      b: { component: StatefulComponent, title: 'B', previewSizes: false },
    });
    expect(await screen.findByRole('button', { name: 'Tiny' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mobile' })).toBeNull();
    expect(within(screen.getByRole('group', { name: 'B' })).queryByRole('group', { name: 'Preview width' })).toBeNull();
  });

  it('COMP-069: translates playground chrome reactively and keeps consumer labels intact', async () => {
    const locale = signal('en');
    const direction = signal<'ltr' | 'rtl'>('ltr');
    const spanish: Record<string, string> = {
      'playground.reset': 'Restablecer',
      'playground.expand': 'Ampliar',
      'playground.inputs': 'Entradas',
      'playground.events': 'Eventos',
      'playground.clearEvents': 'Vaciar',
      'playground.noEvents': 'Aún no hay eventos.',
      'playground.resetAnnouncement': 'El entorno se restableció.',
    };
    const adapter: DoqI18nAdapter = {
      locale: locale.asReadonly(),
      direction: direction.asReadonly(),
      translate: (key, fallback) => locale() === 'es' ? spanish[key] ?? fallback : fallback,
      localize: path => path,
    };
    const user = userEvent.setup();
    await open('<p>::playground[sig]</p>', { sig: definition }, [provideDoqI18n(adapter)]);
    expect(screen.getByRole('button', { name: 'Reset' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Preview width' })).toBeTruthy();
    locale.set('es');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Restablecer' })).toBeTruthy());
    expect(screen.getByRole('group', { name: 'Preview width' })).toBeTruthy();
    expect(screen.getByText('Variant')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Restablecer' }));
    expect(screen.getByRole('status').textContent).toBe('El entorno se restableció.');
  });

  it('COMP-060: expands into a dialog keeping the same component instance and returns focus on close', async () => {
    const user = userEvent.setup();
    await open('<p>::playground[state]</p>', { state: { component: StatefulComponent, title: 'Stateful' } });
    const button = await screen.findByRole('button', { name: 'count 0' });
    await user.click(button);
    const expand = screen.getByRole('button', { name: 'Expand' });
    await user.click(expand);
    const dialog = document.querySelector('dialog')!;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.contains(button)).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toContain('Stateful');
    await user.click(button);
    expect(button.textContent).toBe('count 2');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(dialog.contains(button)).toBe(false);
    expect(button.textContent).toBe('count 2');
    expect(document.activeElement).toBe(expand);
    // Escape in a real browser closes a modal dialog through the same `close` event.
    await user.click(expand);
    dialog.dispatchEvent(new Event('close'));
    expect(document.activeElement).toBe(expand);
  });

  it('COMP-061: shows code that follows the controls, tabs it, and copies exactly what is displayed', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await open('<p>::playground[sig]</p>', { sig: definition });
    await user.selectOptions(await screen.findByLabelText(/Variant/), 'Outline');
    await user.clear(screen.getByLabelText('Size'));
    await user.type(screen.getByLabelText('Size'), 'a "q" <b>');
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Template', 'Static']);
    const panel = screen.getByRole('tabpanel', { name: 'Template' });
    const shown = panel.querySelector('code')!.textContent!;
    expect(shown).toContain('variant="outline"');
    expect(shown).toContain('size="a &quot;q&quot; &lt;b&gt;"');
    expect(shown).toContain('[disabled]="false"');
    await user.click(within(panel).getByRole('button', { name: 'Copy Template code' }));
    expect(writeText).toHaveBeenCalledWith(shown);
    expect(screen.getByRole('status').textContent).toContain('copied');
    await user.click(screen.getByRole('tab', { name: 'Static' }));
    expect(screen.getByRole('tab', { name: 'Static' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Static' }).textContent).toContain('const a = 1;');
    tabs[1]!.focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Template' }));
  });

  it('COMP-068: the playground copy button is not a Markdown code-block button (`.doq-code-copy` stays Markdown-only)', async () => {
    await open('<p>::playground[sig]</p>', { sig: definition });
    await screen.findByRole('group', { name: 'Signal playground' });
    expect(document.querySelectorAll('.doq-code-copy')).toHaveLength(0);
    expect(document.querySelectorAll('.doq-pg-copy').length).toBeGreaterThan(0);
  });

  it('COMP-062: reports clipboard failure instead of claiming success', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    await open('<p>::playground[a]</p>', { a: { component: StatefulComponent, title: 'A', code: [{ label: 'Only', code: 'x' }] } });
    await user.click(await screen.findByRole('button', { name: 'Copy Only code' }));
    expect(screen.getByRole('button', { name: 'Clipboard access unavailable' }).textContent).toBe('Copy unavailable');
  });

  it('COMP-063: explains an unregistered id and a failing code formatter instead of breaking the page', async () => {
    await open('<p>::playground[missing]</p><p>::playground[boom]</p>', {
      boom: { component: StatefulComponent, title: 'Boom', code: [{ label: 'T', code: () => { throw new Error('kaput'); } }] },
    });
    expect(await screen.findByText(/Playground “missing” is not registered/)).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Boom' }).textContent).toContain('could not be generated: kaput');
  });

  it('COMP-064: shows a clear message when the component cannot be created with the configured outputs', async () => {
    await open('<p>::playground[bad]</p>', { bad: { component: StatefulComponent, title: 'Bad', outputs: [{ event: 'nope' }] } });
    expect((await screen.findByRole('alert')).textContent).toContain('The preview could not be created');
  });

  it('COMP-065: destroys components and leaves no dialog content when navigating away', async () => {
    const user = userEvent.setup();
    const { router } = await open('<p>::playground[sig]</p>', { sig: definition });
    await screen.findByRole('button', { name: /solid\|/ });
    await user.click(screen.getByRole('button', { name: 'Expand' }));
    await router.navigateByUrl('/docs/other');
    await screen.findByText('Other body');
    await waitFor(() => expect(destroyed).toEqual(['signal']));
    expect(document.querySelector('.doq-pg-stage')).toBeNull();
  });

  it('COMP-066: a playground named like an object prototype member is not registered by accident', async () => {
    await open('<p>::playground[constructor]</p>', { other: { component: StatefulComponent } });
    expect(await screen.findByText(/Playground “constructor” is not registered/)).toBeTruthy();
  });

  it('COMP-067: legacy ::demo[id] is unchanged next to a playground', async () => {
    await renderDocs({ docs: page('<p>::demo[counter]</p><p>::playground[s]</p>'), config: { demos: { counter: StatefulComponent }, playgrounds: { s: { component: StatefulComponent, title: 'S' } } }, url: '/docs/guide' });
    expect(await screen.findAllByRole('button', { name: 'count 0' })).toHaveLength(2);
    expect(document.querySelector('[data-doq-demo="counter"]')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'count 0' })[0]!);
  });
});

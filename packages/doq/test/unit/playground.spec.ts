import { describe, expect, it } from 'vitest';
import {
  appendDoqEvent, DoqPlaygroundControl, DoqPlaygroundDefinition, formatDoqEventPayload, formatDoqUsage, initialDoqValues, parseDoqControlText, validateDoqPlaygrounds,
} from '../../config/src/lib/doq-playground-model';
import { defineDoqConfig } from '../../config/src/lib/doq-config';
import { parseDoqContent, parseDoqDocument } from '../../src/lib/doq-rich-content';

class Fixture {}
const define = (patch: Partial<DoqPlaygroundDefinition>): DoqPlaygroundDefinition => ({ component: Fixture, ...patch });
const check = (patch: Partial<DoqPlaygroundDefinition>, id = 'ok') => validateDoqPlaygrounds({ [id]: define(patch) });

describe('::playground[id] directive', () => {
  it('UNIT-050: recognises a standalone paragraph, keeps order and ::demo untouched', () => {
    const out = parseDoqDocument('<h2 id="a">A</h2><p>before</p><p>::playground[button-basic]</p><p>::demo[plain]</p><p>after</p>');
    expect(out.map((s) => (s.kind === 'html' ? 'html' : `${s.kind}:${s.id}`))).toEqual(['html', 'playground:button-basic', 'demo:plain', 'html']);
    expect(out[0]).toMatchObject({ html: '<h2 id="a">A</h2><p>before</p>' });
  });

  it('UNIT-051: leaves look-alikes literal in code, inline code, quotes, lists, tables and malformed ids', () => {
    const source = [
      '<pre><code>::playground[in-fence]\n</code></pre>', '<p>Use <code>::playground[inline]</code>.</p>', '<blockquote><p>::playground[quote]</p></blockquote>',
      '<ul><li><p>::playground[list]</p></li></ul>', '<table><tbody><tr><td>::playground[cell]</td></tr></tbody></table>',
      '<p>::playground[bad id]</p>', '<p>text ::playground[x]</p>', '<p>::playground[]</p>',
    ].join('');
    expect(parseDoqDocument(source)).toEqual([{ kind: 'html', html: source }]);
  });

  it('UNIT-052: repeated ids produce one segment each, and tab bodies keep the directive literal', () => {
    expect(parseDoqDocument('<p>::playground[x]</p><p>::playground[x]</p>')).toEqual([{ kind: 'playground', id: 'x' }, { kind: 'playground', id: 'x' }]);
    const tabs = parseDoqDocument('<p>:::tabs G\n:::tab One</p><p>::playground[x]</p><p>:::</p>');
    expect(JSON.stringify(tabs)).not.toContain('"playground"');
  });

  it('UNIT-065: parseDoqContent, the 0.8 API, never produces playground segments', () => {
    const source = '<p>before</p><p>::playground[x]</p><p>::demo[d]</p>';
    expect(parseDoqContent(source)).toEqual([{ kind: 'html', html: '<p>before</p><p>::playground[x]</p>' }, { kind: 'demo', id: 'd' }]);
  });
});

describe('playground registry validation', () => {
  it('UNIT-053: accepts a valid definition and an absent registry', () => {
    expect(validateDoqPlaygrounds(undefined)).toEqual([]);
    expect(check({ controls: [{ input: 'a', kind: 'select', label: 'A', initial: 'x', options: [{ label: 'X', value: 'x' }] }, { input: 'n', kind: 'number', label: 'N', initial: 2, min: 1, max: 3, step: 1 }], outputs: [{ event: 'done' }], code: [{ label: 'T', code: 'x' }] })).toEqual([]);
  });

  it('UNIT-054: reports duplicates, bad ids, missing labels, unsupported kinds and non-components', () => {
    expect(check({ controls: [{ input: 'a', kind: 'boolean', label: 'A' }, { input: 'a', kind: 'boolean', label: 'B' }] }).join()).toContain('duplicate control for input "a"');
    expect(check({}, 'bad id')[0]).toContain('the id must start');
    expect(check({ controls: [{ input: 'a', kind: 'boolean', label: ' ' }] }).join()).toContain('"label" is required');
    expect(check({ controls: [{ input: 'a', kind: 'slider' } as unknown as DoqPlaygroundControl] }).join()).toContain('unsupported kind "slider"');
    expect(validateDoqPlaygrounds({ x: { component: 'nope' } as unknown as DoqPlaygroundDefinition })[0]).toContain('standalone component class');
    expect(check({ outputs: [{ event: 'a' }, { event: 'a' }] }).join()).toContain('duplicate output');
  });

  it('UNIT-055: reports invalid select, number and required definitions', () => {
    const one = (control: DoqPlaygroundControl) => check({ controls: [control] }).join('|');
    expect(one({ input: 's', kind: 'select', label: 'S', options: [{ label: 'A', value: 'a' }], initial: 'zzz' })).toContain('not one of the options');
    expect(one({ input: 's', kind: 'select', label: 'S', options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'a' }] })).toContain('duplicate option');
    expect(one({ input: 's', kind: 'select', label: 'S', options: [] })).toContain('at least one option');
    expect(one({ input: 'n', kind: 'number', label: 'N', initial: 9, max: 3 })).toContain('outside min/max');
    expect(one({ input: 'n', kind: 'number', label: 'N', min: 5, max: 1 })).toContain('"min" is greater');
    expect(one({ input: 'n', kind: 'number', label: 'N', initial: Number.NaN })).toContain('finite number');
    expect(one({ input: 'n', kind: 'number', label: 'N', step: 0 })).toContain('"step"');
    expect(one({ input: 't', kind: 'string', label: 'T', required: true })).toContain('needs an "initial"');
  });

  it('UNIT-056: defineDoqConfig throws one readable error and leaves registry-free configs valid', () => {
    expect(() => defineDoqConfig({ contentDirectory: 'docs', playgrounds: { 'a b': define({}) } })).toThrow(/invalid playground configuration/);
    expect(defineDoqConfig({ contentDirectory: 'docs' }).playgrounds).toBeUndefined();
    expect(defineDoqConfig({ contentDirectory: 'docs', demos: { x: Fixture } }).demos).toEqual({ x: Fixture });
  });
});

describe('control values', () => {
  const controls: DoqPlaygroundControl[] = [
    { input: 'disabled', kind: 'boolean', label: 'D' }, { input: 'on', kind: 'boolean', label: 'O', initial: true }, { input: 'label', kind: 'string', label: 'L', initial: 'Hi' },
    { input: 'size', kind: 'select', label: 'S', initial: 2, options: [{ label: 'Two', value: 2 }] }, { input: 'delay', kind: 'number', label: 'Delay' },
  ];
  it('UNIT-057: derives initial values; booleans default to false and unset optionals are left out', () => {
    expect(initialDoqValues(controls)).toEqual({ disabled: false, on: true, label: 'Hi', size: 2 });
  });

  it('UNIT-058: parses numbers with range checks and never accepts NaN', () => {
    const n = { input: 'n', kind: 'number', label: 'N', min: 0, max: 10 } as const;
    expect(parseDoqControlText(n, '4.5')).toEqual({ ok: true, value: 4.5 });
    expect(parseDoqControlText(n, '')).toEqual({ ok: true, value: undefined });
    expect(parseDoqControlText({ ...n, required: true }, '  ')).toMatchObject({ ok: false });
    for (const bad of ['abc', 'NaN', 'Infinity', '1e999']) expect(parseDoqControlText(n, bad)).toMatchObject({ ok: false });
    expect(parseDoqControlText(n, '-1')).toMatchObject({ ok: false, message: 'Must be at least 0.' });
    expect(parseDoqControlText(n, '11')).toMatchObject({ ok: false, message: 'Must be at most 10.' });
    expect(parseDoqControlText({ input: 's', kind: 'string', label: 'S', required: true }, '')).toMatchObject({ ok: false });
  });
});

describe('usage snippets', () => {
  it('UNIT-059: renders strings, numbers and booleans as Angular template usage', () => {
    expect(formatDoqUsage('app-button', { variant: 'solid', disabled: false, delay: 300 })).toBe('<app-button variant="solid" [disabled]="false" [delay]="300" />');
    expect(formatDoqUsage('app-button', {}, { text: 'Save' })).toBe('<app-button>Save</app-button>');
    expect(formatDoqUsage('button', { size: 'md' }, { attributes: ['voltButton'], text: 'A <b>' })).toBe('<button voltButton size="md">A &lt;b&gt;</button>');
    expect(formatDoqUsage('b', {}, { text: '{{ x }}' })).toBe('<b>&#123;&#123; x &#125;&#125;</b>');
  });

  it('UNIT-060: escapes quotes and angle brackets, and turns interpolation or newlines into string expressions', () => {
    expect(formatDoqUsage('x-y', { label: 'Say "hi" <b>&' })).toBe('<x-y label="Say &quot;hi&quot; &lt;b&gt;&amp;" />');
    expect(formatDoqUsage('x-y', { label: '{{ secret }}' })).toBe(`<x-y [label]="'{{ secret }}'" />`);
    expect(formatDoqUsage('x-y', { label: "it's\nnew" })).toBe(`<x-y [label]="'it\\'s\\nnew'" />`);
  });

  it('UNIT-061: omits unset values and unusable names, wraps long usage and rejects non-element names', () => {
    expect(formatDoqUsage('x-y', { a: undefined, 'bad name': 'v', ok: 'v' })).toBe('<x-y ok="v" />');
    expect(formatDoqUsage('x-y', { first: 'a'.repeat(40), second: 'b'.repeat(40) })).toContain('\n  first="');
    expect(() => formatDoqUsage('[voltButton]', {})).toThrow(/element name/);
  });
});

describe('event payload formatting', () => {
  it('UNIT-062: formats primitives and small objects', () => {
    expect(formatDoqEventPayload('a')).toBe('"a"');
    expect(formatDoqEventPayload(3)).toBe('3');
    expect(formatDoqEventPayload(null)).toBe('null');
    expect(formatDoqEventPayload(undefined)).toBe('undefined');
    expect(formatDoqEventPayload({ a: 1, b: [1, 2] })).toBe('{ a: 1, b: [1, 2] }');
  });

  it('UNIT-063: survives circular objects, functions, DOM events, getters that throw and sensitive keys', () => {
    const loop: Record<string, unknown> = { name: 'x' };
    loop['self'] = loop;
    expect(formatDoqEventPayload(loop)).toBe('{ name: "x", self: [Circular] }');
    expect(formatDoqEventPayload(() => 1)).toBe('[Function]');
    expect(formatDoqEventPayload({ password: 'hunter2', apiKey: 'k', ok: 1 })).toBe('{ password: [redacted], apiKey: [redacted], ok: 1 }');
    expect(formatDoqEventPayload({ get boom(): number { throw new Error('no'); } })).toBe('[Unreadable]');
    expect(formatDoqEventPayload(new Map())).toBe('[Map]');
  });

  it('UNIT-064: bounds long text, wide objects, deep nesting and history length', () => {
    expect(formatDoqEventPayload('x'.repeat(1000)).length).toBeLessThanOrEqual(161);
    expect(formatDoqEventPayload(Array.from({ length: 50 }, (_, i) => i))).toContain('… 44 more');
    expect(formatDoqEventPayload({ a: { b: { c: { d: 1 } } } })).toBe('{ a: { b: { c: [Object] } } }');
    let history = [] as ReturnType<typeof appendDoqEvent>;
    for (let id = 1; id <= 30; id++) history = appendDoqEvent(history, { id, label: 'e', detail: '' });
    expect(history).toHaveLength(20);
    expect(history[0]!.id).toBe(30);
  });

  it('UNIT-177: expandedPreview is optional, accepts modal and overlay-compatible, and rejects anything else', () => {
    expect(check({})).toEqual([]);
    expect(check({ expandedPreview: 'modal' })).toEqual([]);
    expect(check({ expandedPreview: 'overlay-compatible' })).toEqual([]);
    expect(check({ expandedPreview: 'floating' as never })[0]).toContain('"expandedPreview" must be "modal" or "overlay-compatible"');
  });
});

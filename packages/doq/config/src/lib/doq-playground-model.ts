import type { Type } from '@angular/core';

/** A value a playground control can bind to a component input. */
export type DoqControlValue = string | number | boolean;
/** The current bound values, keyed by public input name. An input with no value yet is absent or `undefined`. */
export type DoqPlaygroundValues = Readonly<Record<string, DoqControlValue | undefined>>;

interface DoqControlBase {
  /** The component's public binding name (the alias when the input declares one), not necessarily the class property. */
  readonly input: string;
  /** Visible label, also the control's accessible name. */
  readonly label: string;
  /** Optional hint shown under the control and linked with `aria-describedby`. */
  readonly description?: string;
  /** The component input is required: the control must start with a valid value and can never be left empty. */
  readonly required?: boolean;
}

/** Checkbox. Starts as `false` unless `initial` says otherwise; the value is always bound. */
export interface DoqBooleanControl extends DoqControlBase { readonly kind: 'boolean'; readonly initial?: boolean }
/** Text field. Without `initial` the input stays unbound until the reader types. */
export interface DoqStringControl extends DoqControlBase { readonly kind: 'string'; readonly initial?: string; readonly placeholder?: string }
/** Numeric field; out-of-range and non-numeric text is rejected with a message and the last valid value stays bound. */
export interface DoqNumberControl extends DoqControlBase { readonly kind: 'number'; readonly initial?: number; readonly min?: number; readonly max?: number; readonly step?: number }
export interface DoqSelectOption { readonly label: string; readonly value: DoqControlValue }
/** A finite list of options. Without `initial` the first entry is an empty "unset" choice. */
export interface DoqSelectControl extends DoqControlBase { readonly kind: 'select'; readonly options: readonly DoqSelectOption[]; readonly initial?: DoqControlValue }
export type DoqPlaygroundControl = DoqBooleanControl | DoqStringControl | DoqNumberControl | DoqSelectControl;

/** A component output to observe, by its public name (the alias when the output declares one). A `model()` exposes `<name>Change`. */
export interface DoqPlaygroundOutput { readonly event: string; readonly label?: string }

/** One code tab: static text, or a trusted function of the current valid control values. */
export interface DoqPlaygroundCode {
  readonly label: string;
  readonly language?: string;
  readonly code: string | ((values: DoqPlaygroundValues) => string);
}

/** A preview-container width. `width` is any CSS length; it never exceeds the available space. */
export interface DoqPreviewSize { readonly label: string; readonly width: string }

export interface DoqPlaygroundDefinition {
  /** A consumer-owned standalone component. A directive needs a small wrapper component that applies it. */
  readonly component: Type<unknown>;
  /** Heading of the playground; defaults to its registry id. */
  readonly title?: string;
  readonly description?: string;
  readonly controls?: readonly DoqPlaygroundControl[];
  readonly outputs?: readonly DoqPlaygroundOutput[];
  readonly code?: readonly DoqPlaygroundCode[];
  /** Preview widths; `false` hides the width switcher. Defaults to Responsive (100%), Mobile (320px) and Tablet (768px). */
  readonly previewSizes?: false | readonly DoqPreviewSize[];
}

export type DoqPlaygroundRegistry = Readonly<Record<string, DoqPlaygroundDefinition>>;

export const DOQ_DEFAULT_PREVIEW_SIZES: readonly DoqPreviewSize[] = [
  { label: 'Responsive', width: '100%' },
  { label: 'Mobile', width: '320px' },
  { label: 'Tablet', width: '768px' },
];

/** The most recent events a playground keeps; older ones are dropped. */
export const DOQ_PLAYGROUND_EVENT_LIMIT = 20;

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const KINDS = new Set(['boolean', 'string', 'number', 'select']);
const isPrimitive = (value: unknown): value is DoqControlValue => typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));

/** Every problem in a registry, as readable sentences; empty when the registry is valid. Pure and build-safe. */
export function validateDoqPlaygrounds(registry: DoqPlaygroundRegistry | undefined): string[] {
  const problems: string[] = [];
  for (const [id, definition] of Object.entries(registry ?? {})) {
    const at = `playground "${id}"`;
    if (!ID.test(id)) problems.push(`${at}: the id must start with a letter or digit and contain only letters, digits, "_" and "-"`);
    if (!definition || typeof definition.component !== 'function') { problems.push(`${at}: "component" must be a standalone component class`); continue; }
    const seen = new Set<string>();
    (definition.controls ?? []).forEach((control, index) => {
      const here = `${at}, control ${index + 1}${control?.input ? ` ("${control.input}")` : ''}`;
      if (!control || !KINDS.has(control.kind)) { problems.push(`${here}: unsupported kind "${(control as { kind?: unknown } | undefined)?.kind}" (use boolean, string, number or select)`); return; }
      if (!control.input?.trim()) problems.push(`${here}: "input" is required`);
      else if (seen.has(control.input)) problems.push(`${here}: duplicate control for input "${control.input}"`);
      else seen.add(control.input);
      if (!control.label?.trim()) problems.push(`${here}: "label" is required (it is the control's accessible name)`);
      if (control.required && control.kind !== 'boolean' && control.initial === undefined) problems.push(`${here}: a required ${control.kind} control needs an "initial" value`);
      if (control.kind === 'boolean' && control.initial !== undefined && typeof control.initial !== 'boolean') problems.push(`${here}: "initial" must be a boolean`);
      if (control.kind === 'string' && control.initial !== undefined && typeof control.initial !== 'string') problems.push(`${here}: "initial" must be a string`);
      if (control.kind === 'number') {
        const { initial, min, max, step } = control;
        for (const [name, value] of [['initial', initial], ['min', min], ['max', max], ['step', step]] as const) if (value !== undefined && !Number.isFinite(value)) problems.push(`${here}: "${name}" must be a finite number`);
        if (min !== undefined && max !== undefined && min > max) problems.push(`${here}: "min" is greater than "max"`);
        if (step !== undefined && !(step > 0)) problems.push(`${here}: "step" must be greater than 0`);
        if (initial !== undefined && Number.isFinite(initial) && ((min !== undefined && initial < min) || (max !== undefined && initial > max))) problems.push(`${here}: "initial" ${initial} is outside min/max`);
      }
      if (control.kind === 'select') {
        if (!Array.isArray(control.options) || !control.options.length) problems.push(`${here}: "options" needs at least one option`);
        else {
          const values: DoqControlValue[] = [];
          for (const option of control.options) {
            if (!option?.label?.trim() || !isPrimitive(option.value)) problems.push(`${here}: every option needs a "label" and a string, number or boolean "value"`);
            else if (values.includes(option.value)) problems.push(`${here}: duplicate option value ${JSON.stringify(option.value)}`);
            else values.push(option.value);
          }
          if (control.initial !== undefined && !values.includes(control.initial)) problems.push(`${here}: "initial" ${JSON.stringify(control.initial)} is not one of the options`);
        }
      }
    });
    const events = new Set<string>();
    (definition.outputs ?? []).forEach((output, index) => {
      if (!output?.event?.trim()) problems.push(`${at}, output ${index + 1}: "event" is required`);
      else if (events.has(output.event)) problems.push(`${at}, output ${index + 1}: duplicate output "${output.event}"`);
      else events.add(output.event);
    });
    (definition.code ?? []).forEach((code, index) => {
      if (!code?.label?.trim()) problems.push(`${at}, code ${index + 1}: "label" is required`);
      if (typeof code?.code !== 'string' && typeof code?.code !== 'function') problems.push(`${at}, code ${index + 1}: "code" must be a string or a function`);
    });
    if (definition.previewSizes) {
      if (!Array.isArray(definition.previewSizes) || !definition.previewSizes.length) problems.push(`${at}: "previewSizes" needs at least one size, or false`);
      else for (const size of definition.previewSizes) if (!size?.label?.trim() || !size.width?.trim()) problems.push(`${at}: every preview size needs a "label" and a "width"`);
    }
  }
  return problems;
}

/** The values a playground starts with and returns to on reset. Unset optional inputs are left out. */
export function initialDoqValues(controls: readonly DoqPlaygroundControl[]): Record<string, DoqControlValue> {
  const values: Record<string, DoqControlValue> = {};
  for (const control of controls) {
    const value = control.kind === 'boolean' ? (control.initial ?? false) : control.initial;
    if (value !== undefined) values[control.input] = value;
  }
  return values;
}

export type DoqParsedInput = { readonly ok: true; readonly value: DoqControlValue | undefined } | { readonly ok: false; readonly message: string };

/** Turn what the reader typed into a bindable value, or say precisely why it cannot be one. Nothing invalid passes silently. */
export function parseDoqControlText(control: DoqStringControl | DoqNumberControl, text: string): DoqParsedInput {
  if (control.kind === 'string') return text === '' && control.required ? { ok: false, message: 'A value is required.' } : { ok: true, value: text };
  const trimmed = text.trim();
  if (trimmed === '') return control.required ? { ok: false, message: 'A number is required.' } : { ok: true, value: undefined };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { ok: false, message: `“${trimmed}” is not a number.` };
  if (control.min !== undefined && value < control.min) return { ok: false, message: `Must be at least ${control.min}.` };
  if (control.max !== undefined && value > control.max) return { ok: false, message: `Must be at most ${control.max}.` };
  return { ok: true, value };
}

const ATTRIBUTE_NAME = /^[A-Za-z_][\w.-]*$/;
const SELECTOR = /^[a-z][a-z0-9-]*$/;
const htmlEscape = (text: string): string => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A usage snippet for a component or attribute directive from the current values, for `DoqPlaygroundCode.code`:
 * strings become plain attributes, numbers and booleans become property bindings. Text that Angular would read as
 * an interpolation or that spans lines becomes a quoted string expression, so what is shown is what the template means.
 * Unset inputs and names that cannot be template attributes are left out.
 *
 * `selector` is the element name (`app-button`, or `button` for an attribute directive). `attributes` are static,
 * trusted attributes written first (`voltButton`, `type="button"`). `text` becomes the element body, escaped.
 *
 * `defaults` is optional and purely subtractive: an input whose current value is identical (`Object.is`) to the
 * default declared for that exact name is left out, so a snippet shows only what the reader actually changed.
 * Only names present in `defaults` are ever candidates, which is why `0` and `false` survive everywhere else —
 * nothing is suppressed by type. Omitting `defaults` reproduces the 0.11 output byte for byte.
 */
export function formatDoqUsage(selector: string, values: DoqPlaygroundValues, options: { readonly attributes?: readonly string[]; readonly text?: string; readonly defaults?: Readonly<Record<string, unknown>> } = {}): string {
  if (!SELECTOR.test(selector)) throw new Error(`formatDoqUsage: "${selector}" is not an element name`);
  const attributes: string[] = [...(options.attributes ?? [])];
  const defaults = options.defaults;
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || !ATTRIBUTE_NAME.test(name)) continue;
    if (defaults && name in defaults && Object.is(value, defaults[name])) continue;
    if (typeof value === 'number') { if (Number.isFinite(value)) attributes.push(`[${name}]="${value}"`); }
    else if (typeof value === 'boolean') attributes.push(`[${name}]="${value}"`);
    else if (/\{\{|\}\}|[\n\r\t\\]/.test(value)) {
      const literal = `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}'`;
      attributes.push(`[${name}]="${htmlEscape(literal)}"`);
    } else attributes.push(`${name}="${htmlEscape(value)}"`);
  }
  const open = `<${selector}${attributes.length ? ` ${attributes.join(' ')}` : ''}`;
  const body = options.text === undefined ? undefined : htmlEscape(options.text).replace(/&quot;/g, '"').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
  const inline = body === undefined ? `${open} />` : `${open}>${body}</${selector}>`;
  if (inline.length <= 80 || !attributes.length) return inline;
  const lines = attributes.map(attribute => `  ${attribute}`).join('\n');
  return body === undefined ? `<${selector}\n${lines}\n/>` : `<${selector}\n${lines}\n>${body}</${selector}>`;
}

const SENSITIVE_KEY = /pass(word|phrase)?|secret|token|authorization|api[-_]?key|credential|cookie|session/i;
const MAX_TEXT = 160;
const MAX_ITEMS = 6;
const MAX_DEPTH = 3;

const clip = (text: string): string => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text);

/**
 * A bounded, side-effect-free description of an event payload for the inspector. Primitives are shown as written;
 * small plain objects and arrays are summarised; DOM nodes and events, functions, circular references and values under
 * keys that look sensitive (password, token, secret…) never expose their content. It never calls `JSON.stringify`.
 */
export function formatDoqEventPayload(value: unknown): string {
  return clip(describe(value, 0, new Set()));
}

function describe(value: unknown, depth: number, seen: Set<object>): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'undefined': return 'undefined';
    case 'string': return JSON.stringify(value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value);
    case 'number': case 'boolean': return String(value);
    case 'bigint': return `${value}n`;
    case 'symbol': return 'Symbol()';
    case 'function': return '[Function]';
  }
  const object = value as object;
  if (seen.has(object)) return '[Circular]';
  const tag = Object.prototype.toString.call(object).slice(8, -1);
  if (typeof Event !== 'undefined' && object instanceof Event) return `[${object.constructor.name}${object.type ? ` ${object.type}` : ''}]`;
  if (typeof Node !== 'undefined' && object instanceof Node) return `[${object.nodeName.toLowerCase()}]`;
  if (object instanceof Date) return Number.isNaN(object.getTime()) ? 'Invalid Date' : object.toISOString();
  if (object instanceof Error) return `[${object.name}]`;
  if (tag !== 'Object' && tag !== 'Array') return `[${tag}]`;
  if (depth >= MAX_DEPTH) return Array.isArray(object) ? '[Array]' : '[Object]';
  seen.add(object);
  try {
    if (Array.isArray(object)) {
      const items = object.slice(0, MAX_ITEMS).map(item => describe(item, depth + 1, seen));
      return `[${items.join(', ')}${object.length > MAX_ITEMS ? `, … ${object.length - MAX_ITEMS} more` : ''}]`;
    }
    const keys = Object.keys(object);
    const parts = keys.slice(0, MAX_ITEMS).map(key => `${key}: ${SENSITIVE_KEY.test(key) ? '[redacted]' : describe((object as Record<string, unknown>)[key], depth + 1, seen)}`);
    return `{ ${parts.join(', ')}${keys.length > MAX_ITEMS ? `, … ${keys.length - MAX_ITEMS} more` : ''} }`;
  } catch { return '[Unreadable]'; } finally { seen.delete(object); }
}

export interface DoqPlaygroundEvent { readonly id: number; readonly label: string; readonly detail: string }

/** Newest first, bounded to `limit`. */
export function appendDoqEvent(history: readonly DoqPlaygroundEvent[], event: DoqPlaygroundEvent, limit = DOQ_PLAYGROUND_EVENT_LIMIT): DoqPlaygroundEvent[] {
  return [event, ...history].slice(0, limit);
}

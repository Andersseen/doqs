import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApiReference, checkApiReference, DoqApiError, generateApiReference } from '../../bin/api-reference.mjs';
import { extractApi } from '../../bin/api-reference/extract.mjs';
import { loadTypeScript } from '../../bin/api-reference/typescript.mjs';
import { assignSlugs, proseBlock, slugify } from '../../bin/api-reference/render.mjs';

// Projects live below packages/doq so that the real "typescript" and "@angular/core" resolve like in a consumer.
const work = resolve(import.meta.dirname, '../.work');
let cwd: string;

beforeEach(async () => {
  await mkdir(work, { recursive: true });
  cwd = await mkdtemp(join(work, 'api-'));
});
afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

async function write(files: Record<string, string>) {
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(cwd, path)), { recursive: true });
    await writeFile(join(cwd, path), text);
  }
}
const options = (extra: Record<string, unknown> = {}) => ({ cwd, entry: 'src/public-api.ts', out: 'src/content/docs/reference/api', ...extra });
async function extract(files: Record<string, string>) {
  await write(files);
  return extractApi(loadTypeScript(cwd), { cwd, entry: 'src/public-api.ts' });
}
const symbol = (model: { symbols: any[] }, name: string) => {
  const found = model.symbols.find((s) => s.name === name);
  if (!found) throw new Error(`symbol ${name} not found in ${model.symbols.map((s) => s.name).join(', ')}`);
  return found;
};
async function pages(files: Record<string, string>, extra: Record<string, unknown> = {}) {
  await write(files);
  return (await buildApiReference(options(extra))).files;
}

describe('UNIT-090 public export discovery', () => {
  it('follows barrels, export-star, renamed and type-only re-exports, and ignores unexported code', async () => {
    const model = await extract({
      'src/public-api.ts': `export * from './lib/barrel';\nexport { Greeter as RenamedGreeter } from './lib/greeter';\nexport type { Config } from './lib/types';`,
      'src/lib/barrel.ts': `export * from './deep';\nexport function direct(): void {}\nclass Hidden {}\nexport const kept = 1;`,
      'src/lib/deep.ts': `export interface Deep { a: string }`,
      'src/lib/greeter.ts': `export class Greeter { greet(name: string): string { return name; } }\nexport class NotReExported {}`,
      'src/lib/types.ts': `export interface Config { debug?: boolean }\nexport interface Unlisted { x: number }`,
    });
    expect(model.symbols.map((s: any) => s.name)).toEqual(['Config', 'Deep', 'RenamedGreeter', 'direct', 'kept']);
    expect(symbol(model, 'RenamedGreeter')).toMatchObject({ category: 'class', declaredName: 'Greeter' });
  });

  it('documents a symbol exported under two names once, and lists the other name', async () => {
    const model = await extract({
      'src/public-api.ts': `import { Thing } from './thing';\nexport { Thing };\nexport { Thing as Alias };`,
      'src/thing.ts': `export interface Thing { id: string }`,
    });
    expect(model.symbols).toHaveLength(1);
    expect(model.symbols[0]).toMatchObject({ name: 'Thing', aliases: ['Alias'] });
  });

  it('skips re-exports from packages and namespaces without failing', async () => {
    const model = await extract({
      'src/public-api.ts': `export { Injectable } from '@angular/core';\nexport * as ns from './ns';\nexport const own = 1;`,
      'src/ns.ts': `export const inner = 1;`,
    });
    expect(model.symbols.map((s: any) => s.name)).toEqual(['own']);
    expect(model.diagnostics.map((d: any) => d.symbol)).toEqual(expect.arrayContaining(['Injectable']));
  });

  it('drops @internal and @ignore exports and private, protected and #private members', async () => {
    const model = await extract({
      'src/public-api.ts': `export * from './a';`,
      'src/a.ts': `/** @internal */\nexport class Secret {}\n/** @ignore */\nexport const skip = 1;\nexport class Service {\n  readonly visible = 1;\n  private hidden = 2;\n  protected guarded = 3;\n  #native = 4;\n  /** @internal */ internalThing = 5;\n  run(): void {}\n  private runPrivate(): void {}\n}`,
    });
    expect(model.symbols.map((s: any) => s.name)).toEqual(['Service']);
    const service = symbol(model, 'Service');
    expect(service.properties.map((p: any) => p.name)).toEqual(['visible']);
    expect(service.methods.map((m: any) => m.name)).toEqual(['run']);
  });

  it('fails clearly for a missing entry point and for a file that is not a module', async () => {
    await write({ 'src/public-api.ts': `const x = 1;` });
    expect(() => extractApi(loadTypeScript(cwd), { cwd, entry: 'src/missing.ts' })).toThrow(/not found/);
    expect(() => extractApi(loadTypeScript(cwd), { cwd, entry: 'src/public-api.ts' })).toThrow(/not a module/);
  });
});

describe('UNIT-091 Angular declarations', () => {
  const angular = {
    'src/public-api.ts': `export * from './ui';`,
    'src/ui.ts': `
import { Component, Directive, Injectable, Pipe, PipeTransform, input, model, output, booleanAttribute, EventEmitter, Input, Output } from '@angular/core';

const SELECTOR = 'app-card';
export type Tone = 'plain' | 'bold';
function toMs(value: unknown): number { return Number(value); }

/**
 * A card.
 *
 * @stability candidate
 * @since 1.2
 */
@Component({ selector: SELECTOR, exportAs: 'card', template: '' })
export class CardComponent {
  /** Visual tone. */
  readonly tone = input<Tone>('plain');
  readonly title = input.required<string>();
  /** Disables the card. */
  readonly disabled = input(false, { alias: 'isDisabled', transform: booleanAttribute });
  readonly duration = input<number | undefined, unknown>(undefined, { transform: toMs });
  readonly open = model(false);
  readonly closed = output<string>();
  readonly picked = output<{ id: number }>({ alias: 'itemPicked' });
  /** Legacy input. */
  @Input() label = '';
  @Input('legacyAlias') aliased = 1;
  @Input({ required: true, transform: booleanAttribute }) flag = false;
  @Output() legacyChange = new EventEmitter<number>();
  @Output('renamed') other = new EventEmitter<string>();
  /** Focuses the card. */
  focus(options?: { preventScroll: boolean }): void {}
  ngOnInit(): void {}
  protected secret = 1;
}

/** @stability experimental */
@Directive({ selector: '[appHighlight], app-highlight', exportAs: 'highlight' })
export class HighlightDirective {
  readonly appHighlight = input<string>('');
}

/** Formats a number. */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: number): string;
  transform(value: string, currency: string): string;
  transform(value: number | string, currency?: string): string { return String(value) + (currency ?? ''); }
}

/** Stores things. */
@Injectable({ providedIn: 'root' })
export class StoreService {
  readonly count = 0;
  /** Adds one. @deprecated Use addMany. */
  add(): void {}
}

const dynamic = 'dyn' + 'amic';
@Directive({ selector: dynamic })
export class DynamicDirective {}
`,
  };

  it('reads selector, exportAs, stability and since from a component', async () => {
    const card = symbol(await extract(angular), 'CardComponent');
    expect(card).toMatchObject({ category: 'component', stability: 'candidate', since: '1.2', description: 'A card.' });
    expect(card.angular).toMatchObject({ selector: 'app-card', exportAs: 'card' });
    expect(card.methods.map((m: any) => m.name)).toEqual(['focus']);
    expect(card.properties).toEqual([]);
  });

  it('documents signal inputs with required flags, aliases, defaults, transforms and accepted binding types', async () => {
    const { inputs } = symbol(await extract(angular), 'CardComponent');
    const byProperty = Object.fromEntries(inputs.map((i: any) => [i.property, i]));
    expect(byProperty.tone).toMatchObject({ name: 'tone', type: 'Tone', required: false, defaultValue: "'plain'", legacy: false });
    expect(byProperty.tone.description).toBe('Visual tone.');
    expect(byProperty.title).toMatchObject({ type: 'string', required: true, defaultValue: undefined });
    expect(byProperty.disabled).toMatchObject({ name: 'isDisabled', property: 'disabled', transform: 'booleanAttribute', required: false });
    // The signal reads as boolean, but the binding accepts `unknown`: both must stay visible.
    expect(byProperty.disabled).toMatchObject({ type: 'unknown', readType: 'boolean' });
    expect(byProperty.duration).toMatchObject({ type: 'unknown', readType: 'number | undefined', transform: 'toMs' });
  });

  it('documents models with their change output, without repeating it as an output', async () => {
    const model = symbol(await extract(angular), 'CardComponent');
    expect(model.models).toEqual([expect.objectContaining({ name: 'open', type: 'boolean', changeOutput: 'openChange', defaultValue: 'false' })]);
    expect(model.outputs.map((o: any) => o.name)).not.toContain('openChange');
  });

  it('documents signal outputs with payload types and aliases', async () => {
    const { outputs } = symbol(await extract(angular), 'CardComponent');
    const byProperty = Object.fromEntries(outputs.map((o: any) => [o.property, o]));
    expect(byProperty.closed).toMatchObject({ name: 'closed', type: 'string', legacy: false });
    expect(byProperty.picked).toMatchObject({ name: 'itemPicked', type: '{ id: number; }' });
  });

  it('documents decorator inputs and outputs, including aliases, required and EventEmitter payloads', async () => {
    const card = symbol(await extract(angular), 'CardComponent');
    const inputs = Object.fromEntries(card.inputs.map((i: any) => [i.property, i]));
    expect(inputs.label).toMatchObject({ name: 'label', type: 'string', legacy: true, required: false, description: 'Legacy input.' });
    expect(inputs.aliased).toMatchObject({ name: 'legacyAlias', legacy: true });
    expect(inputs.flag).toMatchObject({ required: true, transform: 'booleanAttribute', type: 'unknown', readType: 'boolean' });
    const outputs = Object.fromEntries(card.outputs.map((o: any) => [o.property, o]));
    expect(outputs.legacyChange).toMatchObject({ name: 'legacyChange', type: 'number', legacy: true });
    expect(outputs.other).toMatchObject({ name: 'renamed', type: 'string' });
  });

  it('documents directives, pipes and services', async () => {
    const model = await extract(angular);
    expect(symbol(model, 'HighlightDirective')).toMatchObject({ category: 'directive', stability: 'experimental' });
    expect(symbol(model, 'HighlightDirective').angular).toMatchObject({ selector: '[appHighlight], app-highlight', exportAs: 'highlight' });
    const pipe = symbol(model, 'MoneyPipe');
    expect(pipe).toMatchObject({ category: 'pipe', description: 'Formats a number.' });
    expect(pipe.angular.pipeName).toBe('money');
    expect(pipe.methods[0].signatures.map((s: any) => s.text)).toEqual(['(value: number): string', '(value: string, currency: string): string']);
    const service = symbol(model, 'StoreService');
    expect(service).toMatchObject({ category: 'service' });
    expect(service.angular.providedIn).toBe('root');
    expect(service.methods[0]).toMatchObject({ name: 'add' });
  });

  it('reports metadata it cannot resolve instead of guessing', async () => {
    const model = await extract(angular);
    expect(symbol(model, 'DynamicDirective').angular.selector).toBeUndefined();
    expect(model.diagnostics).toContainEqual(expect.objectContaining({ severity: 'warning', symbol: 'DynamicDirective' }));
  });

  it('does not treat a same-named function from another package as Angular', async () => {
    const model = await extract({
      'src/public-api.ts': `export * from './x';`,
      'src/x.ts': `declare function input<T>(value: T): T;\nexport class Plain { readonly value = input(1); }`,
    });
    expect(symbol(model, 'Plain').inputs).toEqual([]);
    expect(symbol(model, 'Plain').properties.map((p: any) => p.name)).toEqual(['value']);
  });
});

describe('UNIT-092 functions, types and JSDoc', () => {
  const lib = {
    'src/public-api.ts': `export * from './api';`,
    'src/api.ts': `
export interface Options<T = string> {
  /** Name. */
  name: T;
  readonly mode?: 'a' | 'b';
  run(input: number): void;
}
export type Pair<A, B> = readonly [A, B];
export type Handler = { id: string; fire?: () => void };
export enum Level { Low = 1, High = 'high' }
export const VERSION = '1.0.0';
/**
 * Creates things.
 *
 * Second paragraph with <b>html</b> and {@link Options}.
 *
 * @param name - The name.
 * @param rest - More names.
 * @returns A list of things.
 * @example
 * make('a');
 * @deprecated Use makeMany instead.
 * @see https://example.com/docs
 */
export function make<T extends string>(name: T, ...rest: readonly string[]): readonly T[];
export function make(name: string, count: number): string[];
export function make(name: string, ...rest: unknown[]): unknown { return [name, rest]; }
export const arrow = (value: number): number => value;
export function plain(options?: Options): void {}
`,
  };

  it('documents functions with overloads, generics, parameters and JSDoc', async () => {
    const make = symbol(await extract(lib), 'make');
    expect(make.category).toBe('function');
    expect(make.deprecated).toBe('Use makeMany instead.');
    expect(make.examples).toEqual(["make('a');"]);
    expect(make.see).toEqual(['https://example.com/docs']);
    expect(make.signatures.map((s: any) => s.text)).toEqual(['<T extends string>(name: T, ...rest: readonly string[]): readonly T[]', '(name: string, count: number): string[]']);
    expect(make.signatures[0].parameters).toEqual([
      expect.objectContaining({ name: 'name', type: 'T', description: 'The name.' }),
      expect.objectContaining({ name: 'rest', type: 'readonly string[]', rest: true, description: 'More names.' }),
    ]);
    expect(make.signatures[0].returnType).toBe('readonly T[]');
  });

  it('documents interfaces, object aliases, other aliases, enums, arrow functions and constants', async () => {
    const model = await extract(lib);
    expect(symbol(model, 'Options')).toMatchObject({ category: 'interface', header: 'interface Options<T = string>' });
    expect(symbol(model, 'Options').properties).toEqual([
      expect.objectContaining({ name: 'name', type: 'T', optional: false, description: 'Name.' }),
      expect.objectContaining({ name: 'mode', type: "'a' | 'b'", optional: true, readonly: true }),
    ]);
    expect(symbol(model, 'Options').methods[0]).toMatchObject({ name: 'run' });
    expect(symbol(model, 'Handler').properties.map((p: any) => p.name)).toEqual(['id', 'fire']);
    expect(symbol(model, 'Pair').definition).toBe('type Pair<A, B> = readonly [A, B];');
    expect(symbol(model, 'Level').enumMembers).toEqual([
      expect.objectContaining({ name: 'Low', value: '1' }),
      expect.objectContaining({ name: 'High', value: '"high"' }),
    ]);
    expect(symbol(model, 'arrow')).toMatchObject({ category: 'function' });
    expect(symbol(model, 'VERSION')).toMatchObject({ category: 'constant', type: '"1.0.0"' });
  });

  it('leaves undocumented symbols with a useful signature and no invented stability', async () => {
    const plain = symbol(await extract(lib), 'plain');
    expect(plain).toMatchObject({ description: '', stability: undefined, deprecated: undefined });
    expect(plain.signatures[0].text).toBe('(options?: Options): void');
  });

  it('prints no absolute machine paths in type text', async () => {
    const model = await extract(lib);
    expect(JSON.stringify(model.symbols)).not.toContain(cwd);
    expect(JSON.stringify(model.symbols)).not.toContain('import(');
  });
});

describe('UNIT-093 Markdown output', () => {
  const lib = {
    'src/public-api.ts': `export * from './api';`,
    'src/api.ts': `
import { Directive, input, output } from '@angular/core';
export type Mode = 'fast' | 'slow';
/**
 * Pill.
 * @stability stable
 * @example
 * <span appPill="fast"></span>
 */
@Directive({ selector: '[appPill]' })
export class PillDirective {
  /** Speed of the pill. */
  readonly appPill = input<Mode>('fast');
  readonly size = input.required<number>({ alias: 'pillSize' });
  readonly done = output<Mode>();
}
/**
 * Tool. {@link PillDirective} is related.
 *
 * :::tabs
 * ::demo[evil]
 * <script>alert(1)</script>
 * @returns The same {@link Mode}.
 * @deprecated Gone | soon.
 */
export function tool(mode: Mode | null): Mode | null { return mode; }
`,
  };

  it('writes frontmatter, sections and tables a Doq page needs', async () => {
    const files = await pages(lib);
    expect([...files.keys()]).toEqual(['pill-directive.md', 'tool.md', 'mode.md', 'index.md']);
    const pill = files.get('pill-directive.md')!;
    expect(pill).toMatch(/^---\n# Generated by doq-api/);
    expect(pill).toContain('title: PillDirective\n');
    expect(pill).toContain('description: Pill.\n');
    expect(pill).toContain('group: API reference\n');
    expect(pill).toContain('generated: doq-api');
    expect(pill).toContain('## Selector\n\n```text\n[appPill]\n```');
    expect(pill).toContain('| Input | Type | Default | Required | Description |');
    expect(pill).toContain("| `appPill` | [`Mode`](/docs/reference/api/mode) | `'fast'` |  | Speed of the pill. |");
    expect(pill).toContain('| `pillSize` (property `size`) | `number` |  | Yes |  |');
    expect(pill).toContain('## Outputs');
    expect(pill).toContain('| `done` | [`Mode`](/docs/reference/api/mode) |  |');
    expect(pill).toContain('- **Stability:** `stable`');
    expect(pill).toContain('## Examples');
    expect(pill).toContain('```html\n<span appPill="fast"></span>\n```');
    expect(pill).toContain('## Related types\n\n- [`Mode`](/docs/reference/api/mode)');
    expect(pill).not.toContain('## Models');
    expect(pill).not.toContain('## Public methods');
  });

  it('cannot be turned into HTML or Doq directives by JSDoc text', async () => {
    const tool = (await pages(lib)).get('tool.md')!;
    expect(tool).not.toContain('<script>');
    expect(tool).toContain('&lt;script>alert(1)&lt;/script>');
    expect(tool).toContain('\\:::tabs');
    expect(tool).toContain('\\::demo[evil]');
    expect(tool).toContain('[`PillDirective`](/docs/reference/api/pill-directive)');
    expect(tool).toContain('> [!WARNING]\n> **Deprecated.** Gone | soon.');
    expect(tool).toContain('function tool(mode: Mode | null): Mode | null');
    expect(tool).toContain('**Returns** `Mode | null` — The same [`Mode`](/docs/reference/api/mode).');
  });

  it('uses the base path and group options, and links the index to every page', async () => {
    const files = await pages(lib, { basePath: '/', group: 'Reference', title: 'Library API' });
    const index = files.get('index.md')!;
    expect(index).toContain('title: Library API\n');
    expect(index).toContain('group: Reference\n');
    // Text YAML could misread is quoted: the index description contains digits and a colon-free sentence, tool's does not.
    expect((await pages(lib, { title: 'A: b' })).get('index.md')).toContain('title: "A: b"\n');
    expect(index).toContain('[PillDirective](/reference/api/pill-directive)');
    expect(index).toContain('[tool](/reference/api/tool) (deprecated)');
  });

  it('supports include and exclude categories and rejects unknown ones', async () => {
    expect([...(await pages(lib, { exclude: 'function' })).keys()].sort()).toEqual(['index.md', 'mode.md', 'pill-directive.md']);
    expect([...(await pages(lib, { include: ['directive'] })).keys()].sort()).toEqual(['index.md', 'pill-directive.md']);
    await expect(buildApiReference(options({ include: 'widget' }))).rejects.toThrow(/unknown --include category "widget"/);
  });

  it('orders generated pages after hand-written ones by default and from --order-start when given', async () => {
    const defaults = await pages(lib);
    expect(defaults.get('index.md')).toContain('order: 1000\n');
    expect(defaults.get('pill-directive.md')).toContain('order: 1001\n');
    expect(defaults.get('mode.md')).toContain('order: 1003\n');
    expect((await pages(lib, { orderStart: 50 })).get('index.md')).toContain('order: 50\n');
    await expect(buildApiReference(options({ orderStart: -1 }))).rejects.toThrow(/--order-start/);
  });

  it('adds source links only when a template is configured', async () => {
    expect((await pages(lib)).get('tool.md')).not.toContain('**Source:**');
    const linked = (await pages(lib, { sourceUrl: 'https://example.com/blob/main/{path}#L{line}' })).get('tool.md')!;
    expect(linked).toContain('- **Source:** [src/api.ts:');
    expect(linked).toContain('(https://example.com/blob/main/src/api.ts#L');
  });

  it('is byte-for-byte deterministic', async () => {
    await write(lib);
    const first = await buildApiReference(options());
    const second = await buildApiReference(options());
    expect([...second.files]).toEqual([...first.files]);
    for (const text of first.files.values()) {
      expect(text).not.toContain(cwd);
      expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
      expect(text.endsWith('\n')).toBe(true);
    }
  });
});

describe('UNIT-094 slugs and prose', () => {
  it('derives readable slugs and keeps colliding names apart', () => {
    expect(slugify('MoveEnterDirective')).toBe('move-enter-directive');
    expect(slugify('provideMovement')).toBe('provide-movement');
    expect(slugify('HTTPClient')).toBe('http-client');
    expect(slugify('MOVEMENT_CONFIG')).toBe('movement-config');
    const slugs = assignSlugs([
      { name: 'MovementConfig', category: 'interface' },
      { name: 'MOVEMENT_CONFIG', category: 'constant' },
      { name: 'index', category: 'function' },
    ]);
    expect(slugs.get('MOVEMENT_CONFIG')).toBe('movement-config');
    expect(slugs.get('MovementConfig')).toBe('movement-config-interface');
    expect(slugs.get('index')).toBe('index-function');
  });

  it('keeps fenced code from JSDoc intact and escapes only prose', () => {
    const text = proseBlock('See <b>this</b>.\n\n```html\n<div>{{ x }}</div>\n```\n\n`<keep>`', () => undefined);
    expect(text).toContain('&lt;b>this&lt;/b>');
    expect(text).toContain('```html\n<div>{{ x }}</div>\n```');
    expect(text).toContain('`<keep>`');
  });
});

describe('UNIT-095 safe output and ownership', () => {
  const lib = { 'src/public-api.ts': `export const one = 1;\nexport function two(): void {}\n` };
  const out = 'src/content/docs/reference/api';

  it('refuses output outside the content directory, the project, or protected folders', async () => {
    await write(lib);
    for (const bad of ['..', '../elsewhere', 'src/content/docs', 'src/content', 'docs', '/tmp/x', 'src/content/docs/../../x', 'src/content/docs/node_modules/x']) {
      await expect(buildApiReference(options({ out: bad })), bad).rejects.toThrow(DoqApiError);
    }
    await expect(buildApiReference(options({ contentDir: '..' }))).rejects.toThrow(/inside the project/);
  });

  it('refuses a symbolic link that leaves the project', async () => {
    await write(lib);
    const outside = await mkdtemp(join(work, 'outside-'));
    try {
      await mkdir(join(cwd, 'src/content/docs'), { recursive: true });
      await symlink(outside, join(cwd, 'src/content/docs/reference'));
      await expect(buildApiReference(options())).rejects.toThrow(/symbolic link/);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('writes pages and a manifest, then reports no change on the second run', async () => {
    await write(lib);
    const first = await generateApiReference(options());
    expect(first.written.sort()).toEqual(['index.md', 'one.md', 'two.md']);
    expect(await readdir(join(cwd, out))).toEqual(['.doq-api.json', 'index.md', 'one.md', 'two.md']);
    const manifest = JSON.parse(await readFile(join(cwd, out, '.doq-api.json'), 'utf8'));
    expect(Object.keys(manifest.files)).toEqual(['index.md', 'one.md', 'two.md']);
    const second = await generateApiReference(options());
    expect(second.written).toEqual([]);
    expect((await checkApiReference(options())).upToDate).toBe(true);
  });

  it('never overwrites a hand-written file and changes nothing when it finds one', async () => {
    await write({ ...lib, [`${out}/one.md`]: '# mine\n', 'src/content/docs/guide.md': 'guide\n' });
    await expect(generateApiReference(options())).rejects.toThrow(/not generated by doq-api/);
    expect(await readFile(join(cwd, out, 'one.md'), 'utf8')).toBe('# mine\n');
    expect(await readdir(join(cwd, out))).toEqual(['one.md']);
    expect((await checkApiReference(options())).upToDate).toBe(false);
    expect((await checkApiReference(options())).conflicts[0]).toMatch(/^one.md/);
  });

  it('refuses to overwrite or delete a generated page that was edited by hand', async () => {
    await write(lib);
    await generateApiReference(options());
    await writeFile(join(cwd, out, 'one.md'), 'edited\n');
    await expect(generateApiReference(options())).rejects.toThrow(/edited after it was generated/);
    expect(await readFile(join(cwd, out, 'one.md'), 'utf8')).toBe('edited\n');
    await write({ 'src/public-api.ts': `export function two(): void {}\n` });
    await expect(generateApiReference(options())).rejects.toThrow(/no longer generated but was edited/);
    expect(await readFile(join(cwd, out, 'one.md'), 'utf8')).toBe('edited\n');
  });

  it('removes only files it generated, keeps neighbours, and leaves hand-written siblings alone', async () => {
    await write({ ...lib, 'src/content/docs/guide.md': 'guide\n', [`${out}/notes.md`]: 'notes\n' });
    await generateApiReference(options());
    await write({ 'src/public-api.ts': `export function two(): void {}\n` });
    const result = await generateApiReference(options());
    expect(result.removed).toEqual(['one.md']);
    expect((await readdir(join(cwd, out))).sort()).toEqual(['.doq-api.json', 'index.md', 'notes.md', 'two.md']);
    expect(await readFile(join(cwd, 'src/content/docs/guide.md'), 'utf8')).toBe('guide\n');
  });

  it('refuses a damaged manifest instead of guessing ownership', async () => {
    await write({ ...lib, [`${out}/.doq-api.json`]: '{not json' });
    await expect(generateApiReference(options())).rejects.toThrow(/not valid JSON/);
    await write({ [`${out}/.doq-api.json`]: JSON.stringify({ generator: 'doq-api', files: { '../escape.md': 'x' } }) });
    await expect(generateApiReference(options())).rejects.toThrow(/does not look like a doq-api manifest/);
  });
});

describe('UNIT-096 check mode', () => {
  const lib = { 'src/public-api.ts': `export function two(a: number): void {}\n` };

  it('reports added, modified and removed pages without writing', async () => {
    await write(lib);
    let before = await checkApiReference(options());
    expect(before).toMatchObject({ upToDate: false, added: ['index.md', 'two.md'] });
    await expect(readdir(join(cwd, 'src/content/docs'))).rejects.toThrow();

    await generateApiReference(options());
    expect((await checkApiReference(options())).upToDate).toBe(true);

    await write({ 'src/public-api.ts': `export function two(a: number, b: string): void {}\nexport const extra = 1;\n` });
    const stale = await checkApiReference(options());
    expect(stale).toMatchObject({ upToDate: false, added: ['extra.md'], modified: ['index.md', 'two.md'], removed: [] });
    expect(await readFile(join(cwd, 'src/content/docs/reference/api/two.md'), 'utf8')).toContain('(a: number): void');

    await write({ 'src/public-api.ts': `export const extra = 1;\n` });
    expect(await checkApiReference(options())).toMatchObject({ removed: ['two.md'] });
  });

  it('fails strict mode for undocumented symbols and passes when documented', async () => {
    await write(lib);
    await expect(generateApiReference(options({ strict: true }))).rejects.toThrow(/two: Public symbol has no documentation comment/);
    await write({ 'src/public-api.ts': `/** Does two. */\nexport function two(a: number): void {}\n` });
    await expect(generateApiReference(options({ strict: true }))).resolves.toMatchObject({ symbolCount: 1 });
  });
});

describe('UNIT-097 configuration errors', () => {
  it('explains a missing entry, missing TypeScript and a bad project', async () => {
    await expect(buildApiReference({ cwd })).rejects.toThrow(/"entry" is required/);
    await write({ 'src/public-api.ts': `export const a = 1;` });
    await expect(buildApiReference(options({ project: 'nope.json' }))).rejects.toThrow(/cannot read the TypeScript project/);
    await expect(buildApiReference(options({ sourceUrl: 'ftp://x' }))).rejects.toThrow(/--source-url/);
    await expect(buildApiReference(options({ exclude: 'function,constant' }))).rejects.toThrow(/no public symbols/);
    const bare = await mkdtemp(join(tmpdir(), 'doq-no-ts-'));
    try {
      expect(() => loadTypeScript(bare)).toThrow(/could not be resolved/);
    } finally {
      await rm(bare, { recursive: true, force: true });
    }
  });
});

describe('UNIT-098 doq-api command line', () => {
  const cli = resolve(import.meta.dirname, '../../bin/doq-api.mjs');
  const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  const flags = ['--entry', 'src/public-api.ts', '--out', 'src/content/docs/reference/api'];

  it('generates, checks and detects staleness with exit codes 0, 0 and 1', async () => {
    await write({ 'src/public-api.ts': `/** One. */\nexport const one = 1;\n` });
    const generated = run('generate', ...flags);
    expect(generated.status, generated.stderr).toBe(0);
    expect(generated.stdout).toContain('2 pages in src/content/docs/reference/api');
    expect(generated.stdout).not.toContain(cwd);
    expect(run('check', ...flags).status).toBe(0);
    await write({ 'src/public-api.ts': `/** One. */\nexport const one = 1;\nexport const two = 2;\n` });
    const stale = run('check', ...flags);
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain('is stale');
    expect(stale.stderr).toContain('added     two.md');
    expect(stale.stderr).toContain('modified  index.md');
    expect(await readdir(join(cwd, 'src/content/docs/reference/api'))).not.toContain('two.md');
  }, 30_000); // spawns the CLI three times; the 5 s default is not enough on a loaded machine

  it('exits 2 with a one-line explanation for usage and configuration errors', async () => {
    await write({ 'src/public-api.ts': `export const one = 1;\n` });
    for (const args of [[], ['generate'], ['frobnicate', ...flags], ['generate', '--bogus'], ['generate', ...flags, '--out', '../escape'], ['generate', '--entry', 'src/missing.ts']]) {
      const result = run(...args);
      expect(result.status, args.join(' ')).toBe(2);
      expect(result.stderr).toMatch(/Usage:|doq-api:/);
      expect(result.stderr).not.toContain('    at ');
    }
    expect(run('--help').status).toBe(0);
  });

  it('exits 1 and writes nothing when a hand-written file is in the way', async () => {
    await write({ 'src/public-api.ts': `export const one = 1;\n`, 'src/content/docs/reference/api/one.md': 'mine\n' });
    const result = run('generate', ...flags);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('refusing to overwrite');
    expect(await readdir(join(cwd, 'src/content/docs/reference/api'))).toEqual(['one.md']);
  });
});

describe('UNIT-170 symbol index in the manifest', () => {
  it('records every public symbol with the route its page is linked at, deterministically, and check validates it', async () => {
    await write({
      'src/public-api.ts': `export { Thing } from './a';\nexport interface Thing2 { a: string }\nexport function Thing3(): void {}`,
      'src/a.ts': `export class Thing {}`,
    });
    const opts = options({ basePath: '/docs/v/2' });
    await generateApiReference(opts);
    const manifest = JSON.parse(await readFile(join(cwd, 'src/content/docs/reference/api/.doq-api.json'), 'utf8'));
    expect(manifest.symbols).toEqual({
      Thing: '/docs/v/2/reference/api/thing',
      Thing2: '/docs/v/2/reference/api/thing2',
      Thing3: '/docs/v/2/reference/api/thing3',
    });
    expect(Object.keys(manifest.symbols)).toEqual([...Object.keys(manifest.symbols)].sort());
    expect(JSON.stringify(manifest)).not.toContain(cwd);
    expect((await checkApiReference(opts)).upToDate).toBe(true);
    const before = await readFile(join(cwd, 'src/content/docs/reference/api/.doq-api.json'), 'utf8');
    await generateApiReference(opts);
    expect(await readFile(join(cwd, 'src/content/docs/reference/api/.doq-api.json'), 'utf8')).toBe(before);
    // A hand-edited index is detected as stale rather than trusted.
    await writeFile(join(cwd, 'src/content/docs/reference/api/.doq-api.json'), before.replace('/thing3', '/elsewhere'));
    expect((await checkApiReference(opts)).upToDate).toBe(false);
  }, 15_000);
});

describe('UNIT-143 COMPAT-02 sources checked out with CRLF line endings', () => {
  it('produce byte-identical pages as the LF checkout', async () => {
    const source = {
      'src/public-api.ts': `export * from './lib/thing';`,
      'src/lib/thing.ts': [
        '/**',
        ' * First paragraph of the description.',
        ' *',
        ' * Second paragraph with a `code` span.',
        ' */',
        'export function thing(/** Which one. */ id: string): string {',
        '  return id;',
        '}',
        '',
      ].join('\n'),
    };
    const lf = await pages(source);
    const windows = await pages(Object.fromEntries(Object.entries(source).map(([name, text]) => [name, text.replace(/\n/g, '\r\n')])));
    expect([...windows]).toEqual([...lf]);
    expect([...windows.values()].some((text) => text.includes('Second paragraph'))).toBe(true);
    expect([...windows.values()].every((text) => !text.includes('\r'))).toBe(true);
  });
});

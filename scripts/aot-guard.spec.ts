import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertAotBuild } from './aot-guard.ts';

let project: string;
const write = async (path: string, text: string) => {
  await mkdir(dirname(join(project, path)), { recursive: true });
  await writeFile(join(project, path), text);
};

beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'doq-aot-guard-'));
  await write('package.json', JSON.stringify({ name: 'app', dependencies: { '@angular/core': '^21.2.2' } }));
});
afterEach(() => rm(project, { recursive: true, force: true }));

describe('UNIT-183 AOT build guard (REQ-004, AC-005)', () => {
  it('accepts a build whose scripts have no runtime-compilation path', async () => {
    await write('dist/analog/public/assets/index-a.js', 'export const a = 1;');
    expect(() => assertAotBuild('test', project)).not.toThrow();
  });

  it('stops a build that needs the JIT compiler it does not contain, naming the file', async () => {
    await write('dist/analog/public/assets/index-a.js', 'function f(){throw Error(`JIT compiler unavailable`)}');
    expect(() => assertAotBuild('test', project)).toThrow(/not AOT-compiled.*assets\/index-a\.js/);
  });

  it('does not accept an unreadable report as a pass', async () => {
    await rm(join(project, 'package.json'));
    expect(() => assertAotBuild('test', project)).toThrow(/no build\.aot finding/);
  });
});

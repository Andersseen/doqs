import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertAotBuild, buildAot } from './aot-guard.ts';

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

  const bad = 'function f(){throw Error(`JIT compiler unavailable`)}';
  const output = (text: string) => () => {
    mkdirSync(join(project, 'dist/analog/public/assets'), { recursive: true });
    writeFileSync(join(project, 'dist/analog/public/assets/index-a.js'), text);
  };

  it('rebuilds once from a clean dist when the build hits the upstream race, and says so', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const outputs = [output(bad), output('export const a = 1;')];
    let builds = 0;
    buildAot('test', project, () => outputs[builds++]!());
    expect(builds).toBe(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('upstream Analog build race detected'));
    warn.mockRestore();
  });

  it('stops when the second build is also uncompiled, and never retries a third time', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let builds = 0;
    expect(() =>
      buildAot('test', project, () => {
        builds++;
        output(bad)();
      }),
    ).toThrow(/not AOT-compiled/);
    expect(builds).toBe(2);
    warn.mockRestore();
  });
});

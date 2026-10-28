import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertDisposable, isSha, repo, upstream } from './adoption-lib.ts';

describe('UNIT-145 adoption harness guards (REQ-004)', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('uses the pinned revision unless an override is given, and reports which', () => {
    delete process.env['AM_REF'];
    delete process.env['AM_REPO'];
    expect(upstream('AM', 'https://example.test/a.git', 'a'.repeat(40))).toEqual({
      url: 'https://example.test/a.git',
      ref: 'a'.repeat(40),
      overridden: false,
    });
    process.env['AM_REF'] = 'HEAD';
    expect(upstream('AM', 'https://example.test/a.git', 'a'.repeat(40))).toMatchObject({
      ref: 'HEAD',
      overridden: true,
    });
    delete process.env['AM_REF'];
    process.env['AM_REPO'] = 'https://example.test/fork.git';
    expect(upstream('AM', 'https://example.test/a.git', 'a'.repeat(40))).toMatchObject({
      url: 'https://example.test/fork.git',
      ref: 'a'.repeat(40),
      overridden: true,
    });
  });

  it('recognises full commit ids only', () => {
    expect(isSha('4e71e2f75be3c82ec4f10ca80dc91d08562efa1b')).toBe(true);
    expect(isSha('4e71e2f')).toBe(false);
    expect(isSha('v1.4.0')).toBe(false);
  });

  it('refuses this repository, shallow paths and foreign non-empty directories; accepts owned ones', () => {
    expect(() => assertDisposable(repo)).toThrow(/outside the repository/);
    expect(() => assertDisposable(join(repo, 'tmp-proof'))).toThrow(/outside the repository/);
    expect(() => assertDisposable('/tmp')).toThrow(/Refusing/);
    const root = mkdtempSync(join(tmpdir(), 'doq-adoption-guard-'));
    const foreign = join(root, 'my-work');
    mkdirSync(foreign);
    writeFileSync(join(foreign, 'file.txt'), 'mine');
    expect(() => assertDisposable(foreign)).toThrow(/not empty/);
    writeFileSync(join(foreign, '.doq-adoption-sha'), 'x');
    expect(() => assertDisposable(foreign)).not.toThrow();
    const ownName = join(root, 'doq-adoption-volt-ui');
    mkdirSync(ownName);
    writeFileSync(join(ownName, 'file.txt'), 'leftover');
    expect(() => assertDisposable(ownName)).not.toThrow();
    expect(() => assertDisposable(join(root, 'does-not-exist-yet'))).not.toThrow();
  });
});

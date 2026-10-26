import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { launchChrome } from './chrome.ts';

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe.skipIf(process.platform === 'win32')('CDP harness Chrome startup', () => {
  let dir: string | undefined;
  const previous = process.env['CHROME_BIN'];
  afterEach(async () => {
    if (previous === undefined) delete process.env['CHROME_BIN'];
    else process.env['CHROME_BIN'] = previous;
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  const fakeChrome = async (script: string) => {
    dir = await mkdtemp(join(tmpdir(), 'doq-fake-chrome-'));
    const bin = join(dir, 'chrome');
    await writeFile(bin, `#!/bin/sh\necho $$ > "${join(dir, 'pid')}"\n${script}\n`);
    await chmod(bin, 0o755);
    process.env['CHROME_BIN'] = bin;
    return dir;
  };

  it('UNIT-181: kills a Chrome that never writes DevToolsActivePort instead of leaving it to hold the job open', async () => {
    const root = await fakeChrome('exec sleep 300');
    await expect(launchChrome([], { startupTimeout: 1000 })).rejects.toThrow(
      'Timed out waiting for Chrome DevToolsActivePort',
    );
    const pid = Number((await readFile(join(root, 'pid'), 'utf8')).trim());
    expect(alive(pid)).toBe(false);
  });

  it('UNIT-182: reports a Chrome that exits during startup at once rather than after the startup timeout', async () => {
    await fakeChrome('exit 3');
    const started = Date.now();
    await expect(launchChrome([], { startupTimeout: 30_000 })).rejects.toThrow('Chrome exited during startup (3)');
    expect(Date.now() - started).toBeLessThan(10_000);
  });
});

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { CDP } from './cdp.ts';
import { waitFor } from './wait.ts';

const chromeCandidates = () =>
  [
    process.env['CHROME_BIN'],
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter((candidate): candidate is string => !!candidate);

export interface ChromeSession {
  bin: string;
  cdp: CDP;
  close(): Promise<void>;
}

/**
 * Start an isolated headless Chrome (temporary profile, ephemeral DevTools port) with clipboard access for `origins`.
 * A cold first launch on a fresh CI runner can take well over 15 s, so startup waits up to `startupTimeout`. If startup
 * fails, the process is killed and its profile removed before the error is rethrown: a leftover Chrome would keep the
 * Node process (and the CI job) alive after the harness has already reported.
 */
export async function launchChrome(
  origins: readonly string[],
  { startupTimeout = 60_000 }: { startupTimeout?: number } = {},
): Promise<ChromeSession> {
  const candidates = chromeCandidates();
  let bin: string | undefined;
  for (const candidate of candidates) {
    try {
      await access(candidate);
      bin = candidate;
      break;
    } catch {
      // Try the next candidate.
    }
  }
  assert.ok(bin, `Chrome binary not found. Set CHROME_BIN; checked ${candidates.join(', ')}`);
  const profileRoot = await mkdtemp(join(tmpdir(), 'doq-mvp-verify-'));
  const chrome: ChildProcess = spawn(
    bin,
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-extensions',
      '--remote-debugging-port=0',
      `--user-data-dir=${join(profileRoot, 'profile')}`,
      '--no-sandbox',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const activePort = join(profileRoot, 'profile', 'DevToolsActivePort');
  const stop = async () => {
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill('SIGTERM');
      const exited = await Promise.race([
        new Promise<boolean>((resolve) => chrome.once('exit', () => resolve(true))),
        delay(3000).then(() => false),
      ]);
      if (!exited) chrome.kill('SIGKILL');
    }
    // Chrome may still be flushing its profile for a moment after exit; a leftover temp dir must not fail the run.
    await rm(profileRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
  };
  let cdp: CDP | undefined;
  try {
    await waitFor(
      async () => {
        if (chrome.exitCode !== null || chrome.signalCode !== null) {
          throw new ChromeExited(`Chrome exited during startup (${chrome.exitCode ?? chrome.signalCode}): ${bin}`);
        }
        return (await readFile(activePort, 'utf8')).trim().length > 0;
      },
      'Chrome DevToolsActivePort',
      startupTimeout,
      (error) => error instanceof ChromeExited,
    );
    const [port] = (await readFile(activePort, 'utf8')).trim().split('\n');
    const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as {
      type: string;
      webSocketDebuggerUrl: string;
    }[];
    const target = targets.find((t) => t.type === 'page');
    assert.ok(target, 'Chrome page target missing');
    cdp = new CDP(target.webSocketDebuggerUrl);
    await cdp.ready();
    for (const domain of ['Page', 'Runtime', 'Network', 'Log']) await cdp.send(`${domain}.enable`);
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    for (const origin of origins) {
      await cdp
        .send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] })
        .catch(() => {});
      await cdp
        .send('Browser.setPermission', { permission: { name: 'clipboard-read' }, setting: 'granted', origin })
        .catch(() => {});
    }
  } catch (error) {
    cdp?.close();
    await stop();
    throw error;
  }
  const session = cdp;
  return {
    bin,
    cdp: session,
    async close() {
      session.close();
      await stop();
    },
  };
}

class ChromeExited extends Error {}

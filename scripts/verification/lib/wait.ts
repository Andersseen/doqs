import { setTimeout as delay } from 'node:timers/promises';

/**
 * Poll `test` every 100ms until it returns truthy; throws a descriptive timeout otherwise. An error for which `fatal`
 * returns true is rethrown at once instead of being treated as "not ready yet".
 */
export async function waitFor(
  test: () => unknown,
  message: string,
  timeout = 15000,
  fatal: (error: unknown) => boolean = () => false,
): Promise<void> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await test()) return;
    } catch (error) {
      if (fatal(error)) throw error;
      // Not ready yet; keep polling.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${message}`);
}

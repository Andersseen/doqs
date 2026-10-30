import { expect, test as base, type Page } from '@playwright/test';
import { apps } from '../playwright.config.ts';

export { apps, expect };

/**
 * Reads the clipboard back and compares it. Only Chromium lets a test grant `clipboard-read`; Firefox and WebKit have no such
 * permission, so there the visible "Code copied" confirmation (asserted by the caller) is the evidence and the gap is annotated.
 */
export async function expectClipboard(page: Page, expected: string): Promise<void> {
  if (page.context().browser()?.browserType().name() === 'chromium') {
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  } else {
    test.info().annotations.push({
      type: 'clipboard',
      description: 'read-back not testable: clipboard-read cannot be granted in this engine',
    });
  }
}

/**
 * Records, from before the first script runs, every element the page removes from the document that a prerendered page
 * is made of. Hydration reuses the server-rendered nodes; an application that fails to hydrate (or hydrates by destroying
 * and recreating the DOM) removes them, which shows as duplicated or flickering UI.
 */
export async function watchDomReplacement(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const removed: string[] = [];
    (window as unknown as { __doqRemoved: string[] }).__doqRemoved = removed;
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of Array.from(record.removedNodes))
          if (node.nodeType === 1 && /^(APP-ROOT|MAIN|H1)$/.test((node as Element).tagName))
            removed.push((node as Element).tagName);
    }).observe(document, { childList: true, subtree: true });
  });
}

/**
 * The page really executed the application: Angular consumed every hydration marker (`ngh`, present in the prerendered
 * HTML and removed on hydration), and there is exactly one root and one `<h1>`. `watchDomReplacement` must have been
 * called before the navigation.
 *
 * Host pages and the documentation index reuse the prerendered nodes, and this asserts it. A documentation page does not
 * (known limitation, spec 0022): its first client render is the "loading" placeholder, because the Markdown module is
 * imported asynchronously, so Angular discards the prerendered `<main class="doq-root">` and renders it again. That is
 * recorded as an annotation, never silently accepted: pass `reusesPrerenderedDom: false` only for documentation pages.
 */
export async function expectHydrated(page: Page, { reusesPrerenderedDom = true } = {}): Promise<void> {
  await expect.poll(() => page.locator('[ngh]').count(), { message: 'hydration markers still present' }).toBe(0);
  await expect(page.locator('app-root')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
  const removed = await page.evaluate(() => (window as unknown as { __doqRemoved: string[] }).__doqRemoved);
  if (reusesPrerenderedDom) {
    expect(removed, 'prerendered nodes were discarded: the page did not hydrate in place').toEqual([]);
  } else {
    expect(removed, 'only the documentation root may be recreated').toEqual(removed.map(() => 'MAIN'));
    if (removed.length)
      test
        .info()
        .annotations.push({ type: 'known-limitation', description: 'documentation page re-rendered, not reused' });
  }
}

const HARNESS_LAYOUT_WARNING =
  /^\[JavaScript Warning: "Layout was forced before the page was fully loaded\..*\{file: "debugger eval code"/;

/** Every test fails on uncaught exceptions, console errors/warnings and failed requests (hydration regressions surface here). */
export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          // Firefox reports, for Playwright's own evaluation (`{file: "debugger eval code"}`, never page code), that layout was
          // measured while the document was still settling. Nothing in the page produced it, so it is not a page problem.
          if (HARNESS_LAYOUT_WARNING.test(message.text())) return;
          problems.push(`console.${message.type()}: ${message.text()}`);
        }
      });
      page.on('requestfailed', (request) =>
        problems.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`),
      );
      await use(problems);
      expect(problems, 'browser reported errors or warnings').toEqual([]);
    },
    { auto: true },
  ],
});

/**
 * The key that moves focus to the next focusable element. Safari's default (and therefore Playwright's WebKit on macOS) skips
 * links and many buttons on plain Tab unless a system option is enabled; Option+Tab is its "visit everything" chord.
 * WebKit on Linux, Firefox and Chromium tab to every control, so Tab is right there.
 */
export const nextFocusKey = (page: Page, backwards = false): string => {
  const safariOnMac = process.platform === 'darwin' && page.context().browser()?.browserType().name() === 'webkit';
  return `${safariOnMac ? 'Alt+' : ''}${backwards ? 'Shift+' : ''}Tab`;
};

/**
 * What the engine reports for a resource that legitimately answered 404 (a missing page or search bundle). Chromium logs a
 * console error and an aborted request; Firefox reports a corrupted-content request failure and a module-load warning; WebKit
 * a cancelled request. Chromium keeps its exact expectation in the callers; the others must report nothing but this.
 */
export const EXPECTED_404_NOISE =
  /^console\.error: Failed to load resource|^requestfailed: \S+\/pagefind\/pagefind\.js |^console\.warning: \[JavaScript Warning: "Loading failed for the module with source .*pagefind\.js/;

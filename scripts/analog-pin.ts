/**
 * Analog packages used by the generated consumers (consumer.ts, init-consumer.ts, adoption scripts).
 *
 * TEMPORARY. On 2026-10-30 upstream published @analogjs/platform, router and content 2.9.3 without
 * @analogjs/vite-plugin-angular@2.9.3, which platform@2.9.3 requires, so any fresh install of a `^2.9.x` range fails with
 * ERR_PNPM_NO_MATCHING_VERSION. Consumers are installed outside this workspace's lockfile, so they are pinned to the
 * last complete release. Remove this file when `npm view @analogjs/vite-plugin-angular versions` lists 2.9.3 (or later).
 * The supported peer range of @doqs/analog is unchanged.
 */
export const analogPin = '2.9.2';

export const analogOverrides = {
  '@analogjs/content': analogPin,
  '@analogjs/router': analogPin,
  '@analogjs/platform': analogPin,
  '@analogjs/vite-plugin-angular': analogPin,
};

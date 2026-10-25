/**
 * `@doqs/analog/config`: configuration only. It imports `@angular/core` for the injection token and nothing else, so an eagerly
 * loaded host module can define and provide its configuration without keeping the documentation components in the first chunk.
 *
 * Preferred imports: `defineDoqConfig`, `provideDoq`, `doqPrerenderRoutes`, `DOQ_CONFIG` and the configuration types.
 * The remaining exports are shared with `@doqs/analog` and are implementation details with weaker guarantees.
 */
export * from './lib/doq-config';
export * from './lib/doq-paths';
export * from './lib/doq-document';
export * from './lib/doq-versions';
export * from './lib/doq-i18n';
export * from './lib/doq-i18n-adapter';
export * from './lib/doq-search';
export * from './lib/doq-playground-model';

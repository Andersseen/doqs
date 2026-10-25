export * from './lib/doq-docs.component';
export * from './lib/doq-index.component';
export * from './lib/doq-routes';
export * from './lib/doq-shell.component';
export * from './lib/doq-demo.component';
export { splitDoqInlineDemos, DOQ_INLINE_DEMO_PATTERN, DOQ_INLINE_PLAYGROUND_PATTERN } from './lib/doq-inline-demos';
export type { DoqContentSegment } from './lib/doq-inline-demos';
export { parseDoqContent, parseDoqDocument, DOQ_CALLOUT_TYPES } from './lib/doq-rich-content';
export type { DoqRichSegment, DoqDocumentSegment, DoqPlaygroundSegment, DoqTab, DoqCalloutType } from './lib/doq-rich-content';
export { DoqTabsComponent } from './lib/doq-tabs.component';
export { DoqVersionSwitcherComponent } from './lib/doq-version-switcher.component';
export { DoqLocaleSwitcherComponent } from './lib/doq-locale-switcher.component';
export { DoqI18n } from './lib/doq-i18n';
export { DoqPlaygroundComponent } from './lib/doq-playground.component';
// Configuration and shared helpers live in the lightweight '@doqs/analog/config' entry; every name below is re-exported unchanged.
export {
  DOQ_CONFIG, defineDoqConfig, provideDoq, normalizeDoqPaths, doqPrerenderRoutes, joinDoqPath, normalizeDoqDocument, sortDoqDocuments, doqPrerenderRoute,
  normalizeDoqSearchConfig, normalizeSearchResultUrl, DOQ_VERSION_FILTER, doqVersionLinks,
  DOQ_LOCALE_FILTER, normalizeDoqI18n, getDoqCatalogs, findDoqCatalog, doqLocaleLinks, doqReservedSegments, assertDoqSlugAvailable, unlocalizedLocale,
  DOQ_I18N_ADAPTER, provideDoqI18n, DOQ_DEFAULT_MESSAGES, formatDoqMessage, createDoqStaticI18nAdapter,
  DOQ_DEFAULT_PREVIEW_SIZES, DOQ_PLAYGROUND_EVENT_LIMIT, formatDoqEventPayload, formatDoqUsage, validateDoqPlaygrounds,
} from '@doqs/analog/config';
export type {
  DoqDemoRegistry, DoqSlots, DoqPresentation, DoqConfig, DoqLandmark, DoqUnmatched, DoqPaths, DoqPrerenderContentRoute, DoqDocumentAttributes, DoqDocument,
  DoqSearchConfig, DoqResolvedSearchConfig, DoqSearchResult, DoqExcerptSegment,
  DoqVersioning, DoqVersionConfig, DoqArchiveConfig, DoqResolvedVersioning, DoqVersion, DoqVersionLink,
  DoqI18nConfig, DoqLocaleConfig, DoqResolvedI18n, DoqResolvedLocale, DoqCatalog, DoqLocaleLink, DoqTextDirection,
  DoqI18nAdapter, DoqMessageKey, DoqMessageParams, DoqResolvedPaths,
  DoqBooleanControl, DoqControlValue, DoqNumberControl, DoqPlaygroundCode, DoqPlaygroundControl, DoqPlaygroundDefinition, DoqPlaygroundOutput,
  DoqPlaygroundRegistry, DoqPlaygroundValues, DoqPreviewSize, DoqSelectControl, DoqSelectOption, DoqStringControl,
} from '@doqs/analog/config';

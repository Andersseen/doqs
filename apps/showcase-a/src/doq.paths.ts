// Build-safe: imported by vite.config.ts, so it must stay free of Angular components.
export const doqPaths = {
  contentDirectory: 'docs',
  basePath: '/docs',
  // The current docs stay at /docs; the 1.x snapshot lives in src/content/docs-v1 and is served at /docs/v/1.
  versioning: {
    current: { id: 'latest', label: 'Latest' },
    archives: [{ id: '1', label: 'v1.x', contentDirectory: 'docs-v1' }],
    canonicalOrigin: 'https://docs.example.test',
  },
  i18n: {
    defaultLocale: 'en',
    fallback: 'none',
    locales: [
      { id: 'en', label: 'English' },
      { id: 'es', label: 'Español', contentDirectory: 'docs-es', archives: { '1': 'docs-es-v1' } },
      { id: 'ar', label: 'العربية', dir: 'rtl', contentDirectory: 'docs-ar' },
    ],
  },
} as const;

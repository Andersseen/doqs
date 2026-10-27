import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { DoqDocsComponent, DoqI18n, DoqI18nAdapter, provideDoqI18n } from '../../src/public-api';
import { renderDocs } from './harness';

describe('COMP-070 adapter routing ownership', () => {
  it('keeps host ownership explicit when Doqs also publishes multiple locales', async () => {
    const locale = signal('es');
    const adapter: DoqI18nAdapter = {
      locale: locale.asReadonly(),
      direction: signal<'ltr' | 'rtl'>('ltr').asReadonly(),
      translate: (_key, fallback) => fallback,
      localize: (path, id) => id === 'es' ? `/es${path}` : path,
      ownsRouting: true,
    };
    const view = await renderDocs({
      docs: [{ source: 'guide', body: '<p>Content</p>', attributes: { title: 'Guide' } }],
      config: {
        contentDirectory: 'docs',
        i18n: { defaultLocale: 'en', locales: [{ id: 'en' }, { id: 'es', contentDirectory: 'docs-es' }] },
      },
      url: '/docs/guide',
      providers: [provideDoqI18n(adapter)],
    });
    const documentView = view.debugElement.query(By.directive(DoqDocsComponent));
    const i18n = documentView.injector.get(DoqI18n);

    expect(i18n.localized).toBe(true);
    expect(i18n.hostOwnsRouting).toBe(true);
    expect(i18n.localize('/docs/guide', 'es')).toBe('/es/docs/guide');
  });

  it('does not infer host-owned routing from adapter presence', async () => {
    const adapter: DoqI18nAdapter = {
      locale: signal('en').asReadonly(),
      direction: signal<'ltr' | 'rtl'>('ltr').asReadonly(),
      translate: (_key, fallback) => fallback,
      localize: path => path,
    };
    const view = await renderDocs({
      docs: [{ source: 'guide', body: '<p>Content</p>', attributes: { title: 'Guide' } }],
      config: { contentDirectory: 'docs' },
      url: '/docs/guide',
      providers: [provideDoqI18n(adapter)],
    });
    const documentView = view.debugElement.query(By.directive(DoqDocsComponent));

    expect(documentView.injector.get(DoqI18n).hostOwnsRouting).toBe(false);
  });
});

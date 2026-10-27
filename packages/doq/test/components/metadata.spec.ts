import { Component } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { screen, waitFor } from '@testing-library/angular';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signal } from '@angular/core';
import { FakeDoc } from './content-state';
import { renderDocs } from './harness';
import { provideDoqI18n } from '../../src/public-api';

@Component({ selector: 'host-about', template: '<h1>About the host</h1>' })
class HostAboutComponent {}

const docs: FakeDoc[] = [
  { source: 'intro', body: 'Intro body', attributes: { title: 'Introduction', description: 'Start here', order: 1 } },
  { source: 'plain', body: 'Plain body', attributes: { title: 'Plain', order: 2 } },
];
const description = () => document.head.querySelector('meta[name="description"]')?.getAttribute('content') ?? null;
const canonicals = () => [...document.head.querySelectorAll('link[rel="canonical"]')].map(link => link.getAttribute('href'));
const hostRoutes = [{ path: 'about', component: HostAboutComponent }];

beforeEach(() => {
  document.head.querySelectorAll('meta[name="description"], link[rel="canonical"]').forEach(node => node.remove());
  const host = document.createElement('meta');
  host.name = 'description';
  host.content = 'Host description';
  document.head.appendChild(host);
  document.title = 'Host title';
});
afterEach(() => document.head.querySelectorAll('meta[name="description"], link[rel="canonical"]').forEach(node => node.remove()));

describe('COMP-120 metadata lifecycle (SEO-02)', () => {
  it('shows each document\'s description and never keeps the previous one for a document without its own', async () => {
    const view = await renderDocs({ docs, url: '/docs/intro', hostRoutes });
    await screen.findByRole('heading', { level: 1, name: 'Introduction' });
    expect(description()).toBe('Start here');
    await view.router.navigateByUrl('/docs/plain');
    await screen.findByRole('heading', { level: 1, name: 'Plain' });
    expect(description()).toBe('Host description');
    expect(TestBed.inject(Title).getTitle()).toBe('Plain · Documentation');
  });

  it('restores the host title and description when the reader leaves for a host route', async () => {
    const view = await renderDocs({ docs, url: '/docs/intro', hostRoutes });
    await screen.findByRole('heading', { level: 1, name: 'Introduction' });
    await view.router.navigateByUrl('/about');
    await screen.findByRole('heading', { name: 'About the host' });
    expect(TestBed.inject(Title).getTitle()).toBe('Host title');
    expect(description()).toBe('Host description');
    expect(canonicals()).toEqual([]);
    // And documentation can be entered again: it must capture the host values it restored, not its own.
    await view.router.navigateByUrl('/docs/intro');
    await screen.findByRole('heading', { level: 1, name: 'Introduction' });
    await view.router.navigateByUrl('/about');
    await screen.findByRole('heading', { name: 'About the host' });
    expect(TestBed.inject(Title).getTitle()).toBe('Host title');
    expect(description()).toBe('Host description');
  });

  it('a missing document sets a not-found title, no document description and no canonical', async () => {
    const view = await renderDocs({ docs: [...docs, { source: 'old', directory: 'docs-v1', body: 'Old', attributes: { title: 'Old' } }], url: '/docs/intro', hostRoutes, config: { versioning: { current: { id: 'latest' }, archives: [{ id: '1', contentDirectory: 'docs-v1' }], canonicalOrigin: 'https://docs.example' } } });
    await screen.findByRole('heading', { level: 1, name: 'Introduction' });
    expect(canonicals()).toEqual(['https://docs.example/docs/intro']);
    await view.router.navigateByUrl('/docs/does-not-exist');
    await screen.findByRole('heading', { name: 'Documentation page not found' });
    await waitFor(() => expect(TestBed.inject(Title).getTitle()).toBe('Page not found · Documentation'));
    expect(description()).toBe('Host description');
    expect(canonicals()).toEqual([]);
  });

  it('keeps one description tag however many documents are visited', async () => {
    const view = await renderDocs({ docs, url: '/docs/intro', hostRoutes });
    await screen.findByRole('heading', { level: 1, name: 'Introduction' });
    for (const url of ['/docs/plain', '/docs/intro', '/docs', '/docs/plain']) await view.router.navigateByUrl(url);
    expect(document.head.querySelectorAll('meta[name="description"]').length).toBe(1);
    expect(TestBed.inject(Meta).getTags('name="description"').length).toBe(1);
  });

  it('leaves the document head untouched when the host owns SEO', async () => {
    document.documentElement.lang = 'host-lang';
    document.documentElement.dir = 'rtl';
    const adapter = {
      locale: signal('es').asReadonly(),
      direction: signal<'ltr' | 'rtl'>('ltr').asReadonly(),
      translate: (_key: string, fallback: string) => fallback,
      localize: (path: string) => path,
      ownsHead: true,
    };
    try {
      await renderDocs({
        docs: [
          { ...docs[0]!, directory: 'docs-es', body: 'Contenido', attributes: { title: 'Introducción', description: 'Descripción' } },
        ],
        config: {
          i18n: { defaultLocale: 'en', locales: [{ id: 'en' }, { id: 'es', contentDirectory: 'docs-es' }] },
          versioning: { current: { id: 'latest' }, canonicalOrigin: 'https://docs.example.test' },
        },
        url: '/es/docs/intro',
        providers: [provideDoqI18n(adapter)],
      });
      await screen.findByRole('heading', { name: 'Introducción' });
      expect(document.title).toBe('Host title');
      expect(description()).toBe('Host description');
      expect(canonicals()).toEqual([]);
      expect(document.documentElement.lang).toBe('host-lang');
      expect(document.documentElement.dir).toBe('rtl');
    } finally {
      document.documentElement.removeAttribute('lang');
      document.documentElement.removeAttribute('dir');
    }
  });
});

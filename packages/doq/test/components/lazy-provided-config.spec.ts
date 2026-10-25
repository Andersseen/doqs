import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterOutlet } from '@angular/router';
import { ContentRenderer } from '@analogjs/content';
import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { contentState } from './content-state';
import { doqRoutes, provideDoq } from '../../src/public-api';

class Plain extends ContentRenderer {
  override async render(content: string) {
    return { content: `<p>${content}</p>`, toc: [] };
  }
  override getContentHeadings() {
    return [];
  }
  override enhance() {}
}

@Component({ selector: 'doq-lazy-host', imports: [RouterOutlet], template: '<router-outlet />' })
class LazyHost {}

/**
 * Regression for the official site's production build (CI "Production builds and package", NG0201).
 * The site provides `provideDoq()` inside its lazy `/docs` region, so `DOQ_CONFIG` lives in a route
 * injector and is invisible to anything provided at the application root. Every Doqs view that reads the
 * configuration must therefore resolve its locale/chrome state from its own injector, not from root.
 * With `DoqI18n` provided at root this render throws NG0201 (NullInjectorError: DOQ_CONFIG).
 */
describe('COMP-143 configuration provided in a lazy route injector (REG-01)', () => {
  it('renders a document when DOQ_CONFIG is provided below the root, as apps/site does', async () => {
    contentState.docs = [{ source: 'install', body: 'Install body', attributes: { title: 'Install' } }];
    const config = { contentDirectory: 'docs' } as const;
    const view = await render(LazyHost, {
      routes: [{ path: '', providers: [provideDoq(config)], children: doqRoutes(config) }],
      providers: [{ provide: ContentRenderer, useClass: Plain }],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/docs/install');
    await view.fixture.whenStable();
    view.detectChanges();
    expect(await screen.findByRole('heading', { level: 1, name: 'Install' })).toBeTruthy();
    expect(screen.getByText('Install body')).toBeTruthy();
  });

  it('renders the index from the same route-scoped configuration', async () => {
    contentState.docs = [{ source: 'install', body: 'Install body', attributes: { title: 'Install' } }];
    const config = { contentDirectory: 'docs' } as const;
    const view = await render(LazyHost, {
      routes: [{ path: '', providers: [provideDoq(config)], children: doqRoutes(config) }],
      providers: [{ provide: ContentRenderer, useClass: Plain }],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/docs');
    await view.fixture.whenStable();
    view.detectChanges();
    expect(await screen.findByRole('link', { name: /Install/ })).toBeTruthy();
  });
});

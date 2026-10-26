import { render, screen, waitFor, within } from '@testing-library/angular';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import userEvent from '@testing-library/user-event';
import { doqRoutes } from '@doqs/analog';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { appConfig, docsRoute } from '../../src/app/app.config';
import { doqConfig } from '../../src/app/doq.config';
import { docsRoutes } from '../../src/app/docs.routes';
import { InstallDemo } from '../../src/app/install-demo';
import { SeoLinks } from '../../src/app/seo';

@Component({ template: '<main id="main"><h1>Landing</h1></main>' })
class Landing {}
@Component({ template: '<article class="doq-article"><h1>Doc</h1></article>' })
class Doc {}

const routes = [
  { path: '', component: Landing },
  { path: 'docs', component: Doc },
  { path: 'docs/guides/setup', component: Doc },
];

describe('COMP-100 the official site is a Doqs consumer', () => {
  it('mounts the documentation at /docs with search, the registered demos and the Doqs routes', () => {
    expect(doqConfig).toMatchObject({ contentDirectory: 'docs', basePath: '/docs', search: { enabled: true } });
    expect(Object.keys(doqConfig.demos ?? {}).sort()).toEqual(['enter-animation', 'install-command']);
    expect(docsRoutes[0]!.children).toHaveLength(doqRoutes(doqConfig).length);
    expect(appConfig.providers.length).toBeGreaterThan(4);
  });

  it('keeps the host header and footer around the routed page and offers a skip link', async () => {
    await render(App, { providers: [provideRouter(routes)], routes });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/docs');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Footer' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Skip to content' }).getAttribute('href')).toBe('#content');
    const main = screen.getByRole('navigation', { name: 'Main' });
    expect(within(main).getByRole('link', { name: 'Docs' }).getAttribute('href')).toBe('/docs');
    expect(within(main).getByRole('link', { name: 'Docs' }).getAttribute('aria-current')).toBe('page');
  });

  it('moves focus to the routed content when the skip link is used on a Doqs page', async () => {
    const user = userEvent.setup();
    await render(App, { providers: [provideRouter(routes)], routes });
    await TestBed.inject(Router).navigateByUrl('/docs/guides/setup');
    await user.click(screen.getByRole('link', { name: 'Skip to content' }));
    await waitFor(() => expect(document.activeElement?.id).toBe('content'));
    // The base href would otherwise send an in-page "#main" link to the landing page.
    expect(TestBed.inject(Router).url).toBe('/docs/guides/setup');
  });

  it('on the landing the skip link focuses the same content wrapper, which contains the main region', async () => {
    const user = userEvent.setup();
    await render(App, { providers: [provideRouter(routes)], routes });
    await TestBed.inject(Router).navigateByUrl('/');
    await user.click(screen.getByRole('link', { name: 'Skip to content' }));
    await waitFor(() => expect(document.activeElement?.id).toBe('content'));
    expect(document.activeElement?.querySelector('main#main')).toBeTruthy();
  });
});

describe('COMP-101 per-route canonical metadata', () => {
  const canonicals = () => [...document.head.querySelectorAll('link[rel="canonical"]')].map((link) => link.getAttribute('href'));

  it('writes one canonical link and og:url per route, replacing the previous one', async () => {
    document.head.querySelectorAll('link[rel="canonical"], meta[property="og:url"]').forEach((node) => node.remove());
    await render(App, { providers: [provideRouter(routes)], routes });
    TestBed.inject(SeoLinks);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/docs/guides/setup?x=1#frag');
    expect(canonicals()).toEqual(['https://docs.example.test/docs/guides/setup']);
    expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('https://docs.example.test/docs/guides/setup');
    await router.navigateByUrl('/');
    expect(canonicals()).toEqual(['https://docs.example.test/']);
    expect(document.head.querySelectorAll('meta[property="og:url"]')).toHaveLength(1);
  });
});

describe('COMP-102 the consumer-owned install demo', () => {
  it('switches the package manager with accessible controls and updates the command', async () => {
    const user = userEvent.setup();
    await render(InstallDemo);
    const group = screen.getByRole('group', { name: 'Package manager' });
    expect(within(group).getByRole('radio', { name: 'pnpm' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/^pnpm add @doqs\/analog/)).toBeTruthy();
    await user.click(within(group).getByRole('radio', { name: 'yarn' }));
    expect(screen.getByText('yarn add @doqs/analog @analogjs/content @analogjs/router prismjs')).toBeTruthy();
    expect(screen.getByText('Showing the yarn command.')).toBeTruthy();
    // Pressing the active item again keeps the selection instead of leaving the demo without a command.
    await user.click(within(group).getByRole('radio', { name: 'yarn' }));
    expect(screen.getByText(/^yarn add/)).toBeTruthy();
  });
});

describe('COMP-103 the documentation region loads on demand', () => {
  it('is a pathless lazy route limited to the mount path, so the landing never loads Doqs', async () => {
    expect(docsRoute.path).toBe('');
    expect(docsRoute.loadChildren).toBeTypeOf('function');
    expect(docsRoute.component).toBeUndefined();
    const canMatch = docsRoute.canMatch![0] as (route: unknown, segments: { path: string }[]) => boolean;
    expect(canMatch({}, [{ path: 'docs' }, { path: 'cli' }])).toBe(true);
    expect(canMatch({}, [{ path: 'docs' }])).toBe(true);
    expect(canMatch({}, [])).toBe(false);
    expect(canMatch({}, [{ path: 'documents' }])).toBe(false);
    const children = await (docsRoute.loadChildren as () => Promise<unknown[]>)();
    expect(children).toBe(docsRoutes);
    expect(docsRoutes[0]!.providers).toHaveLength(2);
    expect(docsRoutes[0]!.children).toHaveLength(2);
  });
});

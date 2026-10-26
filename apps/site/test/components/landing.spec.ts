import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { render, screen, waitFor, within } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ExamplesPage from '../../src/app/pages/examples.page';
import HomePage from '../../src/app/pages/index.page';
import { CopyCommand } from '../../src/app/copy-command';
import { EnterDemo } from '../../src/app/enter-demo';
import { ThemeController } from '../../src/app/theme';
import { SiteFooter } from '../../src/app/site-footer';
import { SiteHeader } from '../../src/app/site-header';
import { installCommand, siteLinks } from '../../src/lib/site-config';

@Component({ template: '' })
class Blank {}

const routes = [
  { path: '', component: Blank },
  { path: 'examples', component: Blank },
  { path: 'docs', component: Blank },
  { path: 'docs/getting-started', component: Blank },
  { path: 'docs/guides/interactive-playgrounds', component: Blank },
  { path: '**', component: Blank },
];
const withRouter = { providers: [provideRouter(routes)] };

describe('COMP-020 landing page content', () => {
  it('has one h1 stating the value, a main region and the labelled sections', async () => {
    await render(HomePage, withRouter);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/inside your Angular app/i);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    for (const name of [/made of your app/i, 'Up and running in four steps', /Built with Doqs/i])
      expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy();
  });

  it('LAND-02/03: the primary call to action opens the guide and the secondary one the examples', async () => {
    await render(HomePage, withRouter);
    expect(screen.getAllByRole('link', { name: /Get started/ })[0].getAttribute('href')).toBe('/docs/getting-started');
    expect(screen.getByRole('link', { name: 'Explore examples' }).getAttribute('href')).toBe('/examples');
    expect(screen.getByRole('link', { name: /View on GitHub/ }).getAttribute('href')).toBe(siteLinks.github);
  });

  it('LAND-05: presents the differentiators as articles and the rest as a list', async () => {
    await render(HomePage, withRouter);
    const section = screen.getByRole('region', { name: /made of your app/i });
    const articles = within(section).getAllByRole('article');
    expect(articles.map((article) => within(article).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Angular components inside Markdown',
      'API reference generated from your source',
      'Examples that cannot drift',
    ]);
    const names = within(section).getAllByRole('listitem').map((item) => within(item).getByRole('heading', { level: 3 }).textContent);
    expect(names).toEqual(
      expect.arrayContaining(['Static full-text search', 'SSR and SSG', 'Versioned documentation', 'Host-owned theme and layout', 'Composition slots']),
    );
  });

  it('does not promote unreleased capabilities or claim MDX', async () => {
    const { container } = await render(HomePage, withRouter);
    expect(container.textContent).toMatch(/Doqs is not MDX/);
    expect(container.textContent).not.toMatch(/i18n|internationali[sz]ation|translat|1\.0/i);
  });

  it('LAND-04: the documentation preview links to real pages and runs a real component', async () => {
    const user = userEvent.setup();
    await render(HomePage, withRouter);
    const sidebar = screen.getByRole('navigation', { name: 'Preview: documentation' });
    expect(within(sidebar).getByRole('link', { name: 'Interactive playgrounds' }).getAttribute('href')).toBe('/docs/guides/interactive-playgrounds');
    expect(within(sidebar).getByRole('link', { name: 'Interactive playgrounds' }).getAttribute('aria-current')).toBe('page');
    const toc = screen.getByRole('navigation', { name: 'Preview: on this page' });
    expect(within(toc).getByRole('link', { name: 'Register' }).getAttribute('href')).toBe('/docs/guides/interactive-playgrounds#register');
    expect(screen.getByRole('radio', { name: 'fade-up' }).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('radio', { name: 'zoom-in' }));
    expect(screen.getByTestId('enter-target').textContent).toContain('zoom-in');
    await user.click(screen.getByRole('tab', { name: 'Markdown' }));
    expect(within(screen.getByRole('figure')).getByRole('tabpanel').textContent).toContain('::demo[enter-animation]');
  });

  it('COMP-060: switches code examples with accessible tabs and shows the real public API names', async () => {
    const user = userEvent.setup();
    await render(HomePage, withRouter);
    const tabs = screen.getByRole('tablist', { name: 'Setup steps' });
    const names = within(tabs).getAllByRole('tab').map((tab) => tab.textContent?.trim());
    expect(names).toEqual(['Shared paths', 'Analog prerender', 'Angular providers', 'API reference', 'Demo registration']);
    expect(within(tabs).getByRole('tab', { selected: true }).textContent).toContain('Shared paths');
    const expected = [
      ['Analog prerender', 'doqPrerenderRoutes'],
      ['Angular providers', 'defineDoqConfig'],
      ['Angular providers', 'doqRoutes'],
      ['Angular providers', 'provideDoq'],
      ['API reference', 'doq-api check'],
      ['Demo registration', "'enter-animation'"],
    ] as const;
    for (const [tab, api] of expected) {
      await user.click(within(tabs).getByRole('tab', { name: tab }));
      expect(screen.getAllByRole('tabpanel').map((panel) => panel.textContent).join(' '), `${tab}: ${api}`).toContain(api);
    }
    await user.click(within(tabs).getByRole('tab', { name: 'Shared paths' }));
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement?.textContent).toContain('Analog prerender');
  });

  it('COMP-061: renders Volt primitives and Lumen icons, with decorative icons hidden', async () => {
    const { container } = await render(HomePage, withRouter);
    expect(container.querySelector('volt-badge')).toBeTruthy();
    expect(container.querySelector('volt-card')).toBeTruthy();
    const cta = screen.getAllByRole('link', { name: /Get started/ })[0];
    expect(cta.hasAttribute('voltbutton') || cta.className.includes('inline-flex')).toBe(true);
    expect(container.querySelector('lmn-arrow-right svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('COMP-070 examples page', () => {
  it('has one h1, a main region and one labelled section per example, each linking to its guide', async () => {
    await render(ExamplesPage, withRouter);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    const sections = screen.getAllByRole('region');
    expect(sections).toHaveLength(6);
    for (const section of sections) expect(within(section).getAllByRole('link').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Interactive playgrounds/ }).getAttribute('href')).toBe('/docs/guides/interactive-playgrounds');
  });

  it('EX-05: the playground controls drive the component and the usage code', async () => {
    const user = userEvent.setup();
    await render(ExamplesPage, withRouter);
    const lab = screen.getByRole('region', { name: /usage code that stay in sync/i });
    const usage = () => within(lab).getByTestId('lab-usage').textContent ?? '';
    expect(usage()).toContain('moveEnter="fade-up"');
    expect(usage()).toContain('[moveDuration]="600"');
    await user.click(within(lab).getByRole('radio', { name: 'blur-in' }));
    expect(usage()).toContain('moveEnter="blur-in"');
    expect(within(lab).getByTestId('movement-target').textContent).toContain('blur-in');
    await user.click(within(lab).getByRole('radio', { name: '1000 ms' }));
    expect(usage()).toContain('[moveDuration]="1000"');
    await user.click(within(lab).getByRole('radio', { name: 'Off (jump to end)' }));
    expect(usage()).toContain('[moveDisabled]="true"');
    await waitFor(() => expect(within(lab).getByTestId('lab-event').textContent).toMatch(/blur-in/));
  });

  it('EX-05: the install demo copies the command of the selected package manager', async () => {
    const user = userEvent.setup();
    await render(ExamplesPage, withRouter);
    const section = screen.getByRole('region', { name: 'A copyable install command' });
    await user.click(within(section).getByRole('radio', { name: 'npm' }));
    expect(section.textContent).toContain('npm install @doqs/analog');
  });
});

describe('COMP-021 navigation and external links', () => {
  it('NAV-01/02/07: offers Home, Examples and Docs (last) as real routes, then the external links', async () => {
    await render(SiteHeader, withRouter);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const hrefs = within(nav).getAllByRole('link').map((link) => [link.textContent?.trim(), link.getAttribute('href')]);
    expect(hrefs).toEqual([
      ['Home', '/'],
      ['Examples', '/examples'],
      ['Docs', '/docs'],
      ['GitHub', 'https://github.com/Andersseen/doqs'],
      ['npm', 'https://www.npmjs.com/package/@doqs/analog'],
    ]);
    expect(hrefs.some(([, href]) => href?.includes('#'))).toBe(false);
  });

  it('NAV-03: marks the current route with aria-current and only that route', async () => {
    const { navigate, fixture } = await render(SiteHeader, withRouter);
    const router = TestBed.inject(Router);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const current = () => within(nav).queryAllByRole('link', { current: 'page' }).map((link) => link.textContent?.trim());
    await navigate('/');
    expect(current()).toEqual(['Home']);
    await router.navigateByUrl('/examples');
    fixture.detectChanges();
    expect(current()).toEqual(['Examples']);
    await router.navigateByUrl('/docs/guides/interactive-playgrounds');
    fixture.detectChanges();
    expect(current()).toEqual(['Docs']);
    await router.navigateByUrl('/docs');
    fixture.detectChanges();
    expect(current()).toEqual(['Docs']);
  });

  it('the logo returns to the home route', async () => {
    await render(SiteHeader, withRouter);
    expect(screen.getByRole('link', { name: 'Doqs, home' }).getAttribute('href')).toBe('/');
  });

  it('NAV-04: the mobile menu mirrors the desktop routes and closes with the button, a link and Escape', async () => {
    const user = userEvent.setup();
    await render(SiteHeader, withRouter);
    const toggle = screen.getByRole('button', { name: 'Menu' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(toggle);
    const dialog = await screen.findByRole('dialog');
    const menu = within(dialog).getByRole('navigation', { name: 'Main' });
    expect(within(menu).getAllByRole('link').slice(0, 3).map((link) => link.getAttribute('href'))).toEqual(['/', '/examples', '/docs']);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const reopened = await screen.findByRole('dialog');
    await user.click(within(reopened).getByRole('link', { name: 'Examples' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(TestBed.inject(Router).url).toBe('/examples');
  });

  it('gives the footer the site routes plus GitHub, npm, changelog and license links', async () => {
    await render(SiteFooter, withRouter);
    const footer = screen.getByRole('navigation', { name: 'Footer' });
    expect(within(footer).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/examples',
      '/docs',
      siteLinks.github,
      siteLinks.npm,
      siteLinks.changelog,
      siteLinks.license,
    ]);
  });
});

describe('COMP-022 install command copy', () => {
  const stubClipboard = (writeText: (text: string) => Promise<void>) =>
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

  it('copies the exact command and announces it', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    const writeText = vi.fn(async () => undefined);
    stubClipboard(writeText);
    await render(CopyCommand, { inputs: { command: installCommand } });
    await user.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith(installCommand);
    expect(screen.getByRole('status').textContent).toMatch(/copied/i);
    expect(screen.getByRole('button').textContent).toContain('Copied');
    expect(screen.getByRole('button').querySelector('lmn-check')).toBeTruthy();
  });

  it('tells the reader to copy manually when the clipboard is unavailable', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    stubClipboard(async () => {
      throw new Error('denied');
    });
    await render(CopyCommand, { inputs: { command: installCommand } });
    await user.click(screen.getByRole('button', { name: /copy/i }));
    expect(screen.getByText(/copy it manually/i)).toBeTruthy();
  });
});

describe('COMP-062 theme toggle', () => {
  it('is a named pressed-state button that applies Volt\'s dark class and remembers the choice', async () => {
    const user = userEvent.setup();
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('doqs-theme');
    await render(SiteHeader, withRouter);
    const toggle = screen.getByRole('button', { name: 'Dark theme' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    await user.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('doqs-theme')).toBe('dark');
    await user.click(toggle);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('doqs-theme')).toBe('light');
  });

  it('exposes the state through the controller', async () => {
    await render(SiteHeader, withRouter);
    expect(TestBed.inject(ThemeController).dark()).toBe(false);
  });
});

describe('COMP-063 interactive Markdown demo', () => {
  it('switches the Angular Movement preset and replays with Volt controls', async () => {
    const user = userEvent.setup();
    await render(EnterDemo);
    const group = screen.getByRole('group', { name: 'Enter animation preset' });
    expect(within(group).getByRole('radio', { name: 'fade-up' }).getAttribute('aria-checked')).toBe('true');
    await user.click(within(group).getByRole('radio', { name: 'zoom-in' }));
    expect(screen.getByTestId('enter-target').textContent).toContain('zoom-in');
    expect(screen.getByRole('status').textContent).toContain('zoom-in');
    const before = screen.getByTestId('enter-target');
    await user.click(screen.getByRole('button', { name: /replay/i }));
    expect(screen.getByTestId('enter-target')).not.toBe(before);
  });
});

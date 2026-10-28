import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideFileRouter, requestContextInterceptor, withExtraRoutes } from '@analogjs/router';
import { provideContent, withMarkdownRenderer } from '@analogjs/content';
import { defineDoqConfig, doqRoutes, formatDoqUsage, provideDoq } from '@doqs/analog';
import { provideShowcaseDoqI18n } from './doq-i18n-adapter';
import { doqPaths } from '../doq.paths';
import { VantaButtonDemoComponent } from './demos/button-demo';
import { VantaButtonPlaygroundComponent } from './demos/button-playground';
import { VantaContrastDemoComponent } from './demos/contrast-demo';
import { VantaInstallDemoComponent } from './demos/install-demo';
import { VantaHelpComponent } from './slots/vanta-help';
import { VantaStartComponent } from './slots/vanta-start';

const doqConfig = defineDoqConfig({
  ...doqPaths,
  contentWidth: '43rem',
  sidebar: 'left',
  sidebarWidth: '14rem',
  showTableOfContents: true,
  search: { enabled: true },
  unmatched: 'continue',
  demos: { 'vanta-button': VantaButtonDemoComponent, 'vanta-install': VantaInstallDemoComponent, 'vanta-contrast': VantaContrastDemoComponent },
  playgrounds: {
    'vanta-button': {
      component: VantaButtonPlaygroundComponent,
      title: 'Volt UI button',
      description: 'A real Volt UI button: change its inputs and press it to see the output.',
      controls: [
        { input: 'variant', kind: 'select', label: 'Variant', initial: 'solid', options: [{ label: 'Solid', value: 'solid' }, { label: 'Outline', value: 'outline' }, { label: 'Ghost', value: 'ghost' }, { label: 'Destructive', value: 'destructive' }, { label: 'Link', value: 'link' }] },
        { input: 'size', kind: 'select', label: 'Size', initial: 'md', options: [{ label: 'Small', value: 'sm' }, { label: 'Medium', value: 'md' }, { label: 'Large', value: 'lg' }] },
        { input: 'label', kind: 'string', label: 'Label', initial: 'Save changes', required: true },
        { input: 'disabled', kind: 'boolean', label: 'Disabled', initial: false },
      ],
      outputs: [{ event: 'pressed', label: 'Pressed' }],
      code: [
        { label: 'Template', language: 'html', code: ({ label, ...inputs }) => formatDoqUsage('button', inputs, { attributes: ['voltButton', 'type="button"'], text: String(label ?? '') }) },
      ],
    },
  },
  slots: { indexAfterIntro: VantaStartComponent, documentAfterContent: VantaHelpComponent },
  presentation: {
    documentationLabel: 'Vanta UI docs',
    indexTitle: 'Build with Vanta UI',
    indexDescription: 'Component guides, theming and routing recipes for teams shipping thoughtful interfaces.',
    pageTitleSuffix: 'Vanta UI',
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideFileRouter(withExtraRoutes(doqRoutes(doqConfig))),
    provideContent(withMarkdownRenderer()),
    provideDoq(doqConfig),
    provideShowcaseDoqI18n,
    provideHttpClient(withInterceptors([requestContextInterceptor])), provideClientHydration(withEventReplay()),
  ],
};

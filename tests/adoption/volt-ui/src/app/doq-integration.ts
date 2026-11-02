import { defineDoqConfig } from '@doqs/analog/config';
import { doqPaths } from '../doq.paths';
import { AsyncSearchRecipe } from './recipes/async-search/async-search';
import {
  VoltButtonPlayground,
  VoltDialogPlayground,
  VoltPopoverPlayground,
  VoltSelectPlayground,
} from './volt-playgrounds';

const options = (...values: string[]) => values.map((value) => ({ label: value, value }));

export const doqConfig = defineDoqConfig({
  ...doqPaths,
  // Volt UI's shell already wraps every routed page in <main class="flex-grow">: the host owns the landmark (LANDMARK-01).
  landmark: 'host',
  // Pages that were not migrated stay host-owned below the same /docs prefix.
  unmatched: 'continue',
  search: { enabled: true },
  // The host's own recipe component, rendered in the Markdown flow of a migrated page at the original recipe URL.
  demos: { 'async-search-recipe': AsyncSearchRecipe },
  playgrounds: {
    'volt-button': {
      component: VoltButtonPlayground,
      title: 'volt-button',
      description: 'The real Volt UI button.',
      controls: [
        {
          input: 'variant',
          kind: 'select',
          label: 'Variant',
          initial: 'solid',
          options: options('solid', 'outline', 'ghost', 'link', 'destructive'),
        },
        { input: 'size', kind: 'select', label: 'Size', initial: 'md', options: options('sm', 'md', 'lg') },
        { input: 'label', kind: 'string', label: 'Label', initial: 'Save changes' },
        { input: 'disabled', kind: 'boolean', label: 'Disabled' },
      ],
      outputs: [{ event: 'pressed', label: 'Pressed' }],
      code: [
        {
          label: 'Template',
          language: 'html',
          code: ({ variant, size, label, disabled }) =>
            `<volt-button variant="${variant}" size="${size}"${disabled ? ' disabled' : ''}>${label}</volt-button>`,
        },
      ],
    },
    'volt-dialog': {
      component: VoltDialogPlayground,
      title: 'voltDialogRoot',
      description: 'A real Volt UI dialog: its overlay and content render in the application root, like in production.',
      expandedPreview: 'overlay-compatible',
      controls: [
        { input: 'heading', kind: 'string', label: 'Heading', initial: 'Delete project?' },
        { input: 'role', kind: 'select', label: 'Role', initial: 'dialog', options: options('dialog', 'alertdialog') },
        { input: 'closeOnEscape', kind: 'boolean', label: 'Close on Escape', initial: true },
      ],
      outputs: [{ event: 'closed', label: 'Closed' }],
    },
    'volt-popover': {
      component: VoltPopoverPlayground,
      title: 'voltPopover',
      description: 'A real Volt UI popover trigger and content.',
      expandedPreview: 'overlay-compatible',
      controls: [
        {
          input: 'placement',
          kind: 'select',
          label: 'Placement',
          initial: 'bottom',
          options: options('top', 'bottom', 'left', 'right'),
        },
        { input: 'offset', kind: 'number', label: 'Offset (px)', initial: 8, min: 0, max: 40, step: 4 },
      ],
      outputs: [{ event: 'openChange', label: 'Open change' }],
    },
    'volt-select': {
      component: VoltSelectPlayground,
      title: 'volt-select',
      description: 'A real Volt UI select; its dropdown is portalled to the document body.',
      expandedPreview: 'overlay-compatible',
      controls: [
        { input: 'placeholder', kind: 'string', label: 'Placeholder', initial: 'Select a fruit' },
        { input: 'disabled', kind: 'boolean', label: 'Disabled' },
      ],
      outputs: [{ event: 'changed', label: 'Changed' }],
    },
    'volt-select-modal': {
      component: VoltSelectPlayground,
      title: 'volt-select-modal',
      description: 'A real Volt UI select; its dropdown is portalled to the document body.',
      controls: [
        { input: 'placeholder', kind: 'string', label: 'Placeholder', initial: 'Select a fruit' },
        { input: 'disabled', kind: 'boolean', label: 'Disabled' },
      ],
      outputs: [{ event: 'changed', label: 'Changed' }],
    },
  },
  presentation: { documentationLabel: 'Documentation', pageTitleSuffix: 'Volt UI' },
});

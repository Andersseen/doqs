# Browser and screen-reader verification

This protocol supplements the automated Playwright and axe checks. Automated accessibility checks cover only a subset of WCAG and do not establish conformance or replace screen-reader use.

## VoiceOver with Safari on macOS

Use a current supported macOS and Safari version. Enable VoiceOver with `Command+F5` and use Safari's full keyboard access setting so Tab can reach links and controls.

1. Open the host landing page, enter its documentation region, and inspect the page title, main landmark, heading outline, sidebar navigation and current-page announcement.
2. Navigate the sidebar and table of contents using VoiceOver navigation and keyboard. Confirm link names, expanded/collapsed state, current-page state, and that the focused section is announced after navigation.
3. Open search using the visible button and `Control+Option+Space`; confirm the dialog name, labelled search field and changing result count/status. Move through results, open one, then reopen search and press Escape. Confirm focus returns to the trigger.
4. On a mobile-width viewport, open the navigation drawer, inspect its controls and links, close with Escape, and confirm focus returns to the menu trigger.
5. On an interactive playground, inspect every label, native disabled/invalid state, output announcement and keyboard operation. Expand the preview, confirm dialog name and close control, close with Escape and verify focus restoration and retained playground state.
6. Repeat on Arabic documentation. Confirm Arabic language and right-to-left direction are announced, and locale switching reaches the expected translated page.
7. Record macOS, Safari, VoiceOver versions, the exact routes, observed announcements, defects, and result. Do not mark PASS if any step was skipped.

## NVDA with a supported Windows browser

Use a current supported Windows release and the project's supported Chromium browser. Record exact browser and NVDA versions; use NVDA in browse mode for document structure and focus mode for interactive controls.

1. Repeat the landing-to-document journey and inspect landmarks, heading levels, sidebar links and the current page.
2. Navigate by heading and link through a document and its table of contents. Confirm the focused section and page title after navigation.
3. Open search by button and keyboard shortcut. Confirm dialog name, labelled field, result status announcements, result navigation, Escape dismissal and focus restoration.
4. Test the mobile drawer at a narrow viewport, including expanded state, link navigation, Escape and focus restoration.
5. Operate playground inputs using native controls. Check disabled and invalid state announcements, output changes, expanded-preview dialog semantics, Escape dismissal, retained state and restored focus.
6. Repeat the language switch on Arabic documentation and verify NVDA reports Arabic text and the RTL page structure intelligibly.
7. Record Windows, browser and NVDA versions, exact routes, observed announcements, defects and result. Do not mark PASS if any step was skipped.

## Current run record

VoiceOver/Safari: **NOT RUN** until a maintainer records an actual session.

NVDA/Windows: **NOT RUN** until a maintainer records an actual session.

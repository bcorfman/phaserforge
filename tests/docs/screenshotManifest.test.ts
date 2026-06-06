import { describe, expect, it } from 'vitest';

import {
  getScreenshotsBySource,
  parseScreenshotManifest,
} from '../../src/docs/screenshotManifest';

describe('parseScreenshotManifest', () => {
  it('parses valid storybook and playwright screenshot entries', () => {
    const manifest = parseScreenshotManifest([
      {
        id: 'toolbar-theme-and-scale',
        source: 'storybook',
        storyId: 'editor-toolbar--theme-and-scale',
        selector: '[data-testid="toolbar"]',
        output: 'docs/assets/screenshots/storybook/toolbar-theme-and-scale.png',
      },
      {
        id: 'layout-popover',
        source: 'playwright',
        output: 'docs/assets/screenshots/playwright/layout-popover.png',
      },
    ]);

    expect(manifest).toHaveLength(2);
    expect(manifest[0]?.source).toBe('storybook');
    expect(manifest[1]?.source).toBe('playwright');
  });

  it('requires storybook entries to include a story id', () => {
    expect(() =>
      parseScreenshotManifest([
        {
          id: 'bad-story',
          source: 'storybook',
          output: 'docs/assets/screenshots/storybook/bad.png',
        },
      ]),
    ).toThrow('must include storyId');
  });

  it('requires every entry to include id, source, and output', () => {
    expect(() =>
      parseScreenshotManifest([
        {
          source: 'playwright',
          output: 'docs/assets/screenshots/playwright/missing-id.png',
        },
      ]),
    ).toThrow('must include a non-empty id');
  });
});

describe('getScreenshotsBySource', () => {
  it('filters manifest entries by source', () => {
    const manifest = parseScreenshotManifest([
      {
        id: 'toolbar-theme-and-scale',
        source: 'storybook',
        storyId: 'editor-toolbar--theme-and-scale',
        output: 'docs/assets/screenshots/storybook/toolbar-theme-and-scale.png',
      },
      {
        id: 'layout-popover',
        source: 'playwright',
        output: 'docs/assets/screenshots/playwright/layout-popover.png',
      },
    ]);

    expect(getScreenshotsBySource(manifest, 'storybook').map((entry) => entry.id)).toEqual([
      'toolbar-theme-and-scale',
    ]);
    expect(getScreenshotsBySource(manifest, 'playwright').map((entry) => entry.id)).toEqual([
      'layout-popover',
    ]);
  });
});

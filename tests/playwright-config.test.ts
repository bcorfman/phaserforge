import { describe, expect, it } from 'vitest';

import { resolveE2EProjectNames } from '../playwright.config';

describe('playwright.config project selection', () => {
  it('defaults to Edge + Chromium locally', () => {
    expect(resolveE2EProjectNames({})).toEqual(['chromium', 'msedge']);
  });

  it('defaults to Chromium-only on GitHub Actions', () => {
    expect(resolveE2EProjectNames({ GITHUB_ACTIONS: 'true' })).toEqual(['chromium']);
  });

  it('includes all browsers when PW_ALL_BROWSERS=1', () => {
    expect(resolveE2EProjectNames({ PW_ALL_BROWSERS: '1' })).toEqual(['chromium', 'firefox', 'webkit', 'msedge']);
  });

  it('supports opting out of Edge locally via PW_EXCLUDE_EDGE=1', () => {
    expect(resolveE2EProjectNames({ PW_EXCLUDE_EDGE: '1' })).toEqual(['chromium']);
  });

  it('supports explicit PW_PROJECTS override', () => {
    expect(resolveE2EProjectNames({ GITHUB_ACTIONS: 'true', PW_PROJECTS: 'firefox,webkit,msedge' })).toEqual([
      'firefox',
      'webkit',
      'msedge',
    ]);
  });
});

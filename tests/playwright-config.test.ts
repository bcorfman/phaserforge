import { describe, expect, it } from 'vitest';

import { resolveE2EProjectNames } from '../playwright.config';

describe('playwright.config project selection', () => {
  it('defaults to Edge + Chromium locally', () => {
    expect(resolveE2EProjectNames({})).toEqual(['chromium', 'edge']);
  });

  it('defaults to Firefox + WebKit on GitHub Actions', () => {
    expect(resolveE2EProjectNames({ GITHUB_ACTIONS: 'true' })).toEqual(['firefox', 'webkit']);
  });

  it('includes all browsers when PW_ALL_BROWSERS=1', () => {
    expect(resolveE2EProjectNames({ PW_ALL_BROWSERS: '1' })).toEqual(['chromium', 'firefox', 'webkit', 'edge']);
  });

  it('supports opting out of Edge locally via PW_EXCLUDE_EDGE=1', () => {
    expect(resolveE2EProjectNames({ PW_EXCLUDE_EDGE: '1' })).toEqual(['chromium']);
  });

  it('supports adding Edge on GitHub Actions via PW_INCLUDE_EDGE=1', () => {
    expect(resolveE2EProjectNames({ GITHUB_ACTIONS: 'true', PW_INCLUDE_EDGE: '1' })).toEqual([
      'firefox',
      'webkit',
      'edge',
    ]);
  });
});


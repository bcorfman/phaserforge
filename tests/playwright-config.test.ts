import { describe, expect, it } from 'vitest';

import { resolveE2EProjectNames, resolveE2EWebServerConfig } from '../playwright.config';

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

  it('uses the stable preview server path by default', () => {
    expect(resolveE2EWebServerConfig({})).toEqual({
      command:
        'VITE_E2E_TEST_BRIDGE=1 npm run build-nolog && VITE_E2E_TEST_BRIDGE=1 npx vite preview --config vite/config.prod.mjs --host 127.0.0.1 --port 4173 --strictPort',
      port: 4173,
      reuseExistingServer: false,
      timeout: 180000,
    });
  });

  it('supports opting into a live dev server for debugging', () => {
    expect(resolveE2EWebServerConfig({ PW_E2E_SERVER_MODE: 'dev' })).toEqual({
      command: 'npx vite --config vite/config.dev.mjs --host 127.0.0.1 --port 4173',
      port: 4173,
      reuseExistingServer: false,
      timeout: 120000,
    });
  });

  it('allows an externally-managed web server', () => {
    expect(resolveE2EWebServerConfig({ PW_EXTERNAL_WEBSERVER: '1' })).toBeUndefined();
  });
});

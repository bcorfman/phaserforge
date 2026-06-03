import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { shouldUseManagedExternalWebServer } = require('../scripts/e2e-external-webserver.cjs');

describe('managed external E2E web server', () => {
  it('enables managed external server for normal test runs', () => {
    expect(shouldUseManagedExternalWebServer(['test', '--project=chromium'], {})).toBe(true);
  });

  it('skips managed external server for list-only runs', () => {
    expect(shouldUseManagedExternalWebServer(['test', '--list', '--project=chromium'], {})).toBe(false);
  });

  it('respects an explicitly managed external server environment override', () => {
    expect(shouldUseManagedExternalWebServer(['test'], { PW_EXTERNAL_WEBSERVER: '1' })).toBe(false);
  });
});

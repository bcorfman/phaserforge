import { describe, expect, it } from 'vitest';

import { shouldEnableTestBridge } from '../src/testing/testBridge';

describe('testBridge', () => {
  it('enables the bridge in dev mode', () => {
    expect(shouldEnableTestBridge({ DEV: true }, true)).toBe(true);
  });

  it('enables the bridge for preview smoke runs when explicitly requested', () => {
    expect(shouldEnableTestBridge({ DEV: false, VITE_E2E_TEST_BRIDGE: '1' }, true)).toBe(true);
  });

  it('keeps the bridge disabled in production without the explicit preview override', () => {
    expect(shouldEnableTestBridge({ DEV: false, VITE_E2E_TEST_BRIDGE: '0' }, true)).toBe(false);
  });
});

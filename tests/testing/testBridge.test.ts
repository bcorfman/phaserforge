// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { registerAppStateGetter, registerModeToggleHandler, unregisterAppStateGetter, unregisterModeToggleHandler } from '../../src/testing/testBridge';

describe('testBridge mode helpers', () => {
  it('exposes setMode() and uses the registered toggle handler', () => {
    const handler = vi.fn();
    registerModeToggleHandler(handler);

    const getState = () =>
      ({
        mode: 'edit',
      }) as any;
    registerAppStateGetter(getState);

    expect(window.__PHASER_ACTIONS_STUDIO_TEST__?.isEnabled).toBe(true);
    expect(typeof window.__PHASER_ACTIONS_STUDIO_TEST__?.setMode).toBe('function');

    window.__PHASER_ACTIONS_STUDIO_TEST__?.setMode?.('play');
    expect(handler).toHaveBeenCalledTimes(1);

    unregisterAppStateGetter(getState);
    unregisterModeToggleHandler(handler);
  });
});


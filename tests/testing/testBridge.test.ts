// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import {
  registerActionDispatcher,
  registerAppStateGetter,
  registerModeToggleHandler,
  unregisterActionDispatcher,
  unregisterAppStateGetter,
  unregisterModeToggleHandler,
} from '../../src/testing/testBridge';

describe('testBridge mode helpers', () => {
  it('exposes setMode() and dispatches mode changes without using the UI toggle handler', () => {
    const handler = vi.fn();
    const dispatch = vi.fn();
    registerModeToggleHandler(handler);
    registerActionDispatcher(dispatch);

    const getState = () =>
      ({
        mode: 'edit',
      }) as any;
    registerAppStateGetter(getState);

    expect(window.__PHASER_FORGE_TEST__?.isEnabled).toBe(true);
    expect(typeof window.__PHASER_FORGE_TEST__?.setMode).toBe('function');
    expect(typeof window.__PHASER_FORGE_TEST__?.pauseActiveProjectRecordPersistence).toBe('function');
    expect(typeof window.__PHASER_FORGE_TEST__?.resumeActiveProjectRecordPersistence).toBe('function');

    window.__PHASER_FORGE_TEST__?.setMode?.('play');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'toggle-mode' });
    expect(handler).not.toHaveBeenCalled();

    unregisterAppStateGetter(getState);
    unregisterActionDispatcher(dispatch);
    unregisterModeToggleHandler(handler);
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearViewDebugEntries,
  installViewDebugBridge,
  isViewDebugEnabled,
  readViewDebugEntries,
  setViewDebugEnabled,
} from '../../src/util/viewDebug';

function createStorageMock(): Storage {
  let store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store = new Map<string, string>();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe('viewDebug', () => {
  Object.defineProperty(window, 'localStorage', {
    value: createStorageMock(),
    configurable: true,
  });

  afterEach(() => {
    clearViewDebugEntries();
    setViewDebugEnabled(false);
    delete window.__PHASER_FORGE_VIEW_DEBUG__;
  });

  it('toggles the view debug flag', () => {
    expect(isViewDebugEnabled()).toBe(false);
    setViewDebugEnabled(true);
    expect(isViewDebugEnabled()).toBe(true);
    setViewDebugEnabled(false);
    expect(isViewDebugEnabled()).toBe(false);
  });

  it('installs a bridge that can enable, disable, and clear view debug', () => {
    installViewDebugBridge();

    window.__PHASER_FORGE_VIEW_DEBUG__?.enable();
    expect(isViewDebugEnabled()).toBe(true);
    expect(readViewDebugEntries()).toEqual([]);

    window.__PHASER_FORGE_VIEW_DEBUG__?.disable();
    expect(isViewDebugEnabled()).toBe(false);

    window.localStorage.setItem('phaserforge.debugViewRestoreLog.v1', JSON.stringify([{ event: 'scene-view-state' }]));
    window.__PHASER_FORGE_VIEW_DEBUG__?.clear();
    expect(readViewDebugEntries()).toEqual([]);
  });
});

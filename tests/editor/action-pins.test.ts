// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';

function installMockLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => void store.clear(),
  };
  Object.defineProperty(window, 'localStorage', { value: localStorage, configurable: true });
  return localStorage;
}

describe('actionPins', () => {
  beforeEach(() => {
    vi.resetModules();
    installMockLocalStorage();
  });

  it('returns empty when window is not available (SSR-safe)', async () => {
    const prevWindow = (globalThis as any).window;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (globalThis as any).window;

    const pins = await import('../../src/editor/actionPins');
    expect(pins.loadPinnedActionTypes()).toEqual([]);
    pins.savePinnedActionTypes(['MoveUntil']);
    expect(pins.loadPinnedActionTypes()).toEqual([]);

    (globalThis as any).window = prevWindow;
  });

  it('returns empty when storage is empty or invalid JSON', async () => {
    const pins = await import('../../src/editor/actionPins');
    window.localStorage.removeItem('phaserforge.pinnedActionTypes.v1');
    expect(pins.loadPinnedActionTypes()).toEqual([]);

    window.localStorage.setItem('phaserforge.pinnedActionTypes.v1', '{not json');
    expect(pins.loadPinnedActionTypes()).toEqual([]);
  });

  it('dedupes + sorts when saving and loading', async () => {
    const pins = await import('../../src/editor/actionPins');
    pins.savePinnedActionTypes(['Wait', 'MoveUntil', 'Wait', '', 'Repeat']);
    expect(pins.loadPinnedActionTypes()).toEqual(['MoveUntil', 'Repeat', 'Wait']);
  });

  it('toggles pin on/off and persists', async () => {
    const pins = await import('../../src/editor/actionPins');
    window.localStorage.removeItem('phaserforge.pinnedActionTypes.v1');

    expect(pins.togglePinnedActionType('MoveUntil')).toEqual(['MoveUntil']);
    expect(pins.loadPinnedActionTypes()).toEqual(['MoveUntil']);

    expect(pins.togglePinnedActionType('MoveUntil')).toEqual([]);
    expect(pins.loadPinnedActionTypes()).toEqual([]);
  });
});

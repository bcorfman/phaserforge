// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const storage = (() => {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    clear: vi.fn(() => {
      values.clear();
    }),
  };
})();

const loadModule = async () => import('../../src/editor/yamlPickerState');

describe('yamlPickerState', () => {
  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });
    storage.clear();
    storage.getItem.mockClear();
    storage.setItem.mockClear();
    storage.removeItem.mockClear();
    storage.clear.mockClear();
    vi.resetModules();
  });

  it('persists the YAML filename label in localStorage', async () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });
    const state = await loadModule();

    state.setYamlFileSourceLabel('persisted-name.yaml');

    expect(storage.setItem).toHaveBeenCalledWith('phaserforge:last-yaml-file-label', 'persisted-name.yaml');
  });

  it('restores the YAML filename label from localStorage after reload', async () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });
    storage.setItem('phaserforge:last-yaml-file-label', 'restored-name.yaml');

    const state = await loadModule();

    expect(state.getYamlFileSourceLabel()).toBe('restored-name.yaml');
  });
});

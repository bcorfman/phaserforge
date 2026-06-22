// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  appendPersistenceDebugEntry,
  clearPersistenceDebugEntries,
  installPersistenceDebugBridge,
  readPersistenceDebugEntries,
  setPersistenceDebugEnabled,
} from '../../src/util/persistenceDebug';

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

describe('persistenceDebug', () => {
  Object.defineProperty(window, 'localStorage', {
    value: createStorageMock(),
    configurable: true,
  });

  afterEach(() => {
    clearPersistenceDebugEntries();
    setPersistenceDebugEnabled(false);
    delete window.__PHASER_FORGE_PERSISTENCE_DEBUG__;
  });

  it('records entries only when the debug flag is enabled', () => {
    appendPersistenceDebugEntry('editor-store:save-active-start', { projectId: 'project-1' });
    expect(readPersistenceDebugEntries()).toEqual([]);

    setPersistenceDebugEnabled(true);
    appendPersistenceDebugEntry('editor-store:save-active-start', { projectId: 'project-1' });

    expect(readPersistenceDebugEntries()).toEqual([
      expect.objectContaining({
        event: 'editor-store:save-active-start',
        details: expect.objectContaining({
          projectId: 'project-1',
        }),
      }),
    ]);
  });

  it('keeps only the most recent entries in the rolling log', () => {
    setPersistenceDebugEnabled(true);

    for (let index = 0; index < 250; index += 1) {
      appendPersistenceDebugEntry('project-persistence:write', { index });
    }

    const entries = readPersistenceDebugEntries();
    expect(entries).toHaveLength(200);
    expect(entries[0]).toEqual(expect.objectContaining({
      details: expect.objectContaining({ index: 50 }),
    }));
    expect(entries.at(-1)).toEqual(expect.objectContaining({
      details: expect.objectContaining({ index: 249 }),
    }));
  });

  it('installs a window bridge that can read and clear the persisted trace', () => {
    setPersistenceDebugEnabled(true);
    installPersistenceDebugBridge();
    appendPersistenceDebugEntry('cloud:autosave-flush-success', { cloudGameId: 'g-1' });

    const firstRead = window.__PHASER_FORGE_PERSISTENCE_DEBUG__?.read() ?? [];
    expect(firstRead).toHaveLength(1);
    expect(firstRead[0]).toEqual(expect.objectContaining({
      event: 'cloud:autosave-flush-success',
      details: expect.objectContaining({ cloudGameId: 'g-1' }),
    }));

    window.__PHASER_FORGE_PERSISTENCE_DEBUG__?.clear();
    expect(window.__PHASER_FORGE_PERSISTENCE_DEBUG__?.read()).toEqual([]);
  });
});

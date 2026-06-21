// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyProject } from '../../src/model/emptyProject';
import { projectPersistence } from '../../src/editor/projectPersistence';

function installLocalStorageMock() {
  const storage = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    },
  });
}

describe('projectPersistence steady-state storage', () => {
  installLocalStorageMock();

  afterEach(() => {
    window.localStorage.clear();
  });

  it('does not bootstrap a project from legacy localStorage project YAML when indexeddb is unavailable', async () => {
    const originalIndexedDb = window.indexedDB;
    const project = createEmptyProject();
    window.localStorage.setItem('phaserforge.projectYaml.v1', JSON.stringify({ project }));
    // @ts-expect-error test override
    window.indexedDB = undefined;

    try {
      const snapshot = await projectPersistence.load();
      expect(snapshot.localProjects).toEqual([]);
      expect(snapshot.workspace.activeProjectId).toBeNull();
    } finally {
      window.indexedDB = originalIndexedDb;
    }
  });

  it('still hydrates legacy browser preferences when indexeddb is unavailable', async () => {
    const originalIndexedDb = window.indexedDB;
    // @ts-expect-error test override
    window.indexedDB = undefined;
    window.localStorage.setItem('phaserforge.startupMode.v1', 'new_empty_scene');
    window.localStorage.setItem('phaserforge.themeMode.v1', 'light');
    window.localStorage.setItem('phaserforge.uiScale.v1', '1');
    window.localStorage.setItem('phaserforge.showHitboxOverlay.v1', '0');

    try {
      const snapshot = await projectPersistence.load();
      expect(snapshot.preferences).toEqual({
        startupMode: 'new_empty_scene',
        themeMode: 'light',
        uiScale: 1,
        showHitboxOverlay: false,
      });
    } finally {
      window.indexedDB = originalIndexedDb;
    }
  });

  it('returns safe defaults for workspace/profile helpers when indexeddb is unavailable', async () => {
    const originalIndexedDb = window.indexedDB;
    // @ts-expect-error test override
    window.indexedDB = undefined;

    try {
      expect(await projectPersistence.loadWorkspaceStateRecord()).toEqual({
        activeProjectId: null,
        syncMode: 'online',
      });
      expect(await projectPersistence.loadViewState('project-1')).toBeNull();
      expect(await projectPersistence.loadLastPublishInfo('u1')).toBeNull();
    } finally {
      window.indexedDB = originalIndexedDb;
    }
  });
});

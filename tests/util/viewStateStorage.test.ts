import { describe, expect, it } from 'vitest';
import {
  canRestorePersistedView,
  doesReportedViewMatchCurrentScene,
  isViewStateApproximatelyEqual,
  parseStoredViewState,
  shouldResetViewStateForProjectChange,
  shouldPersistViewState,
  toExactViewState,
  VIEW_STATE_STORAGE_KEY,
  type ViewState,
  readStoredViewState,
  writeStoredViewState,
} from '../../src/util/viewStateStorage';

describe('viewStateStorage', () => {
  it('parses a valid view state JSON', () => {
    expect(parseStoredViewState(JSON.stringify({
      projectId: 'p1',
      zoom: 1.25,
      scrollX: 10,
      scrollY: -5,
      viewportWidth: 900,
      viewportHeight: 700,
    }))).toEqual({
      projectId: 'p1',
      zoom: 1.25,
      scrollX: 10,
      scrollY: -5,
      viewportWidth: 900,
      viewportHeight: 700,
    });
  });

  it('returns undefined for invalid JSON', () => {
    expect(parseStoredViewState('{')).toBeUndefined();
  });

  it('returns undefined for missing/invalid numbers', () => {
    expect(parseStoredViewState(JSON.stringify({ projectId: 'p1', zoom: 'nope', scrollX: 0, scrollY: 0 }))).toBeUndefined();
    expect(parseStoredViewState(JSON.stringify({ projectId: 'p1', zoom: 0, scrollX: 0, scrollY: 0 }))).toBeUndefined();
    expect(parseStoredViewState(JSON.stringify({ projectId: 'p1', zoom: 1, scrollX: 'nope', scrollY: 0 }))).toBeUndefined();
    expect(parseStoredViewState(JSON.stringify({ zoom: 1, scrollX: 0, scrollY: 0 }))).toBeUndefined();
  });

  it('reads/writes via storage key', () => {
    const storage = new Map<string, string>();
    const fakeStorage: Storage = {
      get length() {
        return storage.size;
      },
      clear() {
        storage.clear();
      },
      getItem(key: string) {
        return storage.get(key) ?? null;
      },
      key(index: number) {
        return Array.from(storage.keys())[index] ?? null;
      },
      removeItem(key: string) {
        storage.delete(key);
      },
      setItem(key: string, value: string) {
        storage.set(key, value);
      },
    };

    const view: ViewState = { zoom: 2, scrollX: 3, scrollY: 4, viewportWidth: 900, viewportHeight: 700 };
    writeStoredViewState(fakeStorage, 'p1', view);
    expect(fakeStorage.getItem(VIEW_STATE_STORAGE_KEY)).toBe(JSON.stringify({ projectId: 'p1', ...view }));
    expect(readStoredViewState(fakeStorage, 'p1')).toEqual(view);
    expect(readStoredViewState(fakeStorage, 'p2')).toBeUndefined();
  });

  it('strips viewport dimensions for exact same-canvas mode-switch restores', () => {
    expect(toExactViewState({
      zoom: 1.4,
      scrollX: -220,
      scrollY: -160,
      viewportWidth: 1280,
      viewportHeight: 721,
    })).toEqual({
      zoom: 1.4,
      scrollX: -220,
      scrollY: -160,
    });
    expect(toExactViewState(undefined)).toBeUndefined();
  });

  it('does not persist boot-time viewport state before restore has run', () => {
    expect(shouldPersistViewState({ projectId: 'p1', initialized: false, restoreAttempted: false })).toBe(false);
    expect(shouldPersistViewState({ projectId: 'p1', initialized: true, restoreAttempted: false })).toBe(false);
    expect(shouldPersistViewState({ projectId: '', initialized: true, restoreAttempted: true })).toBe(false);
    expect(shouldPersistViewState({ projectId: 'p1', initialized: true, restoreAttempted: true })).toBe(true);
  });

  it('ignores boot-time project swaps until initialization is complete', () => {
    expect(shouldResetViewStateForProjectChange({
      initialized: false,
      currentProjectId: 'project-real',
      lastProjectId: 'project-1',
    })).toBe(false);
    expect(shouldResetViewStateForProjectChange({
      initialized: true,
      currentProjectId: 'project-real',
      lastProjectId: 'project-real',
    })).toBe(false);
    expect(shouldResetViewStateForProjectChange({
      initialized: true,
      currentProjectId: 'project-real',
      lastProjectId: 'project-1',
    })).toBe(true);
  });

  it('waits for view-state events from the currently loaded scene before restoring', () => {
    expect(doesReportedViewMatchCurrentScene({
      initialized: false,
      reportedWorldWidth: 1024,
      reportedWorldHeight: 768,
      currentWorldWidth: 800,
      currentWorldHeight: 600,
    })).toBe(true);
    expect(doesReportedViewMatchCurrentScene({
      initialized: true,
      reportedWorldWidth: 1024,
      reportedWorldHeight: 768,
      currentWorldWidth: 800,
      currentWorldHeight: 600,
    })).toBe(false);
    expect(doesReportedViewMatchCurrentScene({
      initialized: true,
      reportedWorldWidth: 800,
      reportedWorldHeight: 600,
      currentWorldWidth: 800,
      currentWorldHeight: 600,
    })).toBe(true);
  });

  it('restores persisted view only after the active scene world matches the current app scene', () => {
    expect(canRestorePersistedView({
      initialized: false,
      restoreAttempted: false,
      activeSceneWorldWidth: 800,
      activeSceneWorldHeight: 600,
      currentWorldWidth: 800,
      currentWorldHeight: 600,
    })).toBe(false);
    expect(canRestorePersistedView({
      initialized: true,
      restoreAttempted: true,
      activeSceneWorldWidth: 800,
      activeSceneWorldHeight: 600,
      currentWorldWidth: 800,
      currentWorldHeight: 600,
    })).toBe(false);
    expect(canRestorePersistedView({
      initialized: true,
      restoreAttempted: false,
      activeSceneWorldWidth: 1024,
      activeSceneWorldHeight: 768,
      currentWorldWidth: 800,
      currentWorldHeight: 600,
    })).toBe(false);
    expect(canRestorePersistedView({
      initialized: true,
      restoreAttempted: false,
      activeSceneWorldWidth: 800,
      activeSceneWorldHeight: 600,
      currentWorldWidth: 800,
      currentWorldHeight: 600,
    })).toBe(true);
  });

  it('treats near-identical view states as equal', () => {
    expect(isViewStateApproximatelyEqual(
      { zoom: 1.34, scrollX: 120, scrollY: -80 },
      { zoom: 1.34, scrollX: 120, scrollY: -80 }
    )).toBe(true);
    expect(isViewStateApproximatelyEqual(
      { zoom: 1.339, scrollX: 120.7, scrollY: -79.4 },
      { zoom: 1.34, scrollX: 120, scrollY: -80 }
    )).toBe(true);
    expect(isViewStateApproximatelyEqual(
      { zoom: 1.14, scrollX: 120, scrollY: -80 },
      { zoom: 1.34, scrollX: 120, scrollY: -80 }
    )).toBe(false);
    expect(isViewStateApproximatelyEqual(
      { zoom: 1.34, scrollX: 124, scrollY: -80 },
      { zoom: 1.34, scrollX: 120, scrollY: -80 }
    )).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { parseStoredViewState, VIEW_STATE_STORAGE_KEY, type ViewState, readStoredViewState, writeStoredViewState } from '../../src/util/viewStateStorage';

describe('viewStateStorage', () => {
  it('parses a valid view state JSON', () => {
    expect(parseStoredViewState(JSON.stringify({ projectId: 'p1', zoom: 1.25, scrollX: 10, scrollY: -5 }))).toEqual({
      projectId: 'p1',
      zoom: 1.25,
      scrollX: 10,
      scrollY: -5,
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

    const view: ViewState = { zoom: 2, scrollX: 3, scrollY: 4 };
    writeStoredViewState(fakeStorage, 'p1', view);
    expect(fakeStorage.getItem(VIEW_STATE_STORAGE_KEY)).toBe(JSON.stringify({ projectId: 'p1', ...view }));
    expect(readStoredViewState(fakeStorage, 'p1')).toEqual(view);
    expect(readStoredViewState(fakeStorage, 'p2')).toBeUndefined();
  });
});

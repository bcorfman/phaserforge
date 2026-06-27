// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyProject } from '../../src/model/emptyProject';
import { serializeProjectToYaml } from '../../src/model/serialization';
import type { ProjectHistoryEvent } from '../../src/editor/projectHistoryEvents';
import {
  __pauseActiveProjectRecordPersistenceForTests,
  __resumeActiveProjectRecordPersistenceForTests,
  buildStoredProjectRecord,
  projectPersistence,
} from '../../src/editor/projectPersistence';
import { appendProjectRevision, createProjectRevision, materializeProjectRevision } from '../../src/editor/projectTreeHistory';
import { clearPersistenceDebugEntries, readPersistenceDebugEntries, setPersistenceDebugEnabled } from '../../src/util/persistenceDebug';

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

function installIndexedDbMock() {
  type StoreState = { keyPath?: string; values: Map<IDBValidKey, unknown> };
  type DatabaseState = { version: number; stores: Map<string, StoreState> };
  const databases = new Map<string, DatabaseState>();

  const clone = <T,>(value: T): T => (value === undefined ? value : structuredClone(value));
  const queueTask = (fn: () => void) => {
    setTimeout(fn, 0);
  };

  const createRequest = <T,>(run: (resolve: (value: T) => void, reject: (error: unknown) => void) => void) => {
    const request: IDBRequest<T> = {
      onsuccess: null,
      onerror: null,
      result: undefined as T,
      error: null,
      readyState: 'pending',
      source: null,
      transaction: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    };
    queueTask(() => {
      run(
        (value) => {
          request.result = value;
          request.readyState = 'done';
          request.onsuccess?.({ target: request } as Event);
        },
        (error) => {
          request.error = error instanceof Error ? error : new Error(String(error));
          request.readyState = 'done';
          request.onerror?.({ target: request } as Event);
        },
      );
    });
    return request;
  };

  const createDatabase = (name: string, state: DatabaseState): IDBDatabase => {
    const db = {
      name,
      version: state.version,
      objectStoreNames: {
        contains(storeName: string) {
          return state.stores.has(storeName);
        },
        get length() {
          return state.stores.size;
        },
        item(index: number) {
          return Array.from(state.stores.keys())[index] ?? null;
        },
        [Symbol.iterator]: function* () {
          yield* state.stores.keys();
        },
      } satisfies DOMStringList,
      createObjectStore(storeName: string, options?: IDBObjectStoreParameters) {
        const store: StoreState = { keyPath: typeof options?.keyPath === 'string' ? options.keyPath : undefined, values: new Map() };
        state.stores.set(storeName, store);
        return {
          name: storeName,
          keyPath: store.keyPath ?? null,
          indexNames: {
            contains: () => false,
            length: 0,
            item: () => null,
            [Symbol.iterator]: function* () {},
          } satisfies DOMStringList,
          transaction: null,
          autoIncrement: false,
        } as IDBObjectStore;
      },
      deleteObjectStore(storeName: string) {
        state.stores.delete(storeName);
      },
      transaction(storeNames: string | string[]) {
        const requestedNames = Array.isArray(storeNames) ? storeNames : [storeNames];
        const tx = {
          db,
          mode: 'readwrite',
          error: null,
          objectStore(name: string) {
            const store = state.stores.get(name);
            if (!store) throw new Error(`missing object store: ${name}`);
            return createObjectStore(name, store, tx as unknown as IDBTransaction);
          },
          onabort: null,
          oncomplete: null,
          onerror: null,
          abort() {},
          commit() {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        } as IDBTransaction;
        let pending = 0;
        let completionQueued = false;
        const scheduleCompletion = () => {
          if (completionQueued || pending > 0) return;
          completionQueued = true;
          queueTask(() => {
            completionQueued = false;
            if (pending === 0) tx.oncomplete?.({ target: tx } as Event);
          });
        };
        const createObjectStore = (storeName: string, store: StoreState, transaction: IDBTransaction | null): IDBObjectStore => ({
          name: storeName,
          keyPath: store.keyPath ?? null,
          indexNames: {
            contains: () => false,
            length: 0,
            item: () => null,
            [Symbol.iterator]: function* () {},
          } satisfies DOMStringList,
          transaction,
          autoIncrement: false,
          add(value: unknown, key?: IDBValidKey) {
            return this.put(value, key);
          },
          clear() {
            pending += 1;
            return createRequest<void>((resolve) => {
              store.values.clear();
              resolve(undefined);
              pending -= 1;
              scheduleCompletion();
            });
          },
          count() {
            pending += 1;
            return createRequest<number>((resolve) => {
              resolve(store.values.size);
              pending -= 1;
              scheduleCompletion();
            });
          },
          createIndex() {
            throw new Error('not implemented');
          },
          delete(key: IDBValidKey | IDBKeyRange) {
            pending += 1;
            return createRequest<void>((resolve) => {
              store.values.delete(key as IDBValidKey);
              resolve(undefined);
              pending -= 1;
              scheduleCompletion();
            });
          },
          deleteIndex() {},
          get(key: IDBValidKey | IDBKeyRange) {
            pending += 1;
            return createRequest<unknown>((resolve) => {
              resolve(clone(store.values.get(key as IDBValidKey)));
              pending -= 1;
              scheduleCompletion();
            });
          },
          getAll() {
            pending += 1;
            return createRequest<unknown[]>((resolve) => {
              resolve(Array.from(store.values.values(), (value) => clone(value)));
              pending -= 1;
              scheduleCompletion();
            });
          },
          getAllKeys() {
            pending += 1;
            return createRequest<IDBValidKey[]>((resolve) => {
              resolve(Array.from(store.values.keys()));
              pending -= 1;
              scheduleCompletion();
            });
          },
          getKey() {
            pending += 1;
            return createRequest<IDBValidKey | undefined>((resolve) => {
              resolve(undefined);
              pending -= 1;
              scheduleCompletion();
            });
          },
          index() {
            throw new Error('not implemented');
          },
          openCursor() {
            throw new Error('not implemented');
          },
          openKeyCursor() {
            throw new Error('not implemented');
          },
          put(value: any, key?: IDBValidKey) {
            pending += 1;
            return createRequest<IDBValidKey>((resolve) => {
              const derivedKey = key ?? (store.keyPath ? value?.[store.keyPath] : undefined);
              if (derivedKey === undefined || derivedKey === null) throw new Error(`missing key for store ${storeName}`);
              store.values.set(derivedKey, clone(value));
              resolve(derivedKey);
              pending -= 1;
              scheduleCompletion();
            });
          },
        } as IDBObjectStore);
        for (const storeName of requestedNames) {
          const store = state.stores.get(storeName);
          if (!store) throw new Error(`missing object store: ${storeName}`);
        }
        scheduleCompletion();
        return tx;
      },
      close() {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    } as IDBDatabase;
    return db;
  };

  const indexedDb = {
    open(name: string, version?: number) {
      const request: IDBOpenDBRequest = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        onblocked: null,
        result: undefined as IDBDatabase,
        error: null,
        readyState: 'pending',
        source: null,
        transaction: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      };
      queueTask(() => {
        const existing = databases.get(name);
        const nextVersion = version ?? existing?.version ?? 1;
        const needsUpgrade = !existing || nextVersion > existing.version;
        const state = existing ?? { version: nextVersion, stores: new Map<string, StoreState>() };
        state.version = nextVersion;
        databases.set(name, state);
        const db = createDatabase(name, state);
        request.result = db;
        request.readyState = 'done';
        if (needsUpgrade) request.onupgradeneeded?.({ target: request } as IDBVersionChangeEvent);
        request.onsuccess?.({ target: request } as Event);
      });
      return request;
    },
    deleteDatabase(name: string) {
      return createRequest<void>((resolve) => {
        databases.delete(name);
        resolve(undefined);
      }) as IDBOpenDBRequest;
    },
    cmp(first: IDBValidKey, second: IDBValidKey) {
      if (first === second) return 0;
      return first > second ? 1 : -1;
    },
  } satisfies IDBFactory;

  Object.defineProperty(window, 'indexedDB', {
    configurable: true,
    writable: true,
    value: indexedDb,
  });
}

function deletePersistenceDb(): Promise<void> {
  if (typeof window.indexedDB === 'undefined') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase('phaserforge.persistence.v1');
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('indexeddb_delete_blocked'));
    request.onsuccess = () => resolve();
  });
}

function openPersistenceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open('phaserforge.persistence.v1', 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('workspaceState')) db.createObjectStore('workspaceState');
      if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences');
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function seedPersistenceRecords({
  projectRecord,
  latestActiveSnapshot,
  workspace = { activeProjectId: projectRecord.id, syncMode: 'online' as const },
}: {
  projectRecord: ReturnType<typeof buildStoredProjectRecord>;
  latestActiveSnapshot?: {
    recordId: string;
    updatedAt: string;
    syncMode: 'online' | 'offline';
    savedAt: string;
  };
  workspace?: { activeProjectId: string | null; syncMode: 'online' | 'offline' };
}) {
  const db = await openPersistenceDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['projects', 'workspaceState'], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('projects').put(projectRecord);
      tx.objectStore('workspaceState').put(workspace, 'workspace');
      tx.objectStore('workspaceState').put('1', 'legacyMigrated');
      if (latestActiveSnapshot) {
        tx.objectStore('workspaceState').put(latestActiveSnapshot, 'latestActiveSnapshot');
      }
    });
  } finally {
    db.close();
  }
}

async function readStoredProjectRecord(recordId: string): Promise<any> {
  const db = await openPersistenceDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
      const request = tx.objectStore('projects').get(recordId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function readStoredLatestActiveSnapshot(): Promise<any> {
  const db = await openPersistenceDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('workspaceState', 'readonly');
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
      const request = tx.objectStore('workspaceState').get('latestActiveSnapshot');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

describe('projectPersistence steady-state storage', () => {
  installLocalStorageMock();
  installIndexedDbMock();

  afterEach(async () => {
    __resumeActiveProjectRecordPersistenceForTests();
    window.localStorage.clear();
    clearPersistenceDebugEntries();
    setPersistenceDebugEnabled(false);
    await deletePersistenceDb();
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

  it('stores the active project as structured data instead of requiring YAML', () => {
    const project = createEmptyProject();
    project.title = 'Pattern Demo';

    const record = buildStoredProjectRecord(project);

    expect(record.project).toEqual(project);
    expect(record.yaml).toBeUndefined();
  });

  it('persists compact project records without duplicating the current project payload', async () => {
    const project = createEmptyProject();
    project.id = 'project-1';
    project.title = 'Pattern Demo';
    project.publishGithubPagesRepo = 'zoof';

    const record = buildStoredProjectRecord(project, { id: project.id });
    await projectPersistence.saveProjectRecord(record);

    const stored = await readStoredProjectRecord(project.id);
    expect(stored).toMatchObject({
      id: project.id,
      title: 'Pattern Demo',
    });
    expect(stored?.project).toBeUndefined();
  });

  it('can still retain an explicit YAML payload for import-export compatibility', () => {
    const project = createEmptyProject();

    const record = buildStoredProjectRecord(project, {
      yaml: 'project:\n  title: Pattern Demo\n',
    });

    expect(record.project).toEqual(project);
    expect(record.yaml).toBe('project:\n  title: Pattern Demo\n');
  });

  it('stores and restores workspace backups as structured projects', async () => {
    const project = createEmptyProject();
    project.id = 'backup-project';
    project.title = 'Backup Project';
    project.publishGithubPagesRepo = 'zoof';

    await projectPersistence.saveWorkspaceBackup(project, 'device');

    await expect(projectPersistence.loadWorkspaceBackup()).resolves.toEqual({
      project,
      source: 'device',
      savedAt: expect.any(String),
    });
  });

  it('persists semantic history events alongside compact revision storage', async () => {
    const project = createEmptyProject();
    project.id = 'project-1';
    project.title = 'Pattern Demo';

    const historyEvents: ProjectHistoryEvent[] = [
      {
        id: 'history-event-rev-rename-0',
        projectId: project.id,
        revisionId: 'rev-rename',
        occurredAt: '2026-06-27T16:30:00.000Z',
        reason: 'autosave',
        kind: 'project.renamed',
        burstId: 'project.renamed',
        scope: { kind: 'project' },
        summary: 'Renamed to Pattern Demo',
      },
    ];
    const revisions = [createProjectRevision(project, {
      id: 'rev-rename',
      updatedAt: '2026-06-27T16:30:00.000Z',
      reason: 'autosave',
      historyEventIds: ['history-event-rev-rename-0'],
      historyBurstIds: ['project.renamed'],
    })];

    const record = buildStoredProjectRecord(project, {
      id: project.id,
      revisions,
      historyEvents,
    });
    await projectPersistence.saveProjectRecord(record);

    const loaded = await projectPersistence.loadProjectById(project.id);
    expect(loaded?.historyEvents).toEqual(historyEvents);
    expect(loaded?.revisions?.[0]?.historyEventIds).toEqual(['history-event-rev-rename-0']);
    expect(loaded?.revisions?.[0]?.historyBurstIds).toEqual(['project.renamed']);
  });

  it('hydrates a legacy YAML workspace backup into structured project data', async () => {
    const project = createEmptyProject();
    project.id = 'legacy-backup-project';
    project.title = 'Legacy Backup Project';

    await projectPersistence.saveWorkspaceBackup(createEmptyProject(), 'device');

    await new Promise<void>((resolve, reject) => {
      const request = window.indexedDB.open('phaserforge.persistence.v1', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('workspaceState', 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore('workspaceState').put({
          yaml: serializeProjectToYaml(project),
          source: 'cloud',
          savedAt: '2026-06-22T12:00:00.000Z',
        }, 'workspaceBackup');
      };
    });

    await expect(projectPersistence.loadWorkspaceBackup()).resolves.toEqual({
      project,
      source: 'cloud',
      savedAt: '2026-06-22T12:00:00.000Z',
    });
  });

  it('stores revisions as compact deltas while still materializing the edited project', () => {
    const olderProject = createEmptyProject();
    const newerProject = structuredClone(olderProject);
    newerProject.title = 'Pattern Demo';
    newerProject.publishGithubPagesRepo = 'zoof';

    const olderRevision = createProjectRevision(olderProject, { id: 'rev-older' });
    const newerRevision = createProjectRevision(newerProject, { id: 'rev-newer' });
    const revisions = appendProjectRevision([olderRevision], newerRevision);
    const storedNewestRevision = revisions[0];

    expect(storedNewestRevision.kind).toBe('delta');
    expect(storedNewestRevision.patch).toBeTruthy();
    expect(storedNewestRevision.project).toBeUndefined();
    expect(materializeProjectRevision(revisions, storedNewestRevision.id)).toEqual(newerProject);
  });

  it('persists archived revisions separately from visible history revisions', async () => {
    const baseProject = createEmptyProject();
    baseProject.title = 'Base';
    const oldProject = structuredClone(baseProject);
    oldProject.title = 'Old Candidate';
    const currentProject = structuredClone(oldProject);
    currentProject.title = 'Current';

    const oldestRevision = createProjectRevision(baseProject, {
      id: 'rev-oldest',
      updatedAt: '2026-05-18T12:00:00.000Z',
    });
    const oldRevision = createProjectRevision(oldProject, {
      id: 'rev-old',
      updatedAt: '2026-05-21T12:00:00.000Z',
    });
    const currentRevision = createProjectRevision(currentProject, {
      id: 'rev-current',
      updatedAt: '2026-06-24T12:00:00.000Z',
    });
    const seededRevisions = appendProjectRevision(
      appendProjectRevision([oldestRevision], oldRevision, 25),
      currentRevision,
      25,
    );
    const seededRecord = buildStoredProjectRecord(currentProject, {
      id: 'project-with-archive',
      revisions: seededRevisions,
    });

    await projectPersistence.saveProjectRecord(seededRecord);
    const updated = await projectPersistence.updateProjectHistoryRetention('project-with-archive', {
      archiveRevisionIds: ['rev-old', 'rev-oldest'],
    });

    expect(updated?.revisions?.map((revision) => revision.id)).toEqual(['rev-current']);
    expect(updated?.archivedRevisions?.map((revision) => revision.id)).toEqual(['rev-old', 'rev-oldest']);

    const loaded = await projectPersistence.loadProjectById('project-with-archive');
    expect(loaded?.revisions?.map((revision) => revision.id)).toEqual(['rev-current']);
    expect(loaded?.archivedRevisions?.map((revision) => revision.id)).toEqual(['rev-old', 'rev-oldest']);
    expect(materializeProjectRevision(loaded?.archivedRevisions ?? [], 'rev-old')?.title).toBe('Old Candidate');
  });

  it('repairs broken revision chains on load by rebuilding recoverable history from the stored project head', async () => {
    const baseProject = createEmptyProject();
    baseProject.id = 'project-1';
    baseProject.title = 'Base Title';

    const latestProject = structuredClone(baseProject);
    latestProject.title = 'Recovered Title';

    const baseRevision = createProjectRevision(baseProject, {
      id: 'rev-base',
      updatedAt: '2026-06-22T12:00:00.000Z',
    });
    const brokenLatestRevision = {
      ...createProjectRevision(latestProject, {
        id: 'rev-latest',
        updatedAt: '2026-06-22T12:00:05.000Z',
      }),
      kind: 'delta' as const,
      baseRevisionId: 'rev-missing',
      patch: [{ op: 'set' as const, path: ['title'], value: 'Recovered Title' }],
      project: undefined,
    };

    await seedPersistenceRecords({
      projectRecord: buildStoredProjectRecord(latestProject, {
        id: latestProject.id,
        updatedAt: '2026-06-22T12:00:05.000Z',
        revisions: [brokenLatestRevision, baseRevision],
      }),
    });

    const snapshot = await projectPersistence.load();
    const record = snapshot.localProjects[0];

    expect(record?.title).toBe('Recovered Title');
    expect(record?.project.title).toBe('Recovered Title');
    expect(record?.revisions?.map((revision) => revision.id)).toEqual(['rev-latest', 'rev-base']);
    expect(materializeProjectRevision(record?.revisions ?? [], 'rev-latest')?.title).toBe('Recovered Title');
  });

  it('persists the latest active snapshot as a lightweight marker instead of a full record copy', async () => {
    const project = createEmptyProject();
    project.id = 'project-1';
    project.title = 'Pattern Demo';

    const record = buildStoredProjectRecord(project, {
      id: project.id,
      updatedAt: '2026-06-22T12:00:05.000Z',
    });

    await projectPersistence.saveActiveProjectRecord(record, 'offline');

    const snapshot = await readStoredLatestActiveSnapshot();
    expect(snapshot).toEqual({
      recordId: 'project-1',
      updatedAt: '2026-06-22T12:00:05.000Z',
      syncMode: 'offline',
      savedAt: expect.any(String),
    });
    expect(snapshot?.record).toBeUndefined();
  });

  it('can durably upsert the active project row even while active project marker writes are paused', async () => {
    const project = createEmptyProject();
    project.id = 'project-1';
    project.title = 'Untitled Project';

    const initialRecord = buildStoredProjectRecord(project, {
      id: project.id,
      updatedAt: '2026-06-22T12:00:00.000Z',
    });

    await projectPersistence.saveActiveProjectRecord(initialRecord, 'online');

    const renamedProject = structuredClone(project);
    renamedProject.title = 'Snapshot Rescue';
    const renamedRecord = buildStoredProjectRecord(renamedProject, {
      id: project.id,
      updatedAt: '2026-06-22T12:00:05.000Z',
    });

    __pauseActiveProjectRecordPersistenceForTests();
    try {
      await projectPersistence.saveProjectRecordImmediately(renamedRecord);
      const stored = await readStoredProjectRecord(project.id);
      expect(stored).toMatchObject({
        id: 'project-1',
        title: 'Snapshot Rescue',
        updatedAt: '2026-06-22T12:00:05.000Z',
      });
    } finally {
      __resumeActiveProjectRecordPersistenceForTests();
    }
  });

  it('prefers the durable latest active snapshot marker when bootstrapping the active project', async () => {
    const latestProject = createEmptyProject();
    latestProject.id = 'project-1';
    latestProject.title = 'Recovered Title';

    await seedPersistenceRecords({
      projectRecord: buildStoredProjectRecord(latestProject, {
        id: latestProject.id,
        updatedAt: '2026-06-22T12:00:05.000Z',
        revisions: [createProjectRevision(latestProject, { id: 'rev-latest' })],
      }),
      latestActiveSnapshot: {
        recordId: latestProject.id,
        updatedAt: '2026-06-22T12:00:05.000Z',
        syncMode: 'online',
        savedAt: '2026-06-22T12:00:05.000Z',
      },
      workspace: {
        activeProjectId: null,
        syncMode: 'offline',
      },
    });

    const snapshot = await projectPersistence.load();

    expect(snapshot.workspace.activeProjectId).toBe('project-1');
    expect(snapshot.localProjects).toHaveLength(1);
    expect(snapshot.localProjects[0]?.title).toBe('Recovered Title');
    expect(snapshot.localProjects[0]?.project.title).toBe('Recovered Title');
    expect(snapshot.localProjects[0]?.updatedAt).toBe('2026-06-22T12:00:05.000Z');
  });

  it('records restore milestone debug events while selecting the active project during bootstrap', async () => {
    setPersistenceDebugEnabled(true);
    const latestProject = createEmptyProject();
    latestProject.id = 'project-1';
    latestProject.title = 'Recovered Title';

    await seedPersistenceRecords({
      projectRecord: buildStoredProjectRecord(latestProject, {
        id: latestProject.id,
        updatedAt: '2026-06-22T12:00:05.000Z',
      }),
      latestActiveSnapshot: {
        recordId: latestProject.id,
        updatedAt: '2026-06-22T12:00:05.000Z',
        syncMode: 'online',
        savedAt: '2026-06-22T12:00:05.000Z',
      },
      workspace: {
        activeProjectId: null,
        syncMode: 'offline',
      },
    });

    await projectPersistence.load();

    expect(readPersistenceDebugEntries()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: 'restore:workspace-state-loaded',
        details: expect.objectContaining({
          activeProjectId: null,
          syncMode: 'offline',
        }),
      }),
      expect.objectContaining({
        event: 'restore:latest-active-marker-loaded',
        details: expect.objectContaining({
          recordId: 'project-1',
          syncMode: 'online',
        }),
      }),
      expect.objectContaining({
        event: 'restore:active-project-selected',
        details: expect.objectContaining({
          activeProjectId: 'project-1',
          source: 'latest-active-snapshot',
        }),
      }),
    ]));
  });

  it('does not let a newer placeholder snapshot override an explicitly active saved project', async () => {
    const realProject = createEmptyProject();
    realProject.id = 'project-real';
    realProject.title = 'Recovered Title';

    const placeholderProject = createEmptyProject();
    placeholderProject.id = 'project-placeholder';
    placeholderProject.title = 'Untitled Project';

    const db = await openPersistenceDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['projects', 'workspaceState'], 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore('projects').put(buildStoredProjectRecord(realProject, {
          id: realProject.id,
          updatedAt: '2026-06-22T12:00:00.000Z',
        }));
        tx.objectStore('projects').put(buildStoredProjectRecord(placeholderProject, {
          id: placeholderProject.id,
          updatedAt: '2026-06-22T12:05:00.000Z',
        }));
        tx.objectStore('workspaceState').put({
          activeProjectId: realProject.id,
          syncMode: 'online',
        }, 'workspace');
        tx.objectStore('workspaceState').put({
          recordId: placeholderProject.id,
          updatedAt: '2026-06-22T12:05:00.000Z',
          syncMode: 'online',
          savedAt: '2026-06-22T12:05:00.000Z',
        }, 'latestActiveSnapshot');
        tx.objectStore('workspaceState').put('1', 'legacyMigrated');
      });
    } finally {
      db.close();
    }

    const snapshot = await projectPersistence.load();

    expect(snapshot.workspace.activeProjectId).toBe('project-real');
    expect(snapshot.localProjects[0]?.id).toBe('project-real');
    expect(snapshot.localProjects[0]?.title).toBe('Recovered Title');
  });

  it('loads the durable latest active snapshot record from the stored active project id marker', async () => {
    const latestProject = createEmptyProject();
    latestProject.id = 'project-1';
    latestProject.title = 'Linked Draft';

    await seedPersistenceRecords({
      projectRecord: buildStoredProjectRecord(latestProject, {
        id: latestProject.id,
        updatedAt: '2026-06-22T12:00:10.000Z',
        cloudProjectId: 'g-1',
        syncStatus: 'cloud',
      }),
      latestActiveSnapshot: {
        recordId: latestProject.id,
        updatedAt: '2026-06-22T12:00:10.000Z',
        syncMode: 'online',
        savedAt: '2026-06-22T12:00:10.000Z',
      },
    });

    const record = await projectPersistence.loadLatestActiveProjectSnapshotRecord();

    expect(record).toMatchObject({
      id: 'project-1',
      title: 'Linked Draft',
      updatedAt: '2026-06-22T12:00:10.000Z',
      cloudProjectId: 'g-1',
      syncStatus: 'cloud',
    });
  });

  it('keeps the durable latest active snapshot in sync when the active record gains a cloud project id', async () => {
    const project = createEmptyProject();
    project.id = 'project-1';
    project.title = 'Cloud Link Demo';

    const created = await projectPersistence.createLocalProject(project);
    const linkedRecord = {
      ...created,
      cloudProjectId: 'g-123',
      syncStatus: 'cloud' as const,
      updatedAt: '2026-06-22T12:05:00.000Z',
    };

    await projectPersistence.saveProjectRecord(linkedRecord);

    const snapshotRecord = await projectPersistence.loadLatestActiveProjectSnapshotRecord();

    expect(snapshotRecord).toMatchObject({
      id: created.id,
      cloudProjectId: 'g-123',
      syncStatus: 'cloud',
      updatedAt: '2026-06-22T12:05:00.000Z',
    });
  });

  it('updates the synchronous workspace boot cache when workspace state changes', async () => {
    await projectPersistence.updateWorkspaceStateRecord({
      activeProjectId: 'project-cached',
      syncMode: 'online',
      leftPaneWidth: 344,
      rightPaneWidth: 688,
      assetsDockHeight: 264,
    });

    expect(projectPersistence.readCachedWorkspaceStateRecord?.()).toEqual({
      activeProjectId: 'project-cached',
      syncMode: 'online',
      leftPaneWidth: 344,
      rightPaneWidth: 688,
      assetsDockHeight: 264,
    });
  });

  it('updates the synchronous preferences boot cache when preferences change', async () => {
    await projectPersistence.savePreferences({
      startupMode: 'new_empty_scene',
      themeMode: 'dark',
      uiScale: 1.1,
      showHitboxOverlay: false,
    });

    expect(projectPersistence.readCachedPreferencesRecord?.()).toEqual({
      startupMode: 'new_empty_scene',
      themeMode: 'dark',
      uiScale: 1.1,
      showHitboxOverlay: false,
    });
  });
});

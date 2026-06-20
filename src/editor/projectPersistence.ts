import { parseProjectYaml, serializeProjectToYaml } from '../model/serialization';
import { createEmptyProject } from '../model/emptyProject';
import type { ProjectSpec, StartupMode } from '../model/types';
import { appendProjectRevision, createProjectRevision, type ProjectRevisionRecord } from './projectTreeHistory';

const DB_NAME = 'phaserforge.persistence.v1';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const WORKSPACE_STORE = 'workspaceState';
const PREFERENCES_STORE = 'preferences';
const LEGACY_MIGRATED_KEY = 'legacyMigrated';
const WORKSPACE_KEY = 'workspace';
const PREFERENCES_KEY = 'preferences';

export type ProjectSyncMode = 'online' | 'offline';
export type StoredThemeMode = 'system' | 'light' | 'dark';
export type StoredProjectOrigin = 'anonymous' | 'cloud-cache' | 'local-only';
export type StoredProjectSyncStatus = 'local' | 'cloud' | 'unsynced';

export type StoredProjectRecord = {
  id: string;
  projectId: string;
  title: string;
  yaml: string;
  updatedAt: string;
  sceneCount: number;
  origin: StoredProjectOrigin;
  syncStatus: StoredProjectSyncStatus;
  cloudProjectId?: string;
  revisions?: ProjectRevisionRecord[];
};

export type WorkspaceStateRecord = {
  activeProjectId: string | null;
  syncMode: ProjectSyncMode;
};

export type PreferencesRecord = {
  startupMode: StartupMode;
  themeMode: StoredThemeMode;
  uiScale: number;
  showHitboxOverlay: boolean;
};

type PersistenceSnapshot = {
  localProjects: StoredProjectRecord[];
  workspace: WorkspaceStateRecord;
  preferences: PreferencesRecord | null;
};

type LegacyStorageReader = Pick<Storage, 'getItem'>;

const defaultWorkspace = (): WorkspaceStateRecord => ({
  activeProjectId: null,
  syncMode: 'online',
});

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('indexeddb_open_failed'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(WORKSPACE_STORE)) db.createObjectStore(WORKSPACE_STORE);
      if (!db.objectStoreNames.contains(PREFERENCES_STORE)) db.createObjectStore(PREFERENCES_STORE);
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexeddb_tx_failed'));
    tx.onabort = () => reject(tx.error ?? new Error('indexeddb_tx_aborted'));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexeddb_request_failed'));
  });
}

function fallbackProjectFromLegacyYaml(reader: LegacyStorageReader): StoredProjectRecord | null {
  const yaml = reader.getItem('phaserforge.projectYaml.v1');
  if (!yaml) return null;
  try {
    const project = parseProjectYaml(yaml);
    return buildStoredProjectRecord(project, {
      id: project.id,
      yaml,
      origin: 'anonymous',
      syncStatus: 'local',
    });
  } catch {
    return null;
  }
}

function buildPreferencesFromLegacy(reader: LegacyStorageReader): PreferencesRecord | null {
  const startupMode = reader.getItem('phaserforge.startupMode.v1');
  const themeMode = reader.getItem('phaserforge.themeMode.v1');
  const uiScale = reader.getItem('phaserforge.uiScale.v1');
  const showHitboxOverlay = reader.getItem('phaserforge.showHitboxOverlay.v1');
  if (!startupMode && !themeMode && !uiScale && !showHitboxOverlay) return null;
  return {
    startupMode: 'new_empty_scene',
    themeMode: themeMode === 'light' || themeMode === 'dark' || themeMode === 'system' ? themeMode : 'system',
    uiScale: Number.isFinite(Number(uiScale)) ? Number(uiScale) : 0.95,
    showHitboxOverlay: showHitboxOverlay !== '0',
  };
}

export function buildStoredProjectRecord(
  project: ProjectSpec,
  options?: {
    id?: string;
    yaml?: string;
    origin?: StoredProjectOrigin;
    syncStatus?: StoredProjectSyncStatus;
    cloudProjectId?: string;
    revisions?: ProjectRevisionRecord[];
  }
): StoredProjectRecord {
  return {
    id: options?.id ?? project.id,
    projectId: project.id,
    title: project.title?.trim() || 'Untitled Project',
    yaml: options?.yaml ?? serializeProjectToYaml(project),
    updatedAt: new Date().toISOString(),
    sceneCount: Object.keys(project.scenes ?? {}).length,
    origin: options?.origin ?? 'local-only',
    syncStatus: options?.syncStatus ?? 'local',
    cloudProjectId: options?.cloudProjectId,
    revisions: options?.revisions ?? [createProjectRevision(project)],
  };
}

async function readAllProjects(db: IDBDatabase): Promise<StoredProjectRecord[]> {
  const tx = db.transaction(PROJECTS_STORE, 'readonly');
  const rows = await requestValue(tx.objectStore(PROJECTS_STORE).getAll());
  await txComplete(tx);
  return Array.isArray(rows) ? (rows as StoredProjectRecord[]) : [];
}

async function readWorkspace(db: IDBDatabase): Promise<WorkspaceStateRecord> {
  const tx = db.transaction(WORKSPACE_STORE, 'readonly');
  const workspace = await requestValue(tx.objectStore(WORKSPACE_STORE).get(WORKSPACE_KEY));
  await txComplete(tx);
  return (workspace as WorkspaceStateRecord | undefined) ?? defaultWorkspace();
}

async function readPreferences(db: IDBDatabase): Promise<PreferencesRecord | null> {
  const tx = db.transaction(PREFERENCES_STORE, 'readonly');
  const preferences = await requestValue(tx.objectStore(PREFERENCES_STORE).get(PREFERENCES_KEY));
  await txComplete(tx);
  return (preferences as PreferencesRecord | undefined) ?? null;
}

async function migrateLegacyStorage(db: IDBDatabase): Promise<void> {
  const tx = db.transaction([PROJECTS_STORE, WORKSPACE_STORE, PREFERENCES_STORE], 'readwrite');
  const workspaceStore = tx.objectStore(WORKSPACE_STORE);
  const alreadyMigrated = await requestValue(workspaceStore.get(LEGACY_MIGRATED_KEY));
  if (alreadyMigrated === '1') {
    await txComplete(tx);
    return;
  }

  const legacyProject = fallbackProjectFromLegacyYaml(window.localStorage);
  if (legacyProject) tx.objectStore(PROJECTS_STORE).put(legacyProject);
  const preferences = buildPreferencesFromLegacy(window.localStorage);
  if (preferences) tx.objectStore(PREFERENCES_STORE).put(preferences, PREFERENCES_KEY);
  tx.objectStore(WORKSPACE_STORE).put(
    {
      activeProjectId: legacyProject?.id ?? null,
      syncMode: 'online',
    } satisfies WorkspaceStateRecord,
    WORKSPACE_KEY,
  );
  workspaceStore.put('1', LEGACY_MIGRATED_KEY);
  await txComplete(tx);
}

async function loadIndexedDbSnapshot(): Promise<PersistenceSnapshot> {
  const db = await openDb();
  if (!db) {
    const project = fallbackProjectFromLegacyYaml(window.localStorage);
    return {
      localProjects: project ? [project] : [],
      workspace: { activeProjectId: project?.id ?? null, syncMode: 'online' },
      preferences: buildPreferencesFromLegacy(window.localStorage),
    };
  }
  await migrateLegacyStorage(db);
  const [localProjects, workspace, preferences] = await Promise.all([readAllProjects(db), readWorkspace(db), readPreferences(db)]);
  return { localProjects, workspace, preferences };
}

async function upsertProjectRecord(record: StoredProjectRecord): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(PROJECTS_STORE, 'readwrite');
  tx.objectStore(PROJECTS_STORE).put(record);
  await txComplete(tx);
}

async function writeWorkspace(workspace: WorkspaceStateRecord): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
  tx.objectStore(WORKSPACE_STORE).put(workspace, WORKSPACE_KEY);
  await txComplete(tx);
}

async function writePreferences(preferences: PreferencesRecord): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(PREFERENCES_STORE, 'readwrite');
  tx.objectStore(PREFERENCES_STORE).put(preferences, PREFERENCES_KEY);
  await txComplete(tx);
}

async function getProjectRecord(projectId: string): Promise<StoredProjectRecord | null> {
  const db = await openDb();
  if (!db) return null;
  const tx = db.transaction(PROJECTS_STORE, 'readonly');
  const record = await requestValue(tx.objectStore(PROJECTS_STORE).get(projectId));
  await txComplete(tx);
  return (record as StoredProjectRecord | undefined) ?? null;
}

function cloneProject(project: ProjectSpec): ProjectSpec {
  return structuredClone(project);
}

function allocateProjectId(prefix: string = 'project'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const projectPersistence = {
  async load(): Promise<PersistenceSnapshot> {
    if (typeof window === 'undefined') {
      const project = createEmptyProject();
      return {
        localProjects: [buildStoredProjectRecord(project)],
        workspace: { activeProjectId: project.id, syncMode: 'online' },
        preferences: null,
      };
    }
    return loadIndexedDbSnapshot();
  },

  async saveProjectRecord(record: StoredProjectRecord): Promise<StoredProjectRecord[]> {
    await upsertProjectRecord(record);
    const snapshot = await this.load();
    return snapshot.localProjects;
  },

  async setActiveProject(projectId: string | null, syncMode: ProjectSyncMode): Promise<void> {
    await writeWorkspace({ activeProjectId: projectId, syncMode });
  },

  async setSyncMode(projectId: string | null, syncMode: ProjectSyncMode): Promise<void> {
    await writeWorkspace({ activeProjectId: projectId, syncMode });
  },

  async savePreferences(preferences: PreferencesRecord): Promise<void> {
    await writePreferences(preferences);
  },

  async loadProjectById(projectId: string): Promise<StoredProjectRecord | null> {
    return getProjectRecord(projectId);
  },

  async createLocalProject(project?: ProjectSpec): Promise<StoredProjectRecord> {
    const nextProject = project ? cloneProject(project) : createEmptyProject();
    if (!nextProject.id || nextProject.id === 'project-1') nextProject.id = allocateProjectId();
    if (!nextProject.title) nextProject.title = 'Untitled Project';
    const record = buildStoredProjectRecord(nextProject, { id: nextProject.id, origin: 'local-only', syncStatus: 'local' });
    await upsertProjectRecord(record);
    await writeWorkspace({ activeProjectId: record.id, syncMode: 'online' });
    return record;
  },

  async duplicateProject(record: StoredProjectRecord): Promise<StoredProjectRecord> {
    const parsed = parseProjectYaml(record.yaml);
    const duplicate = cloneProject(parsed);
    duplicate.id = allocateProjectId();
    duplicate.title = `${parsed.title?.trim() || 'Untitled Project'} Copy`;
    const next = buildStoredProjectRecord(duplicate, {
      id: duplicate.id,
      origin: 'local-only',
      syncStatus: 'local',
    });
    await upsertProjectRecord(next);
    await writeWorkspace({ activeProjectId: next.id, syncMode: 'online' });
    return next;
  },

  async saveProjectRevision(projectId: string, project: ProjectSpec, reason: ProjectRevisionRecord['reason'] = 'autosave'): Promise<StoredProjectRecord | null> {
    const existing = await getProjectRecord(projectId);
    if (!existing) return null;
    const revision = createProjectRevision(project, { reason });
    const next = {
      ...existing,
      revisions: appendProjectRevision(existing.revisions, revision),
    } satisfies StoredProjectRecord;
    await upsertProjectRecord(next);
    return next;
  },
};

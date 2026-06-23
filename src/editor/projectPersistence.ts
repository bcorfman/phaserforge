import { parseProjectYaml, serializeProjectToYaml } from '../model/serialization';
import { createEmptyProject } from '../model/emptyProject';
import { projectsSemanticallyEqual } from '../model/projectCanonical';
import type { ProjectSpec, StartupMode } from '../model/types';
import { validateProjectSpec } from '../model/validation';
import { appendProjectRevision, createProjectRevision, materializeProjectRevision, type ProjectRevisionRecord } from './projectTreeHistory';
import { createSerializedAsyncQueue } from './serializedAsyncQueue';
import { appendPersistenceDebugEntry, summarizeYamlForDebug } from '../util/persistenceDebug';
import type { ViewState } from '../util/viewStateStorage';

const DB_NAME = 'phaserforge.persistence.v1';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const WORKSPACE_STORE = 'workspaceState';
const PREFERENCES_STORE = 'preferences';
const ACTIVE_PROJECT_SNAPSHOT_KEY = 'latestActiveSnapshot';
const LEGACY_MIGRATED_KEY = 'legacyMigrated';
const WORKSPACE_KEY = 'workspace';
const WORKSPACE_BACKUP_KEY = 'workspaceBackup';
const PREFERENCES_KEY = 'preferences';
const WORKSPACE_BOOT_CACHE_KEY = 'phaserforge.workspaceBootCache.v1';
const PREFERENCES_BOOT_CACHE_KEY = 'phaserforge.preferencesBootCache.v1';

export type ProjectSyncMode = 'online' | 'offline';
export type StoredThemeMode = 'system' | 'light' | 'dark';
export type StoredProjectOrigin = 'anonymous' | 'cloud-cache' | 'local-only';
export type StoredProjectSyncStatus = 'local' | 'cloud' | 'unsynced';

export type StoredProjectRecord = {
  id: string;
  projectId: string;
  title: string;
  project: ProjectSpec;
  yaml?: string;
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
  leftPaneWidth?: number;
  rightPaneWidth?: number;
  assetsDockHeight?: number;
  viewStateByProject?: Record<string, ViewState>;
};

export type WorkspaceBackupRecord = {
  project: ProjectSpec;
  source: 'cloud' | 'device';
  savedAt: string;
};

type LatestActiveProjectSnapshotRecord = {
  recordId: string;
  updatedAt: string;
  syncMode: ProjectSyncMode;
  savedAt: string;
};

type PersistedProjectRecord = Omit<StoredProjectRecord, 'project'>;

export type PreferencesRecord = {
  startupMode: StartupMode;
  themeMode: StoredThemeMode;
  uiScale: number;
  showHitboxOverlay: boolean;
  assetsDockShowThumbnails?: boolean;
  inspectorFoldouts?: Record<string, boolean>;
  pinnedActionTypes?: string[];
  pinnedPatternIds?: string[];
  lastPublishByUserId?: Record<string, { url: string; publishedAtMs: number }>;
};

type PersistenceSnapshot = {
  localProjects: StoredProjectRecord[];
  workspace: WorkspaceStateRecord;
  preferences: PreferencesRecord | null;
};

type LegacyStorageReader = Pick<Storage, 'getItem'>;
const EMPTY_LEGACY_STORAGE_READER: LegacyStorageReader = { getItem: () => null };
const workspaceMutationQueue = createSerializedAsyncQueue();
const latestActiveSnapshotMutationQueue = createSerializedAsyncQueue();

let activeProjectRecordPersistenceRelease: (() => void) | null = null;
let activeProjectRecordPersistenceBarrier: Promise<void> | null = null;

const defaultWorkspace = (): WorkspaceStateRecord => ({
  activeProjectId: null,
  syncMode: 'online',
});

function getLegacyStorageReader(): LegacyStorageReader {
  if (typeof window === 'undefined') return EMPTY_LEGACY_STORAGE_READER;
  try {
    return window.localStorage ?? EMPTY_LEGACY_STORAGE_READER;
  } catch {
    return EMPTY_LEGACY_STORAGE_READER;
  }
}

function getLocalStorageWriter(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readJsonStorageRecord<T>(key: string): T | null {
  const storage = getLocalStorageWriter();
  if (!storage) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonStorageRecord(key: string, value: unknown): void {
  const storage = getLocalStorageWriter();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore localStorage write failures; indexeddb remains the source of truth
  }
}

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

function getActiveProjectRecordPersistenceBarrier(): Promise<void> | null {
  return activeProjectRecordPersistenceBarrier;
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexeddb_request_failed'));
  });
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

function normalizeStringList(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const unique = Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0)));
  unique.sort((a, b) => a.localeCompare(b));
  return unique;
}

function normalizeBooleanMap(values: unknown): Record<string, boolean> | undefined {
  if (!values || typeof values !== 'object') return undefined;
  const normalized: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
    if (typeof value === 'boolean') normalized[key] = value;
  }
  return normalized;
}

function normalizeLastPublishMap(values: unknown): Record<string, { url: string; publishedAtMs: number }> | undefined {
  if (!values || typeof values !== 'object') return undefined;
  const normalized: Record<string, { url: string; publishedAtMs: number }> = {};
  for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const url = typeof (value as { url?: unknown }).url === 'string' ? (value as { url: string }).url : '';
    const publishedAtMs = Number((value as { publishedAtMs?: unknown }).publishedAtMs);
    if (!url || !Number.isFinite(publishedAtMs)) continue;
    normalized[key] = { url, publishedAtMs };
  }
  return normalized;
}

function mergePreferences(
  base: PreferencesRecord | null,
  patch: Partial<PreferencesRecord>,
): PreferencesRecord {
  return {
    startupMode: patch.startupMode ?? base?.startupMode ?? 'new_empty_scene',
    themeMode: patch.themeMode ?? base?.themeMode ?? 'system',
    uiScale: patch.uiScale ?? base?.uiScale ?? 0.95,
    showHitboxOverlay: patch.showHitboxOverlay ?? base?.showHitboxOverlay ?? true,
    ...(patch.assetsDockShowThumbnails ?? base?.assetsDockShowThumbnails) != null
      ? { assetsDockShowThumbnails: patch.assetsDockShowThumbnails ?? base?.assetsDockShowThumbnails }
      : {},
    ...(patch.inspectorFoldouts ?? base?.inspectorFoldouts)
      ? { inspectorFoldouts: normalizeBooleanMap(patch.inspectorFoldouts ?? base?.inspectorFoldouts) ?? {} }
      : {},
    ...(patch.pinnedActionTypes ?? base?.pinnedActionTypes)
      ? { pinnedActionTypes: normalizeStringList(patch.pinnedActionTypes ?? base?.pinnedActionTypes) ?? [] }
      : {},
    ...(patch.pinnedPatternIds ?? base?.pinnedPatternIds)
      ? { pinnedPatternIds: normalizeStringList(patch.pinnedPatternIds ?? base?.pinnedPatternIds) ?? [] }
      : {},
    ...(patch.lastPublishByUserId ?? base?.lastPublishByUserId)
      ? { lastPublishByUserId: normalizeLastPublishMap(patch.lastPublishByUserId ?? base?.lastPublishByUserId) ?? {} }
      : {},
  };
}

export function buildStoredProjectRecord(
  project: ProjectSpec,
  options?: {
    id?: string;
    yaml?: string;
    updatedAt?: string;
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
    project: cloneProject(project),
    yaml: options?.yaml,
    updatedAt: options?.updatedAt ?? new Date().toISOString(),
    sceneCount: Object.keys(project.scenes ?? {}).length,
    origin: options?.origin ?? 'local-only',
    syncStatus: options?.syncStatus ?? 'local',
    cloudProjectId: options?.cloudProjectId,
    revisions: options?.revisions ?? [createProjectRevision(project)],
  };
}

function hydrateStoredProjectRecord(record: StoredProjectRecord): StoredProjectRecord {
  if (record.project) return record;
  if (Array.isArray(record.revisions) && record.revisions.length > 0) {
    const latestProject = materializeProjectRevision(record.revisions, record.revisions[0].id);
    if (latestProject) {
      return {
        ...record,
        project: latestProject,
      };
    }
  }
  if (record.yaml) {
    return {
      ...record,
      project: parseProjectYaml(record.yaml),
    };
  }
  return {
    ...record,
    project: createEmptyProject(),
  };
}

function dehydrateStoredProjectRecord(record: StoredProjectRecord): PersistedProjectRecord {
  const { project: _project, ...persisted } = structuredClone(record);
  return persisted;
}

async function readAllProjects(db: IDBDatabase): Promise<StoredProjectRecord[]> {
  const tx = db.transaction(PROJECTS_STORE, 'readonly');
  const rows = await requestValue(tx.objectStore(PROJECTS_STORE).getAll());
  await txComplete(tx);
  return Array.isArray(rows) ? (rows as StoredProjectRecord[]).map(hydrateStoredProjectRecord) : [];
}

async function readWorkspace(db: IDBDatabase): Promise<WorkspaceStateRecord> {
  const tx = db.transaction(WORKSPACE_STORE, 'readonly');
  const workspace = await requestValue(tx.objectStore(WORKSPACE_STORE).get(WORKSPACE_KEY));
  await txComplete(tx);
  return (workspace as WorkspaceStateRecord | undefined) ?? defaultWorkspace();
}

async function readWorkspaceBackup(db: IDBDatabase): Promise<WorkspaceBackupRecord | null> {
  const tx = db.transaction(WORKSPACE_STORE, 'readonly');
  const backup = await requestValue(tx.objectStore(WORKSPACE_STORE).get(WORKSPACE_BACKUP_KEY));
  await txComplete(tx);
  const record = (backup as WorkspaceBackupRecord | { yaml?: string; source?: WorkspaceBackupRecord['source']; savedAt?: string } | undefined) ?? null;
  if (!record) return null;
  if ('project' in record && record.project) {
    validateProjectSpec(record.project);
    return record as WorkspaceBackupRecord;
  }
  if (typeof record.yaml === 'string') {
    const project = parseProjectYaml(record.yaml);
    validateProjectSpec(project);
    return {
      project,
      source: record.source === 'cloud' ? 'cloud' : 'device',
      savedAt: typeof record.savedAt === 'string' ? record.savedAt : new Date().toISOString(),
    };
  }
  return null;
}

async function readLatestActiveSnapshot(db: IDBDatabase): Promise<LatestActiveProjectSnapshotRecord | null> {
  const tx = db.transaction(WORKSPACE_STORE, 'readonly');
  const snapshot = await requestValue(tx.objectStore(WORKSPACE_STORE).get(ACTIVE_PROJECT_SNAPSHOT_KEY));
  await txComplete(tx);
  if (!snapshot || typeof snapshot !== 'object') return null;
  const raw = snapshot as Partial<LatestActiveProjectSnapshotRecord>;
  if (typeof raw.recordId !== 'string' || typeof raw.syncMode !== 'string') return null;
  return {
    recordId: raw.recordId,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    syncMode: raw.syncMode as ProjectSyncMode,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : new Date().toISOString(),
  };
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

  const legacyStorage = getLegacyStorageReader();
  const preferences = buildPreferencesFromLegacy(legacyStorage);
  if (preferences) tx.objectStore(PREFERENCES_STORE).put(preferences, PREFERENCES_KEY);
  const existingWorkspace = await requestValue(workspaceStore.get(WORKSPACE_KEY));
  if (!existingWorkspace) {
    tx.objectStore(WORKSPACE_STORE).put(defaultWorkspace(), WORKSPACE_KEY);
  }
  workspaceStore.put('1', LEGACY_MIGRATED_KEY);
  await txComplete(tx);
}

async function loadIndexedDbSnapshot(): Promise<PersistenceSnapshot> {
  await workspaceMutationQueue.drain();
  await latestActiveSnapshotMutationQueue.drain();
  const db = await openDb();
  if (!db) {
    appendPersistenceDebugEntry('project-persistence:load-snapshot', {
      localProjectCount: 0,
      activeProjectId: null,
      syncMode: 'online',
      storage: 'unavailable',
    });
    return {
      localProjects: [],
      workspace: defaultWorkspace(),
      preferences: buildPreferencesFromLegacy(getLegacyStorageReader()),
    };
  }
  await migrateLegacyStorage(db);
  const [storedProjects, storedWorkspace, preferences, latestActiveSnapshot] = await Promise.all([
    readAllProjects(db),
    readWorkspace(db),
    readPreferences(db),
    readLatestActiveSnapshot(db),
  ]);
  appendPersistenceDebugEntry('restore:workspace-state-loaded', {
    activeProjectId: storedWorkspace.activeProjectId,
    syncMode: storedWorkspace.syncMode,
    viewStateProjectCount: Object.keys(storedWorkspace.viewStateByProject ?? {}).length,
  });
  appendPersistenceDebugEntry('restore:latest-active-marker-loaded', latestActiveSnapshot
    ? {
      recordId: latestActiveSnapshot.recordId,
      updatedAt: latestActiveSnapshot.updatedAt,
      syncMode: latestActiveSnapshot.syncMode,
      savedAt: latestActiveSnapshot.savedAt,
    }
    : {
      recordId: null,
      updatedAt: null,
      syncMode: null,
      savedAt: null,
    });
  const localProjects = [...storedProjects];
  let workspace = storedWorkspace;
  let activeProjectSelectionSource: 'latest-active-snapshot' | 'workspace-active-project' | 'none' = 'none';
  if (latestActiveSnapshot) {
    const existingIndex = localProjects.findIndex((record) => record.id === latestActiveSnapshot.recordId);
    const snapshotRecord = existingIndex >= 0 ? localProjects[existingIndex] : null;
    const currentActiveRecord = localProjects.find((record) => record.id === workspace.activeProjectId) ?? null;
    const snapshotMs = Date.parse(latestActiveSnapshot.updatedAt || latestActiveSnapshot.savedAt);
    const currentActiveMs = Date.parse(currentActiveRecord?.updatedAt ?? '');
    const snapshotLooksPlaceholder = isPlaceholderProjectRecord(snapshotRecord);
    const currentActiveLooksMeaningful = currentActiveRecord != null && !isPlaceholderProjectRecord(currentActiveRecord);
    const shouldUseTimestampTiebreak =
      !(snapshotLooksPlaceholder && currentActiveLooksMeaningful);
    const shouldPreferSnapshot =
      !currentActiveRecord
      || !workspace.activeProjectId
      || latestActiveSnapshot.recordId === workspace.activeProjectId
      || (shouldUseTimestampTiebreak && (
        !Number.isFinite(currentActiveMs)
        || (Number.isFinite(snapshotMs) && snapshotMs >= currentActiveMs)
      ));
    if (shouldPreferSnapshot && snapshotRecord) {
      if (existingIndex > 0) {
        localProjects.splice(existingIndex, 1);
        localProjects.unshift(snapshotRecord);
      }
      workspace = {
        ...workspace,
        activeProjectId: latestActiveSnapshot.recordId,
        syncMode: latestActiveSnapshot.syncMode,
      };
      activeProjectSelectionSource = 'latest-active-snapshot';
    }
  }
  if (workspace.activeProjectId && activeProjectSelectionSource === 'none') {
    activeProjectSelectionSource = 'workspace-active-project';
  }
  const activeProject = localProjects.find((record) => record.id === workspace.activeProjectId) ?? null;
  appendPersistenceDebugEntry('restore:active-project-selected', {
    activeProjectId: workspace.activeProjectId,
    syncMode: workspace.syncMode,
    source: activeProjectSelectionSource,
    activeProject: activeProject ? summarizeRecordForDebug(activeProject) : null,
    localProjectCount: localProjects.length,
  });
  appendPersistenceDebugEntry('project-persistence:load-snapshot', {
    localProjectCount: localProjects.length,
    activeProjectId: workspace.activeProjectId,
    syncMode: workspace.syncMode,
    activeProject: activeProject ? summarizeRecordForDebug(activeProject) : null,
  });
  return { localProjects, workspace, preferences };
}

async function upsertProjectRecord(record: StoredProjectRecord): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(PROJECTS_STORE, 'readwrite');
  tx.objectStore(PROJECTS_STORE).put(dehydrateStoredProjectRecord(record));
  await txComplete(tx);
}

async function writeLatestActiveSnapshot(snapshot: LatestActiveProjectSnapshotRecord): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
  tx.objectStore(WORKSPACE_STORE).put(snapshot, ACTIVE_PROJECT_SNAPSHOT_KEY);
  await txComplete(tx);
}

async function clearLatestActiveSnapshot(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
  tx.objectStore(WORKSPACE_STORE).delete(ACTIVE_PROJECT_SNAPSHOT_KEY);
  await txComplete(tx);
}

async function persistLatestActiveSnapshot(record: StoredProjectRecord, syncMode: ProjectSyncMode): Promise<void> {
  const snapshot: LatestActiveProjectSnapshotRecord = {
    recordId: record.id,
    updatedAt: record.updatedAt,
    syncMode,
    savedAt: new Date().toISOString(),
  };
  await latestActiveSnapshotMutationQueue.run(async () => {
    await writeLatestActiveSnapshot(snapshot);
  });
}

async function writeProjectRecordAndWorkspace(record: StoredProjectRecord, workspace: WorkspaceStateRecord): Promise<void> {
  await upsertProjectRecord(record);
  await getActiveProjectRecordPersistenceBarrier();
  await writeWorkspace(workspace);
}

async function writeWorkspace(workspace: WorkspaceStateRecord): Promise<void> {
  writeJsonStorageRecord(WORKSPACE_BOOT_CACHE_KEY, workspace);
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
  tx.objectStore(WORKSPACE_STORE).put(workspace, WORKSPACE_KEY);
  await txComplete(tx);
}

async function writePreferences(preferences: PreferencesRecord): Promise<void> {
  writeJsonStorageRecord(PREFERENCES_BOOT_CACHE_KEY, preferences);
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(PREFERENCES_STORE, 'readwrite');
  tx.objectStore(PREFERENCES_STORE).put(preferences, PREFERENCES_KEY);
  await txComplete(tx);
}

async function readPreferencesRecord(): Promise<PreferencesRecord | null> {
  const db = await openDb();
  if (!db) return buildPreferencesFromLegacy(getLegacyStorageReader());
  return readPreferences(db);
}

async function updatePreferencesRecord(
  patch: Partial<PreferencesRecord> | ((current: PreferencesRecord | null) => PreferencesRecord),
): Promise<PreferencesRecord> {
  const current = await readPreferencesRecord();
  const next = typeof patch === 'function'
    ? patch(current)
    : mergePreferences(current, patch);
  await writePreferences(next);
  return next;
}

async function getProjectRecord(projectId: string): Promise<StoredProjectRecord | null> {
  const db = await openDb();
  if (!db) return null;
  const tx = db.transaction(PROJECTS_STORE, 'readonly');
  const record = await requestValue(tx.objectStore(PROJECTS_STORE).get(projectId));
  await txComplete(tx);
  return record ? hydrateStoredProjectRecord(record as StoredProjectRecord) : null;
}

async function getWorkspaceState(options?: { awaitPendingWrites?: boolean }): Promise<WorkspaceStateRecord> {
  if (options?.awaitPendingWrites) await workspaceMutationQueue.drain();
  const db = await openDb();
  if (!db) return defaultWorkspace();
  return readWorkspace(db);
}

async function getLatestActiveSnapshotRecord(options?: { awaitPendingWrites?: boolean }): Promise<LatestActiveProjectSnapshotRecord | null> {
  if (options?.awaitPendingWrites) await latestActiveSnapshotMutationQueue.drain();
  const db = await openDb();
  if (!db) return null;
  return readLatestActiveSnapshot(db);
}

async function updateWorkspaceState(
  patch: Partial<WorkspaceStateRecord> | ((current: WorkspaceStateRecord) => WorkspaceStateRecord),
): Promise<WorkspaceStateRecord> {
  return workspaceMutationQueue.run(async () => {
    const current = await getWorkspaceState();
    const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
    await writeWorkspace(next);
    return next;
  });
}

function cloneProject(project: ProjectSpec): ProjectSpec {
  return structuredClone(project);
}

function isPlaceholderProjectRecord(record: StoredProjectRecord | null): boolean {
  if (!record) return false;
  const normalized = cloneProject(record.project);
  normalized.id = 'project-placeholder';
  delete (normalized as Partial<ProjectSpec>).title;
  delete (normalized as Partial<ProjectSpec>).publishTitle;
  delete (normalized as Partial<ProjectSpec>).publishGithubPagesRepo;

  const empty = createEmptyProject();
  empty.id = 'project-placeholder';
  return (record.title?.trim() || 'Untitled Project') === 'Untitled Project'
    && projectsSemanticallyEqual(normalized, empty);
}

function summarizeRecordForDebug(
  record: Pick<StoredProjectRecord, 'cloudProjectId' | 'id' | 'origin' | 'project' | 'projectId' | 'revisions' | 'syncStatus' | 'title' | 'updatedAt' | 'yaml'>,
) {
  const yaml = record.yaml ?? serializeProjectToYaml(record.project);
  return {
    recordId: record.id,
    projectId: record.projectId,
    title: record.title,
    updatedAt: record.updatedAt,
    origin: record.origin,
    syncStatus: record.syncStatus,
    cloudProjectId: record.cloudProjectId ?? null,
    revisionCount: record.revisions?.length ?? 0,
    ...summarizeYamlForDebug(yaml),
  };
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

  async saveProjectRecordImmediately(record: StoredProjectRecord): Promise<void> {
    appendPersistenceDebugEntry('project-persistence:save-project-record-immediate-start', summarizeRecordForDebug(record));
    try {
      await upsertProjectRecord(record);
      appendPersistenceDebugEntry('project-persistence:save-project-record-immediate-success', summarizeRecordForDebug(record));
    } catch (error) {
      appendPersistenceDebugEntry('project-persistence:save-project-record-immediate-error', {
        ...summarizeRecordForDebug(record),
        error,
      });
      throw error;
    }
  },

  async saveProjectRecord(record: StoredProjectRecord): Promise<StoredProjectRecord[]> {
    appendPersistenceDebugEntry('project-persistence:save-project-record-start', summarizeRecordForDebug(record));
    try {
      const workspace = await getWorkspaceState({ awaitPendingWrites: true });
      await upsertProjectRecord(record);
      if (workspace.activeProjectId === record.id) {
        await persistLatestActiveSnapshot(record, workspace.syncMode);
      }
      const snapshot = await this.load();
      appendPersistenceDebugEntry('project-persistence:save-project-record-success', {
        ...summarizeRecordForDebug(record),
        localProjectCount: snapshot.localProjects.length,
      });
      return snapshot.localProjects;
    } catch (error) {
      appendPersistenceDebugEntry('project-persistence:save-project-record-error', {
        ...summarizeRecordForDebug(record),
        error,
      });
      throw error;
    }
  },

  async saveActiveProjectRecord(record: StoredProjectRecord, syncMode: ProjectSyncMode): Promise<StoredProjectRecord[]> {
    appendPersistenceDebugEntry('project-persistence:save-active-project-record-start', {
      ...summarizeRecordForDebug(record),
      syncMode,
    });
    try {
      await workspaceMutationQueue.run(async () => {
        const currentWorkspace = await getWorkspaceState();
        await writeProjectRecordAndWorkspace(record, { ...currentWorkspace, activeProjectId: record.id, syncMode });
      });
      await persistLatestActiveSnapshot(record, syncMode);
      const snapshot = await this.load();
      appendPersistenceDebugEntry('project-persistence:save-active-project-record-success', {
        ...summarizeRecordForDebug(record),
        syncMode,
        localProjectCount: snapshot.localProjects.length,
      });
      return snapshot.localProjects;
    } catch (error) {
      appendPersistenceDebugEntry('project-persistence:save-active-project-record-error', {
        ...summarizeRecordForDebug(record),
        syncMode,
        error,
      });
      throw error;
    }
  },

  async setActiveProject(projectId: string | null, syncMode: ProjectSyncMode): Promise<void> {
    appendPersistenceDebugEntry('project-persistence:set-active-project', {
      activeProjectId: projectId,
      syncMode,
    });
    await updateWorkspaceState({ activeProjectId: projectId, syncMode });
    if (!projectId) {
      await clearLatestActiveSnapshot();
      return;
    }
    const record = await getProjectRecord(projectId);
    if (record) await persistLatestActiveSnapshot(record, syncMode);
  },

  async setSyncMode(projectId: string | null, syncMode: ProjectSyncMode): Promise<void> {
    appendPersistenceDebugEntry('project-persistence:set-sync-mode', {
      activeProjectId: projectId,
      syncMode,
    });
    await updateWorkspaceState({ activeProjectId: projectId, syncMode });
    if (!projectId) return;
    const record = await getProjectRecord(projectId);
    if (record) await persistLatestActiveSnapshot(record, syncMode);
  },

  async savePreferences(preferences: PreferencesRecord): Promise<void> {
    await writePreferences(preferences);
  },

  readCachedWorkspaceStateRecord(): WorkspaceStateRecord | null {
    return readJsonStorageRecord<WorkspaceStateRecord>(WORKSPACE_BOOT_CACHE_KEY);
  },

  readCachedPreferencesRecord(): PreferencesRecord | null {
    const cached = readJsonStorageRecord<PreferencesRecord>(PREFERENCES_BOOT_CACHE_KEY);
    return cached ?? buildPreferencesFromLegacy(getLegacyStorageReader());
  },

  async loadPreferencesRecord(): Promise<PreferencesRecord | null> {
    return readPreferencesRecord();
  },

  async updatePreferencesRecord(patch: Partial<PreferencesRecord> | ((current: PreferencesRecord | null) => PreferencesRecord)): Promise<PreferencesRecord> {
    return updatePreferencesRecord(patch);
  },

  async loadWorkspaceStateRecord(): Promise<WorkspaceStateRecord> {
    return getWorkspaceState({ awaitPendingWrites: true });
  },

  async updateWorkspaceStateRecord(
    patch: Partial<WorkspaceStateRecord> | ((current: WorkspaceStateRecord) => WorkspaceStateRecord),
  ): Promise<WorkspaceStateRecord> {
    return updateWorkspaceState(patch);
  },

  async loadProjectById(projectId: string): Promise<StoredProjectRecord | null> {
    return getProjectRecord(projectId);
  },

  async loadActiveProjectRecord(): Promise<StoredProjectRecord | null> {
    const latestSnapshot = await getLatestActiveSnapshotRecord({ awaitPendingWrites: true });
    if (latestSnapshot?.recordId) {
      const record = await getProjectRecord(latestSnapshot.recordId);
      appendPersistenceDebugEntry('project-persistence:load-active-project-record', {
        activeProjectId: latestSnapshot.recordId,
        syncMode: latestSnapshot.syncMode,
        record: record ? summarizeRecordForDebug(record) : null,
        source: 'latest-active-snapshot',
      });
      if (record) return record;
    }
    const workspace = await getWorkspaceState({ awaitPendingWrites: true });
    if (!workspace.activeProjectId) return null;
    const record = await getProjectRecord(workspace.activeProjectId);
    appendPersistenceDebugEntry('project-persistence:load-active-project-record', {
      activeProjectId: workspace.activeProjectId,
      syncMode: workspace.syncMode,
      record: record ? summarizeRecordForDebug(record) : null,
    });
    return record;
  },

  async loadLatestActiveProjectSnapshotRecord(): Promise<StoredProjectRecord | null> {
    const snapshot = await getLatestActiveSnapshotRecord({ awaitPendingWrites: true });
    if (!snapshot?.recordId) return null;
    return getProjectRecord(snapshot.recordId);
  },

  async saveWorkspaceBackup(project: ProjectSpec, source: WorkspaceBackupRecord['source']): Promise<void> {
    const db = await openDb();
    if (!db) return;
    const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
    tx.objectStore(WORKSPACE_STORE).put({
      project: cloneProject(project),
      source,
      savedAt: new Date().toISOString(),
    } satisfies WorkspaceBackupRecord, WORKSPACE_BACKUP_KEY);
    await txComplete(tx);
  },

  async loadWorkspaceBackup(): Promise<WorkspaceBackupRecord | null> {
    const db = await openDb();
    if (!db) return null;
    return readWorkspaceBackup(db);
  },

  async loadViewState(projectId: string): Promise<ViewState | null> {
    const workspace = await getWorkspaceState({ awaitPendingWrites: true });
    return workspace.viewStateByProject?.[projectId] ?? null;
  },

  async saveViewState(projectId: string, view: ViewState): Promise<void> {
    await updateWorkspaceState((current) => ({
      ...current,
      viewStateByProject: {
        ...(current.viewStateByProject ?? {}),
        [projectId]: view,
      },
    }));
  },

  async clearViewState(projectId?: string): Promise<void> {
    await updateWorkspaceState((current) => {
      if (!projectId) {
        return {
          ...current,
          viewStateByProject: undefined,
        };
      }
      const nextViews = { ...(current.viewStateByProject ?? {}) };
      delete nextViews[projectId];
      return {
        ...current,
        viewStateByProject: Object.keys(nextViews).length > 0 ? nextViews : undefined,
      };
    });
  },

  async loadLastPublishInfo(userId: string): Promise<{ url: string; publishedAtMs: number } | null> {
    const preferences = await readPreferencesRecord();
    return preferences?.lastPublishByUserId?.[userId] ?? null;
  },

  async saveLastPublishInfo(userId: string, value: { url: string; publishedAtMs: number }): Promise<void> {
    await updatePreferencesRecord((current) => mergePreferences(current, {
      lastPublishByUserId: {
        ...(current?.lastPublishByUserId ?? {}),
        [userId]: value,
      },
    }));
  },

  async createLocalProject(project?: ProjectSpec): Promise<StoredProjectRecord> {
    const nextProject = project ? cloneProject(project) : createEmptyProject();
    if (!nextProject.id || nextProject.id === 'project-1') nextProject.id = allocateProjectId();
    if (!nextProject.title) nextProject.title = 'Untitled Project';
    const record = buildStoredProjectRecord(nextProject, { id: nextProject.id, origin: 'local-only', syncStatus: 'local' });
    await upsertProjectRecord(record);
    await updateWorkspaceState({ activeProjectId: record.id, syncMode: 'online' });
    await persistLatestActiveSnapshot(record, 'online');
    return record;
  },

  async duplicateProject(record: StoredProjectRecord): Promise<StoredProjectRecord> {
    const duplicate = cloneProject(record.project);
    duplicate.id = allocateProjectId();
    duplicate.title = `${record.project.title?.trim() || 'Untitled Project'} Copy`;
    const next = buildStoredProjectRecord(duplicate, {
      id: duplicate.id,
      origin: 'local-only',
      syncStatus: 'local',
    });
    await upsertProjectRecord(next);
    await updateWorkspaceState({ activeProjectId: next.id, syncMode: 'online' });
    await persistLatestActiveSnapshot(next, 'online');
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

export function __pauseActiveProjectRecordPersistenceForTests(): void {
  if (activeProjectRecordPersistenceBarrier) return;
  activeProjectRecordPersistenceBarrier = new Promise<void>((resolve) => {
    activeProjectRecordPersistenceRelease = resolve;
  });
}

export function __resumeActiveProjectRecordPersistenceForTests(): void {
  activeProjectRecordPersistenceRelease?.();
  activeProjectRecordPersistenceRelease = null;
  activeProjectRecordPersistenceBarrier = null;
}

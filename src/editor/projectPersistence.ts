import { parseProjectYaml, serializeProjectToYaml } from '../model/serialization';
import { createEmptyProject } from '../model/emptyProject';
import { projectsSemanticallyEqual } from '../model/projectCanonical';
import type { ProjectSpec, StartupMode } from '../model/types';
import { validateProjectSpec } from '../model/validation';
import {
  appendProjectRevision,
  archiveProjectHistoryRevisions,
  createProjectRevision,
  deleteProjectHistoryRevisions,
  materializeProjectRevision,
  rebuildProjectRevisions,
  type ProjectRevisionRecord,
} from './projectTreeHistory';
import { partitionHistoryEventsByRevisionIds, type ProjectHistoryEvent } from './projectHistoryEvents';
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
  archivedRevisions?: ProjectRevisionRecord[];
  historyEvents?: ProjectHistoryEvent[];
  archivedHistoryEvents?: ProjectHistoryEvent[];
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
  restoreWarnings?: string[];
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

const STORED_PROJECT_ORIGINS = new Set<StoredProjectOrigin>(['anonymous', 'cloud-cache', 'local-only']);
const STORED_PROJECT_SYNC_STATUSES = new Set<StoredProjectSyncStatus>(['local', 'cloud', 'unsynced']);
const STORED_THEME_MODES = new Set<StoredThemeMode>(['system', 'light', 'dark']);
const STARTUP_MODES = new Set<StartupMode>(['new_empty_scene']);
const PROJECT_SYNC_MODES = new Set<ProjectSyncMode>(['online', 'offline']);

class StoredProjectRecordValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoredProjectRecordValidationError';
  }
}

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

function mergeWorkspaceState(
  base: WorkspaceStateRecord,
  patch: Partial<WorkspaceStateRecord> | ((current: WorkspaceStateRecord) => WorkspaceStateRecord),
): WorkspaceStateRecord {
  return typeof patch === 'function' ? patch(base) : { ...base, ...patch };
}

function describeRuntimeValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function assertStoredProjectRecord(condition: unknown, message: string): asserts condition {
  if (!condition) throw new StoredProjectRecordValidationError(message);
}

function validateOptionalArrayField(value: unknown, fieldName: string, context: string): void {
  if (value === undefined) return;
  assertStoredProjectRecord(Array.isArray(value), `${context}: ${fieldName} must be an array or omitted, got ${describeRuntimeValue(value)}`);
}

function parseFiniteNumber(value: unknown, context: string, fieldName: string): number {
  assertStoredProjectRecord(typeof value === 'number' && Number.isFinite(value), `${context}: ${fieldName} must be a finite number`);
  return value;
}

function parseOptionalFiniteNumber(value: unknown, context: string, fieldName: string): number | undefined {
  if (value === undefined) return undefined;
  return parseFiniteNumber(value, context, fieldName);
}

function parseViewState(raw: unknown, context: string): ViewState {
  assertStoredProjectRecord(raw && typeof raw === 'object' && !Array.isArray(raw), `${context}: view state must be an object, got ${describeRuntimeValue(raw)}`);
  const candidate = raw as Record<string, unknown>;
  return {
    zoom: parseFiniteNumber(candidate.zoom, context, 'zoom'),
    scrollX: parseFiniteNumber(candidate.scrollX, context, 'scrollX'),
    scrollY: parseFiniteNumber(candidate.scrollY, context, 'scrollY'),
    ...(candidate.viewportWidth !== undefined ? { viewportWidth: parseFiniteNumber(candidate.viewportWidth, context, 'viewportWidth') } : {}),
    ...(candidate.viewportHeight !== undefined ? { viewportHeight: parseFiniteNumber(candidate.viewportHeight, context, 'viewportHeight') } : {}),
  };
}

function parseWorkspaceStateRecord(raw: unknown, context: string): WorkspaceStateRecord {
  if (raw == null) return defaultWorkspace();
  assertStoredProjectRecord(raw && typeof raw === 'object' && !Array.isArray(raw), `${context}: workspace state must be an object, got ${describeRuntimeValue(raw)}`);
  const candidate = raw as Record<string, unknown>;
  assertStoredProjectRecord(candidate.activeProjectId === null || typeof candidate.activeProjectId === 'string', `${context}: activeProjectId must be a string or null`);
  assertStoredProjectRecord(typeof candidate.syncMode === 'string' && PROJECT_SYNC_MODES.has(candidate.syncMode as ProjectSyncMode), `${context}: syncMode must be one of ${Array.from(PROJECT_SYNC_MODES).join(', ')}`);
  let viewStateByProject: Record<string, ViewState> | undefined;
  if (candidate.viewStateByProject !== undefined) {
    assertStoredProjectRecord(candidate.viewStateByProject && typeof candidate.viewStateByProject === 'object' && !Array.isArray(candidate.viewStateByProject), `${context}: viewStateByProject must be an object when present`);
    viewStateByProject = {};
    for (const [projectId, viewState] of Object.entries(candidate.viewStateByProject as Record<string, unknown>)) {
      assertStoredProjectRecord(projectId.length > 0, `${context}: viewStateByProject keys must be non-empty strings`);
      viewStateByProject[projectId] = parseViewState(viewState, `${context}: viewStateByProject.${projectId}`);
    }
  }
  return {
    activeProjectId: candidate.activeProjectId as string | null,
    syncMode: candidate.syncMode as ProjectSyncMode,
    ...(candidate.leftPaneWidth !== undefined ? { leftPaneWidth: parseOptionalFiniteNumber(candidate.leftPaneWidth, context, 'leftPaneWidth') } : {}),
    ...(candidate.rightPaneWidth !== undefined ? { rightPaneWidth: parseOptionalFiniteNumber(candidate.rightPaneWidth, context, 'rightPaneWidth') } : {}),
    ...(candidate.assetsDockHeight !== undefined ? { assetsDockHeight: parseOptionalFiniteNumber(candidate.assetsDockHeight, context, 'assetsDockHeight') } : {}),
    ...(viewStateByProject !== undefined ? { viewStateByProject } : {}),
  };
}

function parseLatestActiveSnapshotRecord(raw: unknown, context: string): LatestActiveProjectSnapshotRecord | null {
  if (raw == null) return null;
  assertStoredProjectRecord(raw && typeof raw === 'object' && !Array.isArray(raw), `${context}: latest active snapshot must be an object, got ${describeRuntimeValue(raw)}`);
  const candidate = raw as Record<string, unknown>;
  assertStoredProjectRecord(typeof candidate.recordId === 'string' && candidate.recordId.length > 0, `${context}: recordId must be a non-empty string`);
  assertStoredProjectRecord(typeof candidate.syncMode === 'string' && PROJECT_SYNC_MODES.has(candidate.syncMode as ProjectSyncMode), `${context}: syncMode must be one of ${Array.from(PROJECT_SYNC_MODES).join(', ')}`);
  assertStoredProjectRecord(typeof candidate.updatedAt === 'string' && candidate.updatedAt.length > 0, `${context}: updatedAt must be a non-empty string`);
  assertStoredProjectRecord(typeof candidate.savedAt === 'string' && candidate.savedAt.length > 0, `${context}: savedAt must be a non-empty string`);
  return {
    recordId: candidate.recordId as string,
    updatedAt: candidate.updatedAt as string,
    syncMode: candidate.syncMode as ProjectSyncMode,
    savedAt: candidate.savedAt as string,
  };
}

function parsePreferencesRecord(raw: unknown, context: string): PreferencesRecord | null {
  if (raw == null) return null;
  assertStoredProjectRecord(raw && typeof raw === 'object' && !Array.isArray(raw), `${context}: preferences must be an object, got ${describeRuntimeValue(raw)}`);
  const candidate = raw as Record<string, unknown>;
  assertStoredProjectRecord(typeof candidate.startupMode === 'string' && STARTUP_MODES.has(candidate.startupMode as StartupMode), `${context}: startupMode must be one of ${Array.from(STARTUP_MODES).join(', ')}`);
  assertStoredProjectRecord(typeof candidate.themeMode === 'string' && STORED_THEME_MODES.has(candidate.themeMode as StoredThemeMode), `${context}: themeMode must be one of ${Array.from(STORED_THEME_MODES).join(', ')}`);
  assertStoredProjectRecord(typeof candidate.showHitboxOverlay === 'boolean', `${context}: showHitboxOverlay must be a boolean`);
  const uiScale = parseFiniteNumber(candidate.uiScale, context, 'uiScale');
  return {
    startupMode: candidate.startupMode as StartupMode,
    themeMode: candidate.themeMode as StoredThemeMode,
    uiScale,
    showHitboxOverlay: candidate.showHitboxOverlay as boolean,
    ...(candidate.assetsDockShowThumbnails !== undefined
      ? (() => {
        assertStoredProjectRecord(typeof candidate.assetsDockShowThumbnails === 'boolean', `${context}: assetsDockShowThumbnails must be a boolean when present`);
        return { assetsDockShowThumbnails: candidate.assetsDockShowThumbnails as boolean };
      })()
      : {}),
    ...(candidate.inspectorFoldouts !== undefined ? { inspectorFoldouts: normalizeBooleanMap(candidate.inspectorFoldouts) ?? {} } : {}),
    ...(candidate.pinnedActionTypes !== undefined ? { pinnedActionTypes: normalizeStringList(candidate.pinnedActionTypes) ?? [] } : {}),
    ...(candidate.pinnedPatternIds !== undefined ? { pinnedPatternIds: normalizeStringList(candidate.pinnedPatternIds) ?? [] } : {}),
    ...(candidate.lastPublishByUserId !== undefined ? { lastPublishByUserId: normalizeLastPublishMap(candidate.lastPublishByUserId) ?? {} } : {}),
  };
}

function buildStoredProjectRecordBase(raw: unknown, context: string): Omit<StoredProjectRecord, 'project'> & { project?: ProjectSpec } {
  assertStoredProjectRecord(raw && typeof raw === 'object', `${context}: stored project record must be an object, got ${describeRuntimeValue(raw)}`);
  const candidate = raw as Record<string, unknown>;
  assertStoredProjectRecord(typeof candidate.id === 'string' && candidate.id.length > 0, `${context}: id must be a non-empty string`);
  assertStoredProjectRecord(typeof candidate.projectId === 'string' && candidate.projectId.length > 0, `${context}: projectId must be a non-empty string`);
  assertStoredProjectRecord(typeof candidate.title === 'string', `${context}: title must be a string`);
  assertStoredProjectRecord(typeof candidate.updatedAt === 'string' && candidate.updatedAt.length > 0, `${context}: updatedAt must be a non-empty string`);
  assertStoredProjectRecord(typeof candidate.sceneCount === 'number' && Number.isFinite(candidate.sceneCount), `${context}: sceneCount must be a finite number`);
  assertStoredProjectRecord(typeof candidate.origin === 'string' && STORED_PROJECT_ORIGINS.has(candidate.origin as StoredProjectOrigin), `${context}: origin must be one of ${Array.from(STORED_PROJECT_ORIGINS).join(', ')}`);
  assertStoredProjectRecord(typeof candidate.syncStatus === 'string' && STORED_PROJECT_SYNC_STATUSES.has(candidate.syncStatus as StoredProjectSyncStatus), `${context}: syncStatus must be one of ${Array.from(STORED_PROJECT_SYNC_STATUSES).join(', ')}`);
  if (candidate.cloudProjectId !== undefined) {
    assertStoredProjectRecord(typeof candidate.cloudProjectId === 'string' && candidate.cloudProjectId.length > 0, `${context}: cloudProjectId must be a non-empty string when present`);
  }
  if (candidate.yaml !== undefined) {
    assertStoredProjectRecord(typeof candidate.yaml === 'string' && candidate.yaml.length > 0, `${context}: yaml must be a non-empty string when present`);
  }
  validateOptionalArrayField(candidate.revisions, 'revisions', context);
  validateOptionalArrayField(candidate.archivedRevisions, 'archivedRevisions', context);
  validateOptionalArrayField(candidate.historyEvents, 'historyEvents', context);
  validateOptionalArrayField(candidate.archivedHistoryEvents, 'archivedHistoryEvents', context);

  return {
    id: candidate.id,
    projectId: candidate.projectId,
    title: candidate.title,
    updatedAt: candidate.updatedAt,
    sceneCount: candidate.sceneCount,
    origin: candidate.origin as StoredProjectOrigin,
    syncStatus: candidate.syncStatus as StoredProjectSyncStatus,
    ...(candidate.cloudProjectId !== undefined ? { cloudProjectId: candidate.cloudProjectId as string } : {}),
    ...(candidate.yaml !== undefined ? { yaml: candidate.yaml as string } : {}),
    ...(candidate.revisions !== undefined ? { revisions: candidate.revisions as ProjectRevisionRecord[] } : {}),
    ...(candidate.archivedRevisions !== undefined ? { archivedRevisions: candidate.archivedRevisions as ProjectRevisionRecord[] } : {}),
    ...(candidate.historyEvents !== undefined ? { historyEvents: candidate.historyEvents as ProjectHistoryEvent[] } : {}),
    ...(candidate.archivedHistoryEvents !== undefined ? { archivedHistoryEvents: candidate.archivedHistoryEvents as ProjectHistoryEvent[] } : {}),
    ...('project' in candidate ? { project: candidate.project as ProjectSpec | undefined } : {}),
  };
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
    archivedRevisions?: ProjectRevisionRecord[];
    historyEvents?: ProjectHistoryEvent[];
    archivedHistoryEvents?: ProjectHistoryEvent[];
  }
): StoredProjectRecord {
  const revisions = Array.isArray(options?.revisions) && options.revisions.length > 0
    ? options.revisions
    : [createProjectRevision(project)];
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
    revisions,
    archivedRevisions: options?.archivedRevisions ?? [],
    historyEvents: options?.historyEvents ?? [],
    archivedHistoryEvents: options?.archivedHistoryEvents ?? [],
  };
}

function normalizeStoredProjectRevisions(
  project: ProjectSpec,
  revisions: ProjectRevisionRecord[] | undefined,
  options?: { fallbackToCurrentProject?: boolean; enforceLatestMatchesProject?: boolean },
): ProjectRevisionRecord[] {
  const fallbackToCurrentProject = options?.fallbackToCurrentProject ?? true;
  const enforceLatestMatchesProject = options?.enforceLatestMatchesProject ?? true;
  if (!Array.isArray(revisions) || revisions.length === 0) {
    return fallbackToCurrentProject ? [createProjectRevision(project)] : [];
  }

  const originalRevisions = revisions.filter(Boolean);
  if (originalRevisions.length === 0) return fallbackToCurrentProject ? [createProjectRevision(project)] : [];

  let workingRevisions = originalRevisions;
  if (enforceLatestMatchesProject) {
    const latestRevision = originalRevisions[0];
    const latestMaterialized = materializeProjectRevision(originalRevisions, latestRevision.id);
    const latestMatchesStoredProject = latestMaterialized && projectsSemanticallyEqual(latestMaterialized, project);
    if (!latestMatchesStoredProject) {
      workingRevisions = [createProjectRevision(project, {
        id: latestRevision.id,
        updatedAt: latestRevision.updatedAt,
        reason: latestRevision.reason,
        changeSummary: latestRevision.changeSummary,
        historyEventIds: latestRevision.historyEventIds,
        historyBurstIds: latestRevision.historyBurstIds,
      }), ...originalRevisions.slice(1)];
    }
  }

  const rebuilt = rebuildProjectRevisions(workingRevisions, fallbackToCurrentProject ? project : undefined);
  return rebuilt.length === 0 && fallbackToCurrentProject ? [createProjectRevision(project)] : rebuilt;
}

function getValidProjectOrNull(project: ProjectSpec | undefined): ProjectSpec | null {
  if (!project) return null;
  try {
    validateProjectSpec(project);
    return project;
  } catch {
    return null;
  }
}

function hydrateStoredProjectRecord(
  record: Omit<StoredProjectRecord, 'project'> & { project?: ProjectSpec },
  context: string,
): StoredProjectRecord {
  const validProject = getValidProjectOrNull(record.project);
  if (validProject) {
    return {
      ...record,
      project: validProject,
      revisions: normalizeStoredProjectRevisions(validProject, record.revisions),
      archivedRevisions: normalizeStoredProjectRevisions(validProject, record.archivedRevisions, {
        fallbackToCurrentProject: false,
        enforceLatestMatchesProject: false,
      }),
      historyEvents: record.historyEvents ?? [],
      archivedHistoryEvents: record.archivedHistoryEvents ?? [],
    };
  }
  if (Array.isArray(record.revisions) && record.revisions.length > 0) {
    try {
      const latestProject = materializeProjectRevision(record.revisions, record.revisions[0].id);
      const validLatestProject = getValidProjectOrNull(latestProject ?? undefined);
      if (validLatestProject) {
        return {
          ...record,
          project: validLatestProject,
          revisions: normalizeStoredProjectRevisions(validLatestProject, record.revisions),
          archivedRevisions: normalizeStoredProjectRevisions(validLatestProject, record.archivedRevisions, {
            fallbackToCurrentProject: false,
            enforceLatestMatchesProject: false,
          }),
          historyEvents: record.historyEvents ?? [],
          archivedHistoryEvents: record.archivedHistoryEvents ?? [],
        };
      }
    } catch (error) {
      throw new StoredProjectRecordValidationError(
        `${context}: revisions could not be materialized (${error instanceof Error ? error.message : 'unknown error'})`,
      );
    }
  }
  if (record.yaml) {
    try {
      const project = parseProjectYaml(record.yaml);
      validateProjectSpec(project);
      return {
        ...record,
        project,
        revisions: normalizeStoredProjectRevisions(project, record.revisions),
        archivedRevisions: normalizeStoredProjectRevisions(project, record.archivedRevisions, {
          fallbackToCurrentProject: false,
          enforceLatestMatchesProject: false,
        }),
        historyEvents: record.historyEvents ?? [],
        archivedHistoryEvents: record.archivedHistoryEvents ?? [],
      };
    } catch (error) {
      throw new StoredProjectRecordValidationError(
        `${context}: yaml could not be parsed into a valid project (${error instanceof Error ? error.message : 'unknown error'})`,
      );
    }
  }
  throw new StoredProjectRecordValidationError(
    `${context}: missing a valid project payload, materializable revisions, and YAML fallback`,
  );
}

function parseStoredProjectRecord(raw: unknown, context: string): StoredProjectRecord {
  const record = buildStoredProjectRecordBase(raw, context);
  return hydrateStoredProjectRecord(record, context);
}

function dehydrateStoredProjectRecord(record: StoredProjectRecord): PersistedProjectRecord {
  const { project: _project, ...persisted } = structuredClone(record);
  return persisted;
}

function validateStoredProjectRecordForPersistence(record: StoredProjectRecord): void {
  const context = `save project record ${record.id}`;
  buildStoredProjectRecordBase(record, context);
  validateProjectSpec(record.project);
  const expectedSceneCount = Object.keys(record.project.scenes ?? {}).length;
  assertStoredProjectRecord(record.sceneCount === expectedSceneCount, `${context}: sceneCount ${record.sceneCount} does not match project scene count ${expectedSceneCount}`);
}

async function readAllProjects(db: IDBDatabase): Promise<{ records: StoredProjectRecord[]; warnings: string[] }> {
  const tx = db.transaction(PROJECTS_STORE, 'readonly');
  const rows = await requestValue(tx.objectStore(PROJECTS_STORE).getAll());
  await txComplete(tx);
  const warnings: string[] = [];
  const records: StoredProjectRecord[] = [];
  for (const [index, row] of (Array.isArray(rows) ? rows : []).entries()) {
    const fallbackRecordId = row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string'
      ? (row as { id: string }).id
      : `index:${index}`;
    const context = `stored project record ${fallbackRecordId}`;
    try {
      records.push(parseStoredProjectRecord(row, context));
    } catch (error) {
      const warning = error instanceof Error ? error.message : `${context}: unknown validation error`;
      warnings.push(warning);
      appendPersistenceDebugEntry('project-persistence:invalid-stored-project-record', {
        context,
        warning,
      });
    }
  }
  return { records, warnings };
}

async function readWorkspace(db: IDBDatabase): Promise<{ workspace: WorkspaceStateRecord; warnings: string[] }> {
  const tx = db.transaction(WORKSPACE_STORE, 'readonly');
  const workspace = await requestValue(tx.objectStore(WORKSPACE_STORE).get(WORKSPACE_KEY));
  await txComplete(tx);
  try {
    return {
      workspace: parseWorkspaceStateRecord(workspace, 'workspace state'),
      warnings: [],
    };
  } catch (error) {
    const warning = error instanceof Error ? error.message : 'workspace state: unknown validation error';
    appendPersistenceDebugEntry('project-persistence:invalid-workspace-state', { warning });
    return {
      workspace: defaultWorkspace(),
      warnings: [warning],
    };
  }
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

async function readLatestActiveSnapshot(db: IDBDatabase): Promise<{ snapshot: LatestActiveProjectSnapshotRecord | null; warnings: string[] }> {
  const tx = db.transaction(WORKSPACE_STORE, 'readonly');
  const snapshot = await requestValue(tx.objectStore(WORKSPACE_STORE).get(ACTIVE_PROJECT_SNAPSHOT_KEY));
  await txComplete(tx);
  try {
    return {
      snapshot: parseLatestActiveSnapshotRecord(snapshot, 'latest active snapshot'),
      warnings: [],
    };
  } catch (error) {
    const warning = error instanceof Error ? error.message : 'latest active snapshot: unknown validation error';
    appendPersistenceDebugEntry('project-persistence:invalid-latest-active-snapshot', { warning });
    return {
      snapshot: null,
      warnings: [warning],
    };
  }
}

async function readPreferences(db: IDBDatabase): Promise<{ preferences: PreferencesRecord | null; warnings: string[] }> {
  const tx = db.transaction(PREFERENCES_STORE, 'readonly');
  const preferences = await requestValue(tx.objectStore(PREFERENCES_STORE).get(PREFERENCES_KEY));
  await txComplete(tx);
  try {
    return {
      preferences: parsePreferencesRecord(preferences, 'preferences'),
      warnings: [],
    };
  } catch (error) {
    const warning = error instanceof Error ? error.message : 'preferences: unknown validation error';
    appendPersistenceDebugEntry('project-persistence:invalid-preferences', { warning });
    return {
      preferences: null,
      warnings: [warning],
    };
  }
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
      restoreWarnings: [],
    };
  }
  await migrateLegacyStorage(db);
  const [storedProjectResult, storedWorkspaceResult, preferencesResult, latestActiveSnapshotResult] = await Promise.all([
    readAllProjects(db),
    readWorkspace(db),
    readPreferences(db),
    readLatestActiveSnapshot(db),
  ]);
  const storedProjects = storedProjectResult.records;
  const storedWorkspace = storedWorkspaceResult.workspace;
  const preferences = preferencesResult.preferences;
  const latestActiveSnapshot = latestActiveSnapshotResult.snapshot;
  const restoreWarnings = [
    ...storedProjectResult.warnings,
    ...storedWorkspaceResult.warnings,
    ...preferencesResult.warnings,
    ...latestActiveSnapshotResult.warnings,
  ];
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
  appendPersistenceDebugEntry('restore:project-candidates-loaded', {
    workspaceActiveProjectId: storedWorkspace.activeProjectId,
    latestActiveSnapshotRecordId: latestActiveSnapshot?.recordId ?? null,
    localProjectCount: localProjects.length,
    candidates: localProjects.map(summarizeRecordForRestoreCandidate),
  });
  let workspace = storedWorkspace;
  let activeProjectSelectionSource: 'latest-active-snapshot' | 'workspace-active-project' | 'none' = 'none';
  if (latestActiveSnapshot) {
    const existingIndex = localProjects.findIndex((record) => record.id === latestActiveSnapshot.recordId);
    const snapshotRecord = existingIndex >= 0 ? localProjects[existingIndex] : null;
    const currentActiveRecord = localProjects.find((record) => record.id === workspace.activeProjectId) ?? null;
    const snapshotMs = Date.parse(latestActiveSnapshot.updatedAt || latestActiveSnapshot.savedAt);
    const currentActiveMs = Date.parse(currentActiveRecord?.updatedAt ?? '');
    const snapshotLooksPlaceholder = isPlaceholderProjectRecord(snapshotRecord);
    const currentActiveLooksPlaceholder = isPlaceholderProjectRecord(currentActiveRecord);
    const currentActiveLooksMeaningful = currentActiveRecord != null && !isPlaceholderProjectRecord(currentActiveRecord);
    const snapshotMatchesWorkspace = latestActiveSnapshot.recordId === workspace.activeProjectId;
    const workspaceHasExplicitMeaningfulActiveProject =
      Boolean(workspace.activeProjectId && currentActiveLooksMeaningful);
    const shouldUseTimestampTiebreak =
      !(snapshotLooksPlaceholder && currentActiveLooksMeaningful);
    const shouldPreferSnapshot =
      !currentActiveRecord
      || !workspace.activeProjectId
      || snapshotMatchesWorkspace
      || (!snapshotLooksPlaceholder && currentActiveLooksPlaceholder)
      || (!workspaceHasExplicitMeaningfulActiveProject && shouldUseTimestampTiebreak && (
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
  let activeProject = localProjects.find((record) => record.id === workspace.activeProjectId) ?? null;
  if (!activeProject) {
    const bootstrapCandidate = selectBestBootstrapProject(localProjects);
    if (bootstrapCandidate) {
      const bootstrapIndex = localProjects.findIndex((record) => record.id === bootstrapCandidate.id);
      if (bootstrapIndex > 0) {
        localProjects.splice(bootstrapIndex, 1);
        localProjects.unshift(bootstrapCandidate);
      }
      workspace = {
        ...workspace,
        activeProjectId: bootstrapCandidate.id,
      };
      activeProject = bootstrapCandidate;
      activeProjectSelectionSource = 'bootstrap-fallback';
      appendPersistenceDebugEntry('restore:bootstrap-fallback-selected', {
        previousWorkspaceActiveProjectId: storedWorkspace.activeProjectId,
        latestActiveSnapshotRecordId: latestActiveSnapshot?.recordId ?? null,
        selected: summarizeRecordForRestoreCandidate(bootstrapCandidate),
        candidates: localProjects.map(summarizeRecordForRestoreCandidate),
      });
    }
  }
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
  return { localProjects, workspace, preferences, restoreWarnings };
}

async function upsertProjectRecord(record: StoredProjectRecord): Promise<void> {
  validateStoredProjectRecordForPersistence(record);
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(PROJECTS_STORE, 'readwrite');
  tx.objectStore(PROJECTS_STORE).put(dehydrateStoredProjectRecord(record));
  await txComplete(tx);
}

async function writeLatestActiveSnapshot(snapshot: LatestActiveProjectSnapshotRecord): Promise<void> {
  parseLatestActiveSnapshotRecord(snapshot, `save latest active snapshot ${snapshot.recordId}`);
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
  const validatedWorkspace = parseWorkspaceStateRecord(workspace, 'save workspace state');
  writeJsonStorageRecord(WORKSPACE_BOOT_CACHE_KEY, validatedWorkspace);
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
  tx.objectStore(WORKSPACE_STORE).put(validatedWorkspace, WORKSPACE_KEY);
  await txComplete(tx);
}

async function writePreferences(preferences: PreferencesRecord): Promise<void> {
  const validatedPreferences = parsePreferencesRecord(preferences, 'save preferences');
  if (!validatedPreferences) throw new StoredProjectRecordValidationError('save preferences: preferences must not be null');
  writeJsonStorageRecord(PREFERENCES_BOOT_CACHE_KEY, validatedPreferences);
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(PREFERENCES_STORE, 'readwrite');
  tx.objectStore(PREFERENCES_STORE).put(validatedPreferences, PREFERENCES_KEY);
  await txComplete(tx);
}

async function readPreferencesRecord(): Promise<PreferencesRecord | null> {
  const db = await openDb();
  if (!db) return buildPreferencesFromLegacy(getLegacyStorageReader());
  return (await readPreferences(db)).preferences;
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
  return record ? parseStoredProjectRecord(record, `stored project record ${projectId}`) : null;
}

async function getWorkspaceState(options?: { awaitPendingWrites?: boolean }): Promise<WorkspaceStateRecord> {
  if (options?.awaitPendingWrites) await workspaceMutationQueue.drain();
  const db = await openDb();
  if (!db) return defaultWorkspace();
  return (await readWorkspace(db)).workspace;
}

async function getLatestActiveSnapshotRecord(options?: { awaitPendingWrites?: boolean }): Promise<LatestActiveProjectSnapshotRecord | null> {
  if (options?.awaitPendingWrites) await latestActiveSnapshotMutationQueue.drain();
  const db = await openDb();
  if (!db) return null;
  return (await readLatestActiveSnapshot(db)).snapshot;
}

async function updateWorkspaceState(
  patch: Partial<WorkspaceStateRecord> | ((current: WorkspaceStateRecord) => WorkspaceStateRecord),
): Promise<WorkspaceStateRecord> {
  return workspaceMutationQueue.run(async () => {
    const current = await getWorkspaceState();
    const next = mergeWorkspaceState(current, patch);
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

function projectRecordUpdatedAtMs(record: StoredProjectRecord | null): number {
  if (!record) return Number.NEGATIVE_INFINITY;
  const updatedAtMs = Date.parse(record.updatedAt ?? '');
  return Number.isFinite(updatedAtMs) ? updatedAtMs : Number.NEGATIVE_INFINITY;
}

function selectBestBootstrapProject(records: StoredProjectRecord[]): StoredProjectRecord | null {
  if (records.length === 0) return null;
  return [...records].sort((left, right) => {
    const leftPlaceholder = isPlaceholderProjectRecord(left);
    const rightPlaceholder = isPlaceholderProjectRecord(right);
    if (leftPlaceholder !== rightPlaceholder) return leftPlaceholder ? 1 : -1;

    const updatedAtDelta = projectRecordUpdatedAtMs(right) - projectRecordUpdatedAtMs(left);
    if (updatedAtDelta !== 0) return updatedAtDelta;

    return left.id.localeCompare(right.id);
  })[0] ?? null;
}

function summarizeRecordForRestoreCandidate(record: StoredProjectRecord) {
  const scenes = Object.values(record.project.scenes ?? {});
  return {
    recordId: record.id,
    projectId: record.projectId,
    title: record.title,
    updatedAt: record.updatedAt,
    origin: record.origin,
    syncStatus: record.syncStatus,
    cloudProjectId: record.cloudProjectId ?? null,
    revisionCount: record.revisions?.length ?? 0,
    sceneCount: scenes.length,
    entityCount: scenes.reduce(
      (total, scene) => total + Object.keys(scene.entities ?? {}).length,
      0,
    ),
    textEntityCount: scenes.reduce(
      (total, scene) => total + Object.values(scene.entities ?? {}).filter((entity) => typeof (entity as { text?: unknown }).text === 'string').length,
      0,
    ),
    isPlaceholder: isPlaceholderProjectRecord(record),
  };
}

function summarizeRecordForDebug(
  record: Pick<StoredProjectRecord, 'cloudProjectId' | 'id' | 'origin' | 'project' | 'projectId' | 'revisions' | 'syncStatus' | 'title' | 'updatedAt' | 'yaml'>,
) {
  const yaml = record.yaml ?? serializeProjectToYaml(record.project);
  const scenes = Object.values(record.project.scenes ?? {});
  return {
    recordId: record.id,
    projectId: record.projectId,
    title: record.title,
    updatedAt: record.updatedAt,
    origin: record.origin,
    syncStatus: record.syncStatus,
    cloudProjectId: record.cloudProjectId ?? null,
    revisionCount: record.revisions?.length ?? 0,
    sceneCount: scenes.length,
    entityCount: scenes.reduce(
      (total, scene) => total + Object.keys(scene.entities ?? {}).length,
      0,
    ),
    textEntityCount: scenes.reduce(
      (total, scene) => total + Object.values(scene.entities ?? {}).filter((entity) => typeof (entity as { text?: unknown }).text === 'string').length,
      0,
    ),
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
        restoreWarnings: [],
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
    const cached = readJsonStorageRecord<unknown>(WORKSPACE_BOOT_CACHE_KEY);
    try {
      return cached == null ? null : parseWorkspaceStateRecord(cached, 'workspace boot cache');
    } catch (error) {
      appendPersistenceDebugEntry('project-persistence:invalid-workspace-boot-cache', {
        warning: error instanceof Error ? error.message : 'workspace boot cache: unknown validation error',
      });
      return null;
    }
  },

  writeCachedWorkspaceStateRecord(
    patch: Partial<WorkspaceStateRecord> | ((current: WorkspaceStateRecord) => WorkspaceStateRecord),
  ): WorkspaceStateRecord {
    const current = this.readCachedWorkspaceStateRecord() ?? defaultWorkspace();
    const next = mergeWorkspaceState(current, patch);
    writeJsonStorageRecord(WORKSPACE_BOOT_CACHE_KEY, next);
    return next;
  },

  readCachedPreferencesRecord(): PreferencesRecord | null {
    const cached = readJsonStorageRecord<unknown>(PREFERENCES_BOOT_CACHE_KEY);
    try {
      const parsed = parsePreferencesRecord(cached, 'preferences boot cache');
      return parsed ?? buildPreferencesFromLegacy(getLegacyStorageReader());
    } catch (error) {
      appendPersistenceDebugEntry('project-persistence:invalid-preferences-boot-cache', {
        warning: error instanceof Error ? error.message : 'preferences boot cache: unknown validation error',
      });
      return buildPreferencesFromLegacy(getLegacyStorageReader());
    }
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
    const requestedProjectId = nextProject.id;
    if (!nextProject.id || nextProject.id === 'project-1') nextProject.id = allocateProjectId();
    if (!nextProject.title) nextProject.title = 'Untitled Project';
    const record = buildStoredProjectRecord(nextProject, { id: nextProject.id, origin: 'local-only', syncStatus: 'local' });
    appendPersistenceDebugEntry('project-persistence:create-local-project', {
      requestedProjectId: requestedProjectId ?? null,
      allocatedProjectId: record.id,
      title: record.title,
      sceneCount: Object.keys(record.project.scenes ?? {}).length,
      entityCount: Object.values(record.project.scenes ?? {}).reduce(
        (total, scene) => total + Object.keys(scene.entities ?? {}).length,
        0,
      ),
    });
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

  async updateProjectHistoryRetention(
    projectId: string,
    options: { archiveRevisionIds?: string[]; deleteRevisionIds?: string[] },
  ): Promise<StoredProjectRecord | null> {
    const existing = await getProjectRecord(projectId);
    if (!existing) return null;

    const archiveRevisionIds = options.archiveRevisionIds ?? [];
    const deleteRevisionIds = options.deleteRevisionIds ?? [];
    let nextHistory = {
      revisions: existing.revisions ?? [],
      archivedRevisions: existing.archivedRevisions ?? [],
    };
    let nextHistoryEvents = existing.historyEvents ?? [];
    let nextArchivedHistoryEvents = existing.archivedHistoryEvents ?? [];

    if (archiveRevisionIds.length > 0) {
      const archivedEventPartition = partitionHistoryEventsByRevisionIds(nextHistoryEvents, archiveRevisionIds);
      nextHistory = archiveProjectHistoryRevisions({
        activeRevisions: nextHistory.revisions,
        archivedRevisions: nextHistory.archivedRevisions,
        revisionIds: archiveRevisionIds,
        currentProject: existing.project,
      });
      nextHistoryEvents = archivedEventPartition.remaining;
      nextArchivedHistoryEvents = [
        ...nextArchivedHistoryEvents,
        ...archivedEventPartition.matched,
      ];
    }

    if (deleteRevisionIds.length > 0) {
      const activeDeletePartition = partitionHistoryEventsByRevisionIds(nextHistoryEvents, deleteRevisionIds);
      const archivedDeletePartition = partitionHistoryEventsByRevisionIds(
        nextArchivedHistoryEvents,
        deleteRevisionIds,
      );
      nextHistory = deleteProjectHistoryRevisions({
        activeRevisions: nextHistory.revisions,
        archivedRevisions: nextHistory.archivedRevisions,
        revisionIds: deleteRevisionIds,
        currentProject: existing.project,
      });
      nextHistoryEvents = activeDeletePartition.remaining;
      nextArchivedHistoryEvents = archivedDeletePartition.remaining;
    }

    const next = {
      ...existing,
      revisions: nextHistory.revisions,
      archivedRevisions: nextHistory.archivedRevisions,
      historyEvents: nextHistoryEvents,
      archivedHistoryEvents: nextArchivedHistoryEvents,
    } satisfies StoredProjectRecord;
    const workspace = await getWorkspaceState({ awaitPendingWrites: true });
    await upsertProjectRecord(next);
    if (workspace.activeProjectId === next.id) {
      await persistLatestActiveSnapshot(next, workspace.syncMode);
    }
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

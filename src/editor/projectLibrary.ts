import type { CloudGameMeta } from '../cloud/api';
import type { ProjectSpec } from '../model/types';
import type { StoredProjectRecord } from './projectPersistence';

export type ProjectPickerFilter = 'recent' | 'cloud' | 'local' | 'templates';
export type ProjectEntrySource = 'local' | 'cloud';
export type ProjectEntryStatus = 'local' | 'cloud' | 'unsynced';

export type ProjectLibraryEntry = {
  id: string;
  projectId: string;
  title: string;
  updatedAt: string;
  sceneCount: number;
  source: ProjectEntrySource;
  status: ProjectEntryStatus;
  isCurrent: boolean;
  cloudProjectId?: string;
};

export function formatProjectTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function countProjectScenes(project: ProjectSpec): number {
  return Object.keys(project.scenes ?? {}).length;
}

function resolveCloudGameSceneCount(game: CloudGameMeta & { project?: ProjectSpec }): number {
  if (game.project) {
    return countProjectScenes(game.project);
  }
  if (typeof game.scene_count === 'number' && Number.isFinite(game.scene_count)) {
    return Math.max(0, Math.floor(game.scene_count));
  }
  return 0;
}

export function buildCloudProjectLibraryEntry({
  game,
  isCurrent,
}: {
  game: CloudGameMeta & { project?: ProjectSpec };
  isCurrent: boolean;
}): ProjectLibraryEntry {
  return {
    id: game.id,
    projectId: game.id,
    title: game.title?.trim() || 'Untitled Project',
    updatedAt: game.updated_at,
    sceneCount: resolveCloudGameSceneCount(game),
    source: 'cloud',
    status: 'cloud',
    isCurrent,
    cloudProjectId: game.id,
  };
}

export function buildStoredProjectLibraryEntry({
  record,
  isCurrent,
}: {
  record: StoredProjectRecord;
  isCurrent: boolean;
}): ProjectLibraryEntry {
  return {
    id: record.id,
    projectId: record.projectId,
    title: record.title,
    updatedAt: record.updatedAt,
    sceneCount: countProjectScenes(record.project),
    source: record.origin === 'cloud-cache' || Boolean(record.cloudProjectId) ? 'cloud' : 'local',
    status: record.syncStatus,
    isCurrent,
    cloudProjectId: record.cloudProjectId,
  };
}

export function buildProjectPickerModel({
  localProjects,
  cloudProjects,
  activeProjectId,
  search,
  filter,
}: {
  localProjects: ProjectLibraryEntry[];
  cloudProjects: ProjectLibraryEntry[];
  activeProjectId: string | null;
  search: string;
  filter: ProjectPickerFilter;
}): {
  counts: { cloud: number; local: number; unsynced: number };
  visibleProjects: ProjectLibraryEntry[];
} {
  const normalizedSearch = search.trim().toLowerCase();
  const localProjectIds = new Set(localProjects.map((entry) => entry.id));
  const cloudProjectIds = new Set(cloudProjects.map((entry) => entry.id));
  const merged = [...localProjects, ...cloudProjects]
    .map((entry) => ({ ...entry, isCurrent: entry.id === activeProjectId }))
    .filter((entry) => {
      if (filter === 'cloud' && !cloudProjectIds.has(entry.id)) return false;
      if (filter === 'local' && !localProjectIds.has(entry.id)) return false;
      if (filter === 'templates') return false;
      if (!normalizedSearch) return true;
      return `${entry.title} ${entry.projectId}`.toLowerCase().includes(normalizedSearch);
    })
    .sort((a, b) => {
      const aMs = Date.parse(a.updatedAt);
      const bMs = Date.parse(b.updatedAt);
      if (Number.isFinite(aMs) && Number.isFinite(bMs) && aMs !== bMs) return bMs - aMs;
      return a.title.localeCompare(b.title);
    });

  return {
    counts: {
      cloud: cloudProjects.length,
      local: localProjects.length,
      unsynced: [...localProjects, ...cloudProjects].filter((entry) => entry.status === 'unsynced').length,
    },
    visibleProjects: merged,
  };
}

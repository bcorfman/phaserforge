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

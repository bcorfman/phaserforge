// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { buildStoredProjectRecord, mergeSnapshotWithLegacyActiveProject, type StoredProjectRecord } from '../../src/editor/projectPersistence';
import { createEmptyProject } from '../../src/model/emptyProject';

function record(overrides: Partial<StoredProjectRecord> = {}): StoredProjectRecord {
  const project = createEmptyProject();
  if (overrides.projectId) project.id = overrides.projectId;
  if (overrides.title) project.title = overrides.title;
  return {
    ...buildStoredProjectRecord(project),
    ...overrides,
  };
}

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

describe('projectPersistence legacy merge', () => {
  installLocalStorageMock();

  afterEach(() => {
    window.localStorage.clear();
  });

  it('prefers newer legacy YAML for the active project during startup', () => {
    const snapshot = {
      localProjects: [
        record({
          id: 'project-1',
          projectId: 'project-1',
          title: 'Enemy Formation',
          yaml: 'old',
          updatedAt: '2026-06-20T20:00:00.000Z',
          origin: 'local-only' as const,
          syncStatus: 'local' as const,
        }),
      ],
      workspace: { activeProjectId: 'project-1', syncMode: 'online' as const },
      preferences: null,
    };

    const merged = mergeSnapshotWithLegacyActiveProject(snapshot, record({
      id: 'project-1',
      projectId: 'project-1',
      title: 'Persisted Wing',
      yaml: 'new',
      updatedAt: '2026-06-20T20:05:00.000Z',
      origin: 'anonymous',
      syncStatus: 'local',
    }));

    expect(merged.localProjects[0]?.title).toBe('Persisted Wing');
    expect(merged.localProjects[0]?.yaml).toBe('new');
    expect(merged.localProjects[0]?.origin).toBe('local-only');
  });

  it('does not override a newer indexeddb active project with older legacy YAML', () => {
    const snapshot = {
      localProjects: [
        record({
          id: 'project-1',
          projectId: 'project-1',
          title: 'Persisted Wing',
          yaml: 'new',
          updatedAt: '2026-06-20T20:05:00.000Z',
        }),
      ],
      workspace: { activeProjectId: 'project-1', syncMode: 'online' as const },
      preferences: null,
    };

    const merged = mergeSnapshotWithLegacyActiveProject(snapshot, record({
      id: 'project-1',
      projectId: 'project-1',
      title: 'Enemy Formation',
      yaml: 'old',
      updatedAt: '2026-06-20T20:00:00.000Z',
      origin: 'anonymous',
      syncStatus: 'local',
    }));

    expect(merged.localProjects[0]?.title).toBe('Persisted Wing');
    expect(merged.localProjects[0]?.yaml).toBe('new');
  });

  it('merges newer legacy YAML into the active cloud-cache project when ids differ but projectId matches', () => {
    const snapshot = {
      localProjects: [
        record({
          id: 'cloud:g1',
          projectId: 'project-1',
          title: 'Pattern Demo',
          yaml: 'old-cloud-yaml',
          updatedAt: '2026-06-20T20:00:00.000Z',
          origin: 'cloud-cache' as const,
          syncStatus: 'cloud' as const,
          cloudProjectId: 'g1',
          revisions: [record({
            id: 'rev-like',
            projectId: 'project-1',
            yaml: 'old-cloud-yaml',
            updatedAt: '2026-06-20T20:00:00.000Z',
          }).revisions![0]],
        }),
      ],
      workspace: { activeProjectId: 'cloud:g1', syncMode: 'online' as const },
      preferences: null,
    };

    const latestProject = createEmptyProject();
    latestProject.title = 'Pattern Demo';
    latestProject.audio.sounds.theme = {
      id: 'theme',
      source: {
        kind: 'embedded',
        dataUrl: 'data:audio/mp3;base64,AAAA',
        originalName: 'pattern-theme.mp3',
        mimeType: 'audio/mpeg',
      },
    };
    latestProject.publishTitle = 'Pattern Demo';

    const merged = mergeSnapshotWithLegacyActiveProject(snapshot, buildStoredProjectRecord(latestProject, {
      id: latestProject.id,
      projectId: latestProject.id,
      updatedAt: '2026-06-20T20:05:00.000Z',
      origin: 'anonymous',
      syncStatus: 'local',
    }));

    expect(merged.localProjects[0]?.id).toBe('cloud:g1');
    expect(merged.localProjects[0]?.projectId).toBe('project-1');
    expect(merged.localProjects[0]?.title).toBe('Pattern Demo');
    expect(merged.localProjects[0]?.yaml).not.toBe('old-cloud-yaml');
    expect(merged.localProjects[0]?.cloudProjectId).toBe('g1');
    expect(merged.localProjects[0]?.revisions?.[0]?.updatedAt).toBe('2026-06-20T20:05:00.000Z');
  });
});

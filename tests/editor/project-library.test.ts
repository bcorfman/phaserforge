import { describe, expect, it } from 'vitest';
import {
  buildCloudProjectLibraryEntry,
  buildProjectPickerModel,
  buildStoredProjectLibraryEntry,
  type ProjectLibraryEntry,
} from '../../src/editor/projectLibrary';
import { createEmptyGameScene, createEmptyProject } from '../../src/model/emptyProject';

function entry(overrides: Partial<ProjectLibraryEntry> = {}): ProjectLibraryEntry {
  return {
    id: 'local:1',
    projectId: 'project-1',
    title: 'Untitled',
    updatedAt: '2026-06-05T10:00:00.000Z',
    sceneCount: 1,
    source: 'local',
    status: 'local',
    isCurrent: false,
    ...overrides,
  };
}

describe('projectLibrary helpers', () => {
  it('uses live cloud project scenes ahead of metadata scene counts', () => {
    const project = createEmptyProject();
    project.scenes['scene-2'] = createEmptyGameScene('scene-2');
    const entry = buildCloudProjectLibraryEntry({
      game: {
        id: 'game-pattern',
        title: 'Pattern Demo',
        created_at: '2026-07-12T16:43:00.000Z',
        updated_at: '2026-07-12T16:43:00.000Z',
        scene_count: 1,
        project,
      },
      isCurrent: true,
    });

    expect(entry).toEqual({
      id: 'game-pattern',
      projectId: 'game-pattern',
      title: 'Pattern Demo',
      updatedAt: '2026-07-12T16:43:00.000Z',
      sceneCount: 2,
      source: 'cloud',
      status: 'cloud',
      isCurrent: true,
      cloudProjectId: 'game-pattern',
    });
  });

  it('uses cloud metadata scene counts only when no project is loaded', () => {
    expect(buildCloudProjectLibraryEntry({
      game: {
        id: 'game-metadata',
        title: 'Metadata Only',
        created_at: '2026-07-12T16:43:00.000Z',
        updated_at: '2026-07-12T16:44:00.000Z',
        scene_count: 3,
      },
      isCurrent: false,
    }).sceneCount).toBe(3);
  });

  it('uses live stored project scenes ahead of persisted scene counts', () => {
    const project = createEmptyProject();
    project.scenes['scene-2'] = createEmptyGameScene('scene-2');

    expect(buildStoredProjectLibraryEntry({
      record: {
        id: 'local-pattern',
        projectId: 'project-pattern',
        title: 'Pattern Demo',
        project,
        updatedAt: '2026-07-12T16:44:00.000Z',
        sceneCount: 0,
        origin: 'local-only',
        syncStatus: 'local',
      },
      isCurrent: true,
    }).sceneCount).toBe(2);
  });

  it('sorts recent projects by most recently updated first', () => {
    const model = buildProjectPickerModel({
      localProjects: [
        entry({ id: 'local:a', title: 'Older', updatedAt: '2026-06-04T10:00:00.000Z' }),
        entry({ id: 'local:b', title: 'Newest', updatedAt: '2026-06-05T12:00:00.000Z' }),
      ],
      cloudProjects: [
        entry({ id: 'cloud:a', title: 'Middle', source: 'cloud', status: 'cloud', updatedAt: '2026-06-05T11:00:00.000Z' }),
      ],
      activeProjectId: 'local:b',
      search: '',
      filter: 'recent',
    });

    expect(model.visibleProjects.map((item) => item.title)).toEqual(['Newest', 'Middle', 'Older']);
    expect(model.visibleProjects[0]?.isCurrent).toBe(true);
  });

  it('filters by source and search text', () => {
    const model = buildProjectPickerModel({
      localProjects: [
        entry({ id: 'local:a', title: 'Local Debug Copy' }),
        entry({ id: 'local:b', title: 'Laser Gates Offline' }),
      ],
      cloudProjects: [
        entry({ id: 'cloud:a', title: 'Laser Gates Iteration', source: 'cloud', status: 'cloud' }),
      ],
      activeProjectId: null,
      search: 'laser',
      filter: 'local',
    });

    expect(model.visibleProjects.map((item) => item.title)).toEqual(['Laser Gates Offline']);
    expect(model.counts.local).toBe(2);
    expect(model.counts.cloud).toBe(1);
  });

  it('keeps locally stored cloud-linked projects visible on the local filter', () => {
    const model = buildProjectPickerModel({
      localProjects: [
        entry({
          id: 'cloud:cached-a',
          projectId: 'game-a',
          title: 'Cloud Cached Locally',
          source: 'cloud',
          status: 'cloud',
        }),
      ],
      cloudProjects: [
        entry({
          id: 'game-a',
          projectId: 'game-a',
          title: 'Cloud Remote Copy',
          source: 'cloud',
          status: 'cloud',
        }),
      ],
      activeProjectId: null,
      search: '',
      filter: 'local',
    });

    expect(model.counts.local).toBe(1);
    expect(model.visibleProjects.map((item) => item.id)).toEqual(['cloud:cached-a']);
  });
});

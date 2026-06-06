import { describe, expect, it } from 'vitest';
import { buildProjectPickerModel, type ProjectLibraryEntry } from '../../src/editor/projectLibrary';

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
});

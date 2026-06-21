import { describe, expect, it } from 'vitest';
import { sampleProject } from '../../src/model/sampleProject';
import {
  appendProjectRevision,
  buildCopyRevisionDefaultName,
  buildProjectTreeRows,
  buildRestoreRevisionStatus,
  createProjectRevision,
  formatProjectRevisionTimestamp,
  formatProjectRevisionSummary,
} from '../../src/editor/projectTreeHistory';

describe('project tree + history helpers', () => {
  it('derives a project root row followed by scene rows', () => {
    const rows = buildProjectTreeRows(sampleProject, sampleProject.initialSceneId);

    expect(rows[0]).toMatchObject({
      kind: 'project',
      id: sampleProject.id,
      label: 'Untitled Project',
    });
    expect(rows.slice(1).map((row) => row.id)).toEqual(Object.keys(sampleProject.scenes));
    expect(rows[1]).toMatchObject({ kind: 'scene', isCurrent: true });
  });

  it('formats revision summaries with reason, counts, and starting scene detail', () => {
    const project = structuredClone(sampleProject);
    project.scenes[project.initialSceneId].entities.e2.name = 'Player Spawn';
    project.scenes[project.initialSceneId].entities.e3.name = 'Boss Gate';
    const revision = createProjectRevision(project, {
      id: 'rev-1',
      updatedAt: '2026-06-17T10:12:00.000Z',
    });

    expect(formatProjectRevisionSummary(revision)).toBe('Autosave checkpoint · 1 scene · 15 entities · Start: scene-1');
    expect(formatProjectRevisionTimestamp(revision)).toMatch(/^Jun 17, (6|10):12 AM$/);
  });

  it('builds a copy default name from the revision date', () => {
    const revision = createProjectRevision(sampleProject, {
      id: 'rev-1',
      updatedAt: '2026-06-17T10:12:00.000Z',
    });

    expect(buildCopyRevisionDefaultName(sampleProject.title, revision)).toBe('Untitled Project - Copy from Jun 17');
  });

  it('builds restore success messaging from revision metadata', () => {
    const revision = createProjectRevision(sampleProject, {
      id: 'rev-1',
      updatedAt: '2026-06-17T10:12:00.000Z',
    });

    expect(buildRestoreRevisionStatus(revision)).toEqual({
      message: 'Restored revision from Jun 17 as the new current project.',
    });
  });

  it('prepends revisions and keeps the newest items within the limit', () => {
    const older = createProjectRevision(sampleProject, { id: 'older', updatedAt: '2026-06-17T10:12:00.000Z' });
    const newer = createProjectRevision(sampleProject, { id: 'newer', updatedAt: '2026-06-18T10:12:00.000Z' });

    const revisions = appendProjectRevision([older], newer, 1);

    expect(revisions).toEqual([newer]);
  });
});

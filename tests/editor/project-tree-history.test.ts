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

  it('formats the oldest revision as an initial snapshot summary', () => {
    const project = structuredClone(sampleProject);
    project.scenes[project.initialSceneId].entities.e2.name = 'Player Spawn';
    project.scenes[project.initialSceneId].entities.e3.name = 'Boss Gate';
    const revision = createProjectRevision(project, {
      id: 'rev-1',
      updatedAt: '2026-06-17T10:12:00.000Z',
    });

    expect(formatProjectRevisionSummary(revision)).toBe('Initial snapshot · 1 scene · 15 entities');
    expect(formatProjectRevisionTimestamp(revision)).toMatch(/^Jun 17, (6|10):12 AM$/);
  });

  it('formats revision summaries as meaningful diffs against the previous version', () => {
    const olderProject = structuredClone(sampleProject);
    const newerProject = structuredClone(sampleProject);
    newerProject.title = 'Pattern Demo';
    newerProject.scenes[newerProject.initialSceneId].entities.e16 = {
      id: 'e16',
      name: 'Checkpoint',
      x: 128,
      y: 96,
      width: 16,
      height: 16,
    };

    const olderRevision = createProjectRevision(olderProject, {
      id: 'rev-older',
      updatedAt: '2026-06-17T10:11:00.000Z',
    });
    const newerRevision = createProjectRevision(newerProject, {
      id: 'rev-newer',
      updatedAt: '2026-06-17T10:12:00.000Z',
    });

    expect(formatProjectRevisionSummary(newerRevision, olderRevision)).toBe('Renamed to Pattern Demo · 1 entity added');
  });

  it('collapses insignificant revisions into a minor edits label', () => {
    const olderProject = structuredClone(sampleProject);
    const newerProject = structuredClone(sampleProject);
    newerProject.scenes[newerProject.initialSceneId].entities.e2.name = 'Player Spawn';

    const olderRevision = createProjectRevision(olderProject, {
      id: 'rev-older',
      updatedAt: '2026-06-17T10:11:00.000Z',
    });
    const newerRevision = createProjectRevision(newerProject, {
      id: 'rev-newer',
      updatedAt: '2026-06-17T10:12:00.000Z',
    });

    expect(formatProjectRevisionSummary(newerRevision, olderRevision)).toBe('Minor edits');
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

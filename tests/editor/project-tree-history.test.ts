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
  materializeProjectRevision,
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

  it('surfaces concrete entity edits before falling back to a scene-level summary', () => {
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

    expect(formatProjectRevisionSummary(newerRevision, olderRevision)).toBe('Named entity Player Spawn');
  });

  it('surfaces audio library and music assignment changes in revision summaries', () => {
    const olderProject = structuredClone(sampleProject);
    const newerProject = structuredClone(sampleProject);
    newerProject.audio.sounds.theme = {
      id: 'theme',
      source: {
        kind: 'embedded',
        dataUrl: 'data:audio/mp3;base64,AAAA',
        originalName: 'pattern-theme.mp3',
        mimeType: 'audio/mpeg',
      },
    };
    newerProject.scenes[newerProject.initialSceneId].music = {
      assetId: 'theme',
      loop: true,
      volume: 0.65,
      fadeMs: 250,
    };

    const olderRevision = createProjectRevision(olderProject, {
      id: 'rev-older',
      updatedAt: '2026-06-17T10:11:00.000Z',
    });
    const newerRevision = createProjectRevision(newerProject, {
      id: 'rev-newer',
      updatedAt: '2026-06-17T10:12:00.000Z',
    });

    expect(formatProjectRevisionSummary(newerRevision, olderRevision)).toBe('Added audio pattern-theme.mp3 · Music -> pattern-theme.mp3');
  });

  it('surfaces named scene system changes like triggers before broad scene fallbacks', () => {
    const olderProject = structuredClone(sampleProject);
    const newerProject = structuredClone(sampleProject);
    newerProject.scenes[newerProject.initialSceneId].triggers = [{
      id: 'trigger-1',
      name: 'Exit Gate',
      rect: { x: 10, y: 20, width: 30, height: 40 },
      onEnter: { callId: 'scene.goto', args: { sceneId: 'next-scene' } },
    }];

    const olderRevision = createProjectRevision(olderProject, {
      id: 'rev-older',
      updatedAt: '2026-06-17T10:11:00.000Z',
    });
    const newerRevision = createProjectRevision(newerProject, {
      id: 'rev-newer',
      updatedAt: '2026-06-17T10:12:00.000Z',
    });

    expect(formatProjectRevisionSummary(newerRevision, olderRevision)).toBe('Added trigger Exit Gate');
  });

  it('surfaces named publish metadata changes before generic project fallbacks', () => {
    const olderProject = structuredClone(sampleProject);
    const newerProject = structuredClone(sampleProject);
    newerProject.publishTitle = 'Published Pattern Demo';

    const olderRevision = createProjectRevision(olderProject, {
      id: 'rev-older',
      updatedAt: '2026-06-17T10:11:00.000Z',
    });
    const newerRevision = createProjectRevision(newerProject, {
      id: 'rev-newer',
      updatedAt: '2026-06-17T10:12:00.000Z',
    });

    expect(formatProjectRevisionSummary(newerRevision, olderRevision)).toBe('Set publish title to Published Pattern Demo');
  });

  it('surfaces named project-wide system changes like input maps before generic project settings', () => {
    const olderProject = structuredClone(sampleProject);
    const newerProject = structuredClone(sampleProject);
    newerProject.inputMaps.player = {
      actions: {
        jump: [{ device: 'keyboard', key: 'Space', event: 'down' }],
      },
    };

    const olderRevision = createProjectRevision(olderProject, {
      id: 'rev-older',
      updatedAt: '2026-06-17T10:11:00.000Z',
    });
    const newerRevision = createProjectRevision(newerProject, {
      id: 'rev-newer',
      updatedAt: '2026-06-17T10:12:00.000Z',
    });

    expect(formatProjectRevisionSummary(newerRevision, olderRevision)).toBe('Added input map player');
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

    expect(revisions).toHaveLength(1);
    expect(revisions[0].id).toBe('newer');
  });

  it('coalesces nearby autosaves when they continue the same entity editing burst', () => {
    const baseProject = structuredClone(sampleProject);
    const firstEdit = structuredClone(sampleProject);
    firstEdit.scenes[firstEdit.initialSceneId].entities.e2.name = 'Player Spawn';
    const secondEdit = structuredClone(firstEdit);
    secondEdit.scenes[secondEdit.initialSceneId].entities.e2.x += 24;

    const baseRevision = createProjectRevision(baseProject, {
      id: 'rev-base',
      updatedAt: '2026-06-17T10:10:00.000Z',
    });
    const firstRevision = createProjectRevision(firstEdit, {
      id: 'rev-first',
      updatedAt: '2026-06-17T10:10:20.000Z',
      reason: 'autosave',
    });
    const secondRevision = createProjectRevision(secondEdit, {
      id: 'rev-second',
      updatedAt: '2026-06-17T10:10:45.000Z',
      reason: 'autosave',
    });

    const revisions = appendProjectRevision([firstRevision, baseRevision], secondRevision, 25);

    expect(revisions.map((revision) => revision.id)).toEqual(['rev-second', 'rev-base']);
  });

  it('coalesces nearby autosaves when they continue the same counter editing burst', () => {
    const baseProject = structuredClone(sampleProject);
    const firstEdit = structuredClone(sampleProject);
    firstEdit.counters = {
      score: {
        id: 'score',
        name: 'Score',
        scope: 'global',
        value: 0,
      },
    };
    const secondEdit = structuredClone(firstEdit);
    secondEdit.counters!.score.value = 5;

    const baseRevision = createProjectRevision(baseProject, {
      id: 'rev-base',
      updatedAt: '2026-06-17T10:10:00.000Z',
    });
    const firstRevision = createProjectRevision(firstEdit, {
      id: 'rev-first',
      updatedAt: '2026-06-17T10:10:20.000Z',
      reason: 'autosave',
    });
    const secondRevision = createProjectRevision(secondEdit, {
      id: 'rev-second',
      updatedAt: '2026-06-17T10:10:45.000Z',
      reason: 'autosave',
    });

    const revisions = appendProjectRevision([firstRevision, baseRevision], secondRevision, 25);

    expect(revisions.map((revision) => revision.id)).toEqual(['rev-second', 'rev-base']);
  });

  it('coalesces nearby autosaves when they continue the same collision-rule editing burst', () => {
    const baseProject = structuredClone(sampleProject);
    const firstEdit = structuredClone(sampleProject);
    firstEdit.scenes[firstEdit.initialSceneId].collisionRules = [{
      id: 'player-vs-enemies',
      a: { type: 'layer', layer: 'player' },
      b: { type: 'layer', layer: 'enemies' },
      interaction: 'overlap',
    }];
    const secondEdit = structuredClone(firstEdit);
    secondEdit.scenes[secondEdit.initialSceneId].collisionRules![0].onEnter = {
      callId: 'scene.flash',
      args: { durationMs: 120 },
    };

    const baseRevision = createProjectRevision(baseProject, {
      id: 'rev-base',
      updatedAt: '2026-06-17T10:10:00.000Z',
    });
    const firstRevision = createProjectRevision(firstEdit, {
      id: 'rev-first',
      updatedAt: '2026-06-17T10:10:20.000Z',
      reason: 'autosave',
    });
    const secondRevision = createProjectRevision(secondEdit, {
      id: 'rev-second',
      updatedAt: '2026-06-17T10:10:45.000Z',
      reason: 'autosave',
    });

    const revisions = appendProjectRevision([firstRevision, baseRevision], secondRevision, 25);

    expect(revisions.map((revision) => revision.id)).toEqual(['rev-second', 'rev-base']);
  });

  it('coalesces nearby autosaves when they continue the same event-block editing burst', () => {
    const baseProject = structuredClone(sampleProject);
    const firstEdit = structuredClone(sampleProject);
    firstEdit.scenes[firstEdit.initialSceneId].eventBlocks = {
      'wave-start': {
        id: 'wave-start',
        name: 'Wave Start',
        target: { type: 'group', groupId: 'g-enemies' },
      },
    };
    firstEdit.scenes[firstEdit.initialSceneId].attachments['att-loop'].eventId = 'wave-start';
    const secondEdit = structuredClone(firstEdit);
    secondEdit.scenes[secondEdit.initialSceneId].eventBlocks!['wave-start'].name = 'Opening Wave';

    const baseRevision = createProjectRevision(baseProject, {
      id: 'rev-base',
      updatedAt: '2026-06-17T10:10:00.000Z',
    });
    const firstRevision = createProjectRevision(firstEdit, {
      id: 'rev-first',
      updatedAt: '2026-06-17T10:10:20.000Z',
      reason: 'autosave',
    });
    const secondRevision = createProjectRevision(secondEdit, {
      id: 'rev-second',
      updatedAt: '2026-06-17T10:10:45.000Z',
      reason: 'autosave',
    });

    const revisions = appendProjectRevision([firstRevision, baseRevision], secondRevision, 25);

    expect(revisions.map((revision) => revision.id)).toEqual(['rev-second', 'rev-base']);
  });

  it('coalesces nearby autosaves when they continue the same image asset editing burst', () => {
    const baseProject = structuredClone(sampleProject);
    const firstEdit = structuredClone(sampleProject);
    firstEdit.assets.images.hero = {
      id: 'hero',
      source: {
        kind: 'embedded',
        dataUrl: 'data:image/png;base64,AAAA',
        mimeType: 'image/png',
        originalName: 'hero.png',
      },
      name: 'Hero',
      width: 16,
      height: 16,
    };
    const secondEdit = structuredClone(firstEdit);
    secondEdit.assets.images.hero.name = 'Hero Idle';

    const baseRevision = createProjectRevision(baseProject, {
      id: 'rev-base',
      updatedAt: '2026-06-17T10:10:00.000Z',
    });
    const firstRevision = createProjectRevision(firstEdit, {
      id: 'rev-first',
      updatedAt: '2026-06-17T10:10:20.000Z',
      reason: 'autosave',
    });
    const secondRevision = createProjectRevision(secondEdit, {
      id: 'rev-second',
      updatedAt: '2026-06-17T10:10:45.000Z',
      reason: 'autosave',
    });

    const revisions = appendProjectRevision([firstRevision, baseRevision], secondRevision, 25);

    expect(revisions.map((revision) => revision.id)).toEqual(['rev-second', 'rev-base']);
  });

  it('splits autosaves when the user switches to an unrelated editing domain', () => {
    const baseProject = structuredClone(sampleProject);
    const audioEdit = structuredClone(sampleProject);
    audioEdit.audio.sounds.theme = {
      id: 'theme',
      source: {
        kind: 'embedded',
        dataUrl: 'data:audio/mp3;base64,AAAA',
        originalName: 'pattern-theme.mp3',
        mimeType: 'audio/mpeg',
      },
    };
    audioEdit.scenes[audioEdit.initialSceneId].music = {
      assetId: 'theme',
      loop: true,
      volume: 0.65,
      fadeMs: 250,
    };
    const publishEdit = structuredClone(audioEdit);
    publishEdit.publishTitle = 'Pattern Demo';

    const baseRevision = createProjectRevision(baseProject, {
      id: 'rev-base',
      updatedAt: '2026-06-17T10:10:00.000Z',
    });
    const audioRevision = createProjectRevision(audioEdit, {
      id: 'rev-audio',
      updatedAt: '2026-06-17T10:10:20.000Z',
      reason: 'autosave',
    });
    const publishRevision = createProjectRevision(publishEdit, {
      id: 'rev-publish',
      updatedAt: '2026-06-17T10:10:45.000Z',
      reason: 'autosave',
    });

    const revisions = appendProjectRevision([audioRevision, baseRevision], publishRevision, 25);

    expect(revisions.map((revision) => revision.id)).toEqual(['rev-publish', 'rev-audio', 'rev-base']);
  });

  it('stores later revisions as deltas against the previous checkpoint instead of full snapshots', () => {
    const baseProject = structuredClone(sampleProject);
    const newerProject = structuredClone(sampleProject);
    newerProject.title = 'Pattern Demo';
    newerProject.publishGithubPagesRepo = 'zoof';

    const baseRevision = createProjectRevision(baseProject, {
      id: 'rev-base',
      updatedAt: '2026-06-17T10:10:00.000Z',
    });
    const newerRevision = createProjectRevision(newerProject, {
      id: 'rev-newer',
      updatedAt: '2026-06-17T10:11:00.000Z',
    });

    const revisions = appendProjectRevision([baseRevision], newerRevision, 25);

    expect(revisions[0]).toMatchObject({
      id: 'rev-newer',
      kind: 'delta',
      baseRevisionId: 'rev-base',
    });
    expect(revisions[0].project).toBeUndefined();
    expect(revisions[0].patch).toBeTruthy();
  });

  it('materializes delta revisions back into full projects for preview, copy, and restore flows', () => {
    const baseProject = structuredClone(sampleProject);
    const renamedProject = structuredClone(sampleProject);
    renamedProject.title = 'Pattern Demo';
    renamedProject.publishGithubPagesRepo = 'zoof';

    const baseRevision = createProjectRevision(baseProject, {
      id: 'rev-base',
      updatedAt: '2026-06-17T10:10:00.000Z',
    });
    const renamedRevision = createProjectRevision(renamedProject, {
      id: 'rev-renamed',
      updatedAt: '2026-06-17T10:11:00.000Z',
    });

    const revisions = appendProjectRevision([baseRevision], renamedRevision, 25);

    expect(materializeProjectRevision(revisions, 'rev-base')).toEqual(baseProject);
    expect(materializeProjectRevision(revisions, 'rev-renamed')).toEqual(renamedProject);
  });
});

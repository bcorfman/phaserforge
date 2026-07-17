import { describe, expect, it } from 'vitest';
import { initState, reducer } from '../../src/editor/EditorStore';
import { sampleProject } from '../../src/model/sampleProject';

function seededState() {
  const base = initState();
  return {
    ...base,
    project: sampleProject,
    currentSceneId: sampleProject.initialSceneId,
    expandedGroups: { 'g-enemies': false },
  };
}

describe('formation draft workflow', () => {
  it('begins a formation draft from an existing sprite template and commits it into a new group', () => {
    const state = seededState();
    const started = reducer(state, { type: 'begin-formation-draft', template: { kind: 'entity', entityId: 'e1' } } as any);
    expect(started.formationDraft).toBeTruthy();
    expect(started.formationDraft?.template).toEqual({ kind: 'entity', entityId: 'e1' });

    const updated = reducer(started, {
      type: 'update-formation-draft',
      patch: {
        name: 'Raid Wing',
        arrangeKind: 'grid',
        memberCount: 12,
        params: { rows: 2, cols: 2, spacing: 20, centerX: 512, centerY: 384 },
      },
    } as any);

    const committed = reducer(updated, { type: 'commit-formation-draft' } as any);
    expect(committed.formationDraft).toBeUndefined();

    const scene: any = committed.project.scenes[committed.currentSceneId];
    const createdGroup = scene.groups['g-raid-wing'];
    expect(createdGroup).toBeTruthy();
    expect(createdGroup.members).toHaveLength(4);
    expect(committed.selection).toEqual({ kind: 'group', id: 'g-raid-wing' });
  });

  it('commits a scatter draft as one undoable formation with deterministic member tints', () => {
    const state = seededState();
    const templateBefore = (state.project.scenes[state.currentSceneId] as any).entities.e1;
    const started = reducer(state, { type: 'begin-formation-draft', template: { kind: 'entity', entityId: 'e1' } } as any);
    const updated = reducer(started, {
      type: 'update-formation-draft',
      patch: {
        name: 'Stars Blink 1',
        arrangeKind: 'scatter',
        memberCount: 80,
        params: {
          minX: 0,
          maxX: 720,
          minY: 5,
          maxY: 1285,
          seed: 'stars-1',
          randomTint: true,
          tintMinR: 20,
          tintMaxR: 255,
          tintMinG: 20,
          tintMaxG: 255,
          tintMinB: 20,
          tintMaxB: 255,
        },
      },
    } as any);

    const committed = reducer(updated, { type: 'commit-formation-draft' } as any);
    const scene: any = committed.project.scenes[committed.currentSceneId];
    const group = scene.groups['g-stars-blink-1'];
    const members = group.members.map((id: string) => scene.entities[id]);

    expect(group.members).toHaveLength(80);
    expect(new Set(group.members).size).toBe(80);
    expect(group.layout).toEqual({
      type: 'arrange',
      arrangeKind: 'scatter',
      params: updated.formationDraft?.params,
    });
    expect(members.every((entity: any) => entity.x >= 0 && entity.x <= 720 && entity.y >= 5 && entity.y <= 1285)).toBe(true);
    expect(members.every((entity: any) => Number.isInteger(entity.tint) && entity.tint >= 0x141414 && entity.tint <= 0xffffff)).toBe(true);
    expect(scene.entities.e1).toEqual(templateBefore);

    const undone = reducer(committed, { type: 'history-undo' } as any);
    expect((undone.project.scenes[undone.currentSceneId] as any).groups['g-stars-blink-1']).toBeUndefined();
    const redone = reducer(undone, { type: 'history-redo' } as any);
    expect((redone.project.scenes[redone.currentSceneId] as any).groups['g-stars-blink-1'].members).toHaveLength(80);
  });
});

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
});


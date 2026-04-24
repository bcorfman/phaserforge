import { describe, expect, it, vi } from 'vitest';
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

function sceneOf(state: any) {
  return state.project.scenes[state.currentSceneId];
}

describe('EditorStore history', () => {
  it('undo/redo restores scene content and selection metadata', () => {
    const state0 = reducer(seededState(), { type: 'select', selection: { kind: 'entity', id: 'e1' } } as any);
    const scene0 = sceneOf(state0);

    const state1 = reducer(state0, {
      type: 'update-entity',
      id: 'e1',
      next: { ...scene0.entities.e1, x: scene0.entities.e1.x + 100 },
    });
    expect(sceneOf(state1).entities.e1.x).toBe(scene0.entities.e1.x + 100);
    expect(state1.history.past).toHaveLength(1);

    const undone = reducer(state1, { type: 'history-undo' } as any);
    expect(sceneOf(undone).entities.e1.x).toBe(scene0.entities.e1.x);
    expect(undone.selection).toEqual({ kind: 'entity', id: 'e1' });
    expect(undone.history.past).toHaveLength(0);
    expect(undone.history.future).toHaveLength(1);

    const redone = reducer(undone, { type: 'history-redo' } as any);
    expect(sceneOf(redone).entities.e1.x).toBe(scene0.entities.e1.x + 100);
    expect(redone.selection).toEqual({ kind: 'entity', id: 'e1' });
    expect(redone.history.past).toHaveLength(1);
    expect(redone.history.future).toHaveLength(0);
  });

  it('undo restores deleted scene graph items', () => {
    const state0 = seededState();
    const scene0 = sceneOf(state0);
    expect(scene0.entities.e1).toBeDefined();

    const removed = reducer(state0, { type: 'remove-scene-graph-item', item: { kind: 'entity', id: 'e1' } } as any);
    expect(sceneOf(removed).entities.e1).toBeUndefined();
    expect(removed.history.past).toHaveLength(1);

    const undone = reducer(removed, { type: 'history-undo' } as any);
    expect(sceneOf(undone).entities.e1).toBeDefined();
  });

  it('undo/redo works for project-scoped scene creation', () => {
    const state0 = seededState();
    const beforeSceneIds = Object.keys(state0.project.scenes);
    const created = reducer(state0, { type: 'create-scene' } as any);
    expect(Object.keys(created.project.scenes).length).toBe(beforeSceneIds.length + 1);
    expect(created.history.past).toHaveLength(1);

    const undone = reducer(created, { type: 'history-undo' } as any);
    expect(Object.keys(undone.project.scenes)).toEqual(beforeSceneIds);
    expect(undone.currentSceneId).toBe(state0.currentSceneId);

    const redone = reducer(undone, { type: 'history-redo' } as any);
    expect(Object.keys(redone.project.scenes).length).toBe(beforeSceneIds.length + 1);
  });

  it('batches canvas drags into a single history entry', () => {
    const state0 = reducer(seededState(), { type: 'select', selection: { kind: 'entity', id: 'e1' } } as any);
    const x0 = sceneOf(state0).entities.e1.x;
    const y0 = sceneOf(state0).entities.e1.y;

    const state1 = reducer(state0, { type: 'begin-canvas-interaction', kind: 'entity', id: 'e1' } as any);
    const state2 = reducer(state1, { type: 'move-entity', id: 'e1', dx: 10, dy: 0 } as any);
    const state3 = reducer(state2, { type: 'move-entity', id: 'e1', dx: 0, dy: 20 } as any);
    const state4 = reducer(state3, { type: 'end-canvas-interaction' } as any);

    expect(sceneOf(state4).entities.e1.x).toBe(x0 + 10);
    expect(sceneOf(state4).entities.e1.y).toBe(y0 + 20);
    expect(state4.history.past).toHaveLength(1);

    const undone = reducer(state4, { type: 'history-undo' } as any);
    expect(sceneOf(undone).entities.e1.x).toBe(x0);
    expect(sceneOf(undone).entities.e1.y).toBe(y0);
  });

  it('merges consecutive nudges within the merge window', () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_700_000_000_000)
      .mockReturnValueOnce(1_700_000_000_100);

    const state0 = reducer(seededState(), { type: 'select', selection: { kind: 'entity', id: 'e1' } } as any);
    const x0 = sceneOf(state0).entities.e1.x;

    const state1 = reducer(state0, { type: 'move-entity', id: 'e1', dx: 1, dy: 0 } as any);
    const state2 = reducer(state1, { type: 'move-entity', id: 'e1', dx: 1, dy: 0 } as any);

    expect(sceneOf(state2).entities.e1.x).toBe(x0 + 2);
    expect(state2.history.past).toHaveLength(1);

    const undone = reducer(state2, { type: 'history-undo' } as any);
    expect(sceneOf(undone).entities.e1.x).toBe(x0);

    // Outside merge window -> new entry
    (Date.now as any).mockReturnValueOnce(1_700_000_001_000);
    const state3 = reducer(state2, { type: 'move-entity', id: 'e1', dx: 1, dy: 0 } as any);
    expect(state3.history.past).toHaveLength(2);
  });

  it('batches alt-drag duplication and movement into a single history entry', () => {
    const state0 = reducer(seededState(), { type: 'select', selection: { kind: 'entity', id: 'e1' } } as any);
    const scene0 = sceneOf(state0);
    const entityCount0 = Object.keys(scene0.entities).length;

    const state1 = reducer(state0, { type: 'begin-canvas-interaction', kind: 'entity', id: 'e1' } as any);
    const state2 = reducer(state1, { type: 'duplicate-entities', entityIds: ['e1'] } as any);
    expect(Object.keys(sceneOf(state2).entities).length).toBe(entityCount0 + 1);

    const selection = state2.selection;
    if (selection.kind !== 'entity') throw new Error('Expected entity selection');
    const duplicateId = selection.id;

    const state3 = reducer(state2, { type: 'move-entity', id: duplicateId, dx: 12, dy: 0 } as any);
    const state4 = reducer(state3, { type: 'end-canvas-interaction' } as any);

    expect(state4.history.past).toHaveLength(1);

    const undone = reducer(state4, { type: 'history-undo' } as any);
    expect(Object.keys(sceneOf(undone).entities).length).toBe(entityCount0);
    expect(sceneOf(undone).entities[duplicateId]).toBeUndefined();
  });
});

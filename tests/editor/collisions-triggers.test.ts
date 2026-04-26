import { describe, expect, it } from 'vitest';
import { initState, reducer } from '../../src/editor/EditorStore';

function sceneOf(state: any) {
  return state.project.scenes[state.currentSceneId];
}

describe('Phase 7 collisions + triggers reducers', () => {
  it('adds a trigger zone and selects it', () => {
    const state = initState();
    const next = reducer(state, { type: 'add-trigger-zone' } as any);
    const scene = sceneOf(next);

    expect(Array.isArray(scene.triggers)).toBe(true);
    expect(scene.triggers).toHaveLength(1);
    expect(next.selection.kind).toBe('trigger');
    if (next.selection.kind !== 'trigger') throw new Error('expected trigger selection');
    expect(scene.triggers[0].id).toBe(next.selection.id);
  });

  it('removes a trigger zone and clears selection', () => {
    const state = initState();
    const added = reducer(state, { type: 'add-trigger-zone' } as any);
    if (added.selection.kind !== 'trigger') throw new Error('expected trigger selection');
    const id = added.selection.id;

    const next = reducer(added, { type: 'remove-trigger-zone', id } as any);
    const scene = sceneOf(next);
    expect(scene.triggers ?? []).toHaveLength(0);
    expect(next.selection).toEqual({ kind: 'none' });
  });

  it('adds a collision rule with a stable id', () => {
    const state = initState();
    const next = reducer(state, { type: 'add-collision-rule' } as any);
    const scene = sceneOf(next);
    expect(Array.isArray(scene.collisionRules)).toBe(true);
    expect(scene.collisionRules).toHaveLength(1);
    expect(typeof scene.collisionRules[0].id).toBe('string');
    expect(scene.collisionRules[0].id.length).toBeGreaterThan(0);
  });
});


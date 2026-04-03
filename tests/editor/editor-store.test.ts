import { describe, expect, it } from 'vitest';
import { reducer, initState, type EditorAction } from '../../src/editor/EditorStore';
import { sampleScene } from '../../src/model/sampleScene';

describe('EditorStore reducer', () => {
  it('moves entity by delta', () => {
    const state = initState();
    const action: EditorAction = { type: 'move-entity', id: 'e1', dx: 10, dy: 20 };
    const next = reducer(state, action);

    expect(next.scene.entities['e1'].x).toBe(state.scene.entities['e1'].x + 10);
    expect(next.scene.entities['e1'].y).toBe(state.scene.entities['e1'].y + 20);
    expect(next.dirty).toBe(true);
  });

  it('moves group by delta, updating all members', () => {
    const state = initState();
    const action: EditorAction = { type: 'move-group', id: 'g-enemies', dx: 5, dy: -5 };
    const next = reducer(state, action);

    const group = state.scene.groups['g-enemies'];
    for (const memberId of group.members) {
      expect(next.scene.entities[memberId].x).toBe(state.scene.entities[memberId].x + 5);
      expect(next.scene.entities[memberId].y).toBe(state.scene.entities[memberId].y - 5);
    }
    expect(next.dirty).toBe(true);
  });

  it('updates bounds with clamping', () => {
    const state = initState();
    const action: EditorAction = { type: 'update-bounds', id: 'c-bounds', bounds: { minX: 100, maxX: 50, minY: 200, maxY: 150 } };
    const next = reducer(state, action);

    expect(next.scene.conditions['c-bounds'].bounds.minX).toBe(50);
    expect(next.scene.conditions['c-bounds'].bounds.maxX).toBe(100);
    expect(next.scene.conditions['c-bounds'].bounds.minY).toBe(150);
    expect(next.scene.conditions['c-bounds'].bounds.maxY).toBe(200);
    expect(next.dirty).toBe(true);
  });

  it('begins canvas interaction', () => {
    const state = initState();
    const action: EditorAction = { type: 'begin-canvas-interaction', kind: 'entity', id: 'e-formation-0', handle: 'position' };
    const next = reducer(state, action);

    expect(next.interaction).toEqual({ kind: 'entity', id: 'e-formation-0', handle: 'position' });
  });

  it('ends canvas interaction', () => {
    const state = { ...initState(), interaction: { kind: 'entity' as const, id: 'e-formation-0' } };
    const action: EditorAction = { type: 'end-canvas-interaction' };
    const next = reducer(state, action);

    expect(next.interaction).toBeUndefined();
  });

  it('selects multiple entities', () => {
    const state = initState();
    const action: EditorAction = { type: 'select-multiple', entityIds: ['e1', 'e2'], additive: false };
    const next = reducer(state, action);

    expect(next.selection).toEqual({ kind: 'entities', ids: ['e1', 'e2'] });
  });

  it('selects single entity when selecting multiple with one id', () => {
    const state = initState();
    const action: EditorAction = { type: 'select-multiple', entityIds: ['e1'], additive: false };
    const next = reducer(state, action);

    expect(next.selection).toEqual({ kind: 'entity', id: 'e1' });
  });

  it('selects none when selecting multiple with empty array', () => {
    const state = initState();
    const action: EditorAction = { type: 'select-multiple', entityIds: [], additive: false };
    const next = reducer(state, action);

    expect(next.selection).toEqual({ kind: 'none' });
  });

  it('moves multiple entities by delta', () => {
    const state = initState();
    const action: EditorAction = { type: 'move-entities', entityIds: ['e1', 'e2'], dx: 15, dy: -10 };
    const next = reducer(state, action);

    expect(next.scene.entities['e1'].x).toBe(state.scene.entities['e1'].x + 15);
    expect(next.scene.entities['e1'].y).toBe(state.scene.entities['e1'].y - 10);
    expect(next.scene.entities['e2'].x).toBe(state.scene.entities['e2'].x + 15);
    expect(next.scene.entities['e2'].y).toBe(state.scene.entities['e2'].y - 10);
    expect(next.dirty).toBe(true);
  });

  it('creates group from selected entities', () => {
    const state = { ...initState(), selection: { kind: 'entities' as const, ids: ['e1', 'e2'] } };
    const action: EditorAction = { type: 'create-group-from-selection', name: 'Test Group' };
    const next = reducer(state, action);

    const groupIds = Object.keys(next.scene.groups);
    expect(groupIds.length).toBe(Object.keys(state.scene.groups).length + 1);
    const newGroupId = groupIds.find(id => !state.scene.groups[id]);
    expect(newGroupId).toBeDefined();
    expect(next.scene.groups[newGroupId!]).toEqual({
      id: newGroupId,
      name: 'Test Group',
      members: ['e1', 'e2'],
    });
    expect(next.selection).toEqual({ kind: 'group', id: newGroupId });
    expect(next.expandedGroups[newGroupId!]).toBe(true);
    expect(next.dirty).toBe(true);
  });

  it('does not create group when no entities selected', () => {
    const state = { ...initState(), selection: { kind: 'none' as const } };
    const action: EditorAction = { type: 'create-group-from-selection', name: 'Test Group' };
    const next = reducer(state, action);

    expect(next.scene.groups).toEqual(state.scene.groups);
    expect(next.selection).toEqual(state.selection);
  });

  it('dissolves group', () => {
    const state = initState();
    const groupId = 'g-enemies';
    const action: EditorAction = { type: 'dissolve-group', id: groupId };
    const next = reducer(state, action);

    expect(next.scene.groups[groupId]).toBeUndefined();
    expect(next.selection).toEqual({ kind: 'entities', ids: state.scene.groups[groupId].members });
    expect(next.expandedGroups[groupId]).toBeUndefined();
    expect(next.dirty).toBe(true);
  });

  it('does not dissolve non-existent group', () => {
    const state = initState();
    const action: EditorAction = { type: 'dissolve-group', id: 'non-existent' };
    const next = reducer(state, action);

    expect(next.scene.groups).toEqual(state.scene.groups);
    expect(next.selection).toEqual(state.selection);
  });

  it('renames a group', () => {
    const state = initState();
    const next = reducer(state, {
      type: 'update-group',
      id: 'g-enemies',
      next: { ...state.scene.groups['g-enemies'], name: 'Invader Block' },
    });

    expect(next.scene.groups['g-enemies'].name).toBe('Invader Block');
    expect(next.dirty).toBe(true);
  });

  it('reflows a group using grid layout controls', () => {
    const state = initState();
    const next = reducer(state, {
      type: 'arrange-group-grid',
      id: 'g-enemies',
      layout: { rows: 5, cols: 3, startX: 300, startY: 120, spacingX: 20, spacingY: 25 },
    });

    expect(next.scene.entities.e1.x).toBe(300);
    expect(next.scene.entities.e1.y).toBe(120);
    expect(next.scene.entities.e4.x).toBe(300);
    expect(next.scene.entities.e4.y).toBe(145);
    expect(next.dirty).toBe(true);
  });

  it('grows a formation when arranging to a larger grid', () => {
    const state = initState();
    const next = reducer(state, {
      type: 'arrange-group-grid',
      id: 'g-enemies',
      layout: { rows: 4, cols: 4, startX: 300, startY: 120, spacingX: 20, spacingY: 25 },
    });

    expect(next.scene.groups['g-enemies'].members).toHaveLength(16);
    expect(next.scene.entities.e16).toBeDefined();
    expect(next.dirty).toBe(true);
  });

  it('shrinks a formation when arranging to a smaller grid', () => {
    const state = initState();
    const next = reducer(state, {
      type: 'arrange-group-grid',
      id: 'g-enemies',
      layout: { rows: 3, cols: 4, startX: 300, startY: 120, spacingX: 20, spacingY: 25 },
    });

    expect(next.scene.groups['g-enemies'].members).toHaveLength(12);
    expect(next.scene.entities.e13).toBeUndefined();
    expect(next.scene.entities.e14).toBeUndefined();
    expect(next.scene.entities.e15).toBeUndefined();
    expect(next.dirty).toBe(true);
  });
});

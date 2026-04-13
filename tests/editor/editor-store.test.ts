import { describe, expect, it } from 'vitest';
import { reducer, initState, type EditorAction } from '../../src/editor/EditorStore';
import { sampleScene } from '../../src/model/sampleScene';

function seededState() {
  return {
    ...initState(),
    scene: sampleScene,
    expandedGroups: { 'g-enemies': false },
  };
}

describe('EditorStore reducer', () => {
  it('moves entity by delta', () => {
    const state = seededState();
    const action: EditorAction = { type: 'move-entity', id: 'e1', dx: 10, dy: 20 };
    const next = reducer(state, action);

    expect(next.scene.entities['e1'].x).toBe(state.scene.entities['e1'].x + 10);
    expect(next.scene.entities['e1'].y).toBe(state.scene.entities['e1'].y + 20);
    expect(next.dirty).toBe(true);
  });

  it('moves group by delta, updating all members', () => {
    const state = seededState();
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
    const state = seededState();
    const action: EditorAction = { type: 'update-bounds', id: 'att-move-right', bounds: { minX: 100, maxX: 50, minY: 200, maxY: 150 } };
    const next = reducer(state, action);

    const bounds = next.scene.attachments['att-move-right'].condition?.type === 'BoundsHit'
      ? next.scene.attachments['att-move-right'].condition.bounds
      : undefined;
    expect(bounds?.minX).toBe(50);
    expect(bounds?.maxX).toBe(100);
    expect(bounds?.minY).toBe(150);
    expect(bounds?.maxY).toBe(200);
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
    const state = seededState();
    const action: EditorAction = { type: 'move-entities', entityIds: ['e1', 'e2'], dx: 15, dy: -10 };
    const next = reducer(state, action);

    expect(next.scene.entities['e1'].x).toBe(state.scene.entities['e1'].x + 15);
    expect(next.scene.entities['e1'].y).toBe(state.scene.entities['e1'].y - 10);
    expect(next.scene.entities['e2'].x).toBe(state.scene.entities['e2'].x + 15);
    expect(next.scene.entities['e2'].y).toBe(state.scene.entities['e2'].y - 10);
    expect(next.dirty).toBe(true);
  });

  it('creates group from selected entities', () => {
    const state = { ...seededState(), selection: { kind: 'entities' as const, ids: ['e1', 'e2'] } };
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
      layout: { type: 'freeform' },
    });
    expect(next.selection).toEqual({ kind: 'group', id: newGroupId });
    expect(next.expandedGroups[newGroupId!]).toBe(true);
    expect(next.dirty).toBe(true);
  });

  it('defaults the formation name when creating a group from selection with an empty name', () => {
    const state = { ...seededState(), selection: { kind: 'entities' as const, ids: ['e1', 'e2'] } };
    const next = reducer(state, { type: 'create-group-from-selection', name: '' });

    const newGroupId = Object.keys(next.scene.groups).find((id) => !state.scene.groups[id]);
    expect(newGroupId).toBeDefined();
    expect(next.scene.groups[newGroupId!].name).toBe('Formation 1');
  });

  it('does not create group when no entities selected', () => {
    const state = { ...initState(), selection: { kind: 'none' as const } };
    const action: EditorAction = { type: 'create-group-from-selection', name: 'Test Group' };
    const next = reducer(state, action);

    expect(next.scene.groups).toEqual(state.scene.groups);
    expect(next.selection).toEqual(state.selection);
  });

  it('dissolves group', () => {
    const state = seededState();
    const groupId = 'g-enemies';
    const action: EditorAction = { type: 'dissolve-group', id: groupId };
    const next = reducer(state, action);

    expect(next.scene.groups[groupId]).toBeUndefined();
    expect(next.selection).toEqual({ kind: 'entities', ids: state.scene.groups[groupId].members });
    expect(next.expandedGroups[groupId]).toBeUndefined();
    expect(next.scene.attachments['att-move-right'].target).toEqual({ type: 'entity', entityId: 'e1' });
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
    const state = seededState();
    const next = reducer(state, {
      type: 'update-group',
      id: 'g-enemies',
      next: { ...state.scene.groups['g-enemies'], name: 'Invader Block' },
    });

    expect(next.scene.groups['g-enemies'].name).toBe('Invader Block');
    expect(next.dirty).toBe(true);
  });

  it('updates scene world size', () => {
    const state = seededState();
    const next = reducer(state, {
      type: 'update-scene-world',
      width: 1600,
      height: 1200,
    });

    expect(next.scene.world).toEqual({ width: 1600, height: 1200 });
    const bounds = next.scene.attachments['att-move-right'].condition?.type === 'BoundsHit'
      ? next.scene.attachments['att-move-right'].condition.bounds
      : undefined;
    expect(bounds).toEqual({ minX: 80, minY: 60, maxX: 1520, maxY: 1152 });
    expect(next.dirty).toBe(true);
  });

  it('dismisses the view hint without dirtying the scene', () => {
    const state = initState();
    const next = reducer(state, { type: 'dismiss-view-hint' });

    expect(next.hasSeenViewHint).toBe(true);
    expect(next.dirty).toBe(state.dirty);
  });

  it('removes an entity from a group and keeps selection on the group', () => {
    const state = seededState();
    const next = reducer(state, {
      type: 'remove-entity-from-group',
      groupId: 'g-enemies',
      entityId: 'e3',
    });

    expect(next.scene.groups['g-enemies'].members).not.toContain('e3');
    expect(next.scene.groups['g-enemies'].layout).toEqual({ type: 'freeform' });
    expect(next.selection).toEqual({ kind: 'group', id: 'g-enemies' });
  });

  it('removes an ungrouped entity from the scene graph', () => {
    const state = reducer(seededState(), {
      type: 'import-entities',
      drafts: [{
        entity: {
          id: 'e-imported',
          name: 'Imported Ship',
          x: 80,
          y: 80,
          width: 32,
          height: 32,
        },
      }],
    });

    const next = reducer(state, {
      type: 'remove-scene-graph-item',
      item: { kind: 'entity', id: 'e-imported' },
    });

    expect(next.scene.entities['e-imported']).toBeUndefined();
    expect(next.selection).toEqual({ kind: 'none' });
    expect(next.dirty).toBe(true);
  });

  it('removes a group and its member entities from the scene graph', () => {
    const state = seededState();
    const next = reducer(state, {
      type: 'remove-scene-graph-item',
      item: { kind: 'group', id: 'g-enemies' },
    });

    expect(next.scene.groups['g-enemies']).toBeUndefined();
    expect(next.scene.attachments['att-move-right']).toBeUndefined();
    expect(next.scene.entities.e1).toBeUndefined();
    expect(next.scene.entities.e15).toBeUndefined();
    expect(next.selection).toEqual({ kind: 'none' });
  });

  it('removes an attachment from the scene graph', () => {
    const state = seededState();
    const next = reducer(state, {
      type: 'remove-scene-graph-item',
      item: { kind: 'attachment', id: 'att-drop-right' },
    });

    expect(next.scene.attachments['att-drop-right']).toBeUndefined();
    expect(next.selection).toEqual({ kind: 'none' });
  });

  it('reflows a group using grid layout controls', () => {
    const state = seededState();
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
    const state = seededState();
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
    const state = seededState();
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

  it('creates an attachment for the selected group and selects it', () => {
    const state = seededState();
    const next = reducer(state, { type: 'create-attachment', target: { type: 'group', groupId: 'g-enemies' }, presetId: 'Wait' });

    expect(next.selection.kind).toBe('attachment');
    if (next.selection.kind === 'attachment') {
      expect(next.scene.attachments[next.selection.id]).toBeDefined();
      expect(next.scene.attachments[next.selection.id].presetId).toBe('Wait');
    }
  });

  it('updates ui scale with clamping', () => {
    const state = seededState();
    const next = reducer(state, { type: 'set-ui-scale', uiScale: 0.2 } as any);
    expect(next.uiScale).toBeGreaterThanOrEqual(0.75);
  });
});

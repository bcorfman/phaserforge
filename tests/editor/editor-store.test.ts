import { describe, expect, it, vi } from 'vitest';
import { reducer, initState, type EditorAction } from '../../src/editor/EditorStore';
import { serializeProjectToYaml } from '../../src/model/serialization';
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

describe('EditorStore reducer', () => {
  it('loads YAML text into the scene and sets a transient status message', () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const yaml = serializeProjectToYaml(sampleProject);
    const state = initState();
    const next = reducer(state, { type: 'load-yaml-text', text: yaml, sourceLabel: 'fixture.yaml' } as any);

    expect(next.project).toEqual(sampleProject);
    expect(sceneOf(next)).toEqual(sampleProject.scenes[sampleProject.initialSceneId]);
    expect(next.yamlText).toBe(yaml);
    expect(next.dirty).toBe(false);
    expect(next.error).toBeUndefined();
    expect(next.selection).toEqual({ kind: 'none' });
    expect(next.statusMessage).toContain('fixture.yaml');
    expect(next.statusExpiresAt).toBeGreaterThan(now);
  });

  it('does not set a success status message when YAML parsing fails', () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const state = initState();
    const next = reducer(state, { type: 'load-yaml-text', text: 'not: [valid', sourceLabel: 'bad.yaml' } as any);

    expect(next.error).toBeTruthy();
    expect(next.statusMessage).toBeUndefined();
    expect(next.statusExpiresAt).toBeUndefined();
  });

  it('sets and clears errors', () => {
    const state = seededState();
    const withError = reducer(state, { type: 'set-error', error: 'Boom' });
    expect(withError.error).toBe('Boom');

    const cleared = reducer(withError, { type: 'set-error', error: undefined });
    expect(cleared.error).toBeUndefined();
  });

  it('exports the current scene to YAML text and clears errors', () => {
    const state = {
      ...seededState(),
      yamlText: 'previous yaml',
      error: 'previous error',
    };

    const next = reducer(state, { type: 'export-yaml' });

    expect(next.project).toEqual(state.project);
    expect(next.yamlText).toBe(serializeProjectToYaml(state.project));
    expect(next.error).toBeUndefined();
  });

  it('creates group from arrange preset with a name-based id and clones template sprites', () => {
    const state = seededState();
    const scene = sceneOf(state);
    const initialEntityCount = Object.keys(scene.entities).length;
    const initialGroupCount = Object.keys(scene.groups).length;

    const action: EditorAction = {
      type: 'create-group-from-arrange',
      name: 'Enemy Formation',
      templateEntityId: 'e1',
      arrangeKind: 'line',
      memberCount: 5,
      params: { startX: 300, startY: 200, spacing: 10 },
    };
    const next = reducer(state, action);
    const nextScene = sceneOf(next);
    expect(Object.keys(nextScene.groups).length).toBe(initialGroupCount + 1);
    expect(nextScene.groups['g-enemy-formation']).toBeDefined();
    expect(next.selection).toEqual({ kind: 'group', id: 'g-enemy-formation' });
    expect(next.expandedGroups['g-enemy-formation']).toBe(true);
    expect(next.dirty).toBe(true);

    const group = nextScene.groups['g-enemy-formation'];
    expect(group.name).toBe('Enemy Formation');
    expect(group.members).toHaveLength(5);
    expect(group.layout).toEqual({ type: 'freeform' });
    expect(Object.keys(nextScene.entities).length).toBe(initialEntityCount + 5);
    for (const memberId of group.members) {
      const member = nextScene.entities[memberId];
      expect(member).toBeDefined();
      expect(member.width).toBe(scene.entities.e1.width);
      expect(member.height).toBe(scene.entities.e1.height);
      expect(member.asset).toEqual(scene.entities.e1.asset);
    }
  });

  it('suffixes name-based group ids when a collision exists', () => {
    const state = seededState();

    const first = reducer(state, {
      type: 'create-group-from-arrange',
      name: 'Enemy Formation',
      templateEntityId: 'e1',
      arrangeKind: 'line',
      memberCount: 1,
      params: { startX: 0, startY: 0, spacing: 10 },
    });

    const second = reducer(first, {
      type: 'create-group-from-arrange',
      name: 'Enemy Formation',
      templateEntityId: 'e1',
      arrangeKind: 'line',
      memberCount: 1,
      params: { startX: 0, startY: 0, spacing: 10 },
    });

    const secondScene = sceneOf(second);
    expect(secondScene.groups['g-enemy-formation']).toBeDefined();
    expect(secondScene.groups['g-enemy-formation-2']).toBeDefined();
  });

  it('derives the id from the default formation name when a blank name is provided', () => {
    const state = seededState();

    const next = reducer(state, {
      type: 'create-group-from-arrange',
      name: '',
      templateEntityId: 'e1',
      arrangeKind: 'line',
      memberCount: 1,
      params: { startX: 0, startY: 0, spacing: 10 },
    });

    const nextScene = sceneOf(next);
    expect(nextScene.groups['g-formation-1']).toBeDefined();
    expect(nextScene.groups['g-formation-1'].name).toBe('Formation 1');
  });

  it('moves entity by delta', () => {
    const state = seededState();
    const action: EditorAction = { type: 'move-entity', id: 'e1', dx: 10, dy: 20 };
    const next = reducer(state, action);

    expect(sceneOf(next).entities['e1'].x).toBe(sceneOf(state).entities['e1'].x + 10);
    expect(sceneOf(next).entities['e1'].y).toBe(sceneOf(state).entities['e1'].y + 20);
    expect(next.dirty).toBe(true);
  });

  it('rounds move deltas to integers', () => {
    const state = seededState();
    const nextEntity = reducer(state, { type: 'move-entity', id: 'e1', dx: 1.2, dy: 2.7 });
    expect(sceneOf(nextEntity).entities.e1.x).toBe(sceneOf(state).entities.e1.x + 1);
    expect(sceneOf(nextEntity).entities.e1.y).toBe(sceneOf(state).entities.e1.y + 3);

    const nextGroup = reducer(state, { type: 'move-group', id: 'g-enemies', dx: -1.6, dy: 4.4 });
    const group = sceneOf(state).groups['g-enemies'];
    for (const memberId of group.members) {
      expect(sceneOf(nextGroup).entities[memberId].x).toBe(sceneOf(state).entities[memberId].x - 2);
      expect(sceneOf(nextGroup).entities[memberId].y).toBe(sceneOf(state).entities[memberId].y + 4);
    }
  });

  it('moves group by delta, updating all members', () => {
    const state = seededState();
    const action: EditorAction = { type: 'move-group', id: 'g-enemies', dx: 5, dy: -5 };
    const next = reducer(state, action);

    const group = sceneOf(state).groups['g-enemies'];
    for (const memberId of group.members) {
      expect(sceneOf(next).entities[memberId].x).toBe(sceneOf(state).entities[memberId].x + 5);
      expect(sceneOf(next).entities[memberId].y).toBe(sceneOf(state).entities[memberId].y - 5);
    }
    expect(next.dirty).toBe(true);
  });

  it('moves arrange layouts by delta to keep center params in sync', () => {
    const state = seededState();
    const groupId = 'g-enemies';
    const patched = {
      ...state,
      project: {
        ...state.project,
        scenes: {
          ...state.project.scenes,
          [state.currentSceneId]: {
            ...sceneOf(state),
            groups: {
              ...sceneOf(state).groups,
              [groupId]: {
                ...sceneOf(state).groups[groupId],
                layout: { type: 'arrange', arrangeKind: 'circle', params: { centerX: 100.5, centerY: 200.2, radius: 50 } },
              },
            },
          },
        },
      },
    };

    const next = reducer(patched, { type: 'move-group', id: groupId, dx: 10, dy: -5 });
    const layout = sceneOf(next).groups[groupId].layout;
    expect(layout?.type).toBe('arrange');
    if (layout?.type !== 'arrange') throw new Error('Expected arrange layout');
    expect(layout.params.centerX).toBe(111);
    expect(layout.params.centerY).toBe(195);
  });

  it('updates bounds with clamping', () => {
    const state = seededState();
    const action: EditorAction = { type: 'update-bounds', id: 'att-move-right', bounds: { minX: 100, maxX: 50, minY: 200, maxY: 150 } };
    const next = reducer(state, action);

    const bounds = sceneOf(next).attachments['att-move-right'].condition?.type === 'BoundsHit'
      ? sceneOf(next).attachments['att-move-right'].condition.bounds
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

  it('additively selects multiple entities when requested', () => {
    const base = reducer(seededState(), { type: 'select', selection: { kind: 'entity', id: 'e1' } });
    const next = reducer(base, { type: 'select-multiple', entityIds: ['e2'], additive: true });

    expect(next.selection).toEqual({ kind: 'entities', ids: ['e1', 'e2'] });
  });

  it('toggles off entities when additively selecting an already-selected entity', () => {
    const base = reducer(seededState(), { type: 'select-multiple', entityIds: ['e1', 'e2'], additive: false });
    const next = reducer(base, { type: 'select-multiple', entityIds: ['e2'], additive: true });

    expect(next.selection).toEqual({ kind: 'entity', id: 'e1' });
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

    expect(sceneOf(next).entities['e1'].x).toBe(sceneOf(state).entities['e1'].x + 15);
    expect(sceneOf(next).entities['e1'].y).toBe(sceneOf(state).entities['e1'].y - 10);
    expect(sceneOf(next).entities['e2'].x).toBe(sceneOf(state).entities['e2'].x + 15);
    expect(sceneOf(next).entities['e2'].y).toBe(sceneOf(state).entities['e2'].y - 10);
    expect(next.dirty).toBe(true);
  });

  it('creates group from selected entities', () => {
    const state = seededState();
    const scene = sceneOf(state);
    const baseScene = {
      ...scene,
      groups: {
        ...scene.groups,
        'g-enemies': {
          ...scene.groups['g-enemies'],
          members: scene.groups['g-enemies'].members.filter((id) => !['e1', 'e2'].includes(id)),
          layout: { type: 'freeform' as const },
        },
      },
    };

    const stateWithUngrouped = {
      ...state,
      project: {
        ...state.project,
        scenes: {
          ...state.project.scenes,
          [state.currentSceneId]: baseScene,
        },
      },
      selection: { kind: 'entities' as const, ids: ['e1', 'e2'] },
    };
    const action: EditorAction = { type: 'create-group-from-selection', name: 'Test Group' };
    const next = reducer(stateWithUngrouped, action);

    const groupIds = Object.keys(sceneOf(next).groups);
    expect(groupIds.length).toBe(Object.keys(sceneOf(stateWithUngrouped).groups).length + 1);
    const newGroupId = groupIds.find(id => !sceneOf(stateWithUngrouped).groups[id]);
    expect(newGroupId).toBeDefined();
    expect(sceneOf(next).groups[newGroupId!]).toEqual({
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
    const state = seededState();
    const scene = sceneOf(state);
    const baseScene = {
      ...scene,
      groups: {
        ...scene.groups,
        'g-enemies': {
          ...scene.groups['g-enemies'],
          members: scene.groups['g-enemies'].members.filter((id) => !['e1', 'e2'].includes(id)),
          layout: { type: 'freeform' as const },
        },
      },
    };

    const stateWithUngrouped = {
      ...state,
      project: {
        ...state.project,
        scenes: {
          ...state.project.scenes,
          [state.currentSceneId]: baseScene,
        },
      },
      selection: { kind: 'entities' as const, ids: ['e1', 'e2'] },
    };
    const next = reducer(stateWithUngrouped, { type: 'create-group-from-selection', name: '' });

    const newGroupId = Object.keys(sceneOf(next).groups).find((id) => !sceneOf(stateWithUngrouped).groups[id]);
    expect(newGroupId).toBeDefined();
    expect(sceneOf(next).groups[newGroupId!].name).toBe('Formation 1');
  });

  it('does not create group from selection when fewer than 2 ungrouped entities are selected', () => {
    const state = seededState();
    const scene = sceneOf(state);
    const baseScene = {
      ...scene,
      groups: {
        ...scene.groups,
        'g-enemies': {
          ...scene.groups['g-enemies'],
          members: scene.groups['g-enemies'].members.filter((id) => id !== 'e2'),
          layout: { type: 'freeform' as const },
        },
      },
    };

    const stateWithOneUngrouped = {
      ...state,
      project: {
        ...state.project,
        scenes: {
          ...state.project.scenes,
          [state.currentSceneId]: baseScene,
        },
      },
      selection: { kind: 'entities' as const, ids: ['e1', 'e2'] },
    };

    const next = reducer(stateWithOneUngrouped, { type: 'create-group-from-selection', name: 'Should not work' } as any);
    expect(Object.keys(sceneOf(next).groups)).toEqual(Object.keys(sceneOf(stateWithOneUngrouped).groups));
    expect(next.selection).toEqual(stateWithOneUngrouped.selection);
  });

  it('does not create group when no entities selected', () => {
    const state = { ...initState(), selection: { kind: 'none' as const } };
    const action: EditorAction = { type: 'create-group-from-selection', name: 'Test Group' };
    const next = reducer(state, action);

    expect(sceneOf(next).groups).toEqual(sceneOf(state).groups);
    expect(next.selection).toEqual(state.selection);
  });

  it('dissolves group', () => {
    const state = seededState();
    const groupId = 'g-enemies';
    const action: EditorAction = { type: 'dissolve-group', id: groupId };
    const next = reducer(state, action);

    expect(sceneOf(next).groups[groupId]).toBeUndefined();
    expect(next.selection).toEqual({ kind: 'entities', ids: sceneOf(state).groups[groupId].members });
    expect(next.expandedGroups[groupId]).toBeUndefined();
    expect(sceneOf(next).attachments['att-move-right'].target).toEqual({ type: 'entity', entityId: 'e1' });
    expect(next.dirty).toBe(true);
  });

  it('ungroups a formation without deleting its member sprites, and can regroup back to the same formation', () => {
    const state = { ...seededState(), selection: { kind: 'group' as const, id: 'g-enemies' } };
    const members = sceneOf(state).groups['g-enemies'].members;
    const attachmentIds = Object.keys(sceneOf(state).attachments);

    const ungrouped = reducer(state, { type: 'ungroup-group', id: 'g-enemies' } as any);
    expect(sceneOf(ungrouped).groups['g-enemies']).toBeUndefined();
    expect(ungrouped.selection).toEqual({ kind: 'entities', ids: members });
    expect(Object.keys(sceneOf(ungrouped).entities)).toEqual(Object.keys(sceneOf(state).entities));
    expect(Object.keys(sceneOf(ungrouped).attachments)).toHaveLength(0);
    expect(Object.keys(ungrouped.pendingGroupRestore?.attachments ?? {})).toEqual(attachmentIds);
    expect(ungrouped.pendingGroupRestore?.group.id).toBe('g-enemies');

    const regrouped = reducer(ungrouped, { type: 'group-selection', name: 'ignored' } as any);
    expect(sceneOf(regrouped).groups['g-enemies']).toBeDefined();
    expect(regrouped.selection).toEqual({ kind: 'group', id: 'g-enemies' });
    expect(Object.keys(sceneOf(regrouped).attachments)).toEqual(attachmentIds);
    expect(regrouped.pendingGroupRestore).toBeUndefined();
  });

  it('adds entities to an existing group, removing them from any other group memberships', () => {
    const state = seededState();
    const scene = sceneOf(state);

    const baseScene = {
      ...scene,
      groups: {
        ...scene.groups,
        'g-alt': {
          id: 'g-alt',
          name: 'Alt Formation',
          members: ['e1', 'e2'],
          layout: { type: 'freeform' as const },
        },
        'g-enemies': {
          ...scene.groups['g-enemies'],
          members: scene.groups['g-enemies'].members.filter((id) => !['e1', 'e2'].includes(id)),
          layout: { type: 'freeform' as const },
        },
      },
    };

    const base = {
      ...state,
      project: {
        ...state.project,
        scenes: {
          ...state.project.scenes,
          [state.currentSceneId]: baseScene,
        },
      },
      selection: { kind: 'entities' as const, ids: ['e3', 'e4'] },
    };

    const next = reducer(base, { type: 'add-entities-to-group', groupId: 'g-alt', entityIds: ['e3', 'e4'] } as any);

    expect(sceneOf(next).groups['g-alt'].members).toEqual(['e1', 'e2', 'e3', 'e4']);
    expect(sceneOf(next).groups['g-enemies'].members).not.toContain('e3');
    expect(sceneOf(next).groups['g-enemies'].members).not.toContain('e4');
    expect(sceneOf(next).groups['g-alt'].layout).toEqual({ type: 'freeform' });
    expect(next.selection).toEqual({ kind: 'group', id: 'g-alt' });
    expect(next.dirty).toBe(true);
  });

  it('does not dissolve non-existent group', () => {
    const state = initState();
    const action: EditorAction = { type: 'dissolve-group', id: 'non-existent' };
    const next = reducer(state, action);

    expect(sceneOf(next).groups).toEqual(sceneOf(state).groups);
    expect(next.selection).toEqual(state.selection);
  });

  it('renames a group', () => {
    const state = seededState();
    const next = reducer(state, {
      type: 'update-group',
      id: 'g-enemies',
      next: { ...sceneOf(state).groups['g-enemies'], name: 'Invader Block' },
    });

    expect(sceneOf(next).groups['g-enemies'].name).toBe('Invader Block');
    expect(next.dirty).toBe(true);
  });

  it('converts a group layout to freeform', () => {
    const state = seededState();
    const beforeLayout = sceneOf(state).groups['g-enemies'].layout;
    expect(beforeLayout?.type).toBe('grid');

    const next = reducer(state, { type: 'convert-group-layout-freeform', id: 'g-enemies' } as any);

    expect(sceneOf(next).groups['g-enemies'].layout).toEqual({ type: 'freeform' });
    expect(next.dirty).toBe(true);
  });

  it('converts a group layout to grid without resizing member count', () => {
    const state = seededState();
    const next = reducer(state, { type: 'convert-group-layout-grid', id: 'g-enemies', rows: 1, cols: 1 } as any);

    expect(sceneOf(next).groups['g-enemies'].layout).toMatchObject({ type: 'grid', rows: 1 });
    expect(sceneOf(next).groups['g-enemies'].members).toHaveLength(sceneOf(state).groups['g-enemies'].members.length);
    expect(sceneOf(next).entities.e1).toMatchObject({ x: 220, y: 140 });
    expect(sceneOf(next).entities.e2).toMatchObject({ x: 268, y: 140 });
    expect(sceneOf(next).entities.e6).toMatchObject({ x: 460, y: 140 });
  });

  it('converts a group layout to an arrange preset', () => {
    const state = seededState();
    const next = reducer(state, { type: 'convert-group-layout-arrange', id: 'g-enemies', arrangeKind: 'circle' } as any);

    expect(sceneOf(next).groups['g-enemies'].layout).toMatchObject({ type: 'arrange', arrangeKind: 'circle' });
    expect(next.dirty).toBe(true);
  });

  it('updates scene world size', () => {
    const state = seededState();
    const next = reducer(state, {
      type: 'update-scene-world',
      width: 1600,
      height: 1200,
    });

    expect(sceneOf(next).world).toEqual({ width: 1600, height: 1200 });
    const bounds = sceneOf(next).attachments['att-move-right'].condition?.type === 'BoundsHit'
      ? sceneOf(next).attachments['att-move-right'].condition.bounds
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
    const state = { ...seededState(), expandedGroups: { 'g-enemies': true } };
    const next = reducer(state, {
      type: 'remove-entity-from-group',
      groupId: 'g-enemies',
      entityId: 'e3',
    });

    expect(sceneOf(next).groups['g-enemies'].members).not.toContain('e3');
    expect(sceneOf(next).groups['g-enemies'].layout).toEqual({ type: 'freeform' });
    expect(next.selection).toEqual({ kind: 'group', id: 'g-enemies' });
    expect(next.expandedGroups['g-enemies']).toBe(true);
  });

  it('removes multiple entities from their groups while preserving multi-selection', () => {
    const state = seededState();
    const scene = sceneOf(state);
    const baseScene = {
      ...scene,
      groups: {
        ...scene.groups,
        'g-alt': {
          id: 'g-alt',
          name: 'Alt Formation',
          members: ['e1', 'e2', 'e3'],
          layout: { type: 'freeform' as const },
        },
        'g-enemies': {
          ...scene.groups['g-enemies'],
          members: scene.groups['g-enemies'].members.filter((id) => !['e1', 'e2', 'e3'].includes(id)),
          layout: { type: 'freeform' as const },
        },
      },
    };

    const base = {
      ...state,
      project: {
        ...state.project,
        scenes: {
          ...state.project.scenes,
          [state.currentSceneId]: baseScene,
        },
      },
      selection: { kind: 'entities' as const, ids: ['e1', 'e2'] },
    };

    const next = reducer(base, { type: 'remove-entities-from-groups', entityIds: ['e1', 'e2'] } as any);

    expect(sceneOf(next).groups['g-alt'].members).toEqual(['e3']);
    expect(next.selection).toEqual({ kind: 'entities', ids: ['e1', 'e2'] });
    expect(next.dirty).toBe(true);
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

    expect(sceneOf(next).entities['e-imported']).toBeUndefined();
    expect(next.selection).toEqual({ kind: 'none' });
    expect(next.dirty).toBe(true);
  });

  it('removes a group from the scene graph but keeps member entities', () => {
    const state = seededState();
    const next = reducer(state, {
      type: 'remove-scene-graph-item',
      item: { kind: 'group', id: 'g-enemies' },
    });

    expect(sceneOf(next).groups['g-enemies']).toBeUndefined();
    expect(sceneOf(next).attachments['att-move-right']).toBeUndefined();
    expect(sceneOf(next).entities.e1).toBeDefined();
    expect(sceneOf(next).entities.e15).toBeDefined();
    expect(next.selection).toEqual({ kind: 'none' });
  });

  it('removes an attachment from the scene graph', () => {
    const state = seededState();
    const next = reducer(state, {
      type: 'remove-scene-graph-item',
      item: { kind: 'attachment', id: 'att-drop-right' },
    });

    expect(sceneOf(next).attachments['att-drop-right']).toBeUndefined();
    expect(next.selection).toEqual({ kind: 'none' });
  });

  it('reflows a group using grid layout controls', () => {
    const state = seededState();
    const next = reducer(state, {
      type: 'arrange-group-grid',
      id: 'g-enemies',
      layout: { rows: 5, cols: 3, startX: 300, startY: 120, spacingX: 20, spacingY: 25 },
    });

    expect(sceneOf(next).entities.e1.x).toBe(300);
    expect(sceneOf(next).entities.e1.y).toBe(120);
    expect(sceneOf(next).entities.e4.x).toBe(300);
    expect(sceneOf(next).entities.e4.y).toBe(145);
    expect(next.dirty).toBe(true);
  });

  it('grows a formation when arranging to a larger grid', () => {
    const state = seededState();
    const next = reducer(state, {
      type: 'arrange-group-grid',
      id: 'g-enemies',
      layout: { rows: 4, cols: 4, startX: 300, startY: 120, spacingX: 20, spacingY: 25 },
    });

    expect(sceneOf(next).groups['g-enemies'].members).toHaveLength(16);
    expect(sceneOf(next).entities.e16).toBeDefined();
    expect(next.dirty).toBe(true);
  });

  it('shrinks a formation when arranging to a smaller grid', () => {
    const state = seededState();
    const next = reducer(state, {
      type: 'arrange-group-grid',
      id: 'g-enemies',
      layout: { rows: 3, cols: 4, startX: 300, startY: 120, spacingX: 20, spacingY: 25 },
    });

    expect(sceneOf(next).groups['g-enemies'].members).toHaveLength(12);
    expect(sceneOf(next).entities.e13).toBeUndefined();
    expect(sceneOf(next).entities.e14).toBeUndefined();
    expect(sceneOf(next).entities.e15).toBeUndefined();
    expect(next.dirty).toBe(true);
  });

  it('creates an attachment for the selected group and selects it', () => {
    const state = seededState();
    const next = reducer(state, { type: 'create-attachment', target: { type: 'group', groupId: 'g-enemies' }, presetId: 'Wait' });

    expect(next.selection.kind).toBe('attachment');
    if (next.selection.kind === 'attachment') {
      expect(sceneOf(next).attachments[next.selection.id]).toBeDefined();
      expect(sceneOf(next).attachments[next.selection.id].presetId).toBe('Wait');
    }
  });

  it('updates ui scale with clamping', () => {
    const state = seededState();
    const next = reducer(state, { type: 'set-ui-scale', uiScale: 0.2 } as any);
    expect(next.uiScale).toBeGreaterThanOrEqual(0.75);
  });

  it('adds a background layer from an imported image file and stores it in project assets', () => {
    const state = seededState();
    const beforeScene = sceneOf(state);
    expect(beforeScene.backgroundLayers ?? []).toEqual([]);
    expect(Object.keys(state.project.assets.images ?? {})).toEqual([]);

    const next = reducer(state, {
      type: 'add-background-layer-from-file',
      file: {
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
        originalName: 'starfield.png',
        mimeType: 'image/png',
      },
      defaults: { layout: 'cover' },
    } as any);

    const nextScene = sceneOf(next);
    expect(nextScene.backgroundLayers?.length).toBe(1);
    const layer = nextScene.backgroundLayers?.[0]!;
    expect(layer.assetId).toBeTruthy();
    expect(layer.layout).toBe('cover');
    expect(layer.depth).toBeLessThan(0);
    expect(next.project.assets.images[layer.assetId]).toMatchObject({
      id: layer.assetId,
      source: {
        kind: 'embedded',
        originalName: 'starfield.png',
        mimeType: 'image/png',
      },
    });
  });

  it('reorders background layers within the scene', () => {
    const state = seededState();
    const withTwo = reducer(state, {
      type: 'set-scene-background-layers',
      layers: [
        { assetId: 'a', x: 0, y: 0, depth: -100, layout: 'cover' },
        { assetId: 'b', x: 0, y: 0, depth: -110, layout: 'tile', scrollFactor: { x: 0.2, y: 0.2 } },
      ],
    } as any);

    const moved = reducer(withTwo, { type: 'move-background-layer', fromIndex: 1, toIndex: 0 } as any);
    expect(sceneOf(moved).backgroundLayers?.map((l: any) => l.assetId)).toEqual(['b', 'a']);
  });

  it('undo/redo restores background layer edits', () => {
    const state = reducer(seededState(), {
      type: 'set-scene-background-layers',
      layers: [{ assetId: 'a', x: 10, y: 20, depth: -100, layout: 'cover' }],
    } as any);

    const updated = reducer(state, { type: 'update-background-layer', index: 0, patch: { depth: -222 } } as any);
    expect(sceneOf(updated).backgroundLayers?.[0]?.depth).toBe(-222);

    const undone = reducer(updated, { type: 'history-undo' });
    expect(sceneOf(undone).backgroundLayers?.[0]?.depth).toBe(-100);

    const redone = reducer(undone, { type: 'history-redo' });
    expect(sceneOf(redone).backgroundLayers?.[0]?.depth).toBe(-222);
  });

  it('duplicates a selected entity and keeps it in its existing group', () => {
    const state0 = reducer(seededState(), { type: 'select', selection: { kind: 'entity', id: 'e1' } } as any);
    const scene0 = sceneOf(state0);
    const group0 = scene0.groups['g-enemies'];
    expect(group0.members).toContain('e1');

    const next = reducer(state0, { type: 'duplicate-entities', entityIds: ['e1'] } as any);
    const scene1 = sceneOf(next);

    expect(Object.keys(scene1.entities).length).toBe(Object.keys(scene0.entities).length + 1);
    expect(next.selection.kind).toBe('entity');
    if (next.selection.kind !== 'entity') throw new Error('Expected entity selection');
    expect(next.selection.id).not.toBe('e1');
    const duplicateId = next.selection.id;

    expect(scene1.entities[duplicateId]).toBeDefined();
    expect(scene1.entities[duplicateId].asset).toEqual(scene0.entities.e1.asset);
    expect(scene1.entities[duplicateId].width).toBe(scene0.entities.e1.width);
    expect(scene1.entities[duplicateId].height).toBe(scene0.entities.e1.height);

    const group1 = scene1.groups['g-enemies'];
    expect(group1.members).toContain(duplicateId);
    expect(group1.layout).toEqual({ type: 'freeform' });
  });

  it('duplicates multiple selected entities and selects the duplicates', () => {
    const state0 = reducer(seededState(), { type: 'select-multiple', entityIds: ['e1', 'e2'], additive: false } as any);
    const scene0 = sceneOf(state0);

    const next = reducer(state0, { type: 'duplicate-entities', entityIds: ['e1', 'e2'] } as any);
    const scene1 = sceneOf(next);

    expect(Object.keys(scene1.entities).length).toBe(Object.keys(scene0.entities).length + 2);
    expect(next.selection.kind).toBe('entities');
    if (next.selection.kind !== 'entities') throw new Error('Expected entities selection');
    expect(next.selection.ids).toHaveLength(2);
    expect(new Set(next.selection.ids).size).toBe(2);
    expect(next.selection.ids).not.toContain('e1');
    expect(next.selection.ids).not.toContain('e2');
    for (const id of next.selection.ids) {
      expect(scene1.entities[id]).toBeDefined();
    }
  });
});

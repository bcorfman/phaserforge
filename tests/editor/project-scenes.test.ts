import { describe, expect, it } from 'vitest';
import { initState, reducer } from '../../src/editor/EditorStore';
import type { ProjectSpec } from '../../src/model/types';

function makeProject(): ProjectSpec {
  return {
    id: 'project-1',
    assets: { images: {}, spriteSheets: {} },
    audio: { sounds: {} },
    inputMaps: {},
    baseSceneId: undefined,
    sceneMeta: {
      a: { name: 'Scene A', role: 'stage' },
    },
    scenes: {
      a: {
        id: 'a',
        world: { width: 100, height: 100 },
        entities: { e1: { id: 'e1', x: 1, y: 2, width: 10, height: 10 } },
        groups: {},
        attachments: {},
        behaviors: {},
        actions: {},
        conditions: {},
        backgroundLayers: [],
      },
      b: {
        id: 'b',
        world: { width: 100, height: 100 },
        entities: { e1: { id: 'e1', x: 9, y: 9, width: 10, height: 10 } },
        groups: {},
        attachments: {},
        behaviors: {},
        actions: {},
        conditions: {},
        backgroundLayers: [],
      },
    },
    initialSceneId: 'a',
  };
}

describe('project scene switching', () => {
  it('edits affect only the active scene', () => {
    const state0 = initState();
    const project = makeProject();
    const state1 = reducer(state0, {
      type: 'initialize',
      project,
      currentSceneId: 'a',
      startupMode: 'new_empty_scene',
      themeMode: 'system',
      uiScale: 1,
      registry: { arrange: [], actions: [], conditions: [] },
    } as any);

    const state2 = reducer(state1, {
      type: 'update-entity',
      id: 'e1',
      next: { ...project.scenes.a.entities.e1, x: 123 },
    });

    expect(state2.project.scenes.a.entities.e1.x).toBe(123);
    expect(state2.project.scenes.b.entities.e1.x).toBe(9);
  });

  it('switching scenes updates currentSceneId and resets selection', () => {
    const state0 = initState();
    const project = makeProject();
    const state1 = reducer(state0, {
      type: 'initialize',
      project,
      currentSceneId: 'a',
      startupMode: 'new_empty_scene',
      themeMode: 'system',
      uiScale: 1,
      registry: { arrange: [], actions: [], conditions: [] },
    } as any);

    const state2 = reducer(state1, { type: 'select', selection: { kind: 'entity', id: 'e1' } });
    const state3 = reducer(state2, { type: 'set-current-scene', sceneId: 'b' } as any);

    expect(state3.currentSceneId).toBe('b');
    expect(state3.selection).toEqual({ kind: 'none' });
  });
});

describe('base scene selection', () => {
  it('toggles baseSceneId on/off for a scene', () => {
    const state0 = initState();
    const project = makeProject();
    const state1 = reducer(state0, {
      type: 'initialize',
      project,
      currentSceneId: 'a',
      startupMode: 'new_empty_scene',
      themeMode: 'system',
      uiScale: 1,
      registry: { arrange: [], actions: [], conditions: [] },
    } as any);

    const state2 = reducer(state1, { type: 'toggle-base-scene', sceneId: 'a' } as any);
    expect(state2.project.baseSceneId).toBe('a');

    const state3 = reducer(state2, { type: 'toggle-base-scene', sceneId: 'a' } as any);
    expect(state3.project.baseSceneId).toBeUndefined();

    const state4 = reducer(state3, { type: 'toggle-base-scene', sceneId: 'b' } as any);
    expect(state4.project.baseSceneId).toBe('b');
  });

  it('updates baseSceneId when the base scene is renamed', () => {
    const state0 = initState();
    const project = { ...makeProject(), baseSceneId: 'a' };
    const state1 = reducer(state0, {
      type: 'initialize',
      project,
      currentSceneId: 'a',
      startupMode: 'new_empty_scene',
      themeMode: 'system',
      uiScale: 1,
      registry: { arrange: [], actions: [], conditions: [] },
    } as any);

    const state2 = reducer(state1, { type: 'rename-scene', sceneId: 'a', name: 'base' } as any);
    expect(state2.project.baseSceneId).toBe('base');
  });

  it('clears baseSceneId when the base scene is deleted', () => {
    const state0 = initState();
    const project = { ...makeProject(), baseSceneId: 'a' };
    const state1 = reducer(state0, {
      type: 'initialize',
      project,
      currentSceneId: 'a',
      startupMode: 'new_empty_scene',
      themeMode: 'system',
      uiScale: 1,
      registry: { arrange: [], actions: [], conditions: [] },
    } as any);

    const state2 = reducer(state1, { type: 'delete-scene', sceneId: 'a' } as any);
    expect(state2.project.baseSceneId).toBeUndefined();
  });

  it('copies sceneMeta when duplicating a scene', () => {
    const state0 = initState();
    const project = makeProject();
    const state1 = reducer(state0, {
      type: 'initialize',
      project,
      currentSceneId: 'a',
      startupMode: 'new_empty_scene',
      themeMode: 'system',
      uiScale: 1,
      registry: { arrange: [], actions: [], conditions: [] },
    } as any);

    const state2 = reducer(state1, { type: 'duplicate-scene', sceneId: 'a' } as any);
    expect(state2.project.scenes['a-copy']).toBeTruthy();
    expect(state2.project.sceneMeta?.['a-copy']).toEqual(project.sceneMeta?.a);
  });
});

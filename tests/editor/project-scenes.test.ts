import { describe, expect, it } from 'vitest';
import { initState, reducer } from '../../src/editor/EditorStore';
import type { ProjectSpec } from '../../src/model/types';

function makeProject(): ProjectSpec {
  return {
    id: 'project-1',
    assets: { images: {}, spriteSheets: {} },
    audio: { sounds: {} },
    inputMaps: {},
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


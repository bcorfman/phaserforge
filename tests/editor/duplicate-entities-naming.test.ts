import { describe, expect, it } from 'vitest';
import { initState, reducer } from '../../src/editor/EditorStore';

function sceneOf(state: any) {
  return state.project.scenes[state.currentSceneId];
}

describe('duplicate-entities naming', () => {
  it('increments trailing numbers and avoids collisions (uses display names)', () => {
    const base = initState();
    const state0 = {
      ...base,
      currentSceneId: 's1',
      project: {
        ...base.project,
        initialSceneId: 's1',
        scenes: {
          s1: {
            id: 's1',
            world: { width: 100, height: 100 },
            entities: {
              a: { id: 'a', name: 'Ship1', x: 1, y: 2, width: 10, height: 10 },
              b: { id: 'b', name: 'Ship2', x: 1, y: 2, width: 10, height: 10 },
            },
            groups: {},
            attachments: {},
            behaviors: {},
            actions: {},
            conditions: {},
          },
        },
      },
    };

    const next = reducer(state0 as any, { type: 'duplicate-entities', entityIds: ['a'] } as any);
    const scene1 = sceneOf(next);
    const created = Object.values(scene1.entities).find((e: any) => e.id !== 'a' && e.id !== 'b') as any;
    expect(created?.name).toBe('Ship3');
  });

  it('adds a 2 suffix when no trailing number exists and avoids collisions', () => {
    const base = initState();
    const state0 = {
      ...base,
      currentSceneId: 's1',
      project: {
        ...base.project,
        initialSceneId: 's1',
        scenes: {
          s1: {
            id: 's1',
            world: { width: 100, height: 100 },
            entities: {
              a: { id: 'a', name: 'Ship', x: 1, y: 2, width: 10, height: 10 },
              b: { id: 'b', name: 'Ship2', x: 1, y: 2, width: 10, height: 10 },
            },
            groups: {},
            attachments: {},
            behaviors: {},
            actions: {},
            conditions: {},
          },
        },
      },
    };

    const next = reducer(state0 as any, { type: 'duplicate-entities', entityIds: ['a'] } as any);
    const scene1 = sceneOf(next);
    const created = Object.values(scene1.entities).find((e: any) => e.id !== 'a' && e.id !== 'b') as any;
    expect(created?.name).toBe('Ship3');
  });

  it('treats entity ids as display names when name is missing', () => {
    const base = initState();
    const state0 = {
      ...base,
      currentSceneId: 's1',
      project: {
        ...base.project,
        initialSceneId: 's1',
        scenes: {
          s1: {
            id: 's1',
            world: { width: 100, height: 100 },
            entities: {
              e1: { id: 'e1', x: 1, y: 2, width: 10, height: 10 },
              e2: { id: 'e2', x: 1, y: 2, width: 10, height: 10 },
            },
            groups: {},
            attachments: {},
            behaviors: {},
            actions: {},
            conditions: {},
          },
        },
      },
    };

    const next = reducer(state0 as any, { type: 'duplicate-entities', entityIds: ['e1'] } as any);
    const scene1 = sceneOf(next);
    const created = Object.values(scene1.entities).find((e: any) => e.id !== 'e1' && e.id !== 'e2') as any;
    expect(created?.name).toBe('e3');
  });
});


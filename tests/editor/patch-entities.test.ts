import { describe, expect, it } from 'vitest';
import { initState, reducer } from '../../src/editor/EditorStore';

function withBasicProject(state: any) {
  const sceneId = 'scene-1';
  return {
    ...state,
    currentSceneId: sceneId,
    project: {
      id: 'project-1',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: {
        [sceneId]: {
          id: sceneId,
          world: { width: 800, height: 600 },
          entities: {
            a: { id: 'a', x: 10, y: 10, width: 10, height: 10, scaleX: 1, scaleY: 1 },
            b: { id: 'b', x: 20, y: 20, width: 10, height: 10, scaleX: 1, scaleY: 1 },
          },
          groups: {},
          attachments: {},
          behaviors: {},
          actions: {},
          conditions: {},
          triggers: [],
        },
      },
      initialSceneId: sceneId,
    },
  };
}

describe('EditorStore reducer: patch-entities', () => {
  it('applies the patch to every existing entity id', () => {
    const state = withBasicProject(initState());
    const next = reducer(state as any, {
      type: 'patch-entities',
      entityIds: ['a', 'b', 'missing'],
      patch: { scaleX: 2, alpha: 0.5 },
    } as any);

    expect(next.project.scenes[state.currentSceneId].entities.a.scaleX).toBe(2);
    expect(next.project.scenes[state.currentSceneId].entities.a.alpha).toBe(0.5);
    expect(next.project.scenes[state.currentSceneId].entities.b.scaleX).toBe(2);
    expect(next.project.scenes[state.currentSceneId].entities.b.alpha).toBe(0.5);
  });

  it('does not change state when no entities exist for the provided ids', () => {
    const state = withBasicProject(initState());
    const next = reducer(state as any, {
      type: 'patch-entities',
      entityIds: ['missing'],
      patch: { scaleX: 2 },
    } as any);

    expect(next).toBe(state);
  });
});


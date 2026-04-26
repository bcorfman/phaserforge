import { describe, expect, it } from 'vitest';
import { initState, reducer } from '../../src/editor/EditorStore';
import { sampleProject } from '../../src/model/sampleProject';

function seededState() {
  const base = initState();
  return {
    ...base,
    project: sampleProject,
    currentSceneId: sampleProject.initialSceneId,
  };
}

function activeScene(state: any) {
  return state.project.scenes[state.currentSceneId];
}

describe('input maps authoring', () => {
  it('creates and duplicates input maps in the project', () => {
    const state = seededState();
    const withMap = reducer(state, { type: 'create-input-map', mapId: 'default_controls' } as any);
    expect(withMap.project.inputMaps.default_controls).toEqual({ actions: {} });

    const withDup = reducer(withMap, { type: 'duplicate-input-map', sourceMapId: 'default_controls', nextMapId: 'menu_controls' } as any);
    expect(withDup.project.inputMaps.menu_controls).toEqual({ actions: {} });
  });

  it('adds an action binding and assigns the active map to the scene', () => {
    const state = seededState();
    const withMap = reducer(state, { type: 'create-input-map', mapId: 'default_controls' } as any);

    const withBinding = reducer(withMap, {
      type: 'add-input-binding',
      mapId: 'default_controls',
      actionId: 'Jump',
      binding: { device: 'keyboard', key: 'Space', event: 'held' },
    } as any);

    expect(withBinding.project.inputMaps.default_controls.actions.Jump).toEqual([{ device: 'keyboard', key: 'Space', event: 'held' }]);

    const withSceneMap = reducer(withBinding, { type: 'set-scene-input', input: { activeMapId: 'default_controls' } } as any);
    expect(activeScene(withSceneMap).input?.activeMapId).toBe('default_controls');
  });

  it('removing an input map clears scene/project references', () => {
    const state = seededState();
    const withMap = reducer(state, { type: 'create-input-map', mapId: 'default_controls' } as any);
    const withDefault = reducer(withMap, { type: 'set-project-default-input-map', mapId: 'default_controls' } as any);
    const withSceneMap = reducer(withDefault, { type: 'set-scene-input', input: { activeMapId: 'default_controls' } } as any);

    const removed = reducer(withSceneMap, { type: 'remove-input-map', mapId: 'default_controls' } as any);
    expect(removed.project.inputMaps.default_controls).toBeUndefined();
    expect(removed.project.defaultInputMapId).toBeUndefined();
    expect(activeScene(removed).input?.activeMapId).toBeUndefined();
  });

  it('stores scene mouse options under scene input', () => {
    const state = seededState();
    const next = reducer(state, {
      type: 'set-scene-input',
      input: {
        mouse: {
          hideOsCursorInPlay: true,
          driveEntityId: 'e1',
          affectX: true,
          affectY: false,
        },
      },
    } as any);

    expect(activeScene(next).input?.mouse).toEqual({
      hideOsCursorInPlay: true,
      driveEntityId: 'e1',
      affectX: true,
      affectY: false,
    });
  });
});

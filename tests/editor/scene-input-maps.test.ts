import { describe, expect, it } from 'vitest';
import { listActiveSceneInputActionIds, listSceneInputActionIds, readSceneMapSelection } from '../../src/editor/sceneInputMaps';

describe('sceneInputMaps', () => {
  it('treats undefined map ids as project-default selection', () => {
    expect(readSceneMapSelection(undefined, 'active')).toEqual({ kind: 'project-default' });
  });

  it('treats none flags as none selection', () => {
    expect(readSceneMapSelection({ activeMapNone: true } as any, 'active')).toEqual({ kind: 'none' });
    expect(readSceneMapSelection({ fallbackMapNone: true } as any, 'fallback')).toEqual({ kind: 'none' });
  });

  it('lists actions from selected maps (including project default)', () => {
    const project: any = {
      defaultInputMapId: 'default',
      inputMaps: {
        default: { actions: { Jump: [], Pause: [] } },
        ui: { actions: { Confirm: [], Pause: [] } },
      },
    };
    const scene: any = {
      entities: {},
      input: { fallbackMapId: 'ui' },
    };
    expect(listSceneInputActionIds(scene, project)).toEqual(['Confirm', 'Jump', 'Pause']);
  });

  it('omits actions for selections set to none', () => {
    const project: any = {
      defaultInputMapId: 'default',
      inputMaps: { default: { actions: { Jump: [] } } },
    };
    const scene: any = { entities: {}, input: { activeMapNone: true } };
    expect(listSceneInputActionIds(scene, project)).toEqual([]);
  });

  it('lists actions only from the active selection', () => {
    const project: any = {
      defaultInputMapId: 'default',
      inputMaps: {
        default: { actions: { Jump: [], Pause: [] } },
        ui: { actions: { Confirm: [] } },
      },
    };
    const scene: any = { entities: {}, input: { fallbackMapId: 'ui' } };
    expect(listActiveSceneInputActionIds(scene, project)).toEqual(['Jump', 'Pause']);
  });
});

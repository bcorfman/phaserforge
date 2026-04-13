import { SceneSpec } from './types';

export function createEmptyScene(): SceneSpec {
  return {
    id: 'scene-1',
    world: {
      width: 1024,
      height: 768,
    },
    entities: {},
    groups: {},
    attachments: {},
    behaviors: {},
    actions: {},
    conditions: {},
  };
}

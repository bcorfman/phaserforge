import { SceneSpec } from '../src/model/types';

export function baseScene(): SceneSpec {
  return {
    id: 'scene-1',
    world: { width: 1024, height: 768 },
    entities: {
      e1: { id: 'e1', x: 0, y: 0, width: 10, height: 10, scaleX: 1, scaleY: 1, originX: 0.5, originY: 0.5, alpha: 1, visible: true, depth: 0, flipX: false, flipY: false, rotationDeg: 0 },
      e2: { id: 'e2', x: 20, y: 0, width: 10, height: 10, scaleX: 1, scaleY: 1, originX: 0.5, originY: 0.5, alpha: 1, visible: true, depth: 0, flipX: false, flipY: false, rotationDeg: 0 },
      e3: { id: 'e3', x: 40, y: 0, width: 10, height: 10, scaleX: 1, scaleY: 1, originX: 0.5, originY: 0.5, alpha: 1, visible: true, depth: 0, flipX: false, flipY: false, rotationDeg: 0 },
    },
    groups: {
      g1: { id: 'g1', members: ['e1', 'e2', 'e3'] },
    },
    attachments: {},
    behaviors: {
      b1: {
        id: 'b1',
        target: { type: 'group', groupId: 'g1' },
        rootActionId: 'a1',
      },
    },
    actions: {
      a1: { id: 'a1', type: 'Sequence', children: ['a2', 'a3'] },
      a2: { id: 'a2', type: 'MoveUntil', target: { type: 'group', groupId: 'g1' }, velocity: { x: 50, y: 0 }, conditionId: 'c1' },
      a3: { id: 'a3', type: 'Call', callId: 'reverse' },
    },
    conditions: {
      c1: { id: 'c1', type: 'BoundsHit', bounds: { minX: -10, maxX: 100, minY: -100, maxY: 100 }, mode: 'any' },
    },
  };
}

import { describe, expect, it } from 'vitest';
import { compileBehavior } from '../../src/compiler/compileBehaviors';
import type { SceneSpec } from '../../src/model/types';

function sceneWithParallelAndNever(): SceneSpec {
  return {
    id: 'scene',
    entities: { e1: { id: 'e1', x: 0, y: 0, width: 10, height: 10 } },
    groups: {},
    attachments: {},
    behaviors: { b1: { id: 'b1', target: { type: 'entity', entityId: 'e1' }, rootActionId: 'a1' } },
    actions: {
      a1: { id: 'a1', type: 'Parallel', children: ['a2', 'a3'] } as any,
      a2: { id: 'a2', type: 'Wait', durationMs: 10 },
      a3: { id: 'a3', type: 'MoveUntil', target: { type: 'entity', entityId: 'e1' }, velocity: { x: 100, y: 0 }, conditionId: 'c1' },
    },
    conditions: {
      c1: { id: 'c1', type: 'Never' } as any,
    },
  };
}

describe('compileBehaviors parity', () => {
  it('CB1 Parallel compiles and runs child actions', () => {
    const scene = sceneWithParallelAndNever();
    const behavior = scene.behaviors.b1;
    const action = compileBehavior(behavior, { scene, targets: { entities: { e1: { id: 'e1', x: 0, y: 0, width: 10, height: 10, vx: 0, vy: 0 } }, groups: {} } });
    action.start();
    action.update(10);
    // Wait completes, MoveUntil continues (Never), so Parallel not complete.
    expect(action.isComplete()).toBe(false);
  });
});


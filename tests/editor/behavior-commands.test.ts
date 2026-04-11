import { describe, expect, it } from 'vitest';
import {
  appendActionToBehavior,
  assignBehaviorToTarget,
  createDefaultBehaviorForTarget,
  getPrimaryBehaviorForTarget,
  moveSequenceChild,
  removeBehavior,
  removeSequenceChild,
} from '../../src/editor/behaviorCommands';
import { createEmptyScene } from '../../src/model/emptyScene';
import { sampleScene } from '../../src/model/sampleScene';

describe('behavior commands', () => {
  it('creates a default behavior flow with no root action initially', () => {
    const scene = createEmptyScene();
    scene.entities.e1 = { id: 'e1', x: 10, y: 20, width: 16, height: 16 };

    const { scene: next, behaviorId } = createDefaultBehaviorForTarget(scene, { type: 'entity', entityId: 'e1' });
    const behavior = next.behaviors[behaviorId];

    expect(behavior).toBeDefined();
    expect(behavior.target).toEqual({ type: 'entity', entityId: 'e1' });
    expect(behavior.rootActionId).toBeUndefined();
    expect(Object.keys(next.actions)).toEqual([]);
  });

  it('creates a MoveUntil action with a default bounds condition for a group target', () => {
    const { scene: withBehavior, behaviorId } = createDefaultBehaviorForTarget(sampleScene, { type: 'group', groupId: 'g-enemies' });
    const { scene: next, actionId } = appendActionToBehavior(withBehavior, behaviorId, 'MoveUntil');

    const action = next.actions[actionId];
    expect(action.type).toBe('MoveUntil');
    expect(action.target).toEqual({ type: 'group', groupId: 'g-enemies' });

    const condition = next.conditions[action.conditionId];
    expect(condition.type).toBe('BoundsHit');
    expect(condition.bounds).toEqual({ minX: 0, minY: 0, maxX: 1024, maxY: 768 });
    expect(condition.scope).toBe('group-extents');
    expect(condition.behavior).toBe('limit');
  });

  it('removes a behavior and prunes its orphaned actions and conditions', () => {
    const next = removeBehavior(sampleScene, 'b-formation');

    expect(next.behaviors['b-formation']).toBeUndefined();
    expect(Object.keys(next.actions)).toEqual([]);
    expect(Object.keys(next.conditions)).toEqual([]);
  });

  it('reorders and removes sequence children while keeping the scene reachable', () => {
    const moved = moveSequenceChild(sampleScene, 'a-seq', 'a-drop-right', 'up');
    expect(moved.actions['a-seq'].children.indexOf('a-drop-right')).toBe(0);

    const removed = removeSequenceChild(moved, 'a-seq', 'a-drop-right');
    expect(removed.actions['a-seq'].children).not.toContain('a-drop-right');
    expect(removed.actions['a-drop-right']).toBeUndefined();
  });

  it('reassigns an existing behavior to a new target and retargets target-aware actions', () => {
    const scene = {
      ...sampleScene,
      entities: {
        ...sampleScene.entities,
        extra: { id: 'extra', x: 300, y: 300, width: 20, height: 20 },
      },
    };

    const next = assignBehaviorToTarget(scene, 'b-formation', { type: 'entity', entityId: 'extra' });
    const behavior = getPrimaryBehaviorForTarget(next, { type: 'entity', entityId: 'extra' });

    expect(behavior?.id).toBe('b-formation');
    expect(next.actions['a-move-right'].target).toEqual({ type: 'entity', entityId: 'extra' });
    expect(next.actions['a-drop-right'].target).toEqual({ type: 'entity', entityId: 'extra' });
  });
});

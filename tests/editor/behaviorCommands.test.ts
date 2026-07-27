import { describe, expect, it } from 'vitest';
import {
  appendActionToBehavior,
  assignBehaviorToTarget,
  createDefaultBehaviorForTarget,
  getNextFormationName,
  getPrimaryBehaviorForEntity,
  getPrimaryBehaviorForGroup,
  moveSequenceChild,
  removeBehavior,
  removeSequenceChild,
  renameBehavior,
} from '../../src/editor/behaviorCommands';
import { baseScene } from '../helpers';

describe('behavior commands', () => {
  it('creates default behaviors with stable labels and reuses an existing behavior', () => {
    const scene = baseScene();
    const created = createDefaultBehaviorForTarget(scene, { type: 'entity', entityId: 'e1' });
    expect(created.scene.behaviors[created.behaviorId]).toMatchObject({ name: 'e1 Flow', target: { type: 'entity', entityId: 'e1' } });
    expect(createDefaultBehaviorForTarget(created.scene, { type: 'entity', entityId: 'e1' }).behaviorId).toBe(created.behaviorId);
    expect(getPrimaryBehaviorForGroup(scene, 'g1')?.id).toBe('b1');
    expect(getPrimaryBehaviorForEntity(scene, 'e1')).toBeUndefined();
  });

  it('appends MoveUntil, Wait, and Call actions to a behavior sequence', () => {
    let scene = baseScene();
    for (const type of ['MoveUntil', 'Wait', 'Call'] as const) {
      const result = appendActionToBehavior(scene, 'b1', type);
      scene = result.scene;
      expect(scene.actions[result.actionId]?.type).toBe(type);
    }
    const root = scene.actions.a1;
    expect(root.type).toBe('Sequence');
    if (root.type === 'Sequence') expect(root.children).toHaveLength(5);
    expect(appendActionToBehavior(scene, 'missing', 'Wait')).toEqual({ scene, actionId: '' });
  });

  it('retargets behavior actions and removes the displaced behavior', () => {
    const scene = baseScene();
    const withSecond = createDefaultBehaviorForTarget(scene, { type: 'entity', entityId: 'e1' }).scene;
    const secondId = Object.keys(withSecond.behaviors).find((id) => id !== 'b1')!;
    const withAction = appendActionToBehavior(withSecond, secondId, 'MoveUntil').scene;
    const assigned = assignBehaviorToTarget(withAction, secondId, { type: 'group', groupId: 'g1' });
    expect(assigned.behaviors[secondId].target).toEqual({ type: 'group', groupId: 'g1' });
    expect(assigned.behaviors.b1).toBeUndefined();
    const moveAction = Object.values(assigned.actions).find((action) => action.type === 'MoveUntil');
    expect(moveAction).toMatchObject({ target: { type: 'group', groupId: 'g1' } });
    expect(renameBehavior(assigned, secondId, 'Patrol').behaviors[secondId].name).toBe('Patrol');
    expect(removeBehavior(assigned, 'missing')).toBe(assigned);
  });

  it('moves and removes sequence subtrees while pruning unreachable actions', () => {
    const scene = baseScene();
    expect(moveSequenceChild(scene, 'a1', 'a2', 'down').actions.a1).toMatchObject({ children: ['a3', 'a2'] });
    expect(moveSequenceChild(scene, 'a1', 'a2', 'up')).toBe(scene);
    const removed = removeSequenceChild(scene, 'a1', 'a2');
    expect(removed.actions.a2).toBeUndefined();
    expect(removed.conditions.c1).toBeUndefined();
    expect(removeSequenceChild(scene, 'a1', 'missing')).toBe(scene);
  });

  it('allocates the first unused formation name', () => {
    const scene = baseScene();
    scene.groups.g2 = { id: 'g2', name: 'Formation 1', members: [] };
    scene.groups.g3 = { id: 'g3', name: 'Formation 3', members: [] };
    expect(getNextFormationName(scene)).toBe('Formation 2');
  });
});

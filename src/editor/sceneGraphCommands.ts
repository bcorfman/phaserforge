import { type ActionSpec, type Id, type SceneSpec } from '../model/types';
import { removeBehavior, removeSequenceChild } from './behaviorCommands';

function pruneUnreachable(scene: SceneSpec): SceneSpec {
  const reachableActionIds = new Set<Id>();

  const visitAction = (actionId: Id) => {
    if (reachableActionIds.has(actionId)) return;
    const action = scene.actions[actionId];
    if (!action) return;

    reachableActionIds.add(actionId);
    if (action.type === 'Sequence') {
      action.children.forEach(visitAction);
    } else if (action.type === 'Repeat') {
      visitAction(action.childId);
    }
  };

  Object.values(scene.behaviors).forEach((behavior) => {
    if (behavior.rootActionId) visitAction(behavior.rootActionId);
  });

  const actions = Object.fromEntries(
    Object.entries(scene.actions).filter(([id]) => reachableActionIds.has(id))
  );
  const reachableConditionIds = new Set<Id>();

  Object.values(actions).forEach((action) => {
    if (action.type === 'MoveUntil') {
      reachableConditionIds.add(action.conditionId);
    }
  });

  const conditions = Object.fromEntries(
    Object.entries(scene.conditions).filter(([id]) => reachableConditionIds.has(id))
  );

  return {
    ...scene,
    actions,
    conditions,
  };
}

function findParentActionId(scene: SceneSpec, childId: Id): Id | undefined {
  return Object.values(scene.actions).find((action) => {
    if (action.type === 'Sequence') {
      return action.children.includes(childId);
    }
    return action.type === 'Repeat' && action.childId === childId;
  })?.id;
}

function removeGroupOnly(scene: SceneSpec, groupId: Id): SceneSpec {
  if (!scene.groups[groupId]) return scene;

  let nextScene = scene;
  for (const behavior of Object.values(nextScene.behaviors)) {
    if (behavior.target.type === 'group' && behavior.target.groupId === groupId) {
      nextScene = removeBehavior(nextScene, behavior.id);
    }
  }

  const { [groupId]: removedGroup, ...remainingGroups } = nextScene.groups;
  void removedGroup;

  return {
    ...nextScene,
    groups: remainingGroups,
  };
}

export function removeActionFromScene(scene: SceneSpec, actionId: Id): SceneSpec {
  if (!scene.actions[actionId]) return scene;

  const owningBehavior = Object.values(scene.behaviors).find((behavior) => behavior.rootActionId && behavior.rootActionId === actionId);
  if (owningBehavior) {
    return removeBehavior(scene, owningBehavior.id);
  }

  const parentId = findParentActionId(scene, actionId);
  if (!parentId) {
    const { [actionId]: removedAction, ...remainingActions } = scene.actions;
    void removedAction;
    return pruneUnreachable({
      ...scene,
      actions: remainingActions,
    });
  }

  const parent = scene.actions[parentId];
  if (parent?.type === 'Sequence') {
    return removeSequenceChild(scene, parent.id, actionId);
  }
  if (parent?.type === 'Repeat') {
    return removeActionFromScene(scene, parent.id);
  }

  return scene;
}

export function removeConditionFromScene(scene: SceneSpec, conditionId: Id): SceneSpec {
  if (!scene.conditions[conditionId]) return scene;

  let nextScene = scene;
  const dependentActionIds = Object.values(scene.actions)
    .filter((action) => action.type === 'MoveUntil' && action.conditionId === conditionId)
    .map((action) => action.id);

  for (const actionId of dependentActionIds) {
    nextScene = removeActionFromScene(nextScene, actionId);
  }

  if (!nextScene.conditions[conditionId]) {
    return nextScene;
  }

  const { [conditionId]: removedCondition, ...remainingConditions } = nextScene.conditions;
  void removedCondition;
  return {
    ...nextScene,
    conditions: remainingConditions,
  };
}

export function removeEntityFromScene(scene: SceneSpec, entityId: Id): SceneSpec {
  if (!scene.entities[entityId]) return scene;

  let nextScene = scene;

  for (const behavior of Object.values(nextScene.behaviors)) {
    if (behavior.target.type === 'entity' && behavior.target.entityId === entityId) {
      nextScene = removeBehavior(nextScene, behavior.id);
    }
  }

  for (const group of Object.values(nextScene.groups)) {
    if (!group.members.includes(entityId)) continue;

    if (group.members.length <= 1) {
      nextScene = removeGroupOnly(nextScene, group.id);
    } else {
      nextScene = {
        ...nextScene,
        groups: {
          ...nextScene.groups,
          [group.id]: {
            ...group,
            members: group.members.filter((memberId) => memberId !== entityId),
            layout: { type: 'freeform' },
          },
        },
      };
    }
  }

  const { [entityId]: removedEntity, ...remainingEntities } = nextScene.entities;
  void removedEntity;

  return pruneUnreachable({
    ...nextScene,
    entities: remainingEntities,
  });
}

export function removeGroupFromScene(scene: SceneSpec, groupId: Id): SceneSpec {
  const group = scene.groups[groupId];
  if (!group) return scene;

  let nextScene = removeGroupOnly(scene, groupId);
  for (const memberId of group.members) {
    nextScene = removeEntityFromScene(nextScene, memberId);
  }

  return pruneUnreachable(nextScene);
}

export function removeBehaviorFromScene(scene: SceneSpec, behaviorId: Id): SceneSpec {
  if (!scene.behaviors[behaviorId]) return scene;
  return removeBehavior(scene, behaviorId);
}

export function removeSceneGraphItem(
  scene: SceneSpec,
  item: { kind: 'entity' | 'group' | 'behavior' | 'action' | 'condition'; id: Id }
): SceneSpec {
  switch (item.kind) {
    case 'entity':
      return removeEntityFromScene(scene, item.id);
    case 'group':
      return removeGroupFromScene(scene, item.id);
    case 'behavior':
      return removeBehaviorFromScene(scene, item.id);
    case 'action':
      return removeActionFromScene(scene, item.id);
    case 'condition':
      return removeConditionFromScene(scene, item.id);
    default:
      return scene;
  }
}

export function getActionGraphLabel(action: ActionSpec): string {
  return action.name ?? action.id;
}

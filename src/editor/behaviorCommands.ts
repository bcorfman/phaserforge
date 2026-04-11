import {
  type ActionSpec,
  type BehaviorSpec,
  type BoundsHitConditionSpec,
  type GroupSpec,
  type Id,
  type SceneSpec,
  type SequenceActionSpec,
  type TargetRef,
} from '../model/types';
import { getSceneWorld } from './sceneWorld';

function targetsEqual(a: TargetRef, b: TargetRef): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'entity' && b.type === 'entity') {
    return a.entityId === b.entityId;
  }

  return a.groupId === (b as Extract<TargetRef, { type: 'group' }>).groupId;
}

function makeIdFactory(scene: SceneSpec) {
  let counter = 1;
  const usedIds = new Set([
    ...Object.keys(scene.groups),
    ...Object.keys(scene.behaviors),
    ...Object.keys(scene.actions),
    ...Object.keys(scene.conditions),
  ]);

  return (prefix: 'b' | 'a' | 'c' | 'g'): Id => {
    while (usedIds.has(`${prefix}-generated-${counter}`)) {
      counter += 1;
    }
    const id = `${prefix}-generated-${counter}`;
    usedIds.add(id);
    counter += 1;
    return id;
  };
}

function getTargetLabel(scene: SceneSpec, target: TargetRef): string {
  if (target.type === 'entity') {
    return scene.entities[target.entityId]?.name ?? target.entityId;
  }

  return scene.groups[target.groupId]?.name ?? target.groupId;
}

function collectReachableActionIds(scene: SceneSpec): Set<Id> {
  const visited = new Set<Id>();

  const visit = (actionId: Id) => {
    if (visited.has(actionId)) return;
    const action = scene.actions[actionId];
    if (!action) return;

    visited.add(actionId);
    if (action.type === 'Sequence') {
      action.children.forEach(visit);
    } else if (action.type === 'Repeat') {
      visit(action.childId);
    }
  };

  Object.values(scene.behaviors).forEach((behavior) => visit(behavior.rootActionId));
  return visited;
}

function pruneUnreachable(scene: SceneSpec): SceneSpec {
  const reachableActionIds = collectReachableActionIds(scene);
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

function getBehaviorSequenceRoot(scene: SceneSpec, behaviorId: Id): SequenceActionSpec | undefined {
  const behavior = scene.behaviors[behaviorId];
  if (!behavior) return undefined;

  const root = scene.actions[behavior.rootActionId];
  if (!root) return undefined;
  if (root.type === 'Sequence') return root;
  if (root.type !== 'Repeat') return undefined;

  const child = scene.actions[root.childId];
  return child?.type === 'Sequence' ? child : undefined;
}

function retargetBehaviorActions(scene: SceneSpec, actionId: Id, target: TargetRef): SceneSpec {
  const action = scene.actions[actionId];
  if (!action) return scene;

  let nextScene = scene;
  if (action.type === 'MoveUntil') {
    nextScene = {
      ...nextScene,
      actions: {
        ...nextScene.actions,
        [action.id]: { ...action, target },
      },
    };
  } else if (action.type === 'Call') {
    nextScene = {
      ...nextScene,
      actions: {
        ...nextScene.actions,
        [action.id]: { ...action, target },
      },
    };
  }

  if (action.type === 'Sequence') {
    return action.children.reduce((currentScene, childId) => retargetBehaviorActions(currentScene, childId, target), nextScene);
  }

  if (action.type === 'Repeat') {
    return retargetBehaviorActions(nextScene, action.childId, target);
  }

  return nextScene;
}

export function getPrimaryBehaviorForTarget(scene: SceneSpec, target: TargetRef): BehaviorSpec | undefined {
  return Object.values(scene.behaviors).find((behavior) => targetsEqual(behavior.target, target));
}

export function getPrimaryBehaviorForGroup(scene: SceneSpec, groupId: Id): BehaviorSpec | undefined {
  return getPrimaryBehaviorForTarget(scene, { type: 'group', groupId });
}

export function getPrimaryBehaviorForEntity(scene: SceneSpec, entityId: Id): BehaviorSpec | undefined {
  return getPrimaryBehaviorForTarget(scene, { type: 'entity', entityId });
}

export function createDefaultBehaviorForTarget(scene: SceneSpec, target: TargetRef): { scene: SceneSpec; behaviorId: Id } {
  const existing = getPrimaryBehaviorForTarget(scene, target);
  if (existing) {
    return { scene, behaviorId: existing.id };
  }

  const nextId = makeIdFactory(scene);
  const behaviorId = nextId('b');
  const label = getTargetLabel(scene, target);

  return {
    behaviorId,
    scene: {
      ...scene,
      behaviors: {
        ...scene.behaviors,
        [behaviorId]: {
          id: behaviorId,
          name: `${label} Flow`,
          target,
        },
      },
    },
  };
}

export function removeBehavior(scene: SceneSpec, behaviorId: Id): SceneSpec {
  if (!scene.behaviors[behaviorId]) return scene;
  const { [behaviorId]: removedBehavior, ...remainingBehaviors } = scene.behaviors;
  void removedBehavior;

  return pruneUnreachable({
    ...scene,
    behaviors: remainingBehaviors,
  });
}

export function assignBehaviorToTarget(scene: SceneSpec, behaviorId: Id, target: TargetRef): SceneSpec {
  const behavior = scene.behaviors[behaviorId];
  if (!behavior) return scene;

  const currentBehavior = getPrimaryBehaviorForTarget(scene, target);
  let nextScene = scene;
  if (currentBehavior && currentBehavior.id !== behaviorId) {
    nextScene = removeBehavior(nextScene, currentBehavior.id);
  }

  nextScene = {
    ...nextScene,
    behaviors: {
      ...nextScene.behaviors,
      [behaviorId]: {
        ...nextScene.behaviors[behaviorId],
        target,
      },
    },
  };

  const rootActionId = nextScene.behaviors[behaviorId].rootActionId;
  if (rootActionId) {
    return retargetBehaviorActions(nextScene, rootActionId, target);
  }
  return nextScene;
}

export function renameBehavior(scene: SceneSpec, behaviorId: Id, name: string): SceneSpec {
  const behavior = scene.behaviors[behaviorId];
  if (!behavior) return scene;
  return {
    ...scene,
    behaviors: {
      ...scene.behaviors,
      [behaviorId]: {
        ...behavior,
        name,
      },
    },
  };
}

export function appendActionToBehavior(
  scene: SceneSpec,
  behaviorId: Id,
  actionType: 'MoveUntil' | 'Wait' | 'Call'
): { scene: SceneSpec; actionId: Id } {
  const behavior = scene.behaviors[behaviorId];
  if (!behavior) {
    return { scene, actionId: '' };
  }

  const nextId = makeIdFactory(scene);
  let sequence = behavior.rootActionId ? getBehaviorSequenceRoot(scene, behaviorId) : undefined;
  
  // If no root action exists, create a Sequence to hold this action
  if (!behavior.rootActionId || !sequence) {
    const sequenceId = nextId('a');
    sequence = {
      id: sequenceId,
      type: 'Sequence' as const,
      children: [],
    };
    
    scene = {
      ...scene,
      behaviors: {
        ...scene.behaviors,
        [behaviorId]: {
          ...behavior,
          rootActionId: sequenceId,
        },
      },
      actions: {
        ...scene.actions,
        [sequenceId]: sequence,
      },
    };
  }

  const actionId = nextId('a');
  let nextScene = scene;

  if (actionType === 'MoveUntil') {
    const world = getSceneWorld(scene);
    const conditionId = nextId('c');
    const condition: BoundsHitConditionSpec = {
      id: conditionId,
      type: 'BoundsHit',
      bounds: { minX: 0, minY: 0, maxX: world.width, maxY: world.height },
      mode: 'any',
      scope: behavior.target.type === 'group' ? 'group-extents' : 'member-any',
      behavior: 'limit',
    };

    nextScene = {
      ...nextScene,
      conditions: {
        ...nextScene.conditions,
        [conditionId]: condition,
      },
      actions: {
        ...nextScene.actions,
        [actionId]: {
          id: actionId,
          type: 'MoveUntil',
          name: 'Move',
          target: behavior.target,
          velocity: { x: 80, y: 0 },
          conditionId,
        },
      },
    };
  } else if (actionType === 'Wait') {
    nextScene = {
      ...nextScene,
      actions: {
        ...nextScene.actions,
        [actionId]: {
          id: actionId,
          type: 'Wait',
          name: 'Pause',
          durationMs: 150,
        },
      },
    };
  } else {
    nextScene = {
      ...nextScene,
      actions: {
        ...nextScene.actions,
        [actionId]: {
          id: actionId,
          type: 'Call',
          name: 'Drop',
          callId: 'drop',
          target: behavior.target,
          args: { dy: 24 },
        },
      },
    };
  }

  return {
    actionId,
    scene: {
      ...nextScene,
      actions: {
        ...nextScene.actions,
        [sequence.id]: {
          ...sequence,
          children: [...sequence.children, actionId],
        },
      },
    },
  };
}

export function moveSequenceChild(scene: SceneSpec, sequenceId: Id, childId: Id, direction: 'up' | 'down'): SceneSpec {
  const sequence = scene.actions[sequenceId];
  if (!sequence || sequence.type !== 'Sequence') return scene;

  const index = sequence.children.indexOf(childId);
  if (index === -1) return scene;

  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= sequence.children.length) return scene;

  const children = [...sequence.children];
  [children[index], children[nextIndex]] = [children[nextIndex], children[index]];

  return {
    ...scene,
    actions: {
      ...scene.actions,
      [sequenceId]: {
        ...sequence,
        children,
      },
    },
  };
}

function collectActionSubtreeIds(scene: SceneSpec, actionId: Id, visited = new Set<Id>()): Set<Id> {
  if (visited.has(actionId)) return visited;
  const action = scene.actions[actionId];
  if (!action) return visited;

  visited.add(actionId);
  if (action.type === 'Sequence') {
    action.children.forEach((childId) => collectActionSubtreeIds(scene, childId, visited));
  } else if (action.type === 'Repeat') {
    collectActionSubtreeIds(scene, action.childId, visited);
  }

  return visited;
}

export function removeSequenceChild(scene: SceneSpec, sequenceId: Id, childId: Id): SceneSpec {
  const sequence = scene.actions[sequenceId];
  if (!sequence || sequence.type !== 'Sequence' || !sequence.children.includes(childId)) return scene;

  const removedIds = collectActionSubtreeIds(scene, childId);
  const actions = Object.fromEntries(
    Object.entries(scene.actions).filter(([id]) => !removedIds.has(id))
  );

  return pruneUnreachable({
    ...scene,
    actions: {
      ...actions,
      [sequenceId]: {
        ...sequence,
        children: sequence.children.filter((id) => id !== childId),
      },
    },
  });
}

export function getNextFormationName(scene: SceneSpec): string {
  const usedNumbers = new Set(
    Object.values(scene.groups)
      .map((group) => group.name)
      .map((name) => name?.match(/^Formation (\d+)$/)?.[1])
      .filter(Boolean)
      .map((value) => Number(value))
  );

  let candidate = 1;
  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }

  return `Formation ${candidate}`;
}

export function getAssignableBehaviors(scene: SceneSpec, target: TargetRef): BehaviorSpec[] {
  return Object.values(scene.behaviors).filter((behavior) => !targetsEqual(behavior.target, target));
}

export function getSequenceChildren(scene: SceneSpec, behaviorId: Id): ActionSpec[] {
  return getBehaviorSequenceRoot(scene, behaviorId)?.children.map((childId) => scene.actions[childId]).filter(Boolean) ?? [];
}

export function createGroupSpec(groupId: Id, members: Id[], name: string): GroupSpec {
  return {
    id: groupId,
    name,
    members,
    layout: { type: 'freeform' },
  };
}

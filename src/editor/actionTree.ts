import { type ActionSpec, type Id, type SceneSpec } from '../model/types';

export interface ActionTreeNode {
  id: Id;
  action: ActionSpec;
  children: ActionTreeNode[];
}

export interface BehaviorActionTree {
  behaviorId: Id;
  root?: ActionTreeNode;
}

export function buildBehaviorActionTrees(scene: SceneSpec): BehaviorActionTree[] {
  return Object.values(scene.behaviors).map((behavior) => ({
    behaviorId: behavior.id,
    root: buildActionTreeNode(scene, behavior.rootActionId, new Set()),
  }));
}

function buildActionTreeNode(scene: SceneSpec, actionId: Id, visited: Set<Id>): ActionTreeNode | undefined {
  const action = scene.actions[actionId];
  if (!action || visited.has(actionId)) return undefined;

  const nextVisited = new Set(visited);
  nextVisited.add(actionId);

  return {
    id: action.id,
    action,
    children: getChildActionIds(action)
      .map((childId) => buildActionTreeNode(scene, childId, nextVisited))
      .filter((child): child is ActionTreeNode => Boolean(child)),
  };
}

function getChildActionIds(action: ActionSpec): Id[] {
  switch (action.type) {
    case 'Sequence':
      return action.children;
    case 'Repeat':
      return [action.childId];
    default:
      return [];
  }
}

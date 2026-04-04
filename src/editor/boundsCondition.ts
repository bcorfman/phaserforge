import { type Selection } from './EditorStore';
import { type Id, type SceneSpec } from '../model/types';

export function getPrimaryBoundsConditionId(scene: SceneSpec): Id | undefined {
  return Object.values(scene.conditions).find((condition) => condition.type === 'BoundsHit')?.id;
}

export function getEditableBoundsConditionId(scene: SceneSpec, selection: Selection): Id | undefined {
  if (selection.kind === 'condition') {
    return scene.conditions[selection.id]?.type === 'BoundsHit' ? selection.id : undefined;
  }

  if (selection.kind === 'action') {
    const action = scene.actions[selection.id];
    if (action?.type === 'MoveUntil' && scene.conditions[action.conditionId]?.type === 'BoundsHit') {
      return action.conditionId;
    }
  }

  return undefined;
}

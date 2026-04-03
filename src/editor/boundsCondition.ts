import { type Id, type SceneSpec } from '../model/types';

export function getPrimaryBoundsConditionId(scene: SceneSpec): Id | undefined {
  return Object.values(scene.conditions).find((condition) => condition.type === 'BoundsHit')?.id;
}

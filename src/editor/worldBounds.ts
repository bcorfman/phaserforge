import { type BoundsHitConditionSpec, type SceneSpec, type WorldSpec } from '../model/types';
import { getSceneWorld } from './sceneWorld';

export function syncBoundsToWorldResize(scene: SceneSpec, nextWorld: WorldSpec): SceneSpec {
  const previousWorld = getSceneWorld(scene);
  const nextConditions = Object.fromEntries(
    Object.entries(scene.conditions).map(([id, condition]) => {
      if (condition.type !== 'BoundsHit') return [id, condition];
      return [id, resizeBoundsCondition(condition, previousWorld, nextWorld)];
    })
  );

  return {
    ...scene,
    world: nextWorld,
    conditions: nextConditions,
  };
}

function resizeBoundsCondition(
  condition: BoundsHitConditionSpec,
  previousWorld: WorldSpec,
  nextWorld: WorldSpec
): BoundsHitConditionSpec {
  const rightInset = previousWorld.width - condition.bounds.maxX;
  const bottomInset = previousWorld.height - condition.bounds.maxY;

  return {
    ...condition,
    bounds: {
      minX: condition.bounds.minX,
      minY: condition.bounds.minY,
      maxX: Math.max(condition.bounds.minX, nextWorld.width - rightInset),
      maxY: Math.max(condition.bounds.minY, nextWorld.height - bottomInset),
    },
  };
}

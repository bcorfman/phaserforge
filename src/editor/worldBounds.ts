import { type InlineBoundsHitConditionSpec, type SceneSpec, type WorldSpec } from '../model/types';
import { getSceneWorld } from './sceneWorld';

export function syncBoundsToWorldResize(scene: SceneSpec, nextWorld: WorldSpec): SceneSpec {
  const previousWorld = getSceneWorld(scene);
  const nextAttachments = Object.fromEntries(
    Object.entries(scene.attachments).map(([id, attachment]) => {
      if (attachment.condition?.type !== 'BoundsHit') return [id, attachment];
      return [id, { ...attachment, condition: resizeBoundsCondition(attachment.condition, previousWorld, nextWorld) }];
    })
  );

  return {
    ...scene,
    world: nextWorld,
    attachments: nextAttachments,
  };
}

function resizeBoundsCondition(
  condition: InlineBoundsHitConditionSpec,
  previousWorld: WorldSpec,
  nextWorld: WorldSpec
): InlineBoundsHitConditionSpec {
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

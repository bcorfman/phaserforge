import { EntitySpec } from './types';

export interface ResolvedEntitySpec extends EntitySpec {
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
  originX: number;
  originY: number;
  alpha: number;
  visible: boolean;
  depth: number;
  flipX: boolean;
  flipY: boolean;
}

export function resolveEntityDefaults(entity: EntitySpec): ResolvedEntitySpec {
  return {
    ...entity,
    rotationDeg: entity.rotationDeg ?? 0,
    scaleX: entity.scaleX ?? 1,
    scaleY: entity.scaleY ?? 1,
    originX: entity.originX ?? 0.5,
    originY: entity.originY ?? 0.5,
    alpha: entity.alpha ?? 1,
    visible: entity.visible ?? true,
    depth: entity.depth ?? 0,
    flipX: entity.flipX ?? false,
    flipY: entity.flipY ?? false,
  };
}

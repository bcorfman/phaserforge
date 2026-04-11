import { RuntimeEntity } from '../targets/types';

export interface DisplayObjectAdapter {
  x: number;
  y: number;
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  originX?: number;
  originY?: number;
  alpha?: number;
  visible?: boolean;
  depth?: number;
  flipX?: boolean;
  flipY?: boolean;
}

export function createDisplayObjectAdapter(): DisplayObjectAdapter {
  return { x: 0, y: 0, angle: 0, scaleX: 1, scaleY: 1, originX: 0.5, originY: 0.5, alpha: 1, visible: true, depth: 0, flipX: false, flipY: false };
}

export function syncEntityToDisplay(entity: RuntimeEntity, display: DisplayObjectAdapter): void {
  display.x = entity.x;
  display.y = entity.y;
  display.angle = entity.rotationDeg ?? 0;
  display.scaleX = entity.scaleX ?? 1;
  display.scaleY = entity.scaleY ?? 1;
  display.originX = entity.originX ?? 0.5;
  display.originY = entity.originY ?? 0.5;
  display.alpha = entity.alpha ?? 1;
  display.visible = entity.visible ?? true;
  display.depth = entity.depth ?? 0;
  display.flipX = entity.flipX ?? false;
  display.flipY = entity.flipY ?? false;
}

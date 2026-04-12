import { RuntimeEntity } from './targets/types';

export interface RectBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function normalizeRotationDeg(rotationDeg: number | undefined): number {
  const value = Number.isFinite(rotationDeg) ? rotationDeg! : 0;
  const normalized = ((value % 360) + 360) % 360;
  return normalized;
}

export function getEntityDisplaySize(entity: Pick<RuntimeEntity, 'width' | 'height' | 'scaleX' | 'scaleY'>): { width: number; height: number } {
  return {
    width: entity.width * Math.abs(entity.scaleX ?? 1),
    height: entity.height * Math.abs(entity.scaleY ?? 1),
  };
}

export function getRotatedEntityBounds(entity: Pick<RuntimeEntity, 'x' | 'y' | 'width' | 'height' | 'rotationDeg' | 'scaleX' | 'scaleY' | 'originX' | 'originY'>): RectBounds {
  const angle = normalizeRotationDeg(entity.rotationDeg) * (Math.PI / 180);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const { width, height } = getEntityDisplaySize(entity);
  const originX = entity.originX ?? 0.5;
  const originY = entity.originY ?? 0.5;
  const corners = [
    { x: -originX * width, y: -originY * height },
    { x: (1 - originX) * width, y: -originY * height },
    { x: -originX * width, y: (1 - originY) * height },
    { x: (1 - originX) * width, y: (1 - originY) * height },
  ].map((corner) => ({
    x: entity.x + (corner.x * cos - corner.y * sin),
    y: entity.y + (corner.x * sin + corner.y * cos),
  }));

  return {
    minX: Math.min(...corners.map((corner) => corner.x)),
    maxX: Math.max(...corners.map((corner) => corner.x)),
    minY: Math.min(...corners.map((corner) => corner.y)),
    maxY: Math.max(...corners.map((corner) => corner.y)),
  };
}

export function getRotatedEntityBoundaryBounds(
  entity: Pick<RuntimeEntity, 'x' | 'y' | 'width' | 'height' | 'hitbox' | 'rotationDeg' | 'scaleX' | 'scaleY' | 'originX' | 'originY' | 'flipX' | 'flipY'>
): RectBounds {
  const hitbox = entity.hitbox;
  if (!hitbox) {
    return getRotatedEntityBounds(entity);
  }

  const angle = normalizeRotationDeg(entity.rotationDeg) * (Math.PI / 180);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const originX = entity.originX ?? 0.5;
  const originY = entity.originY ?? 0.5;
  const scaleX = Math.abs(entity.scaleX ?? 1);
  const scaleY = Math.abs(entity.scaleY ?? 1);

  const baseWidth = entity.width;
  const baseHeight = entity.height;

  const hbX = (entity.flipX ?? false) ? (baseWidth - hitbox.x - hitbox.width) : hitbox.x;
  const hbY = (entity.flipY ?? false) ? (baseHeight - hitbox.y - hitbox.height) : hitbox.y;

  const originPxX = originX * baseWidth;
  const originPxY = originY * baseHeight;

  const corners = [
    { x: hbX, y: hbY },
    { x: hbX + hitbox.width, y: hbY },
    { x: hbX, y: hbY + hitbox.height },
    { x: hbX + hitbox.width, y: hbY + hitbox.height },
  ].map((corner) => {
    const dx = (corner.x - originPxX) * scaleX;
    const dy = (corner.y - originPxY) * scaleY;
    return {
      x: entity.x + (dx * cos - dy * sin),
      y: entity.y + (dx * sin + dy * cos),
    };
  });

  return {
    minX: Math.min(...corners.map((corner) => corner.x)),
    maxX: Math.max(...corners.map((corner) => corner.x)),
    minY: Math.min(...corners.map((corner) => corner.y)),
    maxY: Math.max(...corners.map((corner) => corner.y)),
  };
}

export function getRectSpan(bounds: RectBounds): { width: number; height: number } {
  return {
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
}

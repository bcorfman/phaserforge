import type { HitboxSpec } from '../model/types';

export type AutoHitboxOptions = {
  alphaThreshold?: number;
};

export type ImageDataLike = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export function computeHitboxFromImageData(
  imageData: ImageDataLike,
  options: AutoHitboxOptions = {}
): HitboxSpec | null {
  const { data, width, height } = imageData;
  if (width <= 0 || height <= 0) return null;

  const alphaThreshold = Math.max(0, Math.min(255, Math.floor(options.alphaThreshold ?? 1)));

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const a = data[rowOffset + x * 4 + 3];
      if (a < alphaThreshold) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export function mapHitboxToEntitySize(
  hitbox: HitboxSpec,
  sourceSize: { width: number; height: number },
  entitySize: { width: number; height: number }
): HitboxSpec {
  const scaleX = sourceSize.width > 0 ? entitySize.width / sourceSize.width : 1;
  const scaleY = sourceSize.height > 0 ? entitySize.height / sourceSize.height : 1;
  return {
    x: hitbox.x * scaleX,
    y: hitbox.y * scaleY,
    width: hitbox.width * scaleX,
    height: hitbox.height * scaleY,
  };
}

export function clampHitboxToEntity(hitbox: HitboxSpec, entitySize: { width: number; height: number }): HitboxSpec {
  const x = Math.max(0, Math.min(entitySize.width, hitbox.x));
  const y = Math.max(0, Math.min(entitySize.height, hitbox.y));
  const width = Math.max(1, Math.min(entitySize.width - x, hitbox.width));
  const height = Math.max(1, Math.min(entitySize.height - y, hitbox.height));
  return { x, y, width, height };
}

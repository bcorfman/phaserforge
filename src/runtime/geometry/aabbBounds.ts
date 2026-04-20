export type AabbRect = { minX: number; minY: number; maxX: number; maxY: number };

export function computeAabbBounds(rects: AabbRect[]): AabbRect {
  if (rects.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  return rects.reduce(
    (acc, next) => ({
      minX: Math.min(acc.minX, next.minX),
      minY: Math.min(acc.minY, next.minY),
      maxX: Math.max(acc.maxX, next.maxX),
      maxY: Math.max(acc.maxY, next.maxY),
    }),
    rects[0]
  );
}


export function computeEdgeSafeBounds(input: {
  cx: number;
  cy: number;
  xSpan: number;
  ySpan: number;
  halfW: number;
  halfH: number;
}): { minX: number; maxX: number; minY: number; maxY: number } {
  const cx = Number(input.cx);
  const cy = Number(input.cy);
  const xSpan = Math.max(0, Number(input.xSpan));
  const ySpan = Math.max(0, Number(input.ySpan));
  const halfW = Math.max(0, Number(input.halfW));
  const halfH = Math.max(0, Number(input.halfH));

  const minX = cx - xSpan - halfW;
  const maxX = cx + xSpan + halfW;
  const minY = cy - ySpan - halfH;
  const maxY = cy + ySpan + halfH;

  return {
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX),
    minY: Math.min(minY, maxY),
    maxY: Math.max(minY, maxY),
  };
}


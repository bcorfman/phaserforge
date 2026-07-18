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

export function computeEntityAabb(entity: {
  x: number;
  y: number;
  width: number;
  height: number;
  originX?: number;
  originY?: number;
  scaleX?: number;
  scaleY?: number;
}): { minX: number; maxX: number; minY: number; maxY: number } {
  const x = Number(entity.x);
  const y = Number(entity.y);
  const width = Math.max(0, Number(entity.width));
  const height = Math.max(0, Number(entity.height));
  const originX = Number.isFinite(Number(entity.originX)) ? Number(entity.originX) : 0.5;
  const originY = Number.isFinite(Number(entity.originY)) ? Number(entity.originY) : 0.5;
  const scaleX = Number.isFinite(Number(entity.scaleX)) ? Number(entity.scaleX) : 1;
  const scaleY = Number.isFinite(Number(entity.scaleY)) ? Number(entity.scaleY) : 1;

  const displayW = width * scaleX;
  const displayH = height * scaleY;

  const left = x - originX * displayW;
  const top = y - originY * displayH;
  const right = left + displayW;
  const bottom = top + displayH;

  return {
    minX: Math.min(left, right),
    maxX: Math.max(left, right),
    minY: Math.min(top, bottom),
    maxY: Math.max(top, bottom),
  };
}

export function computeTargetAabb(
  scene: { entities: Record<string, any>; groups: Record<string, any> },
  target: { type: 'entity'; entityId: string } | { type: 'group'; groupId: string }
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (target.type === 'entity') {
    const entity = scene.entities[target.entityId];
    if (!entity) return null;
    return computeEntityAabb(entity);
  }
  const group = scene.groups[target.groupId];
  const memberIds = Array.isArray(group?.members) ? group.members : [];
  const members = memberIds.map((id: string) => scene.entities[id]).filter(Boolean);
  if (members.length === 0) return null;

  const bounds = members.map((member: any) => computeEntityAabb(member));
  return {
    minX: Math.min(...bounds.map((b: { minX: number }) => b.minX)),
    maxX: Math.max(...bounds.map((b: { maxX: number }) => b.maxX)),
    minY: Math.min(...bounds.map((b: { minY: number }) => b.minY)),
    maxY: Math.max(...bounds.map((b: { maxY: number }) => b.maxY)),
  };
}

export function boundsToCenterSpan(input: {
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  halfW: number;
  halfH: number;
}): { cx: number; cy: number; xSpan: number; ySpan: number } {
  const minX = Number(input.bounds.minX);
  const maxX = Number(input.bounds.maxX);
  const minY = Number(input.bounds.minY);
  const maxY = Number(input.bounds.maxY);
  const halfW = Math.max(0, Number(input.halfW));
  const halfH = Math.max(0, Number(input.halfH));

  const left = Math.min(minX, maxX);
  const right = Math.max(minX, maxX);
  const top = Math.min(minY, maxY);
  const bottom = Math.max(minY, maxY);

  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const halfRangeX = (right - left) / 2;
  const halfRangeY = (bottom - top) / 2;
  const xSpan = Math.max(0, halfRangeX - halfW);
  const ySpan = Math.max(0, halfRangeY - halfH);

  return { cx, cy, xSpan, ySpan };
}

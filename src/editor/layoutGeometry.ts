export type WorldRect = { minX: number; minY: number; maxX: number; maxY: number; centerX: number; centerY: number };

export function getSelectionBounds(items: Array<{ rect: WorldRect }>): WorldRect | undefined {
  if (items.length === 0) return undefined;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    minX = Math.min(minX, item.rect.minX);
    minY = Math.min(minY, item.rect.minY);
    maxX = Math.max(maxX, item.rect.maxX);
    maxY = Math.max(maxY, item.rect.maxY);
  }
  return { minX, minY, maxX, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}

export function alignSelectionToWorld(
  items: Array<{ id: string; x: number; y: number; rect: WorldRect }>,
  align: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom',
  worldWidth: number,
  worldHeight: number
): Array<{ id: string; x: number; y: number }> {
  const bounds = getSelectionBounds(items);
  if (!bounds) return [];
  const w = Number(worldWidth);
  const h = Number(worldHeight);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return [];

  let dx = 0;
  let dy = 0;
  if (align === 'left') dx = 0 - bounds.minX;
  else if (align === 'centerX') dx = w / 2 - bounds.centerX;
  else if (align === 'right') dx = w - bounds.maxX;
  else if (align === 'top') dy = 0 - bounds.minY;
  else if (align === 'centerY') dy = h / 2 - bounds.centerY;
  else if (align === 'bottom') dy = h - bounds.maxY;

  return items.map((it) => ({ id: it.id, x: it.x + dx, y: it.y + dy }));
}

export function setSelectionCenter(
  items: Array<{ id: string; x: number; y: number; rect: WorldRect }>,
  target: { x?: number; y?: number }
): Array<{ id: string; x: number; y: number }> {
  const bounds = getSelectionBounds(items);
  if (!bounds) return [];
  const x = target.x;
  const y = target.y;
  const hasX = Number.isFinite(x as number);
  const hasY = Number.isFinite(y as number);
  if (!hasX && !hasY) return [];
  const dx = hasX ? (x as number) - bounds.centerX : 0;
  const dy = hasY ? (y as number) - bounds.centerY : 0;
  return items.map((it) => ({ id: it.id, x: it.x + dx, y: it.y + dy }));
}

export function alignByBounds(
  items: Array<{ id: string; x: number; y: number; rect: WorldRect }>,
  align: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom',
  anchorId: string
): Array<{ id: string; x: number; y: number }> {
  const anchor = items.find((it) => it.id === anchorId) ?? items[0];
  if (!anchor) return [];
  const a = anchor.rect;

  return items.map((it) => {
    const r = it.rect;
    let dx = 0;
    let dy = 0;
    if (align === 'left') dx = a.minX - r.minX;
    else if (align === 'centerX') dx = a.centerX - r.centerX;
    else if (align === 'right') dx = a.maxX - r.maxX;
    else if (align === 'top') dy = a.minY - r.minY;
    else if (align === 'centerY') dy = a.centerY - r.centerY;
    else if (align === 'bottom') dy = a.maxY - r.maxY;
    return { id: it.id, x: it.x + dx, y: it.y + dy };
  });
}

export function distributeCenters(
  items: Array<{ id: string; x: number; y: number; rect: WorldRect }>,
  axis: 'x' | 'y'
): Array<{ id: string; x: number; y: number }> {
  if (items.length < 3) return [];
  const sorted = [...items].sort((a, b) =>
    axis === 'x' ? a.rect.centerX - b.rect.centerX : a.rect.centerY - b.rect.centerY
  );
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const span = axis === 'x' ? (last.rect.centerX - first.rect.centerX) : (last.rect.centerY - first.rect.centerY);
  const step = span / (sorted.length - 1);

  return sorted.map((it, index) => {
    if (index === 0 || index === sorted.length - 1) return { id: it.id, x: it.x, y: it.y };
    const desired = (axis === 'x' ? first.rect.centerX : first.rect.centerY) + step * index;
    const delta = desired - (axis === 'x' ? it.rect.centerX : it.rect.centerY);
    return axis === 'x' ? { id: it.id, x: it.x + delta, y: it.y } : { id: it.id, x: it.x, y: it.y + delta };
  });
}

export function spacingByCenters(
  items: Array<{ id: string; x: number; y: number; rect: WorldRect }>,
  axis: 'x' | 'y',
  spacing: number
): Array<{ id: string; x: number; y: number }> {
  if (items.length < 2) return [];
  const s = Number(spacing);
  if (!Number.isFinite(s)) return [];
  const sorted = [...items].sort((a, b) =>
    axis === 'x' ? a.rect.centerX - b.rect.centerX : a.rect.centerY - b.rect.centerY
  );
  const first = sorted[0]!;
  const base = axis === 'x' ? first.rect.centerX : first.rect.centerY;
  return sorted.map((it, index) => {
    if (index === 0) return { id: it.id, x: it.x, y: it.y };
    const desired = base + s * index;
    const delta = desired - (axis === 'x' ? it.rect.centerX : it.rect.centerY);
    return axis === 'x' ? { id: it.id, x: it.x + delta, y: it.y } : { id: it.id, x: it.x, y: it.y + delta };
  });
}

export function snapPositions(
  positions: Array<{ id: string; x: number; y: number }>,
  gridSize: number
): Array<{ id: string; x: number; y: number }> {
  const g = Math.max(1, Math.round(Number(gridSize) || 1));
  const snap = (v: number) => Math.round(v / g) * g;
  return positions.map((p) => ({ id: p.id, x: snap(p.x), y: snap(p.y) }));
}

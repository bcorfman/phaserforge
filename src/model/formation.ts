export interface GridArrangeOptions<T extends { x: number; y: number }> {
  rows?: number;
  cols?: number;
  startX?: number;
  startY?: number;
  spacingX?: number;
  spacingY?: number;
  factory?: (index: number) => T;
}

export interface LineArrangeOptions<T extends { x: number; y: number }> {
  startX?: number;
  startY?: number;
  spacing?: number;
  factory?: (index: number) => T;
  count?: number;
}

export interface CircleArrangeOptions<T extends { x: number; y: number }> {
  centerX?: number;
  centerY?: number;
  radius?: number;
  factory?: (index: number) => T;
  count?: number;
}

export interface ArcArrangeOptions<T extends { x: number; y: number }> {
  centerX?: number;
  centerY?: number;
  radius?: number;
  startAngleDeg?: number;
  endAngleDeg?: number;
  factory?: (index: number) => T;
  count?: number;
}

export interface VFormationArrangeOptions<T extends { x: number; y: number }> {
  apexX?: number;
  apexY?: number;
  spacing?: number;
  direction?: 'up' | 'down';
  factory?: (index: number) => T;
  count?: number;
}

export interface DiamondArrangeOptions<T extends { x: number; y: number }> {
  centerX?: number;
  centerY?: number;
  spacing?: number;
  includeCenter?: boolean;
}

export interface TriangleArrangeOptions<T extends { x: number; y: number }> {
  apexX?: number;
  apexY?: number;
  rowSpacing?: number;
  lateralSpacing?: number;
  invert?: boolean;
}

export interface HexGridArrangeOptions<T extends { x: number; y: number }> {
  rows?: number;
  cols?: number;
  startX?: number;
  startY?: number;
  spacing?: number;
}

export interface ConcentricRingsArrangeOptions<T extends { x: number; y: number }> {
  centerX?: number;
  centerY?: number;
  radii: number[];
  spritesPerRing: number[];
}

export interface CrossArrangeOptions<T extends { x: number; y: number }> {
  centerX?: number;
  centerY?: number;
  armLength?: number;
  spacing?: number;
  includeCenter?: boolean;
}

export function arrangeGrid<T extends { x: number; y: number }>(
  items: T[] | undefined,
  options: GridArrangeOptions<T> = {}
): T[] {
  const {
    rows = 5,
    cols = 10,
    startX = 100,
    startY = 500,
    spacingX = 60,
    spacingY = 50,
    factory,
  } = options;

  const arranged = items ?? createItems(rows * cols, factory);
  const expectedCount = rows * cols;

  if (arranged.length !== expectedCount) {
    throw new Error(`entity count (${arranged.length}) does not match rows * cols (${expectedCount})`);
  }

  arranged.forEach((item, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    item.x = startX + col * spacingX;
    item.y = startY + row * spacingY;
  });

  return arranged;
}

export function arrangeLine<T extends { x: number; y: number }>(
  items: T[] | undefined,
  options: LineArrangeOptions<T> = {}
): T[] {
  const { startX = 0, startY = 0, spacing = 50, factory, count } = options;
  const arranged = items ?? createItems(count ?? 1, factory);
  arranged.forEach((item, index) => {
    item.x = startX + index * spacing;
    item.y = startY;
  });
  return arranged;
}

export function arrangeCircle<T extends { x: number; y: number }>(
  items: T[] | undefined,
  options: CircleArrangeOptions<T> = {}
): T[] {
  const { centerX = 0, centerY = 0, radius = 100, factory, count } = options;
  const arranged = items ?? createItems(count ?? 1, factory);
  if (arranged.length === 0) return arranged;
  const step = (Math.PI * 2) / arranged.length;
  arranged.forEach((item, index) => {
    const angle = Math.PI / 2 - index * step; // start at top, clockwise
    item.x = centerX + Math.cos(angle) * radius;
    item.y = centerY + Math.sin(angle) * radius;
  });
  return arranged;
}

export function arrangeArc<T extends { x: number; y: number }>(
  items: T[] | undefined,
  options: ArcArrangeOptions<T> = {}
): T[] {
  const {
    centerX = 0,
    centerY = 0,
    radius = 100,
    startAngleDeg = 0,
    endAngleDeg = 180,
    factory,
    count,
  } = options;
  const arranged = items ?? createItems(count ?? 1, factory);
  if (arranged.length === 0) return arranged;
  const start = (startAngleDeg * Math.PI) / 180;
  const end = (endAngleDeg * Math.PI) / 180;
  const span = end - start;
  const step = arranged.length === 1 ? 0 : span / (arranged.length - 1);
  arranged.forEach((item, index) => {
    const angle = start + index * step;
    item.x = centerX + Math.cos(angle) * radius;
    item.y = centerY + Math.sin(angle) * radius;
  });
  return arranged;
}

export function arrangeVFormation<T extends { x: number; y: number }>(
  items: T[] | undefined,
  options: VFormationArrangeOptions<T> = {}
): T[] {
  const { apexX = 0, apexY = 0, spacing = 50, direction = 'up', factory, count } = options;
  const arranged = items ?? createItems(count ?? 1, factory);
  const dir = direction === 'down' ? -1 : 1;
  arranged.forEach((item, index) => {
    if (index === 0) {
      item.x = apexX;
      item.y = apexY;
      return;
    }
    const armIndex = Math.ceil(index / 2);
    const side = index % 2 === 1 ? -1 : 1;
    item.x = apexX + side * armIndex * spacing;
    item.y = apexY + dir * armIndex * spacing;
  });
  return arranged;
}

export function arrangeDiamond<T extends { x: number; y: number }>(
  items: T[],
  options: DiamondArrangeOptions<T> = {}
): T[] {
  const { centerX = 0, centerY = 0, spacing = 50, includeCenter = true } = options;
  if (items.length === 0) return items;

  // Build layer counts: 1, 4, 8, 12... until we cover count. Optionally skip center.
  const positions: Array<{ x: number; y: number }> = [];
  if (includeCenter) positions.push({ x: centerX, y: centerY });
  let layer = 1;
  while (positions.length < items.length) {
    const radius = layer * spacing;
    const count = layer * 4;
    for (let i = 0; i < count && positions.length < items.length; i += 1) {
      const t = i / count;
      // Walk a diamond perimeter (4 edges)
      const edge = Math.floor(t * 4);
      const local = (t * 4) - edge;
      if (edge === 0) positions.push({ x: centerX + local * radius, y: centerY + (1 - local) * radius });
      else if (edge === 1) positions.push({ x: centerX + (1 - local) * radius, y: centerY - local * radius });
      else if (edge === 2) positions.push({ x: centerX - local * radius, y: centerY - (1 - local) * radius });
      else positions.push({ x: centerX - (1 - local) * radius, y: centerY + local * radius });
    }
    layer += 1;
  }

  items.forEach((item, index) => {
    item.x = positions[index].x;
    item.y = positions[index].y;
  });
  return items;
}

export function arrangeTriangle<T extends { x: number; y: number }>(
  items: T[],
  options: TriangleArrangeOptions<T> = {}
): T[] {
  const { apexX = 0, apexY = 0, rowSpacing = 50, lateralSpacing = 50, invert = false } = options;
  if (items.length === 0) return items;
  let index = 0;
  let row = 0;
  while (index < items.length) {
    const rowCount = row + 1;
    const y = apexY + (invert ? -row : row) * rowSpacing;
    const rowWidth = (rowCount - 1) * lateralSpacing;
    const startX = apexX - rowWidth / 2;
    for (let col = 0; col < rowCount && index < items.length; col += 1) {
      items[index].x = startX + col * lateralSpacing;
      items[index].y = y;
      index += 1;
    }
    row += 1;
  }
  return items;
}

export function arrangeHexagonalGrid<T extends { x: number; y: number }>(
  items: T[],
  options: HexGridArrangeOptions<T> = {}
): T[] {
  const { cols = 5, startX = 0, startY = 0, spacing = 50 } = options;
  const resolvedCols = Math.max(1, Math.floor(cols));
  const minimumRows = Math.ceil(items.length / resolvedCols);
  const resolvedRows = Math.max(1, Math.floor(options.rows ?? minimumRows), minimumRows);
  const xStep = spacing;
  const yStep = spacing * Math.sqrt(3) / 2;
  items.forEach((item, i) => {
    const row = Math.floor(i / resolvedCols);
    const col = i % resolvedCols;
    const xOffset = row % 2 === 0 ? 0 : xStep / 2;
    item.x = startX + col * xStep + xOffset;
    item.y = startY + row * yStep;
  });
  return items;
}

export function arrangeConcentricRings<T extends { x: number; y: number }>(
  items: T[],
  options: ConcentricRingsArrangeOptions<T>
): T[] {
  const { centerX = 0, centerY = 0, radii, spritesPerRing } = options;
  if (radii.length !== spritesPerRing.length) {
    throw new Error('radii and spritesPerRing must be the same length');
  }
  let index = 0;
  for (let ring = 0; ring < radii.length && index < items.length; ring += 1) {
    const count = spritesPerRing[ring];
    if (count <= 0) continue;
    const step = (Math.PI * 2) / count;
    for (let i = 0; i < count && index < items.length; i += 1) {
      const angle = Math.PI / 2 - i * step;
      items[index].x = centerX + Math.cos(angle) * radii[ring];
      items[index].y = centerY + Math.sin(angle) * radii[ring];
      index += 1;
    }
  }
  return items;
}

export function arrangeCross<T extends { x: number; y: number }>(
  items: T[],
  options: CrossArrangeOptions<T> = {}
): T[] {
  const { centerX = 0, centerY = 0, armLength = 120, spacing = 60, includeCenter = true } = options;
  if (items.length === 0) return items;
  const positions: Array<{ x: number; y: number }> = [];
  if (includeCenter) positions.push({ x: centerX, y: centerY });
  const steps = Math.max(1, Math.floor(armLength / spacing));
  for (let i = 1; i <= steps; i += 1) positions.push({ x: centerX + i * spacing, y: centerY });
  for (let i = 1; i <= steps; i += 1) positions.push({ x: centerX - i * spacing, y: centerY });
  for (let i = 1; i <= steps; i += 1) positions.push({ x: centerX, y: centerY + i * spacing });
  for (let i = 1; i <= steps; i += 1) positions.push({ x: centerX, y: centerY - i * spacing });
  items.forEach((item, index) => {
    const pos = positions[index % positions.length];
    item.x = pos.x;
    item.y = pos.y;
  });
  return items;
}

function createItems<T extends { x: number; y: number }>(
  count: number,
  factory?: (index: number) => T
): T[] {
  if (!factory) {
    throw new Error('factory is required when creating a new grid');
  }

  return Array.from({ length: count }, (_, index) => factory(index));
}

export interface GridArrangeOptions<T extends { x: number; y: number }> {
  rows?: number;
  cols?: number;
  startX?: number;
  startY?: number;
  spacingX?: number;
  spacingY?: number;
  factory?: (index: number) => T;
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

function createItems<T extends { x: number; y: number }>(
  count: number,
  factory?: (index: number) => T
): T[] {
  if (!factory) {
    throw new Error('factory is required when creating a new grid');
  }

  return Array.from({ length: count }, (_, index) => factory(index));
}

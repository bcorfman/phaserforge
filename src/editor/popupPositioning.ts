export type RectLike = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  if (min > max) return min;
  return Math.max(min, Math.min(max, value));
}

export function clampPopupToViewport({
  position,
  popupSize,
  viewportSize,
  padding = 12,
}: {
  position: Point;
  popupSize: Size;
  viewportSize: Size;
  padding?: number;
}): Point {
  const maxX = viewportSize.width - padding - popupSize.width;
  const maxY = viewportSize.height - padding - popupSize.height;
  return {
    x: clamp(position.x, padding, maxX),
    y: clamp(position.y, padding, maxY),
  };
}

export function placePopupNearRect({
  anchorRect,
  popupSize,
  viewportSize,
  padding = 12,
  offset = 10,
  prefer = 'above',
  align = 'left',
}: {
  anchorRect: RectLike;
  popupSize: Size;
  viewportSize: Size;
  padding?: number;
  offset?: number;
  prefer?: 'above' | 'below';
  align?: 'left' | 'right';
}): Point {
  const maxX = viewportSize.width - padding - popupSize.width;
  const maxY = viewportSize.height - padding - popupSize.height;

  const desiredX = align === 'right' ? anchorRect.right - popupSize.width : anchorRect.left;
  const x = clamp(desiredX, padding, maxX);

  const aboveY = anchorRect.top - popupSize.height - offset;
  const belowY = anchorRect.bottom + offset;
  const preferredY = prefer === 'above' ? aboveY : belowY;
  const fallbackY = prefer === 'above' ? belowY : aboveY;

  const y = clamp(
    preferredY >= padding && preferredY <= maxY ? preferredY : fallbackY,
    padding,
    maxY
  );

  return { x, y };
}

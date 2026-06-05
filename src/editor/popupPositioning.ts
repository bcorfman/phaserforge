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

export function constrainPopupSizeToViewport({
  popupSize,
  viewportSize,
  padding = 12,
}: {
  popupSize: Size;
  viewportSize: Size;
  padding?: number;
}): Size {
  const maxWidth = Math.max(0, viewportSize.width - padding * 2);
  const maxHeight = Math.max(0, viewportSize.height - padding * 2);
  return {
    width: Math.min(popupSize.width, maxWidth),
    height: Math.min(popupSize.height, maxHeight),
  };
}

export function fitPopupWithinViewport({
  position,
  popupSize,
  viewportSize,
  padding = 12,
}: {
  position: Point;
  popupSize: Size;
  viewportSize: Size;
  padding?: number;
}): { position: Point; popupSize: Size } {
  const constrainedSize = constrainPopupSizeToViewport({
    popupSize,
    viewportSize,
    padding,
  });

  return {
    position: clampPopupToViewport({
      position,
      popupSize: constrainedSize,
      viewportSize,
      padding,
    }),
    popupSize: constrainedSize,
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

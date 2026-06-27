import { DEFAULT_WORLD } from './sceneWorld';

export const SCENE_WIDTH = DEFAULT_WORLD.width;
export const SCENE_HEIGHT = DEFAULT_WORLD.height;
export const MIN_ZOOM = 0.5;
export const BASE_MAX_ZOOM = 3;
export const ABS_MAX_ZOOM = 24;
export const ZOOM_STEP = 0.2;
const FIT_PADDING = 48;

export type ViewportInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const ZERO_INSETS: ViewportInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function normalizeInsets(insets?: Partial<ViewportInsets>): ViewportInsets {
  return {
    top: Math.max(0, insets?.top ?? 0),
    right: Math.max(0, insets?.right ?? 0),
    bottom: Math.max(0, insets?.bottom ?? 0),
    left: Math.max(0, insets?.left ?? 0),
  };
}

export function getMaxZoom(
  viewportWidth: number,
  viewportHeight: number,
  worldWidth = SCENE_WIDTH,
  worldHeight = SCENE_HEIGHT
): number {
  const safeWorldWidth = Math.max(1, worldWidth);
  const safeWorldHeight = Math.max(1, worldHeight);
  const fillZoom = Math.min(viewportWidth / safeWorldWidth, viewportHeight / safeWorldHeight);
  const desiredMax = Math.max(BASE_MAX_ZOOM, fillZoom);
  // Quantize upwards to the UI step so the "+" button can always reach the fill zoom (no off-by-a-step ceiling).
  const quantizedMax = Math.ceil(desiredMax / ZOOM_STEP) * ZOOM_STEP;
  return Math.min(ABS_MAX_ZOOM, Math.max(BASE_MAX_ZOOM, Number(quantizedMax.toFixed(2))));
}

export function clampZoom(zoom: number, maxZoom = BASE_MAX_ZOOM): number {
  return Math.min(maxZoom, Math.max(MIN_ZOOM, Number(zoom.toFixed(2))));
}

export function getFitZoom(
  viewportWidth: number,
  viewportHeight: number,
  worldWidth = SCENE_WIDTH,
  worldHeight = SCENE_HEIGHT,
  insets: Partial<ViewportInsets> = ZERO_INSETS
): number {
  const safeInsets = normalizeInsets(insets);
  const width = Math.max(1, viewportWidth - safeInsets.left - safeInsets.right - FIT_PADDING * 2);
  const height = Math.max(1, viewportHeight - safeInsets.top - safeInsets.bottom - FIT_PADDING * 2);
  const zoom = Math.min(width / Math.max(1, worldWidth), height / Math.max(1, worldHeight));
  return clampZoom(zoom, getMaxZoom(viewportWidth, viewportHeight, worldWidth, worldHeight));
}

export function getNextZoom(currentZoom: number, direction: 'in' | 'out', maxZoom = BASE_MAX_ZOOM): number {
  return clampZoom(currentZoom + (direction === 'in' ? ZOOM_STEP : -ZOOM_STEP), maxZoom);
}

export function formatZoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

export function getZoomedScroll(
  worldX: number,
  worldY: number,
  pointerX: number,
  pointerY: number,
  nextZoom: number,
  viewportWidth: number,
  viewportHeight: number
): { scrollX: number; scrollY: number } {
  const viewportCenterX = viewportWidth / 2;
  const viewportCenterY = viewportHeight / 2;
  return {
    scrollX: worldX - viewportCenterX - (pointerX - viewportCenterX) / nextZoom,
    scrollY: worldY - viewportCenterY - (pointerY - viewportCenterY) / nextZoom,
  };
}

export function getResizedViewportScroll(
  scrollX: number,
  scrollY: number,
  prevViewportWidth: number,
  prevViewportHeight: number,
  nextViewportWidth: number,
  nextViewportHeight: number,
  zoom: number,
  originX = 0.5,
  originY = 0.5
): { scrollX: number; scrollY: number } {
  const safeZoom = Math.max(0.0001, zoom);
  const prevOffsetX = prevViewportWidth * originX * (1 - 1 / safeZoom);
  const prevOffsetY = prevViewportHeight * originY * (1 - 1 / safeZoom);
  const nextOffsetX = nextViewportWidth * originX * (1 - 1 / safeZoom);
  const nextOffsetY = nextViewportHeight * originY * (1 - 1 / safeZoom);
  const centerWorldX = scrollX + prevOffsetX + prevViewportWidth / (2 * safeZoom);
  const centerWorldY = scrollY + prevOffsetY + prevViewportHeight / (2 * safeZoom);
  return {
    scrollX: centerWorldX - nextOffsetX - nextViewportWidth / (2 * safeZoom),
    scrollY: centerWorldY - nextOffsetY - nextViewportHeight / (2 * safeZoom),
  };
}

export function getCenteredCameraScroll(
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
  zoom: number,
  originX = 0.5,
  originY = 0.5,
  insets: Partial<ViewportInsets> = ZERO_INSETS
): { scrollX: number; scrollY: number } {
  const safeZoom = Math.max(0.0001, zoom);
  const safeInsets = normalizeInsets(insets);
  const focusX = safeInsets.left + (viewportWidth - safeInsets.left - safeInsets.right) / 2;
  const focusY = safeInsets.top + (viewportHeight - safeInsets.top - safeInsets.bottom) / 2;
  const offsetX = viewportWidth * originX * (1 - 1 / safeZoom);
  const offsetY = viewportHeight * originY * (1 - 1 / safeZoom);
  return {
    scrollX: worldWidth / 2 - offsetX - focusX / safeZoom,
    scrollY: worldHeight / 2 - offsetY - focusY / safeZoom,
  };
}

export function isCameraAtFitView(
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
  zoom: number,
  scrollX: number,
  scrollY: number,
  originX = 0.5,
  originY = 0.5,
  insets: Partial<ViewportInsets> = ZERO_INSETS,
  epsilon = 1
): boolean {
  const fitZoom = getFitZoom(viewportWidth, viewportHeight, worldWidth, worldHeight, insets);
  if (Math.abs(zoom - fitZoom) > 0.01) return false;
  const centered = getCenteredCameraScroll(viewportWidth, viewportHeight, worldWidth, worldHeight, fitZoom, originX, originY, insets);
  const clamped = clampCameraScroll(
    centered.scrollX,
    centered.scrollY,
    viewportWidth,
    viewportHeight,
    worldWidth,
    worldHeight,
    fitZoom,
    originX,
    originY,
    insets
  );
  return Math.abs(scrollX - clamped.scrollX) <= epsilon && Math.abs(scrollY - clamped.scrollY) <= epsilon;
}

export function clampCameraScroll(
  scrollX: number,
  scrollY: number,
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
  zoom: number,
  originX = 0.5,
  originY = 0.5,
  insets: Partial<ViewportInsets> = ZERO_INSETS
): { scrollX: number; scrollY: number } {
  const safeZoom = Math.max(0.0001, zoom);
  const safeInsets = normalizeInsets(insets);
  const usableWidth = Math.max(1, viewportWidth - safeInsets.left - safeInsets.right) / safeZoom;
  const usableHeight = Math.max(1, viewportHeight - safeInsets.top - safeInsets.bottom) / safeZoom;
  const offsetX = viewportWidth * originX * (1 - 1 / safeZoom);
  const offsetY = viewportHeight * originY * (1 - 1 / safeZoom);
  const alignLeftScrollX = -offsetX - safeInsets.left / safeZoom;
  const alignTopScrollY = -offsetY - safeInsets.top / safeZoom;
  const alignRightScrollX = worldWidth - usableWidth - offsetX - safeInsets.left / safeZoom;
  const alignBottomScrollY = worldHeight - usableHeight - offsetY - safeInsets.top / safeZoom;
  const minScrollX = Math.min(alignLeftScrollX, alignRightScrollX);
  const maxScrollX = Math.max(alignLeftScrollX, alignRightScrollX);
  const minScrollY = Math.min(alignTopScrollY, alignBottomScrollY);
  const maxScrollY = Math.max(alignTopScrollY, alignBottomScrollY);

  return {
    scrollX: Math.min(maxScrollX, Math.max(minScrollX, scrollX)),
    scrollY: Math.min(maxScrollY, Math.max(minScrollY, scrollY)),
  };
}

export function canPanCamera(
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
  zoom: number
): boolean {
  const visibleWidth = viewportWidth / zoom;
  const visibleHeight = viewportHeight / zoom;
  return Math.abs(worldWidth - visibleWidth) > 0.5 || Math.abs(worldHeight - visibleHeight) > 0.5;
}

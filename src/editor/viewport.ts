import { DEFAULT_WORLD } from './sceneWorld';

export const SCENE_WIDTH = DEFAULT_WORLD.width;
export const SCENE_HEIGHT = DEFAULT_WORLD.height;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.2;
const FIT_PADDING = 48;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(zoom.toFixed(2))));
}

export function getFitZoom(viewportWidth: number, viewportHeight: number, worldWidth = SCENE_WIDTH, worldHeight = SCENE_HEIGHT): number {
  const width = Math.max(1, viewportWidth - FIT_PADDING * 2);
  const height = Math.max(1, viewportHeight - FIT_PADDING * 2);
  return clampZoom(Math.min(1, width / worldWidth, height / worldHeight));
}

export function getNextZoom(currentZoom: number, direction: 'in' | 'out'): number {
  return clampZoom(currentZoom + (direction === 'in' ? ZOOM_STEP : -ZOOM_STEP));
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

export function clampCameraScroll(
  scrollX: number,
  scrollY: number,
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
  zoom: number
): { scrollX: number; scrollY: number } {
  const visibleWidth = viewportWidth / zoom;
  const visibleHeight = viewportHeight / zoom;
  const minScrollX = Math.min(0, worldWidth - visibleWidth);
  const maxScrollX = Math.max(0, worldWidth - visibleWidth);
  const minScrollY = Math.min(0, worldHeight - visibleHeight);
  const maxScrollY = Math.max(0, worldHeight - visibleHeight);

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

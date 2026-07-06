import type { ProjectRenderMode, ProjectSpec, SpriteAssetSpec } from './types';

export const DEFAULT_PROJECT_PIXELS_PER_UNIT = 2;
export const DEFAULT_PROJECT_RENDER_MODE: ProjectRenderMode = 'smooth-2d';

export function normalizeProjectPixelsPerUnit(value: unknown, fallback = DEFAULT_PROJECT_PIXELS_PER_UNIT): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(Number(value)));
}

export function getProjectPixelsPerUnit(project: Pick<ProjectSpec, 'pixelsPerUnit'>): number {
  return normalizeProjectPixelsPerUnit(project.pixelsPerUnit, DEFAULT_PROJECT_PIXELS_PER_UNIT);
}

export function normalizeProjectRenderMode(value: unknown, fallback = DEFAULT_PROJECT_RENDER_MODE): ProjectRenderMode {
  return value === 'smooth-2d' || value === 'pixel-art' ? value : fallback;
}

export function getProjectRenderMode(project: Pick<ProjectSpec, 'renderMode'>): ProjectRenderMode {
  return normalizeProjectRenderMode(project.renderMode, DEFAULT_PROJECT_RENDER_MODE);
}

export function deriveWorldUnitsFromNaturalPixels(naturalPixels: number, pixelsPerUnit: number): number {
  const safePixels = Math.max(1, Math.round(Number.isFinite(naturalPixels) ? naturalPixels : 1));
  return Math.max(1, Math.round(safePixels / normalizeProjectPixelsPerUnit(pixelsPerUnit)));
}

export function getNaturalSpriteSize(
  project: Pick<ProjectSpec, 'assets'>,
  asset: SpriteAssetSpec | undefined,
): { width: number; height: number } | null {
  if (!asset) return null;
  if (asset.source.kind !== 'asset') return null;
  if (asset.imageType === 'spritesheet') {
    const sheet = project.assets.spriteSheets?.[asset.source.assetId];
    const width = sheet?.grid?.frameWidth ?? asset.grid?.frameWidth;
    const height = sheet?.grid?.frameHeight ?? asset.grid?.frameHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  }
  const image = project.assets.images?.[asset.source.assetId];
  if (!Number.isFinite(image?.width) || !Number.isFinite(image?.height)) return null;
  return { width: Math.max(1, Math.round(image.width)), height: Math.max(1, Math.round(image.height)) };
}

export function deriveWorldSpriteSize(
  project: Pick<ProjectSpec, 'assets' | 'pixelsPerUnit'>,
  asset: SpriteAssetSpec | undefined,
): { width: number; height: number } | null {
  const natural = getNaturalSpriteSize(project, asset);
  if (!natural) return null;
  const pixelsPerUnit = getProjectPixelsPerUnit(project);
  return {
    width: deriveWorldUnitsFromNaturalPixels(natural.width, pixelsPerUnit),
    height: deriveWorldUnitsFromNaturalPixels(natural.height, pixelsPerUnit),
  };
}

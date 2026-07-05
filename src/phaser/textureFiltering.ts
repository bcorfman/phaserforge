import type { ProjectRenderMode } from '../model/types';

type TextureLike = {
  setFilter?: (mode: number) => void;
};

type TextureManagerLike = {
  exists: (key: string) => boolean;
  get: (key: string) => TextureLike | null | undefined;
};

// Phaser.Textures.FilterMode.LINEAR / NEAREST
const LINEAR_FILTER_MODE = 0;
const NEAREST_FILTER_MODE = 1;

export function applyProjectTextureFilter(
  textures: TextureManagerLike,
  key: string,
  renderMode: ProjectRenderMode = 'pixel-art',
): void {
  if (!textures.exists(key)) return;
  const texture = textures.get(key);
  texture?.setFilter?.(renderMode === 'smooth-2d' ? LINEAR_FILTER_MODE : NEAREST_FILTER_MODE);
}

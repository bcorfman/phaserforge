type TextureLike = {
  setFilter?: (mode: number) => void;
};

type TextureManagerLike = {
  exists: (key: string) => boolean;
  get: (key: string) => TextureLike | null | undefined;
};

// Phaser.Textures.FilterMode.NEAREST
const NEAREST_FILTER_MODE = 1;

export function applyNearestTextureFilter(textures: TextureManagerLike, key: string): void {
  if (!textures.exists(key)) return;
  const texture = textures.get(key);
  texture?.setFilter?.(NEAREST_FILTER_MODE);
}

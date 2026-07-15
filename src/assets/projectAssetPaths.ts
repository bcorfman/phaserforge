const PROJECT_ASSET_URLS = {
  ...import.meta.glob('../../assets/**/*.png', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('../../assets/**/*.jpg', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('../../assets/**/*.jpeg', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('../../assets/**/*.webp', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('../../assets/**/*.mp3', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('../../assets/**/*.ogg', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('../../assets/**/*.wav', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('../../assets/**/*.ttf', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('../../assets/**/*.otf', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('../../assets/**/*.woff', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('../../assets/**/*.woff2', { eager: true, query: '?url', import: 'default' }),
} as Record<string, string>;

function isPublishedGameRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as any).__PHASER_FORGE_PUBLISH_MARKER === 'string';
}

export function resolveProjectAssetPathToUrl(path: string): string {
  const normalized = path.replace(/^\/+/, '');
  if (isPublishedGameRuntime()) return normalized;
  return PROJECT_ASSET_URLS[`../../${normalized}`] ?? normalized;
}

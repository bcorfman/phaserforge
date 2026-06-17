export type DemoPackAssetKind = 'image' | 'audio' | 'font';

const DEMO_PACK_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const DEMO_PACK_AUDIO_EXTENSIONS = new Set(['mp3', 'ogg', 'wav']);
const DEMO_PACK_FONT_EXTENSIONS = new Set(['ttf', 'otf', 'woff', 'woff2']);

export function assetIdBaseFromOriginalName(name: string | undefined, fallbackBase: string = 'asset'): string {
  const raw = (name ?? '').trim();
  const withoutExt = raw.replace(/\.[a-z0-9]+$/i, '');
  const base = withoutExt.length > 0 ? withoutExt : fallbackBase;
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '') || fallbackBase;
}

export function getDemoPackAssetKind(path: string): DemoPackAssetKind | null {
  const normalized = path.toLowerCase();
  const match = normalized.match(/\.([a-z0-9]+)$/);
  const extension = match?.[1];
  if (!extension) return null;
  if (normalized.includes('/res/images/') && DEMO_PACK_IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (normalized.includes('/res/audio/') && DEMO_PACK_AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (normalized.includes('/res/fonts/') && DEMO_PACK_FONT_EXTENSIONS.has(extension)) return 'font';
  return null;
}

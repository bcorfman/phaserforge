export type DemoPackAssetKind = 'image' | 'audio' | 'font';

export type DemoPackAssetManifestEntry = {
  assetId: string;
  kind: DemoPackAssetKind;
  path: string;
  originalName: string;
  mimeType: string;
  width?: number;
  height?: number;
};

const DEMO_PACK_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const DEMO_PACK_AUDIO_EXTENSIONS = new Set(['mp3', 'ogg', 'wav']);
const DEMO_PACK_FONT_EXTENSIONS = new Set(['ttf', 'otf', 'woff', 'woff2']);

export const DEMO_PACK_ASSET_MANIFEST: DemoPackAssetManifestEntry[] = [
  { assetId: 'effect-purple', kind: 'image', path: 'assets/demo-pack/images/effect_purple.png', originalName: 'effect_purple.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'effect-yellow', kind: 'image', path: 'assets/demo-pack/images/effect_yellow.png', originalName: 'effect_yellow.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'enemy-a', kind: 'image', path: 'assets/demo-pack/images/enemy_A.png', originalName: 'enemy_A.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'enemy-b', kind: 'image', path: 'assets/demo-pack/images/enemy_B.png', originalName: 'enemy_B.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'enemy-c', kind: 'image', path: 'assets/demo-pack/images/enemy_C.png', originalName: 'enemy_C.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'enemy-d', kind: 'image', path: 'assets/demo-pack/images/enemy_D.png', originalName: 'enemy_D.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'enemy-e', kind: 'image', path: 'assets/demo-pack/images/enemy_E.png', originalName: 'enemy_E.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'icon-pluslarge', kind: 'image', path: 'assets/demo-pack/images/icon_plusLarge.png', originalName: 'icon_plusLarge.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'icon-plussmall', kind: 'image', path: 'assets/demo-pack/images/icon_plusSmall.png', originalName: 'icon_plusSmall.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'meteor-detailedlarge', kind: 'image', path: 'assets/demo-pack/images/meteor_detailedLarge.png', originalName: 'meteor_detailedLarge.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'meteor-detailedsmall', kind: 'image', path: 'assets/demo-pack/images/meteor_detailedSmall.png', originalName: 'meteor_detailedSmall.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'meteor-large', kind: 'image', path: 'assets/demo-pack/images/meteor_large.png', originalName: 'meteor_large.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'meteor-small', kind: 'image', path: 'assets/demo-pack/images/meteor_small.png', originalName: 'meteor_small.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'meteor-squaredetailedlarge', kind: 'image', path: 'assets/demo-pack/images/meteor_squareDetailedLarge.png', originalName: 'meteor_squareDetailedLarge.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'meteor-squaredetailedsmall', kind: 'image', path: 'assets/demo-pack/images/meteor_squareDetailedSmall.png', originalName: 'meteor_squareDetailedSmall.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'meteor-squarelarge', kind: 'image', path: 'assets/demo-pack/images/meteor_squareLarge.png', originalName: 'meteor_squareLarge.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'meteor-squaresmall', kind: 'image', path: 'assets/demo-pack/images/meteor_squareSmall.png', originalName: 'meteor_squareSmall.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'satellite-a', kind: 'image', path: 'assets/demo-pack/images/satellite_A.png', originalName: 'satellite_A.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'satellite-c', kind: 'image', path: 'assets/demo-pack/images/satellite_C.png', originalName: 'satellite_C.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'satellite-d', kind: 'image', path: 'assets/demo-pack/images/satellite_D.png', originalName: 'satellite_D.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'ship-sidesa', kind: 'image', path: 'assets/demo-pack/images/ship_sidesA.png', originalName: 'ship_sidesA.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'ship-sidesb', kind: 'image', path: 'assets/demo-pack/images/ship_sidesB.png', originalName: 'ship_sidesB.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'ship-sidesc', kind: 'image', path: 'assets/demo-pack/images/ship_sidesC.png', originalName: 'ship_sidesC.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'ship-sidesd', kind: 'image', path: 'assets/demo-pack/images/ship_sidesD.png', originalName: 'ship_sidesD.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'station-b', kind: 'image', path: 'assets/demo-pack/images/station_B.png', originalName: 'station_B.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'station-c', kind: 'image', path: 'assets/demo-pack/images/station_C.png', originalName: 'station_C.png', mimeType: 'image/png', width: 64, height: 64 },
  { assetId: 'simulacra-chosic-com', kind: 'audio', path: 'assets/demo-pack/audio/Simulacra-chosic.com_.mp3', originalName: 'Simulacra-chosic.com_.mp3', mimeType: 'audio/mpeg' },
  { assetId: 'punch-deck-the-soul-crushing-monotony-of-isolation-instrumental-mix-chosic-com', kind: 'audio', path: 'assets/demo-pack/audio/punch-deck-the-soul-crushing-monotony-of-isolation-instrumental-mix(chosic.com).mp3', originalName: 'punch-deck-the-soul-crushing-monotony-of-isolation-instrumental-mix(chosic.com).mp3', mimeType: 'audio/mpeg' },
  { assetId: 'sb-indreams-chosic-com', kind: 'audio', path: 'assets/demo-pack/audio/sb_indreams(chosic.com).mp3', originalName: 'sb_indreams(chosic.com).mp3', mimeType: 'audio/mpeg' },
];

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
  if (normalized.includes('/assets/demo-pack/images/') && DEMO_PACK_IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (normalized.includes('/assets/demo-pack/audio/') && DEMO_PACK_AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (normalized.includes('/assets/demo-pack/fonts/') && DEMO_PACK_FONT_EXTENSIONS.has(extension)) return 'font';
  if (normalized.startsWith('assets/demo-pack/images/') && DEMO_PACK_IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (normalized.startsWith('assets/demo-pack/audio/') && DEMO_PACK_AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (normalized.startsWith('assets/demo-pack/fonts/') && DEMO_PACK_FONT_EXTENSIONS.has(extension)) return 'font';
  return null;
}

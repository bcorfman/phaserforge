import { describe, expect, it } from 'vitest';

import {
  DEMO_PACK_ASSET_MANIFEST,
  assetIdBaseFromOriginalName,
  getDemoPackAssetKind,
} from '../../src/editor/demoPackAssets';

describe('demo pack asset helpers', () => {
  it('classifies the well-supported demo pack asset types by path', () => {
    expect(getDemoPackAssetKind('assets/demo-pack/images/ship.png')).toBe('image');
    expect(getDemoPackAssetKind('assets/demo-pack/images/background.jpg')).toBe('image');
    expect(getDemoPackAssetKind('assets/demo-pack/images/background.jpeg')).toBe('image');
    expect(getDemoPackAssetKind('assets/demo-pack/images/background.webp')).toBe('image');
    expect(getDemoPackAssetKind('assets/demo-pack/audio/theme.mp3')).toBe('audio');
    expect(getDemoPackAssetKind('assets/demo-pack/audio/theme.ogg')).toBe('audio');
    expect(getDemoPackAssetKind('assets/demo-pack/audio/hit.wav')).toBe('audio');
    expect(getDemoPackAssetKind('assets/demo-pack/fonts/arcade.woff2')).toBe('font');
    expect(getDemoPackAssetKind('assets/demo-pack/fonts/arcade.woff')).toBe('font');
    expect(getDemoPackAssetKind('assets/demo-pack/fonts/arcade.ttf')).toBe('font');
    expect(getDemoPackAssetKind('assets/demo-pack/fonts/arcade.otf')).toBe('font');
  });

  it('ignores unsupported or misplaced files', () => {
    expect(getDemoPackAssetKind('assets/demo-pack/images/readme.txt')).toBeNull();
    expect(getDemoPackAssetKind('assets/demo-pack/audio/theme.flac')).toBeNull();
    expect(getDemoPackAssetKind('assets/demo-pack/fonts/arcade.eot')).toBeNull();
    expect(getDemoPackAssetKind('assets/demo-pack/misc/ship.png')).toBeNull();
  });

  it('builds stable asset ids from filenames', () => {
    expect(assetIdBaseFromOriginalName('enemy_A.png', 'image')).toBe('enemy-a');
    expect(assetIdBaseFromOriginalName('Arcade Classic.woff2', 'font')).toBe('arcade-classic');
    expect(assetIdBaseFromOriginalName('', 'asset')).toBe('asset');
  });

  it('keeps a stable project-relative manifest with image dimensions', () => {
    expect(DEMO_PACK_ASSET_MANIFEST.length).toBeGreaterThan(0);
    expect(DEMO_PACK_ASSET_MANIFEST.every((entry) => entry.path.startsWith('assets/demo-pack/'))).toBe(true);

    const enemy = DEMO_PACK_ASSET_MANIFEST.find((entry) => entry.originalName === 'enemy_A.png');
    expect(enemy).toEqual(
      expect.objectContaining({
        kind: 'image',
        path: 'assets/demo-pack/images/enemy_A.png',
        mimeType: 'image/png',
        width: 64,
        height: 64,
      }),
    );
  });
});

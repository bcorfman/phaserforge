import { describe, expect, it } from 'vitest';

import { assetIdBaseFromOriginalName, getDemoPackAssetKind } from '../../src/editor/demoPackAssets';

describe('demo pack asset helpers', () => {
  it('classifies the well-supported demo pack asset types by path', () => {
    expect(getDemoPackAssetKind('../../res/images/ship.png')).toBe('image');
    expect(getDemoPackAssetKind('../../res/images/background.jpg')).toBe('image');
    expect(getDemoPackAssetKind('../../res/images/background.jpeg')).toBe('image');
    expect(getDemoPackAssetKind('../../res/images/background.webp')).toBe('image');
    expect(getDemoPackAssetKind('../../res/audio/theme.mp3')).toBe('audio');
    expect(getDemoPackAssetKind('../../res/audio/theme.ogg')).toBe('audio');
    expect(getDemoPackAssetKind('../../res/audio/hit.wav')).toBe('audio');
    expect(getDemoPackAssetKind('../../res/fonts/arcade.woff2')).toBe('font');
    expect(getDemoPackAssetKind('../../res/fonts/arcade.woff')).toBe('font');
    expect(getDemoPackAssetKind('../../res/fonts/arcade.ttf')).toBe('font');
    expect(getDemoPackAssetKind('../../res/fonts/arcade.otf')).toBe('font');
  });

  it('ignores unsupported or misplaced files', () => {
    expect(getDemoPackAssetKind('../../res/images/readme.txt')).toBeNull();
    expect(getDemoPackAssetKind('../../res/audio/theme.flac')).toBeNull();
    expect(getDemoPackAssetKind('../../res/fonts/arcade.eot')).toBeNull();
    expect(getDemoPackAssetKind('../../res/misc/ship.png')).toBeNull();
  });

  it('builds stable asset ids from filenames', () => {
    expect(assetIdBaseFromOriginalName('enemy_A.png', 'image')).toBe('enemy-a');
    expect(assetIdBaseFromOriginalName('Arcade Classic.woff2', 'font')).toBe('arcade-classic');
    expect(assetIdBaseFromOriginalName('', 'asset')).toBe('asset');
  });
});

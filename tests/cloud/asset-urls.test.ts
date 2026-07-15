import { afterEach, describe, expect, it, vi } from 'vitest';

import { inlinePreviewUrlForAssetSource, resolveAssetSourceUrl } from '../../src/cloud/assetUrls';

describe('asset URL helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('resolves project-relative path assets to usable browser URLs', async () => {
    const source = {
      kind: 'path' as const,
      path: 'assets/demo-pack/images/enemy_A.png',
      originalName: 'enemy_A.png',
      mimeType: 'image/png',
    };

    const inlineUrl = inlinePreviewUrlForAssetSource(source);
    const resolvedUrl = await resolveAssetSourceUrl(source);

    expect(inlineUrl).toContain('enemy_A.png');
    expect(resolvedUrl).toContain('enemy_A.png');
  });

  it('resolves path-backed audio assets to stable browser URLs', async () => {
    const resolvedUrl = await resolveAssetSourceUrl({
      kind: 'path',
      path: 'assets/demo-pack/audio/Simulacra-chosic.com_.mp3',
      originalName: 'Simulacra-chosic.com_.mp3',
      mimeType: 'audio/mpeg',
    });

    expect(resolvedUrl).toContain('Simulacra-chosic.com_.mp3');
  });

  it('uses literal project paths in published game runtime', async () => {
    vi.stubGlobal('window', { __PHASER_FORGE_PUBLISH_MARKER: 'publish-test' });

    const resolvedUrl = await resolveAssetSourceUrl({
      kind: 'path',
      path: 'assets/demo-pack/audio/Simulacra-chosic.com_.mp3',
      originalName: 'Simulacra-chosic.com_.mp3',
      mimeType: 'audio/mpeg',
    });

    expect(resolvedUrl).toBe('assets/demo-pack/audio/Simulacra-chosic.com_.mp3');
  });
});

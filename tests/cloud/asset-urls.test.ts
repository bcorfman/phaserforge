import { afterEach, describe, expect, it, vi } from 'vitest';

import { inlinePreviewUrlForAssetSource, resolveAssetSourceUrl } from '../../src/cloud/assetUrls';

describe('asset URL helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

  it('resolves path-backed audio assets to blob URLs for runtime playback', async () => {
    const fetchMock = vi.fn(async () => new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const createObjectUrl = vi.fn(() => 'blob:demo-pack-theme');
    vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectUrl);

    const resolvedUrl = await resolveAssetSourceUrl({
      kind: 'path',
      path: 'assets/demo-pack/audio/Simulacra-chosic.com_.mp3',
      originalName: 'Simulacra-chosic.com_.mp3',
      mimeType: 'audio/mpeg',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(resolvedUrl).toBe('blob:demo-pack-theme');
  });
});

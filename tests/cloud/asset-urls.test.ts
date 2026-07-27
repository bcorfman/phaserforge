import { afterEach, describe, expect, it, vi } from 'vitest';

import { assetSourceKey, inlinePreviewUrlForAssetSource, resolveAssetSourceUrl } from '../../src/cloud/assetUrls';

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

  it('builds stable source keys and resolves embedded data URLs inline', async () => {
    const source = {
      kind: 'embedded' as const,
      dataUrl: 'data:image/png;base64,abc',
      originalName: 'hero.png',
      mimeType: 'image/png',
    };
    expect(assetSourceKey(source)).toBe('embedded:hero.png:image/png:25');
    expect(inlinePreviewUrlForAssetSource(source)).toBe(source.dataUrl);
    expect(await resolveAssetSourceUrl(source)).toBe(source.dataUrl);
    expect(assetSourceKey({ kind: 'path', path: 'hero.png' })).toBe('path:hero.png::');
    expect(assetSourceKey({ kind: 'cloud', assetId: 'asset/1' })).toBe('cloud:asset/1::');
  });

  it('fetches cloud content once, caches the promise, and creates an object URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['image'])) });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:hero') });
    const source = { kind: 'cloud' as const, assetId: 'asset-success-coverage' };

    const [first, second] = await Promise.all([resolveAssetSourceUrl(source), resolveAssetSourceUrl(source)]);

    expect(first).toBe('blob:hero');
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/assets/asset-success-coverage/content', { credentials: 'include' });
  });

  it('returns null for a failed cloud asset response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(resolveAssetSourceUrl({ kind: 'cloud', assetId: 'asset-failure-coverage' })).resolves.toBeNull();
  });
});

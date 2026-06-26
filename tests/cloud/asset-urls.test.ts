import { describe, expect, it } from 'vitest';

import { inlinePreviewUrlForAssetSource, resolveAssetSourceUrl } from '../../src/cloud/assetUrls';

describe('asset URL helpers', () => {
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
});

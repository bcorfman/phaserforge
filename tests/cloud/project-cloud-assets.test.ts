import { describe, expect, it, vi } from 'vitest';

import { createEmptyProject } from '../../src/model/emptyProject';
import { prepareProjectForCloudSave } from '../../src/cloud/projectCloudAssets';

describe('prepareProjectForCloudSave', () => {
  it('uploads embedded assets and rewrites them to cloud refs while preserving existing refs', async () => {
    const project = createEmptyProject();
    project.assets.images.hero = {
      id: 'hero',
      width: 16,
      height: 16,
      source: {
        kind: 'embedded',
        dataUrl: 'data:image/png;base64,AAAA',
        originalName: 'hero.png',
        mimeType: 'image/png',
      },
    } as any;
    project.audio.sounds.theme = {
      id: 'theme',
      source: {
        kind: 'embedded',
        dataUrl: 'data:audio/mpeg;base64,BBBB',
        originalName: 'theme.mp3',
        mimeType: 'audio/mpeg',
      },
    } as any;
    project.assets.fonts.arcade = {
      id: 'arcade',
      name: 'Arcade',
      source: {
        kind: 'path',
        path: 'assets/fonts/arcade.woff2',
        originalName: 'arcade.woff2',
        mimeType: 'font/woff2',
      },
    } as any;

    const upload = vi.fn(async (source: any) => ({
      kind: 'cloud' as const,
      assetId: `asset-${source.originalName}`,
      originalName: source.originalName,
      mimeType: source.mimeType,
    }));

    const prepared = await prepareProjectForCloudSave(project, upload);

    expect(upload).toHaveBeenCalledTimes(2);
    expect(prepared).not.toBe(project);
    expect(prepared.assets.images.hero.source).toEqual({
      kind: 'cloud',
      assetId: 'asset-hero.png',
      originalName: 'hero.png',
      mimeType: 'image/png',
    });
    expect(prepared.audio.sounds.theme.source).toEqual({
      kind: 'cloud',
      assetId: 'asset-theme.mp3',
      originalName: 'theme.mp3',
      mimeType: 'audio/mpeg',
    });
    expect(prepared.assets.fonts.arcade.source).toEqual(project.assets.fonts.arcade.source);
  });

  it('reuses cached uploads for identical embedded sources', async () => {
    const project = createEmptyProject();
    const shared = {
      kind: 'embedded',
      dataUrl: 'data:audio/mpeg;base64,BBBB',
      originalName: 'theme.mp3',
      mimeType: 'audio/mpeg',
    } as const;
    project.audio.sounds.theme = { id: 'theme', source: shared } as any;
    project.audio.sounds.theme2 = { id: 'theme2', source: shared } as any;

    const cache = new Map<string, any>();
    const upload = vi.fn(async () => ({
      kind: 'cloud' as const,
      assetId: 'asset-theme',
      originalName: 'theme.mp3',
      mimeType: 'audio/mpeg',
    }));

    const prepared = await prepareProjectForCloudSave(project, upload, cache);

    expect(upload).toHaveBeenCalledTimes(1);
    expect(prepared.audio.sounds.theme.source).toEqual(prepared.audio.sounds.theme2.source);
    expect(cache.get(shared.dataUrl)).toEqual(prepared.audio.sounds.theme.source);
  });
});

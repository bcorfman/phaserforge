import { expect, test } from '@playwright/test';
import { dismissViewHint, getEntitySpriteWorldRect, getState, seedProject } from './helpers';

test.describe('Project pixel scale', () => {
  test('project settings rescale baseline asset-backed sprites on the canvas immediately @smoke', async ({ page }) => {
    const project = {
      id: 'project-pixel-scale',
      title: 'Pixel Scale Demo',
      pixelsPerUnit: 1,
      assets: {
        images: {
          hero: {
            id: 'hero',
            width: 64,
            height: 64,
            source: {
              kind: 'embedded',
              dataUrl: 'data:image/png;base64,AAAA',
              originalName: 'hero.png',
              mimeType: 'image/png',
            },
          },
        },
        spriteSheets: {},
        fonts: {},
      },
      audio: { sounds: {} },
      inputMaps: {},
      collections: {},
      counters: {},
      scenes: {
        'scene-1': {
          id: 'scene-1',
          name: 'Scene 1',
          world: { width: 800, height: 600 },
          entities: {
            hero: {
              id: 'hero',
              name: 'hero',
              x: 240,
              y: 180,
              width: 64,
              height: 64,
              rotationDeg: 0,
              scaleX: 1,
              scaleY: 1,
              asset: {
                source: { kind: 'asset', assetId: 'hero' },
                imageType: 'image',
                frame: { kind: 'single' },
              },
            },
          },
          groups: {},
          attachments: {},
          eventBlocks: {},
          actions: {},
          handlers: {},
          backgroundLayers: [],
          collisionRules: [],
          triggers: [],
        },
      },
      initialSceneId: 'scene-1',
    } as any;

    await seedProject(page, project);
    await dismissViewHint(page);

    await expect.poll(async () => await getEntitySpriteWorldRect(page, 'hero')).toBeTruthy();
    const beforeRect = await getEntitySpriteWorldRect(page, 'hero');
    expect(beforeRect).toBeTruthy();

    await page.getByTestId('project-tree-manage-button').click();
    await page.getByTestId('project-manage-settings').click();
    await expect(page.getByTestId('project-settings-dialog')).toBeVisible();
    await page.getByTestId('project-settings-preset-2').click();
    await page.getByTestId('project-settings-save').click();

    await expect.poll(async () => {
      const state = await getState<{ project?: { pixelsPerUnit?: number }, scene?: { entities?: Record<string, { width?: number; height?: number }> } } | null>(page);
      return {
        pixelsPerUnit: state?.project?.pixelsPerUnit ?? null,
        width: state?.scene?.entities?.hero?.width ?? null,
        height: state?.scene?.entities?.hero?.height ?? null,
      };
    }).toEqual({
      pixelsPerUnit: 2,
      width: 32,
      height: 32,
    });

    await expect.poll(async () => {
      const rect = await getEntitySpriteWorldRect(page, 'hero');
      if (!rect || !beforeRect) return null;
      return {
        width: rect.maxX - rect.minX,
        height: rect.maxY - rect.minY,
        beforeWidth: beforeRect.maxX - beforeRect.minX,
        beforeHeight: beforeRect.maxY - beforeRect.minY,
      };
    }).toEqual(expect.objectContaining({
      width: expect.closeTo((beforeRect!.maxX - beforeRect!.minX) / 2, 1),
      height: expect.closeTo((beforeRect!.maxY - beforeRect!.minY) / 2, 1),
      beforeWidth: expect.any(Number),
      beforeHeight: expect.any(Number),
    }));
  });
});

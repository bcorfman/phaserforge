import { expect, test } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { dismissViewHint, getEntityWorldRect, getState, openSceneScope, seedProject, worldToClient } from './helpers';

test.describe('Assets dock', () => {
  test('imports an image and drags to canvas to create an entity with asset ref', async ({ page }) => {
    await seedProject(page, createEmptyProject());
    await dismissViewHint(page);
    await openSceneScope(page);

    await page.getByTestId('assets-dock-import-button').click();
    await expect(page.getByTestId('assets-dock-import-panel')).toBeVisible();

    const fileChooser = page.getByTestId('assets-dock-file-input');
    await fileChooser.setInputFiles('res/images/enemy_A.png');

    await expect(page.getByTestId('assets-dock-item-image-enemy-a')).toBeVisible();

    const source = page.getByTestId('assets-dock-item-image-enemy-a');
    const canvas = page.locator('#game-container canvas');
    await source.dragTo(canvas, { targetPosition: { x: 200, y: 140 } });

    await expect.poll(async () => {
      const state = await getState<any>(page);
      const entities = state?.scene?.entities ?? {};
      const withAssetRef = Object.values(entities).filter((e: any) => e?.asset?.source?.kind === 'asset' && e?.asset?.source?.assetId === 'enemy-a');
      return withAssetRef.length;
    }).toBe(1);
  });

  test('dragging an image asset onto an existing sprite replaces its asset', async ({ page }) => {
    await seedProject(page, createEmptyProject());
    await dismissViewHint(page);
    await openSceneScope(page);

    await page.getByTestId('assets-dock-import-button').click();
    await page.getByTestId('assets-dock-file-input').setInputFiles('res/images/enemy_A.png');
    await expect(page.getByTestId('assets-dock-item-image-enemy-a')).toBeVisible();

    const enemyAsset = page.getByTestId('assets-dock-item-image-enemy-a');
    const canvas = page.locator('#game-container canvas');
    await enemyAsset.dragTo(canvas, { targetPosition: { x: 220, y: 160 } });

    await expect.poll(async () => {
      const state = await getState<any>(page);
      const entities = state?.scene?.entities ?? {};
      const entry = Object.values(entities).find((e: any) => e?.asset?.source?.kind === 'asset' && e?.asset?.source?.assetId === 'enemy-a') as any;
      return entry?.id ?? null;
    }).not.toBeNull();

    const createdEntityId = await page.evaluate(() => {
      const state: any = (window as any).__PHASER_ACTIONS_STUDIO_TEST__?.getState?.();
      const entities = state?.scene?.entities ?? {};
      const entry = Object.values(entities).find((e: any) => e?.asset?.source?.kind === 'asset' && e?.asset?.source?.assetId === 'enemy-a') as any;
      return entry?.id ?? null;
    });
    if (typeof createdEntityId !== 'string') throw new Error('Failed to create entity from asset');

    await page.getByTestId('assets-dock-import-button').click();
    await page.getByTestId('assets-dock-file-input').setInputFiles('res/images/meteor_large.png');
    await expect(page.getByTestId('assets-dock-item-image-meteor-large')).toBeVisible();

    const rect = await getEntityWorldRect(page, createdEntityId);
    const point = await worldToClient(page, { x: rect.centerX ?? (rect.minX + rect.maxX) / 2, y: rect.centerY ?? (rect.minY + rect.maxY) / 2 });
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas bounding box unavailable');
    await page.getByTestId('assets-dock-item-image-meteor-large').dragTo(canvas, {
      targetPosition: { x: Math.max(1, point.x - canvasBox.x), y: Math.max(1, point.y - canvasBox.y) },
    });

    await expect.poll(async () => {
      const state = await getState<any>(page);
      const entity = state?.scene?.entities?.[createdEntityId];
      return entity?.asset?.source?.assetId ?? '';
    }).toBe('meteor-large');
  });

  test('imports audio by path and assigns it to scene music via drop', async ({ page }) => {
    await seedProject(page, createEmptyProject());
    await dismissViewHint(page);
    await openSceneScope(page);

    await page.getByTestId('assets-dock-import-button').click();
    await page.getByTestId('assets-dock-import-kind-select').selectOption('audio');
    await page.getByTestId('assets-dock-import-source-select').selectOption('path');
    await page.getByTestId('assets-dock-import-path-input').fill('/assets/audio/theme.mp3');
    await page.getByTestId('assets-dock-import-path').click();

    await page.getByTestId('assets-dock-tab-audio').click();
    await expect(page.getByTestId('assets-dock-item-audio-theme')).toBeVisible();

    await page.getByTestId('scene-inspector-panel').getByText('Expand All').click();
    const source = page.getByTestId('assets-dock-item-audio-theme');
    const musicSelect = page.getByTestId('scene-music-asset-select');
    await source.dragTo(musicSelect);

    await expect.poll(async () => {
      const state = await getState<any>(page);
      return state?.scene?.music?.assetId ?? '';
    }).toBe('theme');
  });
});

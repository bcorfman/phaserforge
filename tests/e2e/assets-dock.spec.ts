import { expect, test } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { dismissViewHint, getState, openSceneScope, seedProject } from './helpers';

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

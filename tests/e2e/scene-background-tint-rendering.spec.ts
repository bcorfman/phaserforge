import { expect, test } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { dispatchAction, getRenderDebugSnapshot, getSceneSnapshot, seedProject } from './helpers';

const WHITE_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function makeTintedSceneProject() {
  const project = createEmptyProject() as any;
  const scene = project.scenes[project.initialSceneId];
  scene.backgroundColor = 0x000000;
  project.assets.images.star = {
    id: 'star',
    width: 1,
    height: 1,
    source: { kind: 'embedded', dataUrl: WHITE_PIXEL, originalName: 'star.png', mimeType: 'image/png' },
  };
  project.assets.spriteSheets.sheet = {
    id: 'sheet',
    width: 1,
    height: 1,
    source: { kind: 'embedded', dataUrl: WHITE_PIXEL, originalName: 'sheet.png', mimeType: 'image/png' },
    grid: { frameWidth: 1, frameHeight: 1, columns: 1, rows: 1 },
  };
  scene.entities = {
    imageStar: {
      id: 'imageStar',
      x: 80,
      y: 80,
      width: 16,
      height: 16,
      tint: 0x224466,
      asset: { source: { kind: 'asset', assetId: 'star' }, imageType: 'image', frame: { kind: 'single' } },
    },
    sheetStar: {
      id: 'sheetStar',
      x: 120,
      y: 80,
      width: 16,
      height: 16,
      tint: 0x335577,
      asset: {
        source: { kind: 'asset', assetId: 'sheet' },
        imageType: 'spritesheet',
        grid: { frameWidth: 1, frameHeight: 1, columns: 1, rows: 1 },
        frame: { kind: 'index', frameIndex: 0 },
      },
    },
    placeholderStar: {
      id: 'placeholderStar',
      x: 160,
      y: 80,
      width: 16,
      height: 16,
      tint: 0x446688,
    },
  };
  scene.groups = {};
  scene.attachments = {};
  scene.eventBlocks = {};
  return project;
}

test('scene background and entity tint match in edit and play without selection tint drift @critical', async ({ page }) => {
  await seedProject(page, makeTintedSceneProject());

  await expect.poll(async () => {
    const snapshot = await getSceneSnapshot<any>(page);
    const render = await getRenderDebugSnapshot<any>(page);
    return {
      sceneKey: snapshot?.sceneKey,
      background: render?.cameraBackgroundColor,
      imageTint: render?.entityDisplay?.imageStar?.tint,
      sheetTint: render?.entityDisplay?.sheetStar?.tint,
      placeholderTint: render?.entityDisplay?.placeholderStar?.fillColor ?? render?.entityDisplay?.placeholderStar?.tint,
    };
  }).toEqual({
    sceneKey: 'EditorScene',
    background: 0x000000,
    imageTint: 0x224466,
    sheetTint: 0x335577,
    placeholderTint: 0x446688,
  });

  await dispatchAction(page, { type: 'select', selection: { kind: 'entity', id: 'imageStar' } });
  await expect.poll(async () => (await getRenderDebugSnapshot<any>(page))?.entityDisplay?.imageStar?.tint).toBe(0x224466);

  await page.evaluate(() => window.__PHASER_FORGE_TEST__?.setMode?.('play'));
  await expect.poll(async () => {
    const snapshot = await getSceneSnapshot<any>(page);
    const render = await getRenderDebugSnapshot<any>(page);
    return {
      sceneKey: snapshot?.sceneKey,
      background: render?.cameraBackgroundColor,
      imageTint: render?.entityDisplay?.imageStar?.tint,
      sheetTint: render?.entityDisplay?.sheetStar?.tint,
      placeholderTint: render?.entityDisplay?.placeholderStar?.fillColor ?? render?.entityDisplay?.placeholderStar?.tint,
    };
  }).toEqual({
    sceneKey: 'GameScene',
    background: 0x000000,
    imageTint: 0x224466,
    sheetTint: 0x335577,
    placeholderTint: 0x446688,
  });
});

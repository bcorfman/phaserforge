import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, seedProject } from './helpers';

test('Play mode: hide OS cursor option applies to game canvas @browser', async ({ page }) => {
  await seedProject(page, {
    id: 'project-1',
    assets: { images: {}, spriteSheets: {}, fonts: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: {
      'scene-1': {
        id: 'scene-1',
        world: { width: 512, height: 384 },
        entities: {},
        groups: {},
        attachments: {},
        behaviors: {},
        actions: {},
        conditions: {},
        input: {
          mouse: { hideOsCursorInPlay: true },
        },
      },
    },
    initialSceneId: 'scene-1',
  });

  await dismissViewHint(page);
  await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.setMode?.('play'));
  await expect
    .poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey, { timeout: 5000 })
    .toBe('GameScene');

  const canvas = page.locator('#game-container canvas');
  await expect(canvas).toBeVisible({ timeout: 5000 });
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const canvasEl = document.querySelector('#game-container canvas') as HTMLCanvasElement | null;
        return canvasEl?.style.cursor ?? '';
      });
    }, { timeout: 5000 })
    .toBe('none');
});

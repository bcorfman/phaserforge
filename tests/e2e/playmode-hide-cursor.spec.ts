import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, seedProject } from './helpers';

test('Play mode: hide OS cursor option applies to game canvas', async ({ page }) => {
  await seedProject(page, {
    id: 'project-1',
    assets: { images: {}, spriteSheets: {} },
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
  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');

  await expect.poll(async () => {
    return page.evaluate(() => {
      const canvas = document.querySelector('#game-container canvas') as HTMLCanvasElement | null;
      return canvas?.style?.cursor ?? '';
    });
  }).toBe('none');
});


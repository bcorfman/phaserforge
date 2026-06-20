import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, getState, seedProject } from './helpers';

test('Play mode preserves the hide OS cursor scene option @browser', async ({ page }) => {
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
  await expect
    .poll(async () => {
      const state = await getState<{ scene?: { input?: { mouse?: { hideOsCursorInPlay?: boolean } } } } | null>(page);
      return Boolean(state?.scene?.input?.mouse?.hideOsCursorInPlay);
    }, { timeout: 5000 })
    .toBe(true);
  await page.evaluate(() => window.__PHASER_FORGE_TEST__?.setMode?.('play'));
  await expect
    .poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey, { timeout: 5000 })
    .toBe('GameScene');
  await expect
    .poll(async () => {
      const state = await getState<{ scene?: { input?: { mouse?: { hideOsCursorInPlay?: boolean } } } } | null>(page);
      return Boolean(state?.scene?.input?.mouse?.hideOsCursorInPlay);
    }, { timeout: 5000 })
    .toBe(true);
});

import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, seedProject } from './helpers';

test.describe.configure({ retries: 2 });

test('Play mode: semantic input actions update from keyboard events (bridge snapshot)', async ({ page }) => {
  await seedProject(page, {
    id: 'project-1',
    assets: { images: {}, spriteSheets: {}, fonts: {} },
    audio: { sounds: {} },
    inputMaps: {
      default_controls: {
        actions: {
          Jump: [{ device: 'keyboard', key: 'Space', event: 'held' }],
        },
      },
    },
    defaultInputMapId: 'default_controls',
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
      },
    },
    initialSceneId: 'scene-1',
  });

  await dismissViewHint(page);
  await page.evaluate(() => (window as any).__PHASER_ACTIONS_STUDIO_TEST__?.setMode?.('play'));
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');

  // Ensure the runtime scene receives keyboard events consistently across browsers.
  await page.locator('#game-container canvas').click({ position: { x: 10, y: 10 } });
  await page.keyboard.down('Space');
  await expect.poll(async () => {
    const snap = await getSceneSnapshot<any>(page);
    return {
      held: Boolean(snap?.input?.actions?.Jump?.held),
      pressedCount: Number(snap?.input?.pressedCounts?.Jump ?? 0),
    };
  }).toEqual({ held: true, pressedCount: 1 });

  await page.keyboard.up('Space');
  await expect.poll(async () => {
    const snap = await getSceneSnapshot<any>(page);
    return {
      held: Boolean(snap?.input?.actions?.Jump?.held),
    };
  }).toEqual({ held: false });
});

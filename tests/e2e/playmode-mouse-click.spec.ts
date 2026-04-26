import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, seedProject, worldToClient } from './helpers';

test('Play mode: clicking an entity records a runtime click snapshot', async ({ page }) => {
  await seedProject(page, {
    id: 'project-1',
    assets: { images: {}, spriteSheets: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: {
      'scene-1': {
        id: 'scene-1',
        world: { width: 512, height: 384 },
        entities: {
          e1: { id: 'e1', x: 120, y: 120, width: 40, height: 40 },
        },
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
  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');

  const point = await worldToClient(page, { x: 120, y: 120 });
  await page.mouse.click(point.x, point.y, { button: 'left' });

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<any>(page);
    return snap?.lastEntityPointerDown?.entityId ?? null;
  }).toBe('e1');
});

import { expect, test } from '@playwright/test';
import { clickCanvasAt, dismissViewHint, entityClientCenter, getSceneSnapshot, getState, seedProject, worldToClient } from './helpers';

test('Edit mode: base scene ghost renders but is non-interactive', async ({ page }) => {
  await seedProject(page, {
    id: 'project-ghost',
    assets: { images: {}, spriteSheets: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: {
      base: {
        id: 'base',
        world: { width: 1024, height: 768 },
        entities: {
          base1: { id: 'base1', x: 200, y: 200, width: 80, height: 80 },
        },
        groups: {},
        attachments: {},
        behaviors: {},
        actions: {},
        conditions: {},
      },
      wave: {
        id: 'wave',
        world: { width: 1024, height: 768 },
        entities: {
          w1: { id: 'w1', x: 500, y: 300, width: 40, height: 40 },
        },
        groups: {},
        attachments: {},
        behaviors: {},
        actions: {},
        conditions: {},
      },
    },
    initialSceneId: 'wave',
    baseSceneId: 'base',
  });

  await dismissViewHint(page);

  await expect.poll(async () => (await getSceneSnapshot<any>(page))?.compiledSceneId).toBe('wave');
  await expect.poll(async () => (await getSceneSnapshot<any>(page))?.referenceSpriteCount).toBe(1);

  const activePoint = await entityClientCenter(page, 'w1');
  await clickCanvasAt(page, activePoint);
  await expect.poll(async () => (await getState<any>(page))?.selection).toEqual({ kind: 'entity', id: 'w1' });

  const ghostPoint = await worldToClient(page, { x: 200, y: 200 });
  await clickCanvasAt(page, ghostPoint);
  await expect.poll(async () => (await getState<any>(page))?.selection).toEqual({ kind: 'none' });
});


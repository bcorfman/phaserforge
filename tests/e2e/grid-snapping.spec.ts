import { expect, test } from '@playwright/test';
import { dismissViewHint, dragWorld, getState, seedProject } from './helpers';

test('grid snapping toggles and snaps small drags @critical', async ({ page }) => {
  await seedProject(page, {
    id: 'project-grid-snap',
    assets: { images: {}, spriteSheets: {}, fonts: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: {
      'scene-1': {
        id: 'scene-1',
        world: { width: 1024, height: 768 },
        entities: {
          e1: { id: 'e1', x: 220, y: 140, width: 28, height: 20 },
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
  await page.getByTestId('toggle-grid-snap-button').click();

  await dragWorld(page, { x: 220, y: 140 }, { x: 227, y: 140 });

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
    return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  }).toEqual({ x: 228, y: 140 });
});

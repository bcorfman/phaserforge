import { expect, test } from '@playwright/test';
import { dismissViewHint, getState, seedProject } from './helpers';

test('create a second scene, switch scenes, and preserve per-scene edits @critical', async ({ page }) => {
  test.setTimeout(120000);
  await seedProject(page, {
    id: 'project-scenes-switching',
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

  const state1 = await getState<{ currentSceneId?: string; scene?: { entities?: Record<string, unknown> } }>(page);
  const firstSceneId = state1.currentSceneId ?? 'scene-1';
  const firstCount = Object.keys(state1.scene?.entities ?? {}).length;
  expect(firstCount).toBeGreaterThan(0);

  await page.getByTestId('create-scene-button').click();

  await expect.poll(async () => (await getState<{ currentSceneId?: string }>(page))?.currentSceneId).not.toBe(firstSceneId);
  await expect.poll(async () => {
    const state = await getState<{ scene?: { entities?: Record<string, unknown> } }>(page);
    return Object.keys(state.scene?.entities ?? {}).length;
  }).toBe(0);
  const secondState = await getState<{ scene?: { entities?: Record<string, unknown> } }>(page);
  const secondCount = Object.keys(secondState.scene?.entities ?? {}).length;

  expect(firstCount).not.toBe(secondCount);

  await page.getByTestId(`scene-item-${firstSceneId}`).click();
  await expect.poll(async () => (await getState<{ currentSceneId?: string }>(page))?.currentSceneId).toBe(firstSceneId);
  await expect.poll(async () => {
    const state = await getState<{ scene?: { entities?: Record<string, unknown> } }>(page);
    return Object.keys(state.scene?.entities ?? {}).length;
  }).toBe(firstCount);
});

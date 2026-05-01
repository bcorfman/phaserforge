import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, getState, seedProject } from './helpers';

test('Play mode: scene.goto switches runtime scene without changing editor currentSceneId', async ({ page }) => {
  await seedProject(page, {
    id: 'project-1',
    assets: { images: {}, spriteSheets: {}, fonts: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: {
      'scene-1': {
        id: 'scene-1',
        world: { width: 1024, height: 768 },
        entities: {
          e1: { id: 'e1', x: 120, y: 120, width: 20, height: 20 },
        },
        groups: {},
        attachments: {
          'att-wait': {
            id: 'att-wait',
            target: { type: 'entity', entityId: 'e1' },
            enabled: true,
            order: 0,
            presetId: 'Wait',
            params: { durationMs: 10 },
          },
          'att-goto': {
            id: 'att-goto',
            target: { type: 'entity', entityId: 'e1' },
            enabled: true,
            order: 1,
            presetId: 'Call',
            params: { callId: 'scene.goto', sceneId: 'scene-2', transition: 'none', durationMs: 0 },
          },
        },
        behaviors: {},
        actions: {},
        conditions: {},
      },
      'scene-2': {
        id: 'scene-2',
        world: { width: 1024, height: 768 },
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
  await expect.poll(async () => (await getState<{ currentSceneId?: string }>(page))?.currentSceneId).toBe('scene-1');

  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getState<{ mode?: string }>(page))?.mode).toBe('play');
  await expect(page.getByTestId('scene-item-scene-2')).toBeDisabled();

  await expect.poll(async () => (await getSceneSnapshot<{ compiledSceneId?: string }>(page))?.compiledSceneId, { timeout: 5000 }).toBe('scene-2');
  await expect.poll(async () => (await getState<{ currentSceneId?: string }>(page))?.currentSceneId).toBe('scene-1');
});

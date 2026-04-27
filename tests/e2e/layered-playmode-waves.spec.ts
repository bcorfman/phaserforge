import { expect, test } from '@playwright/test';
import { dismissViewHint, getEntityWorldRect, getEntitySpriteWorldRect, getSceneSnapshot, getState, seedProject } from './helpers';

test('Play mode: scene.gotoWave swaps wave without resetting base, and keeps UI in sync', async ({ page }) => {
  await seedProject(page, {
    id: 'project-layered',
    assets: { images: {}, spriteSheets: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: {
      base: {
        id: 'base',
        world: { width: 1024, height: 768 },
        entities: {
          baseMover: { id: 'baseMover', x: 10, y: 100, width: 20, height: 20 },
        },
        groups: {},
        attachments: {
          'att-move': {
            id: 'att-move',
            target: { type: 'entity', entityId: 'baseMover' },
            enabled: true,
            order: 0,
            presetId: 'MoveUntil',
            params: { velocityX: 120, velocityY: 0 },
            condition: { type: 'ElapsedTime', durationMs: 60000 },
          },
        },
        behaviors: {},
        actions: {},
        conditions: {},
      },
      'wave-1': {
        id: 'wave-1',
        world: { width: 1024, height: 768 },
        entities: {
          w1: { id: 'w1', x: 300, y: 300, width: 30, height: 30 },
        },
        groups: {},
        attachments: {
          'att-wait': {
            id: 'att-wait',
            target: { type: 'entity', entityId: 'w1' },
            enabled: true,
            order: 0,
            presetId: 'Wait',
            params: { durationMs: 250 },
          },
          'att-goto-wave': {
            id: 'att-goto-wave',
            target: { type: 'entity', entityId: 'w1' },
            enabled: true,
            order: 1,
            presetId: 'Call',
            params: { callId: 'scene.gotoWave', sceneId: 'wave-2' },
          },
        },
        behaviors: {},
        actions: {},
        conditions: {},
      },
      'wave-2': {
        id: 'wave-2',
        world: { width: 1024, height: 768 },
        entities: {
          w2: { id: 'w2', x: 700, y: 300, width: 30, height: 30 },
        },
        groups: {},
        attachments: {},
        behaviors: {},
        actions: {},
        conditions: {},
      },
    },
    initialSceneId: 'wave-1',
    baseSceneId: 'base',
  });

  await dismissViewHint(page);

  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getState<any>(page))?.mode).toBe('play');

  await expect.poll(async () => (await getSceneSnapshot<any>(page))?.compiledSceneId, { timeout: 5000 }).toBe('wave-1');
  await expect.poll(async () => (await getSceneSnapshot<any>(page))?.baseCompiledSceneId).toBe('base');

  const before = await getEntityWorldRect(page, 'baseMover');
  expect(before.centerX).toBeGreaterThan(10);

  await expect.poll(async () => (await getSceneSnapshot<any>(page))?.compiledSceneId, { timeout: 5000 }).toBe('wave-2');
  await expect.poll(async () => (await getState<any>(page))?.currentSceneId).toBe('wave-2');

  const after = await getEntityWorldRect(page, 'baseMover');
  expect(after.centerX).toBeGreaterThan(before.centerX);

  await expect.poll(async () => (await getEntitySpriteWorldRect(page, 'w1')), { timeout: 5000 }).toBeNull();
  await expect.poll(async () => (await getEntitySpriteWorldRect(page, 'w2')), { timeout: 5000 }).not.toBeNull();
});

import { expect, test } from '@playwright/test';
import { dismissViewHint, getEntityWorldRect, getSceneSnapshot, seedProject } from './helpers';

test('Play mode: mouse-driven entity motion respects axis locks', async ({ page }) => {
  await seedProject(page, {
    id: 'project-1',
    assets: { images: {}, spriteSheets: {}, fonts: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: {
      'scene-1': {
        id: 'scene-1',
        world: { width: 512, height: 384 },
        entities: {
          e1: { id: 'e1', x: 120, y: 200, width: 40, height: 40 },
        },
        groups: {},
        attachments: {},
        behaviors: {},
        actions: {},
        conditions: {},
        input: {
          mouse: { driveEntityId: 'e1', affectX: true, affectY: false },
        },
      },
    },
    initialSceneId: 'scene-1',
  });

  await dismissViewHint(page);
  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');

  await expect.poll(async () => {
    const rect = await getEntityWorldRect(page, 'e1');
    return rect?.centerX ?? null;
  }).not.toBeNull();

  const start = await getEntityWorldRect(page, 'e1');
  if (!start) throw new Error('Entity rect unavailable');
  const startY = Math.round(start.centerY);

  // Use the test bridge to deterministically place the pointer (avoids flaky headless mousemove behavior).
  await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.setPointerWorld({ x: 200, y: 10 }));
  await expect.poll(async () => {
    const snap = await getSceneSnapshot<any>(page);
    return typeof snap?.input?.pointer?.worldX === 'number' ? Math.round(snap.input.pointer.worldX) : null;
  }).toBeGreaterThanOrEqual(0);

  await expect.poll(async () => {
    const rect = await getEntityWorldRect(page, 'e1');
    return { x: Math.round(rect?.centerX ?? 0), y: Math.round(rect?.centerY ?? 0) };
  }).toEqual({ x: 200, y: startY } as any);

  await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.setPointerWorld({ x: 360, y: 10 }));
  await expect.poll(async () => {
    const rect = await getEntityWorldRect(page, 'e1');
    return { x: Math.round(rect?.centerX ?? 0), y: Math.round(rect?.centerY ?? 0) };
  }).toEqual({ x: 360, y: startY } as any);
});

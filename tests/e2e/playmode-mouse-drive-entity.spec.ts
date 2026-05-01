import { expect, test } from '@playwright/test';
import { dismissViewHint, getEntityWorldRect, getSceneSnapshot, seedProject, worldToClient } from './helpers';

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

  const before = await getEntityWorldRect(page, 'e1');
  const targetClient = await page.evaluate(() => {
    const canvas = document.querySelector('#game-container canvas') as HTMLCanvasElement | null;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + rect.width * 0.75, y: rect.top + rect.height * 0.25 };
  });
  await page.mouse.move(targetClient.x, targetClient.y);

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<any>(page);
    const x = snap?.input?.pointer?.worldX;
    return typeof x === 'number' ? Math.round(x) : null;
  }).not.toBeNull();

  const pointerWorldX = await (async () => {
    const snap = await getSceneSnapshot<any>(page);
    return Math.round(Number(snap?.input?.pointer?.worldX ?? 0));
  })();

  await expect.poll(async () => {
    const rect = await getEntityWorldRect(page, 'e1');
    return { x: Math.round(rect.centerX ?? 0), y: Math.round(rect.centerY ?? 0) };
  }).toEqual({ x: pointerWorldX as any, y: Math.round(before.centerY ?? 0) });
});

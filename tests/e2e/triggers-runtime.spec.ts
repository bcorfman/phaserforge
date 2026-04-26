import { expect, test } from '@playwright/test';
import { dismissViewHint, getEntityWorldRect, getSceneSnapshot, seedProject } from './helpers';

test('Play mode: entering a trigger zone emits an enter event in the snapshot', async ({ page }) => {
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
          e1: {
            id: 'e1',
            x: 50,
            y: 50,
            width: 40,
            height: 40,
            body: { enabled: true, kind: 'dynamic' },
            collision: { enabled: true, layer: 'player' },
          },
        },
        groups: {},
        attachments: {},
        behaviors: {},
        actions: {},
        conditions: {},
        input: {
          mouse: { driveEntityId: 'e1', affectX: true, affectY: true },
        },
        triggers: [
          {
            id: 't1',
            enabled: true,
            rect: { x: 400, y: 0, width: 112, height: 384 },
          },
        ],
      },
    },
    initialSceneId: 'scene-1',
  } as any);

  await dismissViewHint(page);
  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');
  await expect.poll(async () => (await getSceneSnapshot<{ ready?: boolean }>(page))?.ready).toBe(true);

  const targetClient = await page.evaluate(() => {
    const canvas = document.querySelector('#game-container canvas') as HTMLCanvasElement | null;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + rect.width * 0.95, y: rect.top + rect.height * 0.5 };
  });
  await page.mouse.move(targetClient.x, targetClient.y);

  await expect.poll(async () => {
    const rect = await getEntityWorldRect(page, 'e1');
    return Math.round(rect.centerX ?? 0);
  }).toBeGreaterThanOrEqual(400);

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<any>(page);
    const events = snap?.collisions?.triggerEvents;
    if (!Array.isArray(events)) return null;
    return events.find((e: any) => e?.id === 't1' && e?.type === 'enter' && e?.entityId === 'e1') ?? null;
  }).not.toBeNull();
});

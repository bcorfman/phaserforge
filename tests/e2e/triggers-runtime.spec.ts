import { expect, test } from '@playwright/test';
import { dismissViewHint, dragOnCanvas, getEntityWorldRect, getSceneSnapshot, seedProject } from './helpers';

test('Play mode: entering a trigger zone emits an enter event in the snapshot', async ({ page }) => {
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

  const canvas = page.locator('#game-container canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas bounding box unavailable');
  const y = box.y + box.height * 0.5;
  // Hover alone can be flaky in headless Firefox for Phaser pointer world coords,
  // so click before dragging to ensure the canvas has active pointer state.
  await canvas.click({ position: { x: Math.max(1, box.width * 0.15), y: Math.max(1, box.height * 0.5) } });
  await dragOnCanvas(page, { x: box.x + box.width * 0.15, y }, { x: box.x + box.width * 0.95, y }, 'left');
  await page.waitForTimeout(100);

  await expect.poll(async () => {
    const rect = await getEntityWorldRect(page, 'e1');
    if (!rect) return -1;
    return Math.round(rect.centerX ?? 0);
  }).toBeGreaterThanOrEqual(400);

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<any>(page);
    const events = snap?.collisions?.triggerEvents;
    if (!Array.isArray(events)) return null;
    return events.find((e: any) => e?.id === 't1' && e?.type === 'enter' && e?.entityId === 'e1') ?? null;
  }).not.toBeNull();
});

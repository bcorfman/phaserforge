import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, seedProject } from './helpers';

test('Laser Gates MVP: base player can fire into active wave and collisions detect overlap enter', async ({ page }) => {
  await seedProject(page, {
    id: 'project-1',
    assets: { images: {}, spriteSheets: {}, fonts: {} },
    audio: { sounds: {} },
    inputMaps: {
      m1: {
        actions: {
          fire: [{ device: 'keyboard', key: 'Space', event: 'held' }],
        },
      },
    },
    defaultInputMapId: 'm1',
    baseSceneId: 'base',
    scenes: {
      base: {
        id: 'base',
        world: { width: 320, height: 240 },
        entities: {
          ship: {
            id: 'ship',
            x: 120,
            y: 120,
            width: 20,
            height: 20,
            body: { enabled: true, kind: 'dynamic' },
            collision: { enabled: true, layer: 'player' },
          },
        },
        groups: {},
        attachments: {
          'att-fire': {
            id: 'att-fire',
            target: { type: 'entity', entityId: 'ship' },
            presetId: 'InputFire',
            params: {
              fireActionId: 'fire',
              templateEntityId: 'shot_template',
              layer: 'active',
              cooldownMs: 0,
              offsetX: 0,
              offsetY: 0,
              velocityX: 0,
              velocityY: 0,
            },
          },
        },
        behaviors: {},
        actions: {},
        conditions: {},
      },
      wave1: {
        id: 'wave1',
        world: { width: 320, height: 240 },
        entities: {
          shot_template: {
            id: 'shot_template',
            x: -9999,
            y: -9999,
            width: 8,
            height: 8,
            visible: false,
            body: { enabled: true, kind: 'dynamic' },
            collision: { enabled: true, layer: 'shots' },
          },
          block1: {
            id: 'block1',
            x: 120,
            y: 120,
            width: 20,
            height: 20,
            body: { enabled: true, kind: 'static' },
            collision: { enabled: true, layer: 'obstacles' },
          },
        },
        groups: {},
        attachments: {},
        behaviors: {},
        actions: {},
        conditions: {},
        collisionRules: [
          {
            id: 'shot-hit',
            a: { type: 'layer', layer: 'shots' },
            b: { type: 'layer', layer: 'obstacles' },
            interaction: 'overlap',
            onEnter: [
              { callId: 'entity.destroy', args: { target: 'a' } },
              { callId: 'entity.destroy', args: { target: 'b' } },
            ],
          },
        ],
      },
    },
    initialSceneId: 'wave1',
  } as any);

  await dismissViewHint(page);
  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');
  await expect.poll(async () => (await getSceneSnapshot<{ ready?: boolean }>(page))?.ready).toBe(true);
  await expect.poll(async () => (await getSceneSnapshot<any>(page))?.activeCollisionRuleCount).toBe(1);

  // Ensure keyboard input goes to the game canvas (Space on a focused button would toggle mode).
  await page.locator('#game-container canvas').click({ position: { x: 10, y: 10 } });
  await page.evaluate(() => { (document.activeElement as any)?.blur?.(); });

  await page.keyboard.down('Space');
  await expect.poll(async () => {
    const snap = await getSceneSnapshot<any>(page);
    return { pressedCount: Number(snap?.input?.pressedCounts?.fire ?? 0), held: Boolean(snap?.input?.actions?.fire?.held) };
  }).toEqual({ pressedCount: 1, held: true });

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<any>(page);
    return { lastSpawnedEntityId: snap?.lastSpawnedEntityId ?? null, lastSpawnError: snap?.lastSpawnError ?? null };
  }).toEqual({ lastSpawnedEntityId: expect.stringMatching(/^shot_template__spawn_/), lastSpawnError: null });

  await page.keyboard.up('Space');

  await expect.poll(async () => (await getSceneSnapshot<any>(page))?.sceneKey).toBe('GameScene');

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<any>(page);
    const events = snap?.collisions?.collisionEvents;
    const ids: string[] = snap?.activeEntityIds ?? [];
    const lastSpawnedEntityId = snap?.lastSpawnedEntityId ?? null;
    return {
      hasSpawn: ids.some((id) => typeof id === 'string' && id.startsWith('shot_template__spawn_')),
      collisionEventCount: Array.isArray(events) ? events.length : -1,
      hasEnter: Array.isArray(events) ? Boolean(events.find((e: any) => e?.ruleId === 'shot-hit' && e?.type === 'enter')) : false,
      processed: Number(snap?.activeLastProcessedCollisionEventCount ?? 0),
      lastSpawnedEntityId,
    };
  }).toEqual({ hasSpawn: true, collisionEventCount: expect.any(Number), hasEnter: true, processed: expect.any(Number), lastSpawnedEntityId: expect.stringMatching(/^shot_template__spawn_/) });

  // Collision detection happens within the active layer; scripts are covered by unit tests.
});

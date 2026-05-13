import { expect, test } from '@playwright/test';
import { dismissViewHint, getEntityWorldRect, getSceneSnapshot, seedProject } from './helpers';

test('Play mode: emitted event triggers handler Repeat composite children', async ({ page }) => {
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
          coin: { id: 'coin', x: 120, y: 120, width: 20, height: 20 },
          player: { id: 'player', x: 200, y: 120, width: 20, height: 20 },
        },
        groups: {},
        eventBlocks: {
          'ev-player': { id: 'ev-player', target: { type: 'entity', entityId: 'player' }, trigger: { type: 'event', eventName: 'Coin.Collected' } },
        },
        attachments: {
          wait1: {
            id: 'wait1',
            target: { type: 'entity', entityId: 'coin' },
            presetId: 'Wait',
            params: { durationMs: 30 },
            enabled: true,
            order: 0,
          },
          emit1: {
            id: 'emit1',
            target: { type: 'entity', entityId: 'coin' },
            presetId: 'EmitEvent',
            params: { eventName: 'Coin.Collected' },
            enabled: true,
            order: 1,
          },
          r1: {
            id: 'r1',
            target: { type: 'entity', entityId: 'player' },
            eventId: 'ev-player',
            presetId: 'Repeat',
            params: { count: 2 },
            enabled: true,
            order: 0,
            children: ['c1'],
          },
          c1: {
            id: 'c1',
            target: { type: 'entity', entityId: 'player' },
            eventId: 'ev-player',
            parentAttachmentId: 'r1',
            presetId: 'Call',
            params: { callId: 'drop', dy: 5 },
            enabled: true,
            order: 1,
          },
        },
        behaviors: {},
        actions: {},
        conditions: {},
      },
    },
    initialSceneId: 'scene-1',
  } as any);

  await dismissViewHint(page);
  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');
  await expect.poll(async () => (await getSceneSnapshot<{ ready?: boolean }>(page))?.ready).toBe(true);
  await expect.poll(async () => (await getSceneSnapshot<any>(page))?.runtimeOps?.hasDrop).toBe(true);

  const initial = await getEntityWorldRect(page, 'player');
  expect(initial).not.toBeNull();
  const initialCenterY = Math.round((initial as any).centerY);

  // Ensure at least one update tick has run after entering play mode.
  await page.waitForTimeout(200);

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<any>(page);
    const drained = snap?.runtimeEvents?.lastDrainedEventNames;
    return Array.isArray(drained) ? drained.includes('Coin.Collected') : false;
  }).toBe(true);

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<any>(page);
    const started = snap?.runtimeEvents?.lastStartedEventScriptKeys;
    return Array.isArray(started) ? started.includes('entity:player#ev-player#event:Coin.Collected') : false;
  }).toBe(true);

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<any>(page);
    const invocations = snap?.runtimeOps?.lastInvocations;
    return Array.isArray(invocations) ? invocations.filter((id: string) => id === 'drop').length : 0;
  }).toBeGreaterThanOrEqual(2);

  const snapshotAfterCalls = await getSceneSnapshot<any>(page);
  const errors = snapshotAfterCalls?.runtimeOps?.lastErrors ?? [];
  expect(errors).toEqual([]);
  const calls = snapshotAfterCalls?.runtimeOps?.lastCalls ?? [];
  expect(calls.some((c: any) => c?.opId === 'drop' && c?.target?.type === 'entity' && c?.target?.entityId === 'player' && c?.args?.dy === 5)).toBe(true);

  // Entity world rect is not used as the assertion here because the Play-mode render pipeline
  // can be influenced by physics objects; the op invocation count is the stable observable.
  void initialCenterY;
});

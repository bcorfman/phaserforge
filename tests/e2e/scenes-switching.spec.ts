import { expect, test } from '@playwright/test';
import { clampCameraScroll, getCenteredCameraScroll, getFitZoom } from '../../src/editor/viewport';
import { dismissViewHint, getSceneSnapshot, getState, seedProject, waitForViewportToSettle } from './helpers';

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
  await waitForViewportToSettle(page);
  const secondState = await getState<{ scene?: { entities?: Record<string, unknown> } }>(page);
  const secondCount = Object.keys(secondState.scene?.entities ?? {}).length;

  expect(firstCount).not.toBe(secondCount);

  const world = secondState.scene?.world ?? { width: 1024, height: 768 };
  const insets = await page.evaluate(() => {
    const overlay = document.querySelector('[data-testid="canvas-overlay"]') as HTMLElement | null;
    const controls = document.querySelector('[data-testid="canvas-overlay-top-right"]') as HTMLElement | null;
    if (!overlay || !controls) return { top: 0, right: 0 };
    const overlayRect = overlay.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();
    return {
      top: Math.max(0, controlsRect.bottom - overlayRect.top + 12),
      right: Math.max(0, overlayRect.right - controlsRect.left + 12),
    };
  });
  const snapshot = await getSceneSnapshot<{
    zoom: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
  }>(page);
  const expectedZoom = getFitZoom(snapshot.viewportWidth, snapshot.viewportHeight, world.width, world.height, insets);
  const centeringInsets = { top: insets.top, right: 0, bottom: 0, left: 0 };
  const expectedScroll = getCenteredCameraScroll(
    snapshot.viewportWidth,
    snapshot.viewportHeight,
    world.width,
    world.height,
    expectedZoom,
    0.5,
    0.5,
    centeringInsets
  );
  const clampedExpectedScroll = clampCameraScroll(
    expectedScroll.scrollX,
    expectedScroll.scrollY,
    snapshot.viewportWidth,
    snapshot.viewportHeight,
    world.width,
    world.height,
    expectedZoom,
    0.5,
    0.5,
    centeringInsets
  );
  expect(Math.abs(snapshot.zoom - expectedZoom)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(snapshot.scrollX - clampedExpectedScroll.scrollX)).toBeLessThanOrEqual(1);
  expect(Math.abs(snapshot.scrollY - clampedExpectedScroll.scrollY)).toBeLessThanOrEqual(1);

  await page.getByTestId(`scene-item-${firstSceneId}`).click();
  await expect.poll(async () => (await getState<{ currentSceneId?: string }>(page))?.currentSceneId).toBe(firstSceneId);
  await expect.poll(async () => {
    const state = await getState<{ scene?: { entities?: Record<string, unknown> } }>(page);
    return Object.keys(state.scene?.entities ?? {}).length;
  }).toBe(firstCount);
});

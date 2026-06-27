import { expect, test } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { clampCameraScroll, getCenteredCameraScroll, getFitZoom } from '../../src/editor/viewport';
import { dismissViewHint, getSceneSnapshot, getState, seedProject, waitForViewportToSettle } from './helpers';

test('startup centers the editor viewport @critical', async ({ page }) => {
  await seedProject(page, createEmptyProject());
  await dismissViewHint(page);
  await waitForViewportToSettle(page);

  const state = await getState<{ scene?: { world?: { width: number; height: number } } } | null>(page);
  const world = state?.scene?.world ?? { width: 1024, height: 768 };
  const topInset = await page.evaluate(() => {
    const overlay = document.querySelector('[data-testid="canvas-overlay"]') as HTMLElement | null;
    const controls = document.querySelector('[data-testid="canvas-overlay-top-right"]') as HTMLElement | null;
    if (!overlay || !controls) return 0;
    const overlayRect = overlay.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();
    return Math.max(0, controlsRect.bottom - overlayRect.top + 12);
  });

  const snapshot = await getSceneSnapshot<{
    ready: boolean;
    sceneKey: string;
    zoom: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
  }>(page);
  expect(snapshot).toMatchObject({ ready: true, sceneKey: 'EditorScene' });

  const expectedZoom = getFitZoom(snapshot.viewportWidth, snapshot.viewportHeight, world.width, world.height, { top: topInset });
  const expectedScroll = getCenteredCameraScroll(
    snapshot.viewportWidth,
    snapshot.viewportHeight,
    world.width,
    world.height,
    expectedZoom,
    0.5,
    0.5,
    { top: topInset }
  );
  const clampedExpectedScroll = clampCameraScroll(
    expectedScroll.scrollX,
    expectedScroll.scrollY,
    snapshot.viewportWidth,
    snapshot.viewportHeight,
    world.width,
    world.height,
    expectedZoom
  );

  expect(Math.abs(snapshot.zoom - expectedZoom)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(snapshot.scrollX - clampedExpectedScroll.scrollX)).toBeLessThanOrEqual(1);
  expect(Math.abs(snapshot.scrollY - clampedExpectedScroll.scrollY)).toBeLessThanOrEqual(1);
});

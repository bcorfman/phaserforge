import { expect, test, type Page } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { clampCameraScroll, getCenteredCameraScroll, getFitZoom } from '../../src/editor/viewport';
import { dismissViewHint, getSceneSnapshot, getState, seedProject, waitForViewportToSettle } from './helpers';

async function expectViewportCentered(page: Page) {
  const state = await getState<{ scene?: { world?: { width: number; height: number } } } | null>(page);
  const world = state?.scene?.world ?? { width: 1024, height: 768 };

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

  const expectedZoom = getFitZoom(snapshot.viewportWidth, snapshot.viewportHeight, world.width, world.height);
  const expectedScroll = getCenteredCameraScroll(
    snapshot.viewportWidth,
    snapshot.viewportHeight,
    world.width,
    world.height,
    expectedZoom,
    0.5,
    0.5
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
    0.5
  );

  expect(Math.abs(snapshot.zoom - expectedZoom)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(snapshot.scrollX - clampedExpectedScroll.scrollX)).toBeLessThanOrEqual(1);
  expect(Math.abs(snapshot.scrollY - clampedExpectedScroll.scrollY)).toBeLessThanOrEqual(1);
}

test('startup centers the editor viewport @critical', async ({ page }) => {
  await seedProject(page, createEmptyProject());
  await dismissViewHint(page);
  await waitForViewportToSettle(page);
  await expectViewportCentered(page);
});

test('viewport reset centers the editor viewport @critical', async ({ page }) => {
  await seedProject(page, createEmptyProject());
  await dismissViewHint(page);
  await waitForViewportToSettle(page);

  await page.getByTestId('zoom-in-button').click();
  await waitForViewportToSettle(page);
  await page.getByTestId('reset-zoom-button').click();
  await waitForViewportToSettle(page);

  await expectViewportCentered(page);
});

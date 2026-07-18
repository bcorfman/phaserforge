import { expect, test } from '@playwright/test';
import { getResizedViewportScroll } from '../../src/editor/viewport';
import { dismissViewHint, getSceneSnapshot, panByScreenDelta, seedSampleScene, setEditorModeViaUi, waitForViewportToSettle } from './helpers';

type CameraSnapshot = {
  zoom: number;
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
};

function cameraTransferDifference(source: CameraSnapshot, current: CameraSnapshot): number {
  const expectedScroll = getResizedViewportScroll(
    source.scrollX,
    source.scrollY,
    source.viewportWidth,
    source.viewportHeight,
    current.viewportWidth,
    current.viewportHeight,
    source.zoom,
  );
  return Math.max(
    Math.abs(current.zoom - source.zoom) / 0.01,
    Math.abs(current.scrollX - expectedScroll.scrollX),
    Math.abs(current.scrollY - expectedScroll.scrollY),
  );
}

test('Edit and Preview preserve camera view state @critical', async ({ page }) => {
  await seedSampleScene(page);
  await dismissViewHint(page);
  await expect(page.getByTestId('toolbar-status')).toBeHidden();

  const editBefore = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number; sceneKey?: string }>(page);
  expect(editBefore.sceneKey).toBe('EditorScene');

  // Use the explicit zoom controls (more reliable than wheel events in headless CI).
  await page.getByTestId('zoom-in-button').click();
  await page.getByTestId('zoom-in-button').click();
  await panByScreenDelta(page, { x: 180, y: 110 });
  await waitForViewportToSettle(page, { stableForMs: 150 });

  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string; ready?: boolean }>(page))?.ready).toBe(true);

  const editSnapshot = await getSceneSnapshot<{ zoom: number; scrollX: number; scrollY: number; sceneKey?: string; ready?: boolean }>(page);
  expect(editSnapshot.sceneKey).toBe('EditorScene');
  expect(editSnapshot.ready).toBe(true);
  expect(editSnapshot.zoom).toBeGreaterThan(editBefore.zoom);
  const transferSnapshot = await getSceneSnapshot<CameraSnapshot>(page);

  await setEditorModeViaUi(page, 'play');
  await expect.poll(async () => {
    const snap = await getSceneSnapshot<{ sceneKey?: string; ready?: boolean; isActive?: boolean }>(page);
    return { sceneKey: snap?.sceneKey, ready: snap?.ready, isActive: snap?.isActive };
  }).toEqual({ sceneKey: 'GameScene', ready: true, isActive: true });

  await expect.poll(async () => {
    const playSnapshot = await getSceneSnapshot<CameraSnapshot>(page);
    return cameraTransferDifference(transferSnapshot, playSnapshot);
  }).toBeLessThanOrEqual(1);

  await setEditorModeViaUi(page, 'edit');
  await expect.poll(async () => {
    const snap = await getSceneSnapshot<{ sceneKey?: string; ready?: boolean; isActive?: boolean }>(page);
    return { sceneKey: snap?.sceneKey, ready: snap?.ready, isActive: snap?.isActive };
  }).toEqual({ sceneKey: 'EditorScene', ready: true, isActive: true });
  await waitForViewportToSettle(page, { stableForMs: 150 });

  const editRestoredSnapshot = await getSceneSnapshot<CameraSnapshot & { ready?: boolean }>(page);
  expect(editRestoredSnapshot.ready).toBe(true);
  expect(cameraTransferDifference(transferSnapshot, editRestoredSnapshot)).toBeLessThanOrEqual(1);
});

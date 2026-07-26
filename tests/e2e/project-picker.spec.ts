import { expect, test } from '@playwright/test';
import { clampCameraScroll, getCenteredCameraScroll, getFitZoom } from '../../src/editor/viewport';
import { dismissViewHint, getSceneSnapshot, getState, openProjectScope, panByScreenDelta, seedSampleScene, waitForEmptyScene, waitForViewportToSettle } from './helpers';

test.describe('Project picker', () => {
  test('opens the picker from the project tree and preserves the sync toggle @smoke', async ({ page }) => {
    await seedSampleScene(page);
    await dismissViewHint(page);

    await expect(page.getByTestId('project-sync-badge')).toHaveText('Online');
    await page.getByTestId('project-sync-badge').click();
    await expect(page.getByTestId('project-sync-badge')).toHaveText('Offline');

    await openProjectScope(page);
    await page.getByTestId('project-tree-manage-button').click();
    await expect(page.getByTestId('project-manage-library')).toBeVisible();

    await page.getByTestId('project-manage-library').click();
    await expect(page.getByTestId('project-picker-panel')).toBeVisible();
    await expect(page.getByTestId('project-picker-search')).toBeVisible();
    await expect(page.getByTestId('project-picker-filter-all')).toBeVisible();
    await expect(page.locator('.project-picker-tabs')).toHaveCount(0);
    await expect(page.getByTestId('project-picker-list')).toContainText('All Projects');
    await expect(page.getByTestId('project-picker-list')).toContainText('Untitled Project');
    const currentProjectRow = page.locator('.project-picker-row.is-current');
    await currentProjectRow.getByRole('button', { name: /Project actions for/ }).click();
    await expect(currentProjectRow.getByRole('button', { name: 'Delete…' })).toBeDisabled();
  });

  test('creates a new local project from the project tree manage menu @smoke', async ({ page }) => {
    await seedSampleScene(page);
    await dismissViewHint(page);
    await panByScreenDelta(page, { x: 180, y: 120 });
    await waitForViewportToSettle(page);

    await page.getByTestId('project-tree-manage-button').click();
    await page.getByTestId('project-manage-create').click();
    await waitForEmptyScene(page);
    await waitForViewportToSettle(page);
    await expect(page.getByTestId('project-sync-badge')).toHaveText('Online');

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
  });
});

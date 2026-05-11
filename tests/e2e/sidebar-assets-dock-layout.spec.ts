import { expect, test } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { dismissViewHint, openSceneScope, seedProject } from './helpers';

function bottom(box: { y: number; height: number }): number {
  return box.y + box.height;
}

test.describe('Sidebar layout', () => {
  test('pins Assets dock to the bottom and keeps splitter behavior', async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'Pointer capture drag semantics are flaky in Firefox in this suite');

    await page.setViewportSize({ width: 1400, height: 1600 });
    await seedProject(page, createEmptyProject());
    await dismissViewHint(page);
    await openSceneScope(page);

    const pane = page.getByTestId('entity-list-pane');
    const entityList = page.getByTestId('entity-list');
    const assetsDock = page.getByTestId('assets-dock');
    const assetsDockContainer = assetsDock.locator('..');
    const splitter = page.getByTestId('assets-dock-splitter');

    await expect(entityList).toBeVisible();
    await expect(assetsDock).toBeVisible();

    const paneBox = await pane.boundingBox();
    const entityListBox = await entityList.boundingBox();
    const assetsBox = await assetsDock.boundingBox();
    const assetsContainerBox = await assetsDockContainer.boundingBox();
    if (!paneBox || !entityListBox || !assetsBox || !assetsContainerBox) throw new Error('Missing layout bounding boxes');

    expect(Math.abs(bottom(entityListBox) - bottom(paneBox))).toBeLessThanOrEqual(2);
    expect(bottom(entityListBox) - bottom(assetsContainerBox)).toBeLessThanOrEqual(24);

    const beforeAssetsHeight = assetsContainerBox.height;
    const splitterBox = await splitter.boundingBox();
    if (!splitterBox) throw new Error('Splitter bounding box unavailable');

    await page.mouse.move(splitterBox.x + splitterBox.width / 2, splitterBox.y + splitterBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(splitterBox.x + splitterBox.width / 2, splitterBox.y - 80);
    await page.mouse.up();

    const paneBoxAfter = await pane.boundingBox();
    const entityListBoxAfter = await entityList.boundingBox();
    const assetsBoxAfter = await assetsDock.boundingBox();
    const assetsContainerBoxAfter = await assetsDockContainer.boundingBox();
    if (!paneBoxAfter || !entityListBoxAfter || !assetsBoxAfter || !assetsContainerBoxAfter) throw new Error('Missing layout bounding boxes after drag');

    expect(Math.abs(bottom(entityListBoxAfter) - bottom(paneBoxAfter))).toBeLessThanOrEqual(2);
    expect(bottom(entityListBoxAfter) - bottom(assetsContainerBoxAfter)).toBeLessThanOrEqual(24);
    expect(assetsContainerBoxAfter.height).not.toBe(beforeAssetsHeight);
  });

  test('resizes the left sidebar width and persists across reloads', async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'Pointer capture drag semantics are flaky in Firefox in this suite');

    await page.setViewportSize({ width: 1400, height: 980 });
    await seedProject(page, createEmptyProject());
    await dismissViewHint(page);
    await openSceneScope(page);

    const splitter = page.getByTestId('left-pane-splitter');
    const pane = page.getByTestId('entity-list-pane');
    // WebKit can report an unstyled full-width sidebar very briefly after boot; wait for stable layout bounds.
    await expect.poll(async () => (await pane.boundingBox())?.width ?? 0, { timeout: 10000 }).toBeGreaterThan(240);
    await expect.poll(async () => (await pane.boundingBox())?.width ?? 0, { timeout: 10000 }).toBeLessThan(800);
    const before = await pane.boundingBox();
    if (!before) throw new Error('Left pane bounding box unavailable');

    const splitBox = await splitter.boundingBox();
    if (!splitBox) throw new Error('Left pane splitter bounding box unavailable');

    await page.mouse.move(splitBox.x + splitBox.width / 2, splitBox.y + splitBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(splitBox.x + splitBox.width / 2 + 120, splitBox.y + splitBox.height / 2);
    await page.mouse.up();

    const after = await pane.boundingBox();
    if (!after) throw new Error('Left pane bounding box unavailable after resize');
    expect(after.width).toBeGreaterThan(before.width + 40);

    await page.reload();
    await dismissViewHint(page);
    await openSceneScope(page);
    await expect.poll(async () => (await pane.boundingBox())?.width ?? 0, { timeout: 10000 }).toBeGreaterThan(240);
    await expect.poll(async () => (await pane.boundingBox())?.width ?? 0, { timeout: 10000 }).toBeLessThan(800);
    const persisted = await pane.boundingBox();
    if (!persisted) throw new Error('Left pane bounding box unavailable after reload');
    expect(persisted.width).toBeGreaterThan(before.width + 40);
  });
});

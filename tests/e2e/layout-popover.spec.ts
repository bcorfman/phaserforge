import { expect, test } from '@playwright/test';
import { dismissViewHint, dispatchAction, getEntityWorldRect, getState, gotoStudio, resetScene, seedSampleScene, tapWorld, waitForSampleScene } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);
});

test('Layout popover applies fixed spacing by centers @critical', async ({ page }) => {
  const r1 = await getEntityWorldRect(page, 'e1');
  const r2 = await getEntityWorldRect(page, 'e2');
  await tapWorld(page, { x: r1.centerX ?? (r1.minX + r1.maxX) / 2, y: r1.centerY ?? (r1.minY + r1.maxY) / 2 });
  await tapWorld(page, { x: r2.centerX ?? (r2.minX + r2.maxX) / 2, y: r2.centerY ?? (r2.minY + r2.maxY) / 2 }, { additive: true });

  const layoutButton = page.getByTestId('canvas-layout-button');
  await layoutButton.focus();
  await layoutButton.press('Enter');
  await expect(page.getByTestId('layout-distribute-x')).toHaveClass(/button/);
  await expect(page.getByTestId('layout-apply-spacing-x')).toHaveClass(/button/);
  await page.getByTestId('layout-units-pixels').click();
  await page.getByTestId('layout-spacing-x').fill('64');
  await page.getByTestId('layout-apply-spacing-x').click();

  await expect.poll(async () => {
    const state = await getState<any>(page);
    const e1 = state.scene?.entities?.e1;
    const e2 = state.scene?.entities?.e2;
    if (!e1 || !e2) return null;
    return Math.round(e2.x - e1.x);
  }).toBe(64);
});

test('Layout popover distributes selected item centers between endpoints @critical', async ({ page }) => {
  await resetScene(page);

  const createdIds: string[] = [];
  for (const at of [{ x: 100, y: 100 }, { x: 180, y: 100 }, { x: 300, y: 100 }]) {
    await dispatchAction(page, { type: 'create-text-entity', at });
    let createdId: string | null = null;
    await expect.poll(async () => {
      const state = await getState<any>(page);
      createdId = state.selection?.kind === 'entity' && !createdIds.includes(state.selection.id)
        ? state.selection.id
        : null;
      return createdId;
    }).not.toBeNull();
    createdIds.push(createdId!);
  }

  await dispatchAction(page, { type: 'select', selection: { kind: 'entities', ids: createdIds } });
  await expect.poll(async () => {
    const state = await getState<any>(page);
    return state.selection?.kind === 'entities' ? state.selection.ids : [];
  }).toEqual(createdIds);

  const layoutButton = page.getByTestId('canvas-layout-button');
  await layoutButton.focus();
  await layoutButton.press('Enter');
  const distributeX = page.getByTestId('layout-distribute-x');
  await expect(distributeX).toBeEnabled();
  await distributeX.click();

  await expect.poll(async () => {
    const state = await getState<any>(page);
    return createdIds.map((id) => state.scene?.entities?.[id]?.x ?? null);
  }).toEqual([100, 200, 300]);
});

test.describe('Layout popover viewport reachability', () => {
  test.use({ viewport: { width: 820, height: 520 } });

  test('Layout popover stays reachable when near viewport bottom @browser', async ({ page }) => {
    const r1 = await getEntityWorldRect(page, 'e1');
    const r2 = await getEntityWorldRect(page, 'e2');
    await tapWorld(page, { x: r1.centerX ?? (r1.minX + r1.maxX) / 2, y: r1.centerY ?? (r1.minY + r1.maxY) / 2 });
    await tapWorld(page, { x: r2.centerX ?? (r2.minX + r2.maxX) / 2, y: r2.centerY ?? (r2.minY + r2.maxY) / 2 }, { additive: true });

    const layoutButton = page.getByTestId('canvas-layout-button');
    await layoutButton.focus();
    await layoutButton.press('Enter');

    const popover = page.getByTestId('canvas-layout-popover');
    await expect(popover).toBeVisible();

    const viewportSize = page.viewportSize();
    expect(viewportSize).not.toBeNull();

    const box = await popover.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(12);
    expect(box!.y + box!.height).toBeLessThanOrEqual((viewportSize!.height) - 12);

    const applySetY = page.getByTestId('layout-apply-set-y');
    await expect(applySetY).toBeVisible();
  });
});

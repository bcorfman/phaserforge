import { expect, test } from '@playwright/test';
import { dismissViewHint, getEntityWorldRect, getState, seedSampleScene, tapWorld, dragWorld } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await dismissViewHint(page);
});

test('dragging a sprite without Alt does not duplicate (even if Alt was previously stuck) @browser @regression', async ({ page }) => {
  const e1RectBeforeTap = await getEntityWorldRect(page, 'e1');
  const e1WorldCenter = { x: (e1RectBeforeTap.minX + e1RectBeforeTap.maxX) / 2, y: (e1RectBeforeTap.minY + e1RectBeforeTap.maxY) / 2 };
  await tapWorld(page, e1WorldCenter);

  await expect.poll(async () => {
    const state = await getState<{ selection?: { kind: string; id?: string } }>(page);
    return { kind: state.selection?.kind, id: state.selection?.id };
  }).toEqual({ kind: 'entity', id: 'e1' });

  const before = await getState<{ scene: { entities: Record<string, { x: number }> } }>(page);
  const entityCountBefore = Object.keys(before.scene.entities).length;
  const e1BeforeX = before.scene.entities.e1.x;

  // Simulate a missed Alt keyup (common after losing focus) then blur the window.
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', bubbles: true, cancelable: true }));
    window.dispatchEvent(new Event('blur'));
  });

  // Use the test bridge drag helper instead of raw mouse events (more stable across browsers after blur/focus events).
  const e1Rect = await getEntityWorldRect(page, 'e1');
  const start = { x: (e1Rect.minX + e1Rect.maxX) / 2, y: (e1Rect.minY + e1Rect.maxY) / 2 };
  // Use a larger delta to remain non-zero even if grid snapping is enabled.
  await dragWorld(page, start, { x: start.x + 400, y: start.y });

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number }> } }>(page);
    return Object.keys(state.scene.entities).length;
  }).toBe(entityCountBefore);

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number }> } }>(page);
    return state.scene.entities.e1.x;
  }).toBeGreaterThan(e1BeforeX);
});

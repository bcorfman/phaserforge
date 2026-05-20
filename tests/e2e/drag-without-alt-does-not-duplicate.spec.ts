import { expect, test } from '@playwright/test';
import { dismissViewHint, dragOnCanvas, entityClientCenter, getState, seedSampleScene, tapWorld } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await dismissViewHint(page);
});

test('dragging a sprite without Alt does not duplicate (even if Alt was previously stuck)', async ({ page }) => {
  await tapWorld(page, { x: 220, y: 140 });

  const before = await getState<{ scene: { entities: Record<string, { x: number }> } }>(page);
  const entityCountBefore = Object.keys(before.scene.entities).length;
  const e1BeforeX = before.scene.entities.e1.x;

  // Simulate a missed Alt keyup (common after losing focus) then blur the window.
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
    window.dispatchEvent(new Event('blur'));
  });

  const from = await entityClientCenter(page, 'e1');
  await dragOnCanvas(page, from, { x: from.x + 80, y: from.y });

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number }> } }>(page);
    return Object.keys(state.scene.entities).length;
  }).toBe(entityCountBefore);

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number }> } }>(page);
    return state.scene.entities.e1.x;
  }).toBeGreaterThan(e1BeforeX);
});

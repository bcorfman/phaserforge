import { expect, test } from '@playwright/test';
import { getEntityWorldRect, getSceneSnapshot, getState, seedSampleScene } from './helpers';

test('Preview → Edit → Preview keeps rendering (no blank canvas)', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (err) => pageErrors.push(err));

  await seedSampleScene(page);

  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getState<{ mode?: string }>(page))?.mode).toBe('play');
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');

  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getState<{ mode?: string }>(page))?.mode).toBe('edit');
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('EditorScene');

  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getState<{ mode?: string }>(page))?.mode).toBe('play');
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');

  await expect.poll(async () => {
    const rect = await getEntityWorldRect(page, 'e1');
    return rect ? { x: rect.minX, y: rect.minY, maxX: rect.maxX, maxY: rect.maxY } : null;
  }).not.toBeNull();

  expect(pageErrors).toEqual([]);
});


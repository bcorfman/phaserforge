import { expect, test } from '@playwright/test';
import { dismissViewHint, getState, gotoStudio, seedSampleScene } from './helpers';

test('Inspector: Call Id = scene.goto shows structured fields and defaults', async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await dismissViewHint(page);

  await page.getByTestId('create-scene-button').click();
  await expect.poll(async () => (await getState<{ currentSceneId?: string }>(page))?.currentSceneId).not.toBe('scene-1');
  const createdSceneId = (await getState<{ currentSceneId?: string }>(page))?.currentSceneId ?? '';

  await page.getByTestId('scene-item-scene-1').click();
  await expect.poll(async () => (await getState<{ currentSceneId?: string }>(page))?.currentSceneId).toBe('scene-1');

  await page.getByTestId('group-item-g-enemies').click();
  await page.getByTestId('attachment-open-att-drop-right').click();

  await page.getByTestId('attachment-call-id-input').fill('scene.goto');

  await expect(page.getByTestId('attachment-call-scene-goto-scene-select')).toBeVisible();
  await expect(page.getByTestId('attachment-call-scene-goto-scene-select')).toHaveValue(createdSceneId);
  await expect(page.getByTestId('attachment-call-scene-goto-transition-select')).toHaveValue('fade');
  await expect(page.getByTestId('attachment-call-scene-goto-duration-input')).toHaveValue('350');

  await expect(page.locator('[data-testid="attachment-call-dx-input"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="attachment-call-dy-input"]')).toHaveCount(0);
});

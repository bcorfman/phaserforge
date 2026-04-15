import { expect, test } from '@playwright/test';
import { dismissViewHint, dragWorld, getGroupWorldBounds, gotoStudio, seedSampleScene, selectGroupInSceneGraph, waitForSampleScene } from './helpers';

test('dragging a formation updates centerX/centerY params in the Arrange panel', async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);

  await selectGroupInSceneGraph(page, 'g-enemies');

  await page.getByTestId('arrange-preset-select').selectOption('circle');
  await page.getByTestId('arrange-param-centerX').fill('500');
  await page.getByTestId('arrange-param-centerY').fill('400');
  await page.getByTestId('apply-group-layout-button').click();

  const beforeCenterX = Number(await page.getByTestId('arrange-param-centerX').inputValue());
  const beforeCenterY = Number(await page.getByTestId('arrange-param-centerY').inputValue());

  const bounds = await getGroupWorldBounds(page, 'g-enemies');
  if (!bounds) throw new Error('Missing group bounds');
  const start = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  const dx = 20;
  const dy = 10;
  await dragWorld(page, start, { x: start.x + dx, y: start.y + dy });

  await expect.poll(async () => {
    const x = Number(await page.getByTestId('arrange-param-centerX').inputValue());
    const y = Number(await page.getByTestId('arrange-param-centerY').inputValue());
    return { x, y };
  }).toEqual({ x: beforeCenterX + dx, y: beforeCenterY + dy });
});


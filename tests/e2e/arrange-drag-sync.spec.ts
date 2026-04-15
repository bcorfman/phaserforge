import { expect, test } from '@playwright/test';
import { dismissViewHint, getGroupWorldBounds, getState, gotoStudio, seedSampleScene, selectGroupInSceneGraph, waitForSampleScene, worldToClient } from './helpers';

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
  // Start near the top-left of the group frame (inside the interactive zone but away from sprites),
  // to ensure hit-testing prefers the group over an entity.
  const start = { x: bounds.minX - 5, y: bounds.minY - 5 };
  const dx = 80;
  const dy = 40;
  const startClient = await worldToClient(page, start);
  const endClient = await worldToClient(page, { x: start.x + dx, y: start.y + dy });
  if (!startClient || !endClient) throw new Error('Unable to map world->client');

  const beforeState = await getState<{ scene: { entities: Record<string, { x: number; y: number }>; groups: Record<string, { members: string[] }> } }>(page);
  const memberId = beforeState.scene.groups['g-enemies'].members[0];
  const memberBefore = beforeState.scene.entities[memberId];
  if (!memberBefore) throw new Error('Missing group member entity');

  await page.mouse.move(startClient.x, startClient.y);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(endClient.x, endClient.y, { steps: 12 });

  await expect(page.getByTestId('arrange-preset-select')).toBeVisible();
  await expect(page.getByTestId('arrange-param-centerX')).toBeVisible();
  await expect(page.getByTestId('arrange-param-centerY')).toBeVisible();

  // While still dragging, Arrange params should update (no "formation dragging" inspector takeover).
  await expect.poll(async () => {
    const x = Number(await page.getByTestId('arrange-param-centerX').inputValue());
    const y = Number(await page.getByTestId('arrange-param-centerY').inputValue());
    return { x, y };
  }, { timeout: 2000 }).not.toEqual({ x: beforeCenterX, y: beforeCenterY });

  await page.mouse.up({ button: 'left' });

  await expect.poll(async () => {
    const after = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
    const entity = after.scene.entities[memberId];
    if (!entity) return null;
    return { x: entity.x, y: entity.y };
  }).not.toEqual({ x: memberBefore.x, y: memberBefore.y });

  const afterState = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
  const memberAfter = afterState.scene.entities[memberId];
  if (!memberAfter) throw new Error('Missing group member after drag');
  const deltaX = Math.round(memberAfter.x - memberBefore.x);
  const deltaY = Math.round(memberAfter.y - memberBefore.y);

  await expect.poll(async () => {
    const x = Number(await page.getByTestId('arrange-param-centerX').inputValue());
    const y = Number(await page.getByTestId('arrange-param-centerY').inputValue());
    return { x, y };
  }).toEqual({ x: beforeCenterX + deltaX, y: beforeCenterY + deltaY });
});

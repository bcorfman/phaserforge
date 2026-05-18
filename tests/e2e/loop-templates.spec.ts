import { expect, test } from '@playwright/test';
import { dismissViewHint, getState, gotoStudio, seedSampleScene, tapWorld, getEntityWorldRect, waitForSampleScene } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);
});

test('Loops category expands templates into repeat scaffolds', async ({ page }) => {
  const rect = await getEntityWorldRect(page, 'e1');
  const fromWorld = { x: rect.centerX ?? (rect.minX + rect.maxX) / 2, y: rect.centerY ?? (rect.minY + rect.maxY) / 2 };
  await tapWorld(page, fromWorld);

  await page.getByTestId('add-event-block').click();
  await expect.poll(async () => {
    const state = await getState<any>(page);
    const blocks = Object.values(state.scene?.eventBlocks ?? {}).filter((b: any) => b?.target?.type === 'entity' && b?.target?.entityId === 'e1');
    return blocks.length;
  }).toBeGreaterThanOrEqual(1);

  const stateWithHandler = await getState<any>(page);
  const blocks = Object.values(stateWithHandler.scene?.eventBlocks ?? {}).filter((b: any) => b?.target?.type === 'entity' && b?.target?.entityId === 'e1');
  const handlerId = blocks[0]?.id as string;
  if (!handlerId) throw new Error('Missing handler id');

  await page.getByTestId(`event-add-open-${handlerId}`).click();
  await page.getByTestId('action-library-cat-loops').click();
  await page.getByTestId('action-library-add-loops:intro_then_repeat').click();

  await expect.poll(async () => {
    const state = await getState<any>(page);
    const atts = Object.values(state.scene?.attachments ?? {}).filter((a: any) => a?.target?.type === 'entity' && a?.target?.entityId === 'e1' && a?.eventId === handlerId);
    const hasRepeat = atts.some((a: any) => a?.presetId === 'Repeat');
    const callCount = atts.filter((a: any) => a?.presetId === 'Call').length;
    return { hasRepeat, callCount };
  }).toEqual({ hasRepeat: true, callCount: 2 });
});


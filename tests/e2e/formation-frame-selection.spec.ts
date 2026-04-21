import { expect, test } from '@playwright/test';
import { expectSelection, getGroupFrameVisible, getGroupLabelVisible, seedSampleScene, selectGroupInSceneGraph } from './helpers';

test('Formation frames only render when the formation is selected', async ({ page }) => {
  await seedSampleScene(page);

  await expectSelection(page, { kind: 'none' });
  expect(await getGroupFrameVisible(page, 'g-enemies')).toBe(false);
  expect(await getGroupLabelVisible(page, 'g-enemies')).toBe(false);

  await selectGroupInSceneGraph(page, 'g-enemies');
  await expectSelection(page, { kind: 'group', id: 'g-enemies' });
  expect(await getGroupFrameVisible(page, 'g-enemies')).toBe(true);
  expect(await getGroupLabelVisible(page, 'g-enemies')).toBe(true);

  await page.getByTestId('toggle-group-g-enemies').click();
  await page.getByTestId('group-member-g-enemies-e1').click();
  await expectSelection(page, { kind: 'entity', id: 'e1' });
  expect(await getGroupFrameVisible(page, 'g-enemies')).toBe(false);
  expect(await getGroupLabelVisible(page, 'g-enemies')).toBe(false);
});

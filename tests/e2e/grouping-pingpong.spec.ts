import { expect, test } from '@playwright/test';
import { dismissViewHint, getState, gotoStudio, seedSampleScene, selectGroupInSceneGraph, waitForSampleScene } from './helpers';

test('Ungroup / Group ping-pongs between formation and member multi-select', async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);

  await selectGroupInSceneGraph(page, 'g-enemies');
  await expect(page.getByTestId('ungroup-button')).toBeVisible();

  const before = await getState<{ scene: { groups: Record<string, unknown>; attachments: Record<string, unknown> } }>(page);
  expect(Boolean(before.scene.groups['g-enemies'])).toBe(true);
  expect(Object.keys(before.scene.attachments).length).toBeGreaterThan(0);

  await page.getByTestId('ungroup-button').click();

  await expect.poll(async () => {
    const state = await getState<{ selection: { kind: string }; scene: { groups: Record<string, unknown>; attachments: Record<string, unknown> } }>(page);
    return {
      selectionKind: state.selection.kind,
      hasGroup: Boolean(state.scene.groups['g-enemies']),
      attachmentCount: Object.keys(state.scene.attachments).length,
    };
  }).toEqual({
    selectionKind: 'entities',
    hasGroup: false,
    attachmentCount: 0,
  });

  await expect(page.getByTestId('group-selection-button')).toBeVisible();
  await page.getByTestId('group-selection-button').click();

  await expect.poll(async () => {
    const state = await getState<{ selection: { kind: string; id?: string }; scene: { groups: Record<string, unknown>; attachments: Record<string, unknown> } }>(page);
    return {
      selection: state.selection,
      hasGroup: Boolean(state.scene.groups['g-enemies']),
      attachmentCount: Object.keys(state.scene.attachments).length,
    };
  }).toEqual({
    selection: { kind: 'group', id: 'g-enemies' },
    hasGroup: true,
    attachmentCount: Object.keys(before.scene.attachments).length,
  });
});

test('Dissolve Group removes the formation but preserves its actions by retargeting', async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);

  await selectGroupInSceneGraph(page, 'g-enemies');
  await expect(page.getByTestId('dissolve-group-button')).toBeVisible();

  const before = await getState<{ scene: { groups: Record<string, unknown>; attachments: Record<string, unknown> } }>(page);
  expect(Boolean(before.scene.groups['g-enemies'])).toBe(true);
  expect(Object.keys(before.scene.attachments).length).toBeGreaterThan(0);

  await page.getByTestId('dissolve-group-button').click();

  await expect.poll(async () => {
    const state = await getState<{ selection: { kind: string; ids?: string[] }; scene: { groups: Record<string, unknown>; attachments: Record<string, any> } }>(page);
    return {
      selectionKind: state.selection.kind,
      hasGroup: Boolean(state.scene.groups['g-enemies']),
      attachmentTarget: state.scene.attachments['att-move-right']?.target ?? null,
      attachmentCount: Object.keys(state.scene.attachments).length,
    };
  }).toEqual({
    selectionKind: 'entities',
    hasGroup: false,
    attachmentTarget: { type: 'entity', entityId: 'e1' },
    attachmentCount: Object.keys(before.scene.attachments).length,
  });
});

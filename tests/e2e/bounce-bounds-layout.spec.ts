import { expect, test } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { dismissViewHint, getEditableBoundsRect, getState, openSceneScope, seedProject } from './helpers';

test('Bounce: Bounds is a sibling panel (not nested) @critical', async ({ page }) => {
  const project = createEmptyProject();
  const scene = project.scenes[project.initialSceneId];
  scene.world = { width: 800, height: 600 };
  scene.entities = {
    e1: {
      id: 'e1',
      x: 400,
      y: 450,
      width: 32,
      height: 32,
      scaleX: 1,
      scaleY: 1,
      originX: 0.5,
      originY: 0.5,
      alpha: 1,
      visible: true,
      depth: 0,
      flipX: false,
      flipY: false,
      rotationDeg: 0,
    },
  };
  scene.attachments = {
    'att-bounce': {
      id: 'att-bounce',
      name: 'Bounce',
      order: 0,
      target: { type: 'entity', entityId: 'e1' },
      enabled: true,
      presetId: 'BouncePattern',
      params: { axis: 'both', velocityX: 120, velocityY: 60 },
      condition: {
        type: 'BoundsHit',
        bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600 },
        mode: 'any',
        scope: 'member-any',
        behavior: 'bounce',
      },
    } as any,
  };

  await seedProject(page, project as any);
  await dismissViewHint(page);

  await openSceneScope(page);
  await page.getByTestId('scene-item-scene-1').click().catch(() => {});
  await expect(page.getByTestId('entity-list')).toBeVisible();
  await expect.poll(async () => {
    const state = await getState<any>(page);
    return Boolean(state?.scene?.entities?.e1);
  }).toBe(true);
  await expect(page.getByTestId('ungrouped-entity-e1')).toBeVisible();
  await page.getByTestId('ungrouped-entity-e1').click();
  await page.getByTestId('attachment-open-att-bounce').click();

  // Bounds panel shows the mode toggle.
  await expect(page.getByRole('button', { name: 'Min/Max' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Center/Span' })).toBeVisible();

  await expect.poll(async () => await getEditableBoundsRect(page)).toMatchObject({
    minX: 0,
    minY: 0,
    maxX: 800,
    maxY: 600,
  });

  // Collapse Bounce Pattern; Bounds should still be visible (sibling foldout).
  await page.getByLabel('Collapse Bounce Pattern').click();
  await expect(page.getByLabel('Bounds Min X')).toBeVisible();

  // Sanity check: inspector state still has the bounds condition intact.
  const state = await getState<any>(page);
  expect(state.scene.attachments['att-bounce']?.condition?.type).toBe('BoundsHit');
});

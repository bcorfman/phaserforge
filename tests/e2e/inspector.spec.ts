import { expect, test } from '@playwright/test';
import {
  dismissViewHint,
  expectInputValue,
  getEditableBoundsRect,
  getEntitySpriteWorldRect,
  getState,
  gotoStudio,
  openProjectScope,
  openSceneScope,
  seedSampleScene,
  selectGroupInSceneGraph,
  tapWorld,
  waitForSampleScene,
} from './helpers';

test.setTimeout(120000);

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);
});

test('edits formation details and layout from the inspector', async ({ page }) => {
  await selectGroupInSceneGraph(page, 'g-enemies');
  await expectInputValue(page.getByTestId('formation-name-input'), 'Enemy Formation');

  await page.getByTestId('formation-name-input').fill('Invader Block');
  await page.getByTestId('inspector').getByLabel('Expand Layout Inspector').click();
  await page.getByTestId('arrange-preset-select').selectOption('grid');
  await page.getByTestId('arrange-param-startX').fill('260');
  await page.getByTestId('arrange-param-spacingX').fill('60');
  await page.getByTestId('apply-group-layout-button').click();

  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, { name?: string; layout?: { type: string; startX?: number; spacingX?: number } }> } }>(page);
    return state.scene.groups['g-enemies'];
  }).toMatchObject({
    name: 'Invader Block',
    layout: { type: 'grid', startX: 260, spacingX: 60 },
  });
});

test('converts group layout via the inspector layout type dropdown', async ({ page }) => {
  await selectGroupInSceneGraph(page, 'g-enemies');

  await page.getByTestId('layout-type-select').selectOption('grid');
  await page.getByTestId('convert-grid-rows-input').fill('5');
  await page.getByTestId('convert-grid-cols-input').fill('3');
  await page.getByTestId('convert-layout-apply-button').click();

  await expect.poll(async () => {
    const state = await getState<{ scene?: { groups?: Record<string, { layout?: { type: string; rows?: number; cols?: number } }> } } | null>(page);
    return state?.scene?.groups?.['g-enemies']?.layout ?? {};
  }).toMatchObject({ type: 'grid', rows: 5, cols: 3 });

  await page.getByTestId('layout-type-select').selectOption('freeform');
  await page.getByTestId('convert-layout-apply-button').click();

  await expect.poll(async () => {
    const state = await getState<{ scene?: { groups?: Record<string, { layout?: { type: string } }> } } | null>(page);
    return state?.scene?.groups?.['g-enemies']?.layout?.type ?? null;
  }).toBe('freeform');
});

test('edits move-until and bounds values from the attachment inspector', async ({ page }) => {
  await selectGroupInSceneGraph(page, 'g-enemies');
  await page.getByTestId('attachment-open-att-move-right').click();

  await page.getByTestId('attachment-velocity-x-input').fill('140');
  await page.getByTestId('attachment-bounds-min-x-input').fill('120');
  await page.getByTestId('attachment-bounds-max-y-input').fill('700');
  // Commit validated numeric inputs.
  await page.getByTestId('attachment-name-input').click();

  await expect.poll(async () => {
    const state = await getState<{ scene: { attachments: Record<string, { params?: Record<string, unknown>; condition?: { type: string; bounds: { minX: number; maxY: number } } }> } }>(page);
    const att = state.scene.attachments['att-move-right'];
    return {
      velocityX: Number(att.params?.velocityX ?? 0),
      minX: att.condition?.type === 'BoundsHit' ? att.condition.bounds.minX : null,
      maxY: att.condition?.type === 'BoundsHit' ? att.condition.bounds.maxY : null,
    };
  }).toEqual({ velocityX: 140, minX: 120, maxY: 700 });
});

test('removes a formation member and keeps the group selected', async ({ page }) => {
  await selectGroupInSceneGraph(page, 'g-enemies');
  await page.getByTestId('inspector').getByLabel('Expand Members').click();
  await page.getByTestId('group-member-remove-e3').click();

  await expect.poll(async () => {
    const state = await getState<{ selection: { kind: string; id?: string }; scene: { groups: Record<string, { members: string[]; layout?: { type: string } }> } }>(page);
    return {
      selection: state.selection,
      members: state.scene.groups['g-enemies'].members,
      layoutType: state.scene.groups['g-enemies'].layout?.type,
    };
  }).toEqual({
    selection: { kind: 'group', id: 'g-enemies' },
    members: ['e1', 'e2', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10', 'e11', 'e12', 'e13', 'e14', 'e15'],
    layoutType: 'freeform',
  });
});

test('removes an attached action from the scene graph', async ({ page }) => {
  await selectGroupInSceneGraph(page, 'g-enemies');
  await page.getByTestId('attachment-remove-att-wait-right').click();

  await expect.poll(async () => {
    const state = await getState<{ scene: { attachments: Record<string, unknown> } }>(page);
    return Boolean(state.scene.attachments['att-wait-right']);
  }).toBe(false);
});

test('edits authored sprite transform and visual properties from the inspector', async ({ page }) => {
  await tapWorld(page, { x: 220, y: 140 });

  await page.getByTestId('entity-scale-x-input').fill('1.5');
  await page.getByTestId('entity-scale-y-input').fill('0.75');
  await page.getByTestId('entity-origin-x-input').fill('0.25');
  await page.getByTestId('entity-origin-y-input').fill('0.75');
  await page.getByTestId('entity-alpha-input').fill('0.4');
  await page.getByTestId('entity-depth-input').fill('9');
  await page.getByTestId('entity-flip-x-input').check();
  await page.getByTestId('entity-visible-input').uncheck();

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, {
      scaleX?: number;
      scaleY?: number;
      originX?: number;
      originY?: number;
      alpha?: number;
      depth?: number;
      flipX?: boolean;
      visible?: boolean;
    }> } }>(page);
    return state.scene.entities.e1;
  }).toMatchObject({
    scaleX: 1.5,
    scaleY: 0.75,
    originX: 0.25,
    originY: 0.75,
    alpha: 0.4,
    depth: 9,
    flipX: true,
    visible: false,
  });
});

test('validated numeric fields allow clearing until blur', async ({ page }) => {
  await tapWorld(page, { x: 220, y: 140 });

  const scaleX = page.getByTestId('entity-scale-x-input');
  const scaleY = page.getByTestId('entity-scale-y-input');

  await scaleX.click();
  await scaleX.press('Control+A');
  await scaleX.press('Backspace');
  await expect(scaleX).toHaveValue('');

  await scaleX.type('2');
  await expect(scaleX).toHaveValue('2');

  // Commit on blur.
  await scaleY.click();

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { scaleX?: number }> } }>(page);
    return state.scene.entities.e1.scaleX;
  }).toBe(2);
});

test('move-until velocity inputs allow clearing until blur', async ({ page }) => {
  await selectGroupInSceneGraph(page, 'g-enemies');
  await page.getByTestId('attachment-open-att-move-right').click();

  const velocityX = page.getByTestId('attachment-velocity-x-input');
  const velocityY = page.getByTestId('attachment-velocity-y-input');

  await velocityX.click();
  await velocityX.press('Control+A');
  await velocityX.press('Backspace');
  await expect(velocityX).toHaveValue('');

  await velocityX.type('123');
  await expect(velocityX).toHaveValue('123');

  await velocityY.click();
  await expect.poll(async () => {
    const state = await getState<{ scene: { attachments: Record<string, { params?: Record<string, unknown> }> } }>(page);
    const params = state.scene.attachments['att-move-right'].params ?? {};
    return Number(params.velocityX ?? NaN);
  }).toBe(123);
});

test('bounds hit checkbox toggles BoundsHit condition', async ({ page }) => {
  await selectGroupInSceneGraph(page, 'g-enemies');
  await page.getByTestId('attachment-open-att-move-right').click();

  const toggle = page.getByTestId('attachment-bounds-enabled-input');
  await expect(toggle).toBeChecked();
  await expect(toggle).toHaveAttribute('aria-label', 'Enabled');
  await expect(page.getByTestId('attachment-bounds-behavior-select')).toBeVisible();

  await toggle.uncheck();
  await expect(page.getByTestId('attachment-bounds-behavior-select')).toBeHidden();

  await toggle.check();
  await expect(page.getByTestId('attachment-bounds-behavior-select')).toBeVisible();
});

test('creates a formation from imported sprites and arranges it into a grid', async ({ page }) => {
  await openProjectScope(page);
  await page.setInputFiles('[data-testid="sprite-file-input"]', 'res/images/mainwindow.png');
  await page.getByTestId('sprite-import-mode-select').selectOption('spritesheet');
  await page.getByTestId('spritesheet-frame-width-input').fill('64');
  await page.getByTestId('spritesheet-frame-height-input').fill('64');
  await page.getByTestId('spritesheet-frame-1').click();
  await page.getByTestId('import-sprites-button').click();

  await expect(page.getByTestId('multi-entity-inspector')).toBeVisible();
  await page.getByTestId('new-formation-name-input').fill('Raid Wing');
  await page.getByTestId('create-formation-from-selection-button').click();
  await expectInputValue(page.getByTestId('formation-name-input'), 'Raid Wing');

  await page.getByTestId('inspector').getByLabel('Expand Layout Inspector').click();
  await page.getByTestId('arrange-preset-select').selectOption('grid');
  await page.getByTestId('arrange-param-rows').fill('1');
  await page.getByTestId('arrange-param-cols').fill('2');
  await page.getByTestId('apply-group-layout-button').click();

  await expect.poll(async () => {
    const state = await getState<{ scene: { groups: Record<string, { name?: string; layout?: { type?: string; rows?: number; cols?: number } }> } }>(page);
    const createdGroup = Object.values(state.scene.groups).find((group) => group.name === 'Raid Wing');
    return createdGroup?.layout;
  }).toMatchObject({ type: 'grid', rows: 1, cols: 2 });
});

test('assigns a MoveUntil action to an imported sprite', async ({ page }) => {
  await openProjectScope(page);
  await page.setInputFiles('[data-testid="sprite-file-input"]', 'res/images/enemy_A.png');
  await page.getByTestId('import-sprites-button').click();

  await page.getByTestId('add-attachment-MoveUntil').click();
  await page.getByTestId('attachment-velocity-x-input').fill('140');
  await page.getByTestId('attachment-bounds-min-x-input').fill('48');
  // Commit validated numeric inputs.
  await page.getByTestId('attachment-name-input').click();

  await expect.poll(async () => {
    const state = await getState<{ selection: { kind: string; id?: string }; scene: { attachments: Record<string, { target: { type: string; entityId?: string }; presetId: string; params?: Record<string, unknown>; condition?: { type: string; bounds: { minX: number } } }> } }>(page);
    const created = Object.values(state.scene.attachments).find((att) => att.target.type === 'entity' && att.presetId === 'MoveUntil');
    return {
      selectionKind: state.selection.kind,
      velocityX: created ? Number(created.params?.velocityX ?? 0) : null,
      minX: created?.condition?.type === 'BoundsHit' ? created.condition.bounds.minX : null,
    };
  }).toEqual({ selectionKind: 'attachment', velocityX: 140, minX: 48 });
});

test('reassigns a sprite asset from another sprite via the inspector', async ({ page }) => {
  await openProjectScope(page);
  await page.setInputFiles('[data-testid="sprite-file-input"]', 'res/images/enemy_A.png');
  await page.getByTestId('import-sprites-button').click();
  await page.setInputFiles('[data-testid="sprite-file-input"]', 'res/images/enemy_B.png');
  await page.getByTestId('import-sprites-button').click();

  await expect.poll(async () => {
    const state = await getState<{ scene?: { entities?: Record<string, { id: string; name?: string }> } } | null>(page);
    const entities = Object.values(state?.scene?.entities ?? {});
    const a = entities.find((e) => e.name === 'enemy_A.png-0')?.id ?? null;
    const b = entities.find((e) => e.name === 'enemy_B.png-0')?.id ?? null;
    return { a, b };
  }).toEqual({ a: expect.any(String), b: expect.any(String) });

  const stateAfterImport = await getState<{ scene?: { entities?: Record<string, { id: string; name?: string }> } } | null>(page);
  const entitiesAfterImport = Object.values(stateAfterImport?.scene?.entities ?? {});
  const entityAId = entitiesAfterImport.find((e) => e.name === 'enemy_A.png-0')?.id ?? null;
  const entityBId = entitiesAfterImport.find((e) => e.name === 'enemy_B.png-0')?.id ?? null;
  if (!entityAId || !entityBId) throw new Error('Expected imported entity ids');

  await openSceneScope(page);
  await page.getByTestId(`ungrouped-entity-${entityAId}`).click();
  await page.getByTestId('entity-asset-select').selectOption({ label: 'enemy_B.png (image)' });

  await expect.poll(async () => {
    const state = await getState<{ scene?: { entities?: Record<string, { asset?: { source?: { kind: string; originalName?: string } } }> } } | null>(page);
    const asset = state?.scene?.entities?.[entityAId]?.asset;
    if (!asset || asset.source?.kind !== 'embedded') return null;
    return asset.source.originalName ?? null;
  }).toBe('enemy_B.png');
});

test('assigns a group MoveUntil action to imported sprites and runs it in play mode', async ({ page }) => {
  await openProjectScope(page);
  await page.setInputFiles('[data-testid="sprite-file-input"]', 'res/images/mainwindow.png');
  await page.getByTestId('sprite-import-mode-select').selectOption('spritesheet');
  await page.getByTestId('spritesheet-frame-width-input').fill('64');
  await page.getByTestId('spritesheet-frame-height-input').fill('64');
  await page.getByTestId('spritesheet-frame-1').click();
  await page.getByTestId('import-sprites-button').click();
  await page.getByTestId('create-formation-from-selection-button').click();

  await page.getByTestId('add-attachment-MoveUntil').click();
  await page.getByTestId('attachment-velocity-x-input').fill('120');

  const firstMemberId = await page.evaluate(() => {
    const state = window.__PHASER_ACTIONS_STUDIO_TEST__?.getState() as { scene: { groups: Record<string, { name?: string; members: string[] }> } } | null;
    const createdGroup = state ? Object.values(state.scene.groups).find((group) => group.name === 'Formation 1') : undefined;
    return createdGroup?.members[0] ?? null;
  });
  if (!firstMemberId) throw new Error('First member id unavailable');

  const before = await page.evaluate((memberId) => window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect(memberId), firstMemberId);
  await page.getByTestId('toggle-mode-button').click();

  await expect.poll(async () => {
    const rect = await page.evaluate((memberId) => window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect(memberId), firstMemberId);
    return rect?.centerX;
  }).not.toBe(before?.centerX);
});

test('preview uses edited move velocity and bounce behavior', async ({ page }) => {
  await selectGroupInSceneGraph(page, 'g-enemies');
  await page.getByTestId('attachment-open-att-move-right').click();
  await page.getByTestId('attachment-velocity-x-input').fill('240');
  await page.getByTestId('attachment-bounds-max-x-input').fill('460');
  await page.getByTestId('attachment-bounds-behavior-select').selectOption('bounce');

  const before = await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect('e1'));
  await page.getByTestId('toggle-mode-button').click();

  await expect.poll(async () => {
    const rect = await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect('e1'));
    return rect?.centerX;
  }).toBeGreaterThan((before?.centerX ?? 0) + 20);

  await expect.poll(async () => {
    const rect = await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect('e1'));
    return rect?.centerX;
  }, { timeout: 2000 }).toBeLessThan(before?.centerX ?? 0);
});

test('preview bounce reaches configured bounds edge before reversing', async ({ page }) => {
  await page.getByTestId('reset-scene-button').click();
  await openProjectScope(page);
  await page.setInputFiles('[data-testid="sprite-file-input"]', 'res/images/enemy_A.png');
  await page.getByTestId('import-sprites-button').click();
  await page.getByTestId('add-attachment-MoveUntil').click();
  await page.getByTestId('attachment-velocity-x-input').fill('300');
  await page.getByTestId('attachment-bounds-behavior-select').selectOption('bounce');

  const entityId = await page.evaluate(() => {
    const state = window.__PHASER_ACTIONS_STUDIO_TEST__?.getState() as { scene: { entities: Record<string, unknown> } } | null;
    return state ? Object.keys(state.scene.entities)[0] : null;
  });
  if (!entityId) throw new Error('Imported entity id unavailable');

  const beforeSprite = await getEntitySpriteWorldRect(page, entityId);
  if (!beforeSprite?.maxX) throw new Error('Sprite rect unavailable');
  const minX = String(Math.round(beforeSprite.minX - 200));
  const maxX = String(Math.round(beforeSprite.maxX + 40));
  await page.getByTestId('attachment-bounds-min-x-input').fill(minX);
  await page.getByTestId('attachment-bounds-max-x-input').fill(maxX);
  // Commit validated numeric inputs.
  await page.getByTestId('attachment-name-input').click();

  const bounds = await getEditableBoundsRect(page);
  if (!bounds?.maxX) throw new Error('Editable bounds unavailable');

  await page.getByTestId('toggle-mode-button').click();

  const expectedMaxX = bounds.maxX;
  const maxObservedMaxX = await page.evaluate(async ({ id }) => {
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    let lastCenterX: number | null = null;
    let maxMaxX = -Infinity;

    for (let i = 0; i < 240; i += 1) {
      await nextFrame();
      const rect = window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntitySpriteWorldRect(id) as { minX: number; maxX: number; centerX?: number } | null;
      if (!rect) continue;
      const centerX = rect.centerX ?? (rect.minX + rect.maxX) / 2;
      if (Number.isFinite(rect.maxX)) maxMaxX = Math.max(maxMaxX, rect.maxX);

      if (lastCenterX !== null && centerX < lastCenterX - 0.5) {
        break;
      }
      lastCenterX = centerX;
    }

    return maxMaxX;
  }, { id: entityId });

  expect(maxObservedMaxX).toBeGreaterThanOrEqual(expectedMaxX - 1);
  expect(maxObservedMaxX).toBeLessThanOrEqual(expectedMaxX + 8);
});

test('preview applies wrap behavior for an imported sprite move action', async ({ page }) => {
  await page.getByTestId('reset-scene-button').click();
  await openProjectScope(page);
  await page.setInputFiles('[data-testid="sprite-file-input"]', 'res/images/enemy_A.png');
  await page.getByTestId('import-sprites-button').click();
  await page.getByTestId('add-attachment-MoveUntil').click();

  const entityId = await page.evaluate(() => {
    const state = window.__PHASER_ACTIONS_STUDIO_TEST__?.getState() as { scene: { entities: Record<string, unknown> } } | null;
    return state ? Object.keys(state.scene.entities)[0] : null;
  });
  if (!entityId) throw new Error('Imported entity id unavailable');

  const before = await page.evaluate((id) => window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect(id), entityId);
  if (!before?.centerX) throw new Error('Imported entity rect unavailable');

  await page.getByTestId('attachment-velocity-x-input').fill('300');
  await page.getByTestId('attachment-bounds-min-x-input').fill('200');
  await page.getByTestId('attachment-bounds-max-x-input').fill(String(Math.round(before.centerX + 40)));
  await page.getByTestId('attachment-bounds-behavior-select').selectOption('wrap');
  await page.getByTestId('toggle-mode-button').click();

  await expect.poll(async () => {
    const rect = await page.evaluate((id) => window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect(id), entityId);
    return rect?.centerX;
  }).toBeLessThan(before.centerX);

  await expect.poll(async () => {
    const rect = await page.evaluate((id) => window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect(id), entityId);
    return rect?.centerX;
  }).toBeGreaterThan(200);
});

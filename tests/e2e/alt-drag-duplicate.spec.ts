import { expect, test } from '@playwright/test';
import {
  dismissViewHint,
  dragOnCanvas,
  getEntityWorldRect,
  getState,
  gotoStudio,
  seedSampleScene,
  tapWorld,
  waitForSampleScene,
  worldToClient,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);
});

test('alt-drag duplicates a selected sprite', async ({ page }) => {
  await tapWorld(page, { x: 220, y: 140 });

  const before = await getState<{
    scene: {
      entities: Record<string, { x: number }>;
      groups: Record<string, { members: string[]; layout?: { type: string } }>;
    };
  }>(page);
  const entityCountBefore = Object.keys(before.scene.entities).length;
  const e1BeforeX = before.scene.entities.e1.x;

  const rect = await getEntityWorldRect(page, 'e1');
  const start = await worldToClient(page, { x: rect.centerX ?? (rect.minX + rect.maxX) / 2, y: rect.centerY ?? (rect.minY + rect.maxY) / 2 });
  const end = await worldToClient(page, { x: (rect.centerX ?? (rect.minX + rect.maxX) / 2) + 80, y: rect.centerY ?? (rect.minY + rect.maxY) / 2 });

  await page.keyboard.down('Alt');
  await dragOnCanvas(page, start, end);
  await page.keyboard.up('Alt');

  await expect.poll(async () => {
    const state = await getState<{
      selection: { kind: string; id?: string; ids?: string[] };
      scene: {
        entities: Record<string, { x: number }>;
        groups: Record<string, { members: string[]; layout?: { type: string } }>;
      };
    }>(page);

    const selectedId = state.selection.kind === 'entity'
      ? state.selection.id
      : state.selection.kind === 'entities'
        ? state.selection.ids?.[0]
        : undefined;

    return {
      entityCount: Object.keys(state.scene.entities).length,
      selectedId,
      selectedX: selectedId ? state.scene.entities[selectedId]?.x ?? null : null,
      e1X: state.scene.entities.e1?.x ?? null,
      members: state.scene.groups['g-enemies']?.members ?? [],
      layoutType: state.scene.groups['g-enemies']?.layout?.type ?? null,
    };
  }).toMatchObject({
    entityCount: entityCountBefore + 1,
    e1X: e1BeforeX,
    layoutType: 'freeform',
  });

  await expect.poll(async () => {
    const state = await getState<{
      selection: { kind: string; id?: string; ids?: string[] };
      scene: { groups: Record<string, { members: string[] }> };
    }>(page);
    const selectedId = state.selection.kind === 'entity'
      ? state.selection.id
      : state.selection.kind === 'entities'
        ? state.selection.ids?.[0]
        : undefined;
    if (!selectedId) return false;
    if (selectedId === 'e1') return false;
    return Boolean(state.scene.groups['g-enemies']?.members.includes(selectedId));
  }).toBe(true);

  await expect.poll(async () => {
    const state = await getState<{
      selection: { kind: string; id?: string; ids?: string[] };
      scene: { entities: Record<string, { x: number }> };
    }>(page);
    const selectedId = state.selection.kind === 'entity'
      ? state.selection.id
      : state.selection.kind === 'entities'
        ? state.selection.ids?.[0]
        : undefined;
    if (!selectedId) return null;
    if (selectedId === 'e1') return null;
    return state.scene.entities[selectedId]?.x ?? null;
  }).toBeGreaterThan(e1BeforeX + 20);
});

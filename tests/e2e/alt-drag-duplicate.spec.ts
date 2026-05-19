import { expect, test } from '@playwright/test';
import {
  dismissViewHint,
  getEntityWorldRect,
  getState,
  gotoStudio,
  seedSampleScene,
  tapWorld,
  waitForSampleScene,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSampleScene(page);
  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);
});

test('alt-drag duplicates a selected sprite', async ({ page }) => {
  await tapWorld(page, { x: 220, y: 140 });

  // Add a handler + step targeting e1 so duplication can assert cloning.
  await page.getByTestId('add-event-block').click();
  await expect.poll(async () => {
    const state = await getState<any>(page);
    const blocks = Object.values(state.scene?.eventBlocks ?? {}).filter((b: any) => b?.target?.type === 'entity' && b?.target?.entityId === 'e1');
    return blocks[0]?.id ?? null;
  }).not.toBeNull();
  const stateWithHandler = await getState<any>(page);
  const blocks = Object.values(stateWithHandler.scene?.eventBlocks ?? {}).filter((b: any) => b?.target?.type === 'entity' && b?.target?.entityId === 'e1');
  const handlerIdResolved = blocks[0]?.id as string;
  if (!handlerIdResolved) throw new Error('Missing handler id');

  await page.getByTestId(`event-add-open-${handlerIdResolved}`).click();
  await page.getByTestId('action-library-add-Wait').click();

  await expect.poll(async () => {
    const state = await getState<any>(page);
    const attachments = Object.values(state.scene?.attachments ?? {}).filter((a: any) => a?.target?.type === 'entity' && a?.target?.entityId === 'e1' && a?.eventId === handlerIdResolved);
    return attachments.some((a: any) => a?.presetId === 'Wait');
  }).toBe(true);

  const before = await getState<{
    scene: {
      entities: Record<string, { x: number }>;
      groups: Record<string, { members: string[]; layout?: { type: string } }>;
    };
  }>(page);
  const entityCountBefore = Object.keys(before.scene.entities).length;
  const e1BeforeX = before.scene.entities.e1.x;

  const rect = await getEntityWorldRect(page, 'e1');

  // Use the test bridge to keep this deterministic in headless Firefox.
  const fromWorld = { x: rect.centerX ?? (rect.minX + rect.maxX) / 2, y: rect.centerY ?? (rect.minY + rect.maxY) / 2 };
  await tapWorld(page, fromWorld);
  await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.duplicateEntities(['e1'], { x: 80, y: 0 }));

  await expect.poll(async () => {
    const state = await getState<{
      selection: { kind: string; id?: string; ids?: string[] };
      scene: {
        entities: Record<string, { x: number; name?: string }>;
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
      selectedName: selectedId ? state.scene.entities[selectedId]?.name ?? null : null,
      e1X: state.scene.entities.e1?.x ?? null,
      members: state.scene.groups['g-enemies']?.members ?? [],
      layoutType: state.scene.groups['g-enemies']?.layout?.type ?? null,
    };
  }).toMatchObject({
    entityCount: entityCountBefore + 1,
    e1X: e1BeforeX,
    layoutType: 'freeform',
    selectedName: 'e16',
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

  await expect.poll(async () => {
    const state = await getState<any>(page);
    const selectedId = state.selection?.kind === 'entity'
      ? state.selection.id
      : state.selection?.kind === 'entities'
        ? state.selection.ids?.[0]
        : undefined;
    if (!selectedId || selectedId === 'e1') return null;
    const blocks = Object.values(state.scene?.eventBlocks ?? {}).filter((b: any) => b?.target?.type === 'entity' && b?.target?.entityId === selectedId);
    const blockId = blocks[0]?.id;
    const atts = Object.values(state.scene?.attachments ?? {}).filter((a: any) => a?.target?.type === 'entity' && a?.target?.entityId === selectedId);
    const hasWait = atts.some((a: any) => a?.presetId === 'Wait' && a?.eventId === blockId);
    return { hasBlock: blocks.length, hasWait };
  }).toEqual({ hasBlock: 1, hasWait: true });
});

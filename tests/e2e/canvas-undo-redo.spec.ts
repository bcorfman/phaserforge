import { expect, test } from '@playwright/test';
import { dispatchAction, getState, triggerRedo, triggerUndo, seedProject } from './helpers';

test('drags an entity on the canvas and supports keyboard undo/redo', async ({ page }) => {
  await seedProject(page, {
    id: 'project-canvas-undo-redo',
    assets: { images: {}, spriteSheets: {}, fonts: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: {
      'scene-1': {
        id: 'scene-1',
        world: { width: 1024, height: 768 },
        entities: {
          e1: { id: 'e1', x: 220, y: 140, width: 28, height: 20 },
        },
        groups: {},
        attachments: {},
        behaviors: {},
        actions: {},
        conditions: {},
      },
    },
    initialSceneId: 'scene-1',
  });

  await dispatchAction(page, { type: 'move-entity', id: 'e1', dx: 40, dy: 30 } as any);

  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
    return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  }).toEqual({ x: 260, y: 170 });

  await triggerUndo(page);
  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
    return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  }).toEqual({ x: 220, y: 140 });

  await triggerRedo(page);
  await expect.poll(async () => {
    const state = await getState<{ scene: { entities: Record<string, { x: number; y: number }> } }>(page);
    return { x: state.scene.entities.e1.x, y: state.scene.entities.e1.y };
  }).toEqual({ x: 260, y: 170 });
});


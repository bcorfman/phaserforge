import { expect, test } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { dismissViewHint, dragDropByTestIdAtClientPoint, getEntitySpriteWorldRect, getState, hitTestAtClientPoint, openSceneScope, seedProject, triggerUndo, worldToClient } from './helpers';

test.describe('Assets dock', () => {
  test.describe.configure({ timeout: 120000 });

  test('imports an image and drags to canvas to create an entity with asset ref', async ({ page }) => {
    await seedProject(page, createEmptyProject());
    await dismissViewHint(page);
    await openSceneScope(page);

    await expect(page.getByTestId('assets-dock-show-thumbnails')).toBeVisible();

    await page.getByTestId('assets-dock-import-button').click();
    await expect(page.getByTestId('assets-dock-import-panel')).toBeVisible();

    const fileChooser = page.getByTestId('assets-dock-file-input');
    await fileChooser.setInputFiles('res/images/enemy_A.png');

    await expect(page.getByTestId('assets-dock-item-image-enemy-a')).toBeVisible();

    let importedMeta: { width: number | null; height: number | null } = { width: null, height: null };
    await expect
      .poll(async () => {
        importedMeta = await page.evaluate(() => {
          const state: any = (window as any).__PHASER_ACTIONS_STUDIO_TEST__?.getState?.();
          const asset = state?.project?.assets?.images?.['enemy-a'];
          return { width: asset?.width ?? null, height: asset?.height ?? null };
        });
        return importedMeta;
      })
      .toEqual({ width: expect.any(Number), height: expect.any(Number) });

    const source = page.getByTestId('assets-dock-item-image-enemy-a');
    const canvas = page.locator('#game-container canvas');
    await source.dragTo(canvas, { targetPosition: { x: 200, y: 140 } });

    await expect.poll(async () => {
      const state = await getState<any>(page);
      const entities = state?.scene?.entities ?? {};
      const withAssetRef = Object.values(entities).filter((e: any) => e?.asset?.source?.kind === 'asset' && e?.asset?.source?.assetId === 'enemy-a');
      return withAssetRef.length;
    }).toBe(1);

    const created = await page.evaluate(() => {
      const state: any = (window as any).__PHASER_ACTIONS_STUDIO_TEST__?.getState?.();
      const entities = state?.scene?.entities ?? {};
      return Object.values(entities).find((e: any) => e?.asset?.source?.kind === 'asset' && e?.asset?.source?.assetId === 'enemy-a') ?? null;
    });
    if (!created) throw new Error('Failed to find created entity');
    expect(created.width).toBe(importedMeta.width);
    expect(created.height).toBe(importedMeta.height);
    expect(created.scaleX ?? 1).toBe(1);
    expect(created.scaleY ?? 1).toBe(1);
  });

  test('dragging an image asset onto an existing sprite replaces its asset', async ({ page }) => {
    await seedProject(page, createEmptyProject());
    await dismissViewHint(page);
    await openSceneScope(page);

    await page.getByTestId('assets-dock-import-button').click();
    await page.getByTestId('assets-dock-file-input').setInputFiles('res/images/enemy_A.png');
    await expect(page.getByTestId('assets-dock-item-image-enemy-a')).toBeVisible();
    // Ensure the image exists in state before dragging (some engines render the list row before state settles).
    await expect.poll(async () => {
      const state = await getState<any>(page);
      return Boolean(state?.project?.assets?.images?.['enemy-a']);
    }).toBe(true);

    const beforeEntityIds = await page.evaluate(() => {
      const state: any = (window as any).__PHASER_ACTIONS_STUDIO_TEST__?.getState?.();
      return Object.keys(state?.scene?.entities ?? {});
    });

    const enemyAsset = page.getByTestId('assets-dock-item-image-enemy-a');
    const canvas = page.locator('#game-container canvas');
    await expect(canvas).toBeVisible();
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas bounding box unavailable');
    await enemyAsset.dragTo(canvas, { targetPosition: { x: canvasBox.width * 0.5, y: canvasBox.height * 0.5 } });

    await expect.poll(async () => {
      const state = await getState<any>(page);
      const ids = Object.keys(state?.scene?.entities ?? {});
      const added = ids.filter((id) => !beforeEntityIds.includes(id));
      return added.length;
    }).toBe(1);

    const createdEntityId = await page.evaluate((existingIds) => {
      const state: any = (window as any).__PHASER_ACTIONS_STUDIO_TEST__?.getState?.();
      const ids = Object.keys(state?.scene?.entities ?? {});
      const added = ids.filter((id) => !(existingIds as string[]).includes(id));
      return added[0] ?? null;
    }, beforeEntityIds);
    if (typeof createdEntityId !== 'string') throw new Error('Failed to create entity from asset');

    // Fit view so the sprite is guaranteed to be visible/hit-testable in all engines.
    await page.getByTestId('fit-view-button').click();

    await page.getByTestId('assets-dock-import-button').click();
    await page.getByTestId('assets-dock-file-input').setInputFiles('res/images/meteor_large.png');
    await expect(page.getByTestId('assets-dock-item-image-meteor-large')).toBeVisible();
    // Wait for the imported image asset to be present in state (WebKit can render the list item before metadata/state lands).
    await expect.poll(async () => {
      const state = await getState<any>(page);
      const asset = state?.project?.assets?.images?.['meteor-large'];
      return Boolean(asset);
    }).toBe(true);

    const entityCountBeforeReplace = await page.evaluate(() => {
      const state: any = (window as any).__PHASER_ACTIONS_STUDIO_TEST__?.getState?.();
      return Object.keys(state?.scene?.entities ?? {}).length;
    });

    const rect = await getEntitySpriteWorldRect(page, createdEntityId);
    if (!rect || typeof rect.centerX !== 'number' || typeof rect.centerY !== 'number') throw new Error('Missing sprite world rect');

    // Convert the sprite's world center to a client point. Poll until hit-testing confirms the sprite is
    // actually on-screen (fit view is async relative to rendering in headless engines).
    let hitClientPoint: { x: number; y: number } | null = null;
    await expect
      .poll(async () => {
        const p = await worldToClient(page, { x: rect.centerX, y: rect.centerY });
        hitClientPoint = p;
        const hit = await hitTestAtClientPoint(page, p);
        return hit?.id ?? '';
      }, { timeout: 15000 })
      .toBe(createdEntityId);
    if (!hitClientPoint) throw new Error('Failed to locate entity on canvas for asset replacement drop');

    // Try a few nearby drop points in case the first one lands on a handle/overlay edge in some engines.
    const jitter = [
      { dx: 0, dy: 0 },
      { dx: 8, dy: 0 },
      { dx: -8, dy: 0 },
      { dx: 0, dy: 8 },
      { dx: 0, dy: -8 },
      { dx: 12, dy: 12 },
      { dx: -12, dy: -12 },
    ];

    let replaced = false;
    for (const { dx, dy } of jitter) {
      const clientPoint = { x: hitClientPoint.x + dx, y: hitClientPoint.y + dy };
      await dragDropByTestIdAtClientPoint(page, 'assets-dock-item-image-meteor-large', 'game-container', clientPoint);

      try {
        await expect
          .poll(async () => {
            const state = await getState<any>(page);
            const entities = state?.scene?.entities ?? {};
            const entity = entities?.[createdEntityId];
            return {
              assetId: entity?.asset?.source?.assetId ?? '',
              entityCount: Object.keys(entities).length,
            };
          }, { timeout: 2500 })
          .toEqual({ assetId: 'meteor-large', entityCount: entityCountBeforeReplace });
        replaced = true;
        break;
      } catch {
        // If the drop created a new entity instead of replacing, undo and try a different point.
        const state = await getState<any>(page);
        const count = Object.keys(state?.scene?.entities ?? {}).length;
        if (count > entityCountBeforeReplace) {
          await triggerUndo(page);
          await expect
            .poll(async () => Object.keys((await getState<any>(page))?.scene?.entities ?? {}).length)
            .toBe(entityCountBeforeReplace);
        }
      }
    }
    if (!replaced) throw new Error('Failed to replace sprite asset via drop');

    await expect
      .poll(async () => {
        const state = await getState<any>(page);
        const entities = state?.scene?.entities ?? {};
        const entity = entities?.[createdEntityId];
        return {
          assetId: entity?.asset?.source?.assetId ?? '',
          entityCount: Object.keys(entities).length,
        };
      })
      .toEqual({ assetId: 'meteor-large', entityCount: entityCountBeforeReplace });
  });

  test('imports audio by path and assigns it to scene music via drop', async ({ page }) => {
    await seedProject(page, createEmptyProject());
    await dismissViewHint(page);
    await openSceneScope(page);

    await page.getByTestId('assets-dock-import-button').click();
    await page.getByTestId('assets-dock-import-kind-select').selectOption('audio');
    await page.getByTestId('assets-dock-import-source-select').selectOption('path');
    await page.getByTestId('assets-dock-import-path-input').fill('/assets/audio/theme.mp3');
    await page.getByTestId('assets-dock-import-path').click();

    await page.getByTestId('assets-dock-tab-audio').click();
    await expect(page.getByTestId('assets-dock-item-audio-theme')).toBeVisible();

    await page.getByTestId('scene-inspector-panel').getByText('Expand All').click();
    const source = page.getByTestId('assets-dock-item-audio-theme');
    const musicSelect = page.getByTestId('scene-music-asset-select');
    await source.dragTo(musicSelect);

    await expect.poll(async () => {
      const state = await getState<any>(page);
      return state?.scene?.music?.assetId ?? '';
    }).toBe('theme');
  });
});

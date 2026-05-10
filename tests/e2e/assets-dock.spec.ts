import { expect, test } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { dismissViewHint, dragDropByTestIdAtClientPoint, getEntitySpriteWorldRect, getState, openSceneScope, seedProject, triggerUndo, worldToClient } from './helpers';

test.describe('Assets dock', () => {
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

    const beforeEntityIds = await page.evaluate(() => {
      const state: any = (window as any).__PHASER_ACTIONS_STUDIO_TEST__?.getState?.();
      return Object.keys(state?.scene?.entities ?? {});
    });

    const enemyAsset = page.getByTestId('assets-dock-item-image-enemy-a');
    const canvas = page.locator('#game-container canvas');
    await enemyAsset.dragTo(canvas, { targetPosition: { x: 220, y: 160 } });

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
    const centerWorld = { x: rect.centerX ?? (rect.minX + rect.maxX) / 2, y: rect.centerY ?? (rect.minY + rect.maxY) / 2 };
    const candidatesWorld = [
      centerWorld,
      { x: rect.minX + (rect.maxX - rect.minX) * 0.25, y: rect.minY + (rect.maxY - rect.minY) * 0.25 },
      { x: rect.minX + (rect.maxX - rect.minX) * 0.75, y: rect.minY + (rect.maxY - rect.minY) * 0.25 },
      { x: rect.minX + (rect.maxX - rect.minX) * 0.25, y: rect.minY + (rect.maxY - rect.minY) * 0.75 },
      { x: rect.minX + (rect.maxX - rect.minX) * 0.75, y: rect.minY + (rect.maxY - rect.minY) * 0.75 },
    ];
    const candidatesClient = await Promise.all(candidatesWorld.map((p) => worldToClient(page, p)));

    const readSnapshot = async () => {
      const state = await getState<any>(page);
      const entities = state?.scene?.entities ?? {};
      const entity = entities?.[createdEntityId];
      return {
        assetId: entity?.asset?.source?.assetId ?? '',
        entityCount: Object.keys(entities).length,
      };
    };

    const waitForOutcome = async (timeoutMs: number) => {
      const deadline = Date.now() + timeoutMs;
      let last = await readSnapshot();
      while (Date.now() < deadline) {
        last = await readSnapshot();
        if (last.assetId === 'meteor-large') return last;
        if (last.entityCount > entityCountBeforeReplace) return last;
        await page.waitForTimeout(100);
      }
      return last;
    };

    // Some browsers/CI runs are sensitive to the exact drop point. Try a few points within the sprite rect.
    // If a drop accidentally creates a new entity, undo and retry until we get a clean replace.
    for (const point of candidatesClient) {
      await dragDropByTestIdAtClientPoint(page, 'assets-dock-item-image-meteor-large', 'game-container', point);
      const snapshot = await waitForOutcome(1500);

      if (snapshot.entityCount > entityCountBeforeReplace) {
        await triggerUndo(page);
        await expect.poll(async () => {
          const state = await getState<any>(page);
          return Object.keys(state?.scene?.entities ?? {}).length;
        }).toBe(entityCountBeforeReplace);
        continue;
      }

      if (snapshot.assetId === 'meteor-large') break;
    }

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

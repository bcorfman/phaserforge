import { expect, test, type Page } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { dispatchAction, getRenderDebugSnapshot, getSceneSnapshot, getState, seedProject, waitForSceneReady } from './helpers';

const WHITE_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function makeTintedSceneProject() {
  const project = createEmptyProject() as any;
  const scene = project.scenes[project.initialSceneId];
  scene.backgroundColor = 0x000000;
  project.assets.images.star = {
    id: 'star',
    width: 1,
    height: 1,
    source: { kind: 'embedded', dataUrl: WHITE_PIXEL, originalName: 'star.png', mimeType: 'image/png' },
  };
  project.assets.spriteSheets.sheet = {
    id: 'sheet',
    width: 1,
    height: 1,
    source: { kind: 'embedded', dataUrl: WHITE_PIXEL, originalName: 'sheet.png', mimeType: 'image/png' },
    grid: { frameWidth: 1, frameHeight: 1, columns: 1, rows: 1 },
  };
  scene.entities = {
    imageStar: {
      id: 'imageStar',
      x: 80,
      y: 80,
      width: 16,
      height: 16,
      tint: 0x224466,
      asset: { source: { kind: 'asset', assetId: 'star' }, imageType: 'image', frame: { kind: 'single' } },
    },
    sheetStar: {
      id: 'sheetStar',
      x: 120,
      y: 80,
      width: 16,
      height: 16,
      tint: 0x335577,
      asset: {
        source: { kind: 'asset', assetId: 'sheet' },
        imageType: 'spritesheet',
        grid: { frameWidth: 1, frameHeight: 1, columns: 1, rows: 1 },
        frame: { kind: 'index', frameIndex: 0 },
      },
    },
    placeholderStar: {
      id: 'placeholderStar',
      x: 160,
      y: 80,
      width: 16,
      height: 16,
      tint: 0x446688,
    },
  };
  scene.groups = {};
  scene.attachments = {};
  scene.eventBlocks = {};
  return project;
}

async function expectActiveProjectPersisted(page: Page) {
  await expect.poll(async () => {
    return page.evaluate(async () => {
      const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
        const request = window.indexedDB.open('phaserforge.persistence.v1', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      const db = await openDb();
      const workspace = await new Promise<any>((resolve, reject) => {
        const tx = db.transaction('workspaceState', 'readonly');
        const request = tx.objectStore('workspaceState').get('workspace');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!workspace?.activeProjectId) return null;
      const record = await new Promise<any>((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly');
        const request = tx.objectStore('projects').get(workspace.activeProjectId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const headRevision = Array.isArray(record?.revisions) ? record.revisions[0] : null;
      return {
        activeProjectId: workspace.activeProjectId,
        sceneCount: Number(headRevision?.sceneCount ?? record?.sceneCount ?? 0),
        entityCount: Number(headRevision?.entityCount ?? 0),
      };
    });
  }).toEqual({
    activeProjectId: expect.any(String),
    sceneCount: 1,
    entityCount: 3,
  });
}

test('scene background and entity tint match in edit and play without selection tint drift @critical', async ({ page }) => {
  await seedProject(page, makeTintedSceneProject());

  await expect.poll(async () => {
    const snapshot = await getSceneSnapshot<any>(page);
    const render = await getRenderDebugSnapshot<any>(page);
    return {
      sceneKey: snapshot?.sceneKey,
      background: render?.cameraBackgroundColor,
      imageTint: render?.entityDisplay?.imageStar?.tint,
      sheetTint: render?.entityDisplay?.sheetStar?.tint,
      placeholderTint: render?.entityDisplay?.placeholderStar?.fillColor ?? render?.entityDisplay?.placeholderStar?.tint,
    };
  }).toEqual({
    sceneKey: 'EditorScene',
    background: 0x000000,
    imageTint: 0x224466,
    sheetTint: 0x335577,
    placeholderTint: 0x446688,
  });

  await dispatchAction(page, { type: 'select', selection: { kind: 'entity', id: 'imageStar' } });
  await expect.poll(async () => (await getRenderDebugSnapshot<any>(page))?.entityDisplay?.imageStar?.tint).toBe(0x224466);

  await page.evaluate(() => window.__PHASER_FORGE_TEST__?.setMode?.('play'));
  await expect.poll(async () => {
    const snapshot = await getSceneSnapshot<any>(page);
    const render = await getRenderDebugSnapshot<any>(page);
    return {
      sceneKey: snapshot?.sceneKey,
      background: render?.cameraBackgroundColor,
      imageTint: render?.entityDisplay?.imageStar?.tint,
      sheetTint: render?.entityDisplay?.sheetStar?.tint,
      placeholderTint: render?.entityDisplay?.placeholderStar?.fillColor ?? render?.entityDisplay?.placeholderStar?.tint,
    };
  }).toEqual({
    sceneKey: 'GameScene',
    background: 0x000000,
    imageTint: 0x224466,
    sheetTint: 0x335577,
    placeholderTint: 0x446688,
  });
});

test('black authored scene background survives browser reload @critical', async ({ page }) => {
  const project = makeTintedSceneProject();
  await seedProject(page, project);
  await expectActiveProjectPersisted(page);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForSceneReady(page);

  await expect.poll(async () => {
    const state = await getState<any>(page);
    const render = await getRenderDebugSnapshot<any>(page);
    const scene = state?.project?.scenes?.[state.currentSceneId];
    return {
      authoredBackground: scene?.backgroundColor,
      renderedBackground: render?.cameraBackgroundColor,
      imageTint: render?.entityDisplay?.imageStar?.tint,
    };
  }).toEqual({
    authoredBackground: 0x000000,
    renderedBackground: 0x000000,
    imageTint: 0x224466,
  });
});

test('active scene background wins over base scene background in edit and play @critical', async ({ page }) => {
  const empty = createEmptyProject() as any;
  const project = {
    ...empty,
    id: 'project-background-layering',
    baseSceneId: 'base',
    initialSceneId: 'active',
    scenes: {
      base: {
        ...createEmptyProject().scenes.scene,
        id: 'base',
        backgroundColor: 0xff0000,
        entities: {
          baseBox: { id: 'baseBox', x: 40, y: 40, width: 10, height: 10 },
        },
      },
      active: {
        ...createEmptyProject().scenes.scene,
        id: 'active',
        backgroundColor: 0x000000,
        entities: {
          activeBox: { id: 'activeBox', x: 80, y: 80, width: 10, height: 10 },
        },
      },
    },
  };

  await seedProject(page, project);
  await expect.poll(async () => (await getRenderDebugSnapshot<any>(page))?.cameraBackgroundColor).toBe(0x000000);

  await page.evaluate(() => window.__PHASER_FORGE_TEST__?.setMode?.('play'));
  await expect.poll(async () => {
    const snapshot = await getSceneSnapshot<any>(page);
    const render = await getRenderDebugSnapshot<any>(page);
    return {
      sceneKey: snapshot?.sceneKey,
      baseCompiledSceneId: snapshot?.baseCompiledSceneId,
      background: render?.cameraBackgroundColor,
    };
  }).toEqual({
    sceneKey: 'GameScene',
    baseCompiledSceneId: 'base',
    background: 0x000000,
  });
});

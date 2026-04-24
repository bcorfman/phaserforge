import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, gotoStudio, waitForSampleScene } from './helpers';
import { serializeProjectToYaml } from '../../src/model/serialization';
import { sampleProject } from '../../src/model/sampleProject';

test('background layers render in both edit and play mode', async ({ page }) => {
  const pixelPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+Xf5kAAAAASUVORK5CYII=';

  // Reuse the sample scene content, but add two background layers + assets.
  const sceneId = sampleProject.initialSceneId;
  const project = {
    ...sampleProject,
    assets: {
      ...sampleProject.assets,
      images: {
        starfield: { id: 'starfield', source: { kind: 'embedded', dataUrl: pixelPng, originalName: 'starfield.png', mimeType: 'image/png' } },
        fog: { id: 'fog', source: { kind: 'embedded', dataUrl: pixelPng, originalName: 'fog.png', mimeType: 'image/png' } },
      },
      spriteSheets: {},
    },
    scenes: {
      ...sampleProject.scenes,
      [sceneId]: {
        ...sampleProject.scenes[sceneId],
        backgroundLayers: [
          { assetId: 'starfield', x: 512, y: 384, depth: -100, layout: 'cover' as const },
          { assetId: 'fog', x: 0, y: 0, depth: -110, layout: 'tile' as const, scrollFactor: { x: 0.2, y: 0.2 }, alpha: 0.8 },
        ],
      },
    },
  };

  const yaml = serializeProjectToYaml(project as any);
  await page.addInitScript(([projectYaml]) => {
    window.localStorage.removeItem('phaseractions.inspectorFoldouts.v1');
    window.localStorage.setItem('phaseractions.projectYaml.v1', projectYaml);
    window.localStorage.setItem('phaseractions.startupMode.v1', 'reload_last_yaml');
  }, [yaml]);

  await gotoStudio(page);
  await waitForSampleScene(page);
  await dismissViewHint(page);

  await expect.poll(async () => (await getSceneSnapshot<{ backgroundLayerCount?: number; sceneKey?: string }>(page))?.backgroundLayerCount ?? 0).toBe(2);

  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');
  await expect.poll(async () => (await getSceneSnapshot<{ backgroundLayerCount?: number }>(page))?.backgroundLayerCount ?? 0).toBe(2);

  // Return to edit mode so later tests are less likely to be affected by runtime state.
  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('EditorScene');
});

import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, gotoStudio, waitForSampleScene } from './helpers';
import { serializeProjectToYaml } from '../../src/model/serialization';
import { sampleProject } from '../../src/model/sampleProject';

test('entering play mode applies scene music/ambience (bridge snapshot)', async ({ page }) => {
  const silentWav =
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

  const sceneId = sampleProject.initialSceneId;
  const project = {
    ...sampleProject,
    audio: {
      sounds: {
        music_theme: { id: 'music_theme', source: { kind: 'embedded', dataUrl: silentWav, originalName: 'theme.wav', mimeType: 'audio/wav' } },
        forest_ambience: { id: 'forest_ambience', source: { kind: 'embedded', dataUrl: silentWav, originalName: 'forest.wav', mimeType: 'audio/wav' } },
      },
    },
    scenes: {
      ...sampleProject.scenes,
      [sceneId]: {
        ...sampleProject.scenes[sceneId],
        music: { assetId: 'music_theme', loop: true, volume: 0.65, fadeMs: 250 },
        ambience: [{ assetId: 'forest_ambience', loop: true, volume: 0.35 }],
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

  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<{ audio?: { musicAssetId?: string; ambienceAssetIds?: string[] } }>(page);
    return {
      music: snap?.audio?.musicAssetId,
      ambience: snap?.audio?.ambienceAssetIds ?? [],
    };
  }).toEqual({ music: 'music_theme', ambience: ['forest_ambience'] });
});


import { expect, test } from '@playwright/test';
import { dismissViewHint, getSceneSnapshot, getState, openSceneScope, seedProject } from './helpers';
import { sampleProject } from '../../src/model/sampleProject';
import { createEmptyProject } from '../../src/model/emptyProject';
import { serializeProjectToYaml } from '../../src/model/serialization';

test.setTimeout(120000);

test('entering play mode applies scene music/ambience (bridge snapshot) @slow', async ({ page }) => {
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

  await seedProject(page, project as any);
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

test('entering play mode eventually starts delayed path-backed demo-pack music @slow', async ({ page }) => {
  await page.route('**/assets/demo-pack/audio/Simulacra-chosic.com_.mp3*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.continue();
  });

  const sceneId = sampleProject.initialSceneId;
  const project = {
    ...sampleProject,
    audio: {
      sounds: {
        theme: {
          id: 'theme',
          source: {
            kind: 'path',
            path: 'assets/demo-pack/audio/Simulacra-chosic.com_.mp3',
            originalName: 'Simulacra-chosic.com_.mp3',
            mimeType: 'audio/mpeg',
          },
        },
      },
    },
    scenes: {
      ...sampleProject.scenes,
      [sceneId]: {
        ...sampleProject.scenes[sceneId],
        music: { assetId: 'theme', loop: true, volume: 0.65, fadeMs: 250 },
      },
    },
  };

  await seedProject(page, project as any);
  await dismissViewHint(page);

  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<{
      audio?: { musicAssetId?: string };
      audioPlayback?: { musicIsPlaying?: boolean };
      audioDebug?: { outputRange?: number; usingWebAudio?: boolean };
    }>(page);
    return {
      music: snap?.audio?.musicAssetId,
      isPlaying: Boolean(snap?.audioPlayback?.musicIsPlaying),
      outputRange: Number(snap?.audioDebug?.outputRange ?? 0),
      usingWebAudio: Boolean(snap?.audioDebug?.usingWebAudio),
    };
  }, { timeout: 15000 }).toEqual({ music: 'theme', isPlaying: true, outputRange: expect.any(Number), usingWebAudio: true });

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<{ audioDebug?: { outputRange?: number } }>(page);
    return Number(snap?.audioDebug?.outputRange ?? 0);
  }, { timeout: 15000 }).toBeGreaterThan(0);
});

test('published play page starts path-backed demo-pack music @slow', async ({ page }) => {
  const sceneId = sampleProject.initialSceneId;
  const project = {
    ...sampleProject,
    audio: {
      sounds: {
        theme: {
          id: 'theme',
          source: {
            kind: 'path',
            path: 'assets/demo-pack/audio/Simulacra-chosic.com_.mp3',
            originalName: 'Simulacra-chosic.com_.mp3',
            mimeType: 'audio/mpeg',
          },
        },
      },
    },
    scenes: {
      ...sampleProject.scenes,
      [sceneId]: {
        ...sampleProject.scenes[sceneId],
        music: { assetId: 'theme', loop: true, volume: 0.65, fadeMs: 250 },
      },
    },
  };

  await page.route('**/game.yaml', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/x-yaml',
      body: serializeProjectToYaml(project as any),
    });
  });

  await page.goto('./?yamlUrl=./game.yaml&audioDebug=1');
  await expect(page.getByTestId('play-start-gate')).toBeVisible();
  await page.getByTestId('play-start-gate').click();

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<{
      audio?: { musicAssetId?: string };
      audioPlayback?: { musicIsPlaying?: boolean };
      audioDebug?: { outputRange?: number; usingWebAudio?: boolean; currentMusicResolvedUrl?: string };
    }>(page);
    return {
      music: snap?.audio?.musicAssetId,
      isPlaying: Boolean(snap?.audioPlayback?.musicIsPlaying),
      usingWebAudio: Boolean(snap?.audioDebug?.usingWebAudio),
    };
  }, { timeout: 15000 }).toEqual({
    music: 'theme',
    isPlaying: true,
    usingWebAudio: true,
  });

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<{ audioDebug?: { outputRange?: number } }>(page);
    return Number(snap?.audioDebug?.outputRange ?? 0);
  }, { timeout: 15000 }).toBeGreaterThan(0);
});

const demoPackAudioAssets = [
  {
    assetId: 'simulacra-chosic-com',
    route: '**/assets/demo-pack/audio/Simulacra-chosic.com_.mp3*',
    path: 'assets/demo-pack/audio/Simulacra-chosic.com_.mp3',
    originalName: 'Simulacra-chosic.com_.mp3',
  },
  {
    assetId: 'punch-deck-the-soul-crushing-monotony-of-isolation-instrumental-mix-chosic-com',
    route: '**/assets/demo-pack/audio/punch-deck-the-soul-crushing-monotony-of-isolation-instrumental-mix(chosic.com).mp3*',
    path: 'assets/demo-pack/audio/punch-deck-the-soul-crushing-monotony-of-isolation-instrumental-mix(chosic.com).mp3',
    originalName: 'punch-deck-the-soul-crushing-monotony-of-isolation-instrumental-mix(chosic.com).mp3',
  },
  {
    assetId: 'sb-indreams-chosic-com',
    route: '**/assets/demo-pack/audio/sb_indreams(chosic.com).mp3*',
    path: 'assets/demo-pack/audio/sb_indreams(chosic.com).mp3',
    originalName: 'sb_indreams(chosic.com).mp3',
  },
] as const;

test('selecting demo-pack music in the editor primes playback before play mode @slow', async ({ page }) => {
  const { assetId, route } = demoPackAudioAssets[0];
  await page.route(route, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.continue();
  });

  await seedProject(page, createEmptyProject() as any);
  await dismissViewHint(page);
  await openSceneScope(page);

  await page.getByTestId('assets-dock-add-button').click();
  await page.getByTestId('assets-dock-add-menu-from-demo-pack').click();
  await page.getByTestId('assets-dock-tab-audio').click();
  await expect(page.getByTestId(`assets-dock-item-audio-${assetId}`)).toBeVisible();

  await page.getByTestId('scene-inspector-panel').getByText('Expand All').click();
  await page.getByTestId('scene-music-asset-select').selectOption(assetId);

  await expect.poll(async () => {
    const state = await getState<{ currentSceneId?: string; scene?: { music?: { assetId?: string } } }>(page);
    return {
      sceneId: state?.currentSceneId ?? null,
      music: state?.scene?.music?.assetId ?? null,
    };
  }).toEqual({ sceneId: 'scene-1', music: assetId });

  await page.getByTestId('toggle-mode-button').click();
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<{
      audio?: { musicAssetId?: string };
      audioPlayback?: { musicIsPlaying?: boolean };
      audioDebug?: { outputRange?: number; usingWebAudio?: boolean };
    }>(page);
    return {
      music: snap?.audio?.musicAssetId,
      isPlaying: Boolean(snap?.audioPlayback?.musicIsPlaying),
      outputRange: Number(snap?.audioDebug?.outputRange ?? 0),
      usingWebAudio: Boolean(snap?.audioDebug?.usingWebAudio),
    };
  }, { timeout: 15000 }).toEqual({
    music: assetId,
    isPlaying: true,
    outputRange: expect.any(Number),
    usingWebAudio: true,
  });

  await expect.poll(async () => {
    const snap = await getSceneSnapshot<{ audioDebug?: { outputRange?: number } }>(page);
    return Number(snap?.audioDebug?.outputRange ?? 0);
  }, { timeout: 15000 }).toBeGreaterThan(0);
});

test('demo-pack music filenames with punctuation can be assigned in the editor @browser', async ({ page }) => {
  await seedProject(page, createEmptyProject() as any);
  await dismissViewHint(page);
  await openSceneScope(page);

  await page.getByTestId('assets-dock-add-button').click();
  await page.getByTestId('assets-dock-add-menu-from-demo-pack').click();
  await page.getByTestId('assets-dock-tab-audio').click();

  await page.getByTestId('scene-inspector-panel').getByText('Expand All').click();

  for (const { assetId, path, originalName } of demoPackAudioAssets) {
    await expect(page.getByTestId(`assets-dock-item-audio-${assetId}`)).toBeVisible();
    await page.getByTestId('scene-music-asset-select').selectOption(assetId);

    await expect.poll(async () => {
      const state = await getState<{
        currentSceneId?: string;
        scene?: { music?: { assetId?: string } };
        project?: { audio?: { sounds?: Record<string, { source?: { path?: string; originalName?: string } }> } };
      }>(page);
      const source = state?.project?.audio?.sounds?.[assetId]?.source;
      return {
        sceneId: state?.currentSceneId ?? null,
        music: state?.scene?.music?.assetId ?? null,
        path: source?.path ?? null,
        originalName: source?.originalName ?? null,
      };
    }).toEqual({ sceneId: 'scene-1', music: assetId, path, originalName });
  }
});

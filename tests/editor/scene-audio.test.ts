import { describe, expect, it } from 'vitest';
import { initState, reducer } from '../../src/editor/EditorStore';
import { sampleProject } from '../../src/model/sampleProject';

function seededState() {
  const base = initState();
  return {
    ...base,
    project: sampleProject,
    currentSceneId: sampleProject.initialSceneId,
  };
}

function sceneOf(state: any) {
  return state.project.scenes[state.currentSceneId];
}

describe('scene audio authoring', () => {
  it('adds an audio asset to the project library from an embedded file', () => {
    const state = seededState();
    const next = reducer(state, {
      type: 'add-audio-asset-from-file',
      file: {
        dataUrl: 'data:audio/wav;base64,AAAA',
        originalName: 'music_theme.wav',
        mimeType: 'audio/wav',
      },
    } as any);

    expect(Object.keys(next.project.audio.sounds)).toContain('music-theme');
    expect(next.project.audio.sounds['music-theme']).toEqual({
      id: 'music-theme',
      source: { kind: 'embedded', dataUrl: 'data:audio/wav;base64,AAAA', originalName: 'music_theme.wav', mimeType: 'audio/wav' },
    });
    expect(next.dirty).toBe(true);
  });

  it('sets scene music and ambience', () => {
    const state = seededState();
    const withLibrary = reducer(state, {
      type: 'add-audio-asset-from-file',
      file: {
        dataUrl: 'data:audio/mp3;base64,AAAA',
        originalName: 'music_theme.mp3',
        mimeType: 'audio/mpeg',
      },
    } as any);

    const withMusic = reducer(withLibrary, {
      type: 'set-scene-music',
      music: { assetId: 'music-theme', loop: true, volume: 0.65, fadeMs: 250 },
    } as any);

    const withAmbience = reducer(withMusic, {
      type: 'set-scene-ambience',
      ambience: [{ assetId: 'music-theme', loop: true, volume: 0.35 }],
    } as any);

    expect(sceneOf(withAmbience).music).toEqual({ assetId: 'music-theme', loop: true, volume: 0.65, fadeMs: 250 });
    expect(sceneOf(withAmbience).ambience).toEqual([{ assetId: 'music-theme', loop: true, volume: 0.35 }]);
  });

  it('removing an audio asset clears scene references', () => {
    const state = seededState();
    const withLibrary = reducer(state, {
      type: 'add-audio-asset-from-file',
      file: {
        dataUrl: 'data:audio/mp3;base64,AAAA',
        originalName: 'music_theme.mp3',
        mimeType: 'audio/mpeg',
      },
    } as any);

    const withSceneAudio = reducer(
      reducer(withLibrary, {
        type: 'set-scene-music',
        music: { assetId: 'music-theme', loop: true, volume: 1, fadeMs: 0 },
      } as any),
      {
        type: 'set-scene-ambience',
        ambience: [{ assetId: 'music-theme', loop: true, volume: 0.3 }],
      } as any,
    );

    const removed = reducer(withSceneAudio, { type: 'remove-audio-asset', assetId: 'music-theme' } as any);
    expect(removed.project.audio.sounds['music-theme']).toBeUndefined();
    expect(sceneOf(removed).music).toBeUndefined();
    expect(sceneOf(removed).ambience ?? []).toEqual([]);
  });
});

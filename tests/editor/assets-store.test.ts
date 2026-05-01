import { describe, expect, it } from 'vitest';
import { initState, reducer } from '../../src/editor/EditorStore';

function sceneOf(state: any) {
  return state.project.scenes[state.currentSceneId];
}

describe('EditorStore assets actions', () => {
  it('adds an image asset and creates an entity referencing it', () => {
    const state = initState();
    const withAsset = reducer(state, { type: 'add-image-asset-from-path', path: '/assets/images/player.png' } as any);
    expect(withAsset.project.assets.images.player).toBeDefined();

    const withEntity = reducer(withAsset, { type: 'create-entity-from-asset', assetKind: 'image', assetId: 'player', at: { x: 10, y: 20 } } as any);
    const scene = sceneOf(withEntity);
    const ids = Object.keys(scene.entities);
    expect(ids.length).toBe(1);
    const entity = scene.entities[ids[0]];
    expect(entity.x).toBe(10);
    expect(entity.y).toBe(20);
    expect(entity.asset?.source).toEqual({ kind: 'asset', assetId: 'player' });
    expect(entity.asset?.imageType).toBe('image');
  });

  it('blocks deletion of referenced assets', () => {
    const state = initState();
    const withAsset = reducer(state, { type: 'add-image-asset-from-path', path: '/assets/images/bg.png', suggestedId: 'bg' } as any);
    const withEntity = reducer(withAsset, { type: 'create-entity-from-asset', assetKind: 'image', assetId: 'bg' } as any);

    const blocked = reducer(withEntity, { type: 'remove-asset', assetKind: 'image', assetId: 'bg' } as any);
    expect(blocked.project.assets.images.bg).toBeDefined();
    expect(blocked.error).toMatch(/Cannot delete image asset/);
  });

  it('assigns audio asset to scene music', () => {
    const state = initState();
    const withAudio = reducer(state, { type: 'add-audio-asset-from-path', path: '/assets/audio/theme.mp3', suggestedId: 'theme' } as any);
    expect(withAudio.project.audio.sounds.theme).toBeDefined();

    const assigned = reducer(withAudio, {
      type: 'assign-asset-to-target',
      assetKind: 'audio',
      assetId: 'theme',
      target: { kind: 'scene-music', sceneId: withAudio.currentSceneId },
    } as any);

    expect(sceneOf(assigned).music?.assetId).toBe('theme');
  });
});


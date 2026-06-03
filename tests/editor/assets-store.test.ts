import { describe, expect, it } from 'vitest';
import { initState, reducer } from '../../src/editor/EditorStore';

function sceneOf(state: any) {
  return state.project.scenes[state.currentSceneId];
}

describe('EditorStore assets actions', () => {
  it('adds an image asset and creates an entity referencing it', () => {
    const state = initState();
    const withAsset = reducer(state, { type: 'add-image-asset-from-path', path: '/assets/images/player.png', width: 256, height: 128 } as any);
    expect(withAsset.project.assets.images.player).toBeDefined();

    const withEntity = reducer(withAsset, { type: 'create-entity-from-asset', assetKind: 'image', assetId: 'player', at: { x: 10, y: 20 } } as any);
    const scene = sceneOf(withEntity);
    const ids = Object.keys(scene.entities);
    expect(ids.length).toBe(1);
    const entity = scene.entities[ids[0]];
    expect(entity.x).toBe(10);
    expect(entity.y).toBe(20);
    expect(entity.width).toBe(256);
    expect(entity.height).toBe(128);
    expect(entity.scaleX ?? 1).toBe(1);
    expect(entity.scaleY ?? 1).toBe(1);
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

  it('relinks an asset source while keeping assetId stable', () => {
    const state = initState();
    const withAsset = reducer(state, { type: 'add-image-asset-from-path', path: '/assets/images/player.png', suggestedId: 'player' } as any);
    const withEntity = reducer(withAsset, { type: 'create-entity-from-asset', assetKind: 'image', assetId: 'player' } as any);

    const relinked = reducer(withEntity, {
      type: 'relink-asset-source',
      assetKind: 'image',
      assetId: 'player',
      source: { kind: 'path', path: '/assets/images/player_v2.png' },
    } as any);

    expect(relinked.project.assets.images.player.source).toEqual({ kind: 'path', path: '/assets/images/player_v2.png' });
    const entity = Object.values(sceneOf(relinked).entities)[0] as any;
    expect(entity.asset?.source).toEqual({ kind: 'asset', assetId: 'player' });
  });

  it('does not overwrite an existing image during ensure-image-asset-from-file', () => {
    const state = initState();
    const withExisting = reducer(state, {
      type: 'add-image-asset-from-file',
      file: {
        dataUrl: 'data:image/png;base64,AAAA',
        originalName: 'enemy_A.png',
        mimeType: 'image/png',
        width: 16,
        height: 16,
      },
    } as any);

    const ensured = reducer(withExisting, {
      type: 'ensure-image-asset-from-file',
      assetId: 'enemy-a',
      file: {
        dataUrl: 'data:image/png;base64,BBBB',
        originalName: 'enemy_A.png',
        mimeType: 'image/png',
        width: 32,
        height: 32,
      },
    } as any);

    expect(ensured).toBe(withExisting);
    expect(ensured.project.assets.images['enemy-a'].source).toMatchObject({
      dataUrl: 'data:image/png;base64,AAAA',
    });
  });

  it('reassigns an entity sprite asset without creating a new entity', () => {
    const state = initState();
    const withPlayer = reducer(state, {
      type: 'add-image-asset-from-path',
      path: '/assets/images/player.png',
      suggestedId: 'player',
      width: 32,
      height: 32,
    } as any);
    const withMeteor = reducer(withPlayer, {
      type: 'add-image-asset-from-path',
      path: '/assets/images/meteor.png',
      suggestedId: 'meteor',
      width: 48,
      height: 48,
    } as any);
    const withEntity = reducer(withMeteor, { type: 'create-entity-from-asset', assetKind: 'image', assetId: 'player' } as any);
    const entityId = Object.keys(sceneOf(withEntity).entities)[0];

    const reassigned = reducer(withEntity, {
      type: 'assign-asset-to-target',
      assetKind: 'image',
      assetId: 'meteor',
      target: { kind: 'entity-sprite', sceneId: withEntity.currentSceneId, entityId },
    } as any);

    expect(Object.keys(sceneOf(reassigned).entities)).toEqual([entityId]);
    expect(sceneOf(reassigned).entities[entityId].asset).toMatchObject({
      imageType: 'image',
      source: { kind: 'asset', assetId: 'meteor' },
      frame: { kind: 'single' },
    });
  });
});

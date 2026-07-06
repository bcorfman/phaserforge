import { describe, expect, it } from 'vitest';
import { initState, reducer } from '../../src/editor/EditorStore';

function sceneOf(state: any) {
  return state.project.scenes[state.currentSceneId];
}

describe('EditorStore assets actions', () => {
  it('adds an image asset and creates an entity referencing it', () => {
    const state = initState();
    const withAsset = reducer(state, {
      type: 'add-image-asset-from-file',
      file: {
        dataUrl: 'data:image/png;base64,AAAA',
        originalName: 'player.png',
        mimeType: 'image/png',
        width: 256,
        height: 128,
      },
    } as any);
    expect(withAsset.project.assets.images.player).toBeDefined();

    const withEntity = reducer(withAsset, { type: 'create-entity-from-asset', assetKind: 'image', assetId: 'player', at: { x: 10, y: 20 } } as any);
    const scene = sceneOf(withEntity);
    const ids = Object.keys(scene.entities);
    expect(ids.length).toBe(1);
    const entity = scene.entities[ids[0]];
    expect(entity.x).toBe(10);
    expect(entity.y).toBe(20);
    expect(entity.width).toBe(128);
    expect(entity.height).toBe(64);
    expect(entity.scaleX ?? 1).toBe(1);
    expect(entity.scaleY ?? 1).toBe(1);
    expect(entity.asset?.source).toEqual({ kind: 'asset', assetId: 'player' });
    expect(entity.asset?.imageType).toBe('image');
  });

  it('derives created sprite world size from the project pixels-per-unit setting', () => {
    const state = initState();
    const withScale = reducer(state, {
      type: 'set-project-metadata',
      pixelsPerUnit: 2,
    } as any);
    const withAsset = reducer(withScale, {
      type: 'add-image-asset-from-file',
      file: {
        dataUrl: 'data:image/png;base64,AAAA',
        originalName: 'player.png',
        mimeType: 'image/png',
        width: 256,
        height: 128,
      },
    } as any);

    const withEntity = reducer(withAsset, { type: 'create-entity-from-asset', assetKind: 'image', assetId: 'player', at: { x: 10, y: 20 } } as any);
    const scene = sceneOf(withEntity);
    const ids = Object.keys(scene.entities);
    expect(ids.length).toBe(1);
    const entity = scene.entities[ids[0]];
    expect(entity.width).toBe(128);
    expect(entity.height).toBe(64);
    expect(entity.scaleX ?? 1).toBe(1);
    expect(entity.scaleY ?? 1).toBe(1);
  });

  it('blocks deletion of referenced assets', () => {
    const state = initState();
    const withAsset = reducer(state, {
      type: 'add-image-asset-from-file',
      file: {
        dataUrl: 'data:image/png;base64,AAAA',
        originalName: 'bg.png',
        mimeType: 'image/png',
      },
    } as any);
    const withEntity = reducer(withAsset, { type: 'create-entity-from-asset', assetKind: 'image', assetId: 'bg' } as any);

    const blocked = reducer(withEntity, { type: 'remove-asset', assetKind: 'image', assetId: 'bg' } as any);
    expect(blocked.project.assets.images.bg).toBeDefined();
    expect(blocked.error).toMatch(/Cannot delete image asset/);
  });

  it('assigns audio asset to scene music', () => {
    const state = initState();
    const withAudio = reducer(state, {
      type: 'add-audio-asset-from-file',
      file: {
        dataUrl: 'data:audio/mp3;base64,AAAA',
        originalName: 'theme.mp3',
        mimeType: 'audio/mpeg',
      },
    } as any);
    expect(withAudio.project.audio.sounds.theme).toBeDefined();

    const assigned = reducer(withAudio, {
      type: 'assign-asset-to-target',
      assetKind: 'audio',
      assetId: 'theme',
      target: { kind: 'scene-music', sceneId: withAudio.currentSceneId },
    } as any);

    expect(sceneOf(assigned).music?.assetId).toBe('theme');
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

  it('does not overwrite an existing audio asset during ensure-audio-asset-from-file', () => {
    const state = initState();
    const withExisting = reducer(state, {
      type: 'add-audio-asset-from-file',
      file: {
        dataUrl: 'data:audio/mp3;base64,AAAA',
        originalName: 'theme.mp3',
        mimeType: 'audio/mpeg',
      },
    } as any);

    const ensured = reducer(withExisting, {
      type: 'ensure-audio-asset-from-file',
      assetId: 'theme',
      file: {
        dataUrl: 'data:audio/mp3;base64,BBBB',
        originalName: 'theme.mp3',
        mimeType: 'audio/mpeg',
      },
    } as any);

    expect(ensured).toBe(withExisting);
    expect(ensured.project.audio.sounds.theme.source).toMatchObject({
      dataUrl: 'data:audio/mp3;base64,AAAA',
    });
  });

  it('does not overwrite an existing font asset during ensure-font-asset-from-file', () => {
    const state = initState();
    const withExisting = reducer(state, {
      type: 'add-font-asset-from-file',
      file: {
        dataUrl: 'data:font/woff2;base64,AAAA',
        originalName: 'Arcade.woff2',
        mimeType: 'font/woff2',
      },
    } as any);

    const ensured = reducer(withExisting, {
      type: 'ensure-font-asset-from-file',
      assetId: 'arcade',
      file: {
        dataUrl: 'data:font/woff2;base64,BBBB',
        originalName: 'Arcade.woff2',
        mimeType: 'font/woff2',
      },
    } as any);

    expect(ensured).toBe(withExisting);
    expect(ensured.project.assets.fonts.arcade.source).toMatchObject({
      dataUrl: 'data:font/woff2;base64,AAAA',
    });
  });

  it('imports demo pack assets as path-backed library entries and is idempotent', () => {
    const state = initState();
    const action = {
      type: 'import-demo-pack-assets',
      entries: [
        {
          kind: 'image',
          assetId: 'enemy-a',
          path: 'assets/demo-pack/images/enemy_A.png',
          originalName: 'enemy_A.png',
          mimeType: 'image/png',
          width: 64,
          height: 64,
        },
        {
          kind: 'audio',
          assetId: 'theme',
          path: 'assets/demo-pack/audio/Simulacra-chosic.com_.mp3',
          originalName: 'Simulacra-chosic.com_.mp3',
          mimeType: 'audio/mpeg',
        },
        {
          kind: 'font',
          assetId: 'arcade',
          path: 'assets/demo-pack/fonts/Arcade.woff2',
          originalName: 'Arcade.woff2',
          mimeType: 'font/woff2',
        },
      ],
    } as any;

    const imported = reducer(state, action);

    expect(imported.project.assets.images['enemy-a']).toMatchObject({
      id: 'enemy-a',
      width: 64,
      height: 64,
      source: {
        kind: 'path',
        path: 'assets/demo-pack/images/enemy_A.png',
        originalName: 'enemy_A.png',
        mimeType: 'image/png',
      },
    });
    expect(imported.project.audio.sounds.theme.source).toMatchObject({
      kind: 'path',
      path: 'assets/demo-pack/audio/Simulacra-chosic.com_.mp3',
    });
    expect(imported.project.assets.fonts.arcade.source).toMatchObject({
      kind: 'path',
      path: 'assets/demo-pack/fonts/Arcade.woff2',
    });

    const reimported = reducer(imported, action);
    expect(reimported).toBe(imported);
  });

  it('reassigns an entity sprite asset without creating a new entity', () => {
    const state = initState();
    const withPlayer = reducer(state, {
      type: 'add-image-asset-from-file',
      file: {
        dataUrl: 'data:image/png;base64,AAAA',
        originalName: 'player.png',
        mimeType: 'image/png',
        width: 32,
        height: 32,
      },
    } as any);
    const withMeteor = reducer(withPlayer, {
      type: 'add-image-asset-from-file',
      file: {
        dataUrl: 'data:image/png;base64,BBBB',
        originalName: 'meteor.png',
        mimeType: 'image/png',
        width: 48,
        height: 48,
      },
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

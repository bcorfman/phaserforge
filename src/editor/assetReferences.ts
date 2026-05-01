import type { GameSceneSpec, Id, ProjectSpec } from '../model/types';

export type AssetKind = 'image' | 'spritesheet' | 'audio' | 'font';

export type AssetReferenceLocation =
  | { kind: 'background-layer'; sceneId: Id; index: number }
  | { kind: 'scene-music'; sceneId: Id }
  | { kind: 'scene-ambience'; sceneId: Id; index: number }
  | { kind: 'entity-sprite'; sceneId: Id; entityId: Id };

export function getAssetReferences(
  project: ProjectSpec,
  assetKind: AssetKind,
  assetId: Id
): { count: number; locations: AssetReferenceLocation[] } {
  const locations: AssetReferenceLocation[] = [];

  for (const [sceneId, scene] of Object.entries(project.scenes)) {
    const typedScene = scene as GameSceneSpec;

    if (assetKind === 'image') {
      const layers = typedScene.backgroundLayers ?? [];
      layers.forEach((layer, index) => {
        if (layer.assetId === assetId) locations.push({ kind: 'background-layer', sceneId, index });
      });
    }

    if (assetKind === 'audio') {
      if (typedScene.music?.assetId === assetId) {
        locations.push({ kind: 'scene-music', sceneId });
      }
      (typedScene.ambience ?? []).forEach((entry, index) => {
        if (entry.assetId === assetId) locations.push({ kind: 'scene-ambience', sceneId, index });
      });
    }

    if (assetKind === 'image' || assetKind === 'spritesheet') {
      for (const [entityId, entity] of Object.entries(typedScene.entities ?? {})) {
        const sprite = entity.asset;
        if (!sprite) continue;
        if (sprite.source?.kind !== 'asset') continue;
        if (sprite.source.assetId !== assetId) continue;
        if (assetKind === 'image' && sprite.imageType !== 'image') continue;
        if (assetKind === 'spritesheet' && sprite.imageType !== 'spritesheet') continue;
        locations.push({ kind: 'entity-sprite', sceneId, entityId });
      }
    }
  }

  return { count: locations.length, locations };
}


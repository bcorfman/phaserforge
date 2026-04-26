import type { GameSceneSpec, ProjectSpec } from './types';
import { createEmptyScene } from './emptyScene';

export function createEmptyGameScene(sceneId: string = 'scene-1'): GameSceneSpec {
  const base = createEmptyScene();
  return {
    ...base,
    id: sceneId,
    backgroundLayers: [],
    collisionRules: [],
    triggers: [],
  };
}

export function createEmptyProject(): ProjectSpec {
  const scene = createEmptyGameScene('scene-1');
  return {
    id: 'project-1',
    assets: { images: {}, spriteSheets: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: { [scene.id]: scene },
    initialSceneId: scene.id,
  };
}

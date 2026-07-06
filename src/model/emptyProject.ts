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
    pixelsPerUnit: 2,
    renderMode: 'smooth-2d',
    assets: { images: {}, spriteSheets: {}, fonts: {} },
    audio: { sounds: {} },
    inputMaps: {},
    collections: {},
    counters: {},
    scenes: { [scene.id]: scene },
    initialSceneId: scene.id,
  };
}

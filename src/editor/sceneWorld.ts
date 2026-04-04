import { type SceneSpec, type WorldSpec } from '../model/types';

export const DEFAULT_WORLD: WorldSpec = {
  width: 1024,
  height: 768,
};

export function getSceneWorld(scene: SceneSpec): WorldSpec {
  return scene.world ?? DEFAULT_WORLD;
}

import type { ProjectSpec } from './types';
import { sampleScene } from './sampleScene';

export const sampleProject: ProjectSpec = {
  id: 'project-1',
  assets: { images: {}, spriteSheets: {}, fonts: {} },
  audio: { sounds: {} },
  inputMaps: {},
  scenes: {
    [sampleScene.id]: { ...sampleScene, backgroundLayers: [] },
  },
  initialSceneId: sampleScene.id,
};

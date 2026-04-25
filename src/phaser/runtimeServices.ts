import type { RuntimeServices, SceneTransition } from '../runtime/services/RuntimeServices';
import type { BootScene } from './BootScene';

export function createRuntimeServices(boot: BootScene): RuntimeServices {
  return {
    scene: {
      goto: (sceneId: string, options?: { transition?: SceneTransition; durationMs?: number }) => {
        boot.requestSceneGoto(sceneId, {
          transition: options?.transition,
          durationMs: options?.durationMs,
        });
      },
    },
    audio: {},
    input: {},
    collisions: {},
    vars: {},
  };
}


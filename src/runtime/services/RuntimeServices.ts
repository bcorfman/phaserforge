import type { GameSceneSpec, ProjectSpec } from '../../model/types';

export type SceneTransition = 'none' | 'fade';

export interface SceneService {
  goto(sceneId: string, options?: { transition?: SceneTransition; durationMs?: number }): void;
}

export interface AudioService {
  playMusic(assetId: string, options?: { loop?: boolean; volume?: number; fadeMs?: number }): void;
  stopMusic(options?: { fadeMs?: number }): void;
  playSfx(assetId: string, options?: { volume?: number }): void;
  applySceneAudio(scene: Pick<GameSceneSpec, 'music' | 'ambience'>, project: Pick<ProjectSpec, 'audio'>): void;
  getSnapshot(): { musicAssetId?: string; ambienceAssetIds: string[] };
  stopAll(): void;
}
export interface InputService {}
export interface CollisionService {}
export interface VarsService {}

export interface RuntimeServices {
  scene: SceneService;
  audio: AudioService;
  input: InputService;
  collisions: CollisionService;
  vars: VarsService;
}

export function createStubRuntimeServices(overrides: Partial<RuntimeServices> = {}): RuntimeServices {
  const stub: RuntimeServices = {
    scene: {
      goto: (sceneId) => {
        console.warn(`[phaseractions] SceneService.goto stub invoked (sceneId=${sceneId})`);
      },
    },
    audio: {
      playMusic: (assetId) => console.warn(`[phaseractions] AudioService.playMusic stub invoked (assetId=${assetId})`),
      stopMusic: () => console.warn('[phaseractions] AudioService.stopMusic stub invoked'),
      playSfx: (assetId) => console.warn(`[phaseractions] AudioService.playSfx stub invoked (assetId=${assetId})`),
      applySceneAudio: () => console.warn('[phaseractions] AudioService.applySceneAudio stub invoked'),
      getSnapshot: () => ({ musicAssetId: undefined, ambienceAssetIds: [] }),
      stopAll: () => console.warn('[phaseractions] AudioService.stopAll stub invoked'),
    },
    input: {},
    collisions: {},
    vars: {},
  };
  return { ...stub, ...overrides };
}

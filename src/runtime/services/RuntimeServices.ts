export type SceneTransition = 'none' | 'fade';

export interface SceneService {
  goto(sceneId: string, options?: { transition?: SceneTransition; durationMs?: number }): void;
}

export interface AudioService {}
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
    audio: {},
    input: {},
    collisions: {},
    vars: {},
  };
  return { ...stub, ...overrides };
}


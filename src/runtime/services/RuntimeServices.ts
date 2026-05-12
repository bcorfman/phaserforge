import type { GameSceneSpec, ProjectSpec } from '../../model/types';
import type { InputActionMapSpec } from '../../model/types';
import type { InputActionState } from './BasicInputService';

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
export interface InputService {
  setActiveMaps(maps: InputActionMapSpec[]): void;
  handleKeyDown(event: { code: string; key?: string }): void;
  handleKeyUp(event: { code: string; key?: string }): void;
  handleMouseDown(button: number): void;
  handleMouseUp(button: number): void;
  update(): void;
  getActionState(actionId: string): InputActionState;
  getSnapshot(): unknown;
}
export interface CollisionService {}
export interface VarsService {
  getCounter(id: string): number;
  setCounter(id: string, value: number): void;
  addToCounter(id: string, delta: number): number;
  clampCounter(id: string, clamp: { min?: number; max?: number }): number;

  getCollectionMembers(id: string): Array<{ type: 'entity' | 'group'; entityId?: string; groupId?: string }>;
  setCollectionMembers(id: string, members: Array<{ type: 'entity' | 'group'; entityId?: string; groupId?: string }>): void;
  addToCollection(id: string, member: { type: 'entity' | 'group'; entityId?: string; groupId?: string }): void;
  removeFromCollection(id: string, member: { type: 'entity' | 'group'; entityId?: string; groupId?: string }): void;
}

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
    input: {
      setActiveMaps: () => console.warn('[phaseractions] InputService.setActiveMaps stub invoked'),
      handleKeyDown: () => console.warn('[phaseractions] InputService.handleKeyDown stub invoked'),
      handleKeyUp: () => console.warn('[phaseractions] InputService.handleKeyUp stub invoked'),
      handleMouseDown: () => console.warn('[phaseractions] InputService.handleMouseDown stub invoked'),
      handleMouseUp: () => console.warn('[phaseractions] InputService.handleMouseUp stub invoked'),
      update: () => console.warn('[phaseractions] InputService.update stub invoked'),
      getActionState: () => ({ pressed: false, held: false, released: false }),
      getSnapshot: () => ({}),
    },
    collisions: {},
    vars: {
      getCounter: () => 0,
      setCounter: () => {},
      addToCounter: () => 0,
      clampCounter: () => 0,
      getCollectionMembers: () => [],
      setCollectionMembers: () => {},
      addToCollection: () => {},
      removeFromCollection: () => {},
    },
  };
  return { ...stub, ...overrides };
}

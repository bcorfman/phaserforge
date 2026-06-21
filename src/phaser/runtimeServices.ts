import type { RuntimeServices, SceneTransition } from '../runtime/services/RuntimeServices';
import type { BootScene } from './BootScene';
import type { GameScene } from './GameScene';
import { BasicVarsService } from '../runtime/services/BasicVarsService';

export function createRuntimeServices(boot: BootScene): RuntimeServices {
  const fallbackVarsService = new BasicVarsService();
  const getGameScene = (): GameScene | null => {
    try {
      return boot.scene.get('GameScene') as GameScene;
    } catch {
      return null;
    }
  };
  return {
    scene: {
      goto: (sceneId: string, options?: { transition?: SceneTransition; durationMs?: number }) => {
        boot.requestSceneGoto(sceneId, {
          transition: options?.transition,
          durationMs: options?.durationMs,
        });
      },
    },
    audio: {
      playMusic: (assetId, options) => getGameScene()?.playMusic(assetId, options),
      stopMusic: (options) => getGameScene()?.stopMusic(options),
      playSfx: (assetId, options) => getGameScene()?.playSfx(assetId, options),
      applySceneAudio: (scene, project) => getGameScene()?.applySceneAudio(scene as any, project as any),
      getSnapshot: () => getGameScene()?.getAudioSnapshot() ?? { musicAssetId: undefined, ambienceAssetIds: [] },
      stopAll: () => getGameScene()?.stopAllAudio(),
    },
    input: {
      setActiveMaps: (maps) => getGameScene()?.setActiveInputMaps(maps as any),
      handleKeyDown: (event) => {
        // Runtime owns input wiring; this exists primarily for tests/ops parity.
        void event;
      },
      handleKeyUp: (event) => {
        void event;
      },
      handleMouseDown: (button) => {
        void button;
      },
      handleMouseUp: (button) => {
        void button;
      },
      update: () => {
        // GameScene calls update() each frame.
      },
      getActionState: (actionId) => getGameScene()?.getInputActionState(actionId) ?? { pressed: false, held: false, released: false },
      getSnapshot: () => getGameScene()?.getInputSnapshot() ?? {},
    },
    collisions: {},
    vars: {
      getCounter: (id) => getGameScene()?.getVarsService().getCounter(id) ?? fallbackVarsService.getCounter(id),
      setCounter: (id, value) => {
        (getGameScene()?.getVarsService() ?? fallbackVarsService).setCounter(id, value);
      },
      addToCounter: (id, delta) => (getGameScene()?.getVarsService() ?? fallbackVarsService).addToCounter(id, delta),
      clampCounter: (id, clamp) => (getGameScene()?.getVarsService() ?? fallbackVarsService).clampCounter(id, clamp),
      getCollectionMembers: (id) => (getGameScene()?.getVarsService() ?? fallbackVarsService).getCollectionMembers(id),
      setCollectionMembers: (id, members) => {
        (getGameScene()?.getVarsService() ?? fallbackVarsService).setCollectionMembers(id, members);
      },
      addToCollection: (id, member) => {
        (getGameScene()?.getVarsService() ?? fallbackVarsService).addToCollection(id, member);
      },
      removeFromCollection: (id, member) => {
        (getGameScene()?.getVarsService() ?? fallbackVarsService).removeFromCollection(id, member);
      },
    },
  };
}

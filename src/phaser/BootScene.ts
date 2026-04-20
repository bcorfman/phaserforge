import Phaser from 'phaser';
import { EventBus } from './EventBus';
import { EditorScene } from './EditorScene';
import { GameScene } from './GameScene';
import type { SceneSpec } from '../model/types';

export class BootScene extends Phaser.Scene {
  private last?: { scene: SceneSpec; mode: 'edit' | 'play' };

  constructor() {
    super('BootScene');
  }

  create(): void {
    EventBus.on('load-scene', this.handleLoadScene, this);

    // Start in editor mode so the app can emit `current-scene-ready` and then provide scene data.
    if (!this.scene.isActive('EditorScene') && !this.scene.isSleeping('EditorScene')) {
      this.scene.launch('EditorScene');
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('load-scene', this.handleLoadScene, this);
    });
  }

  private handleLoadScene(scene: SceneSpec, mode: 'edit' | 'play' = 'edit'): void {
    this.last = { scene, mode };

    if (mode === 'edit') {
      if (this.scene.isActive('GameScene') || this.scene.isSleeping('GameScene')) {
        this.scene.stop('GameScene');
      }
      if (!this.scene.isActive('EditorScene') && !this.scene.isSleeping('EditorScene')) {
        this.scene.launch('EditorScene');
      }
      const editor = this.scene.get('EditorScene') as EditorScene;
      editor.loadSceneSpec(scene);
      return;
    }

    if (this.scene.isActive('EditorScene') || this.scene.isSleeping('EditorScene')) {
      this.scene.stop('EditorScene');
    }
    if (!this.scene.isActive('GameScene') && !this.scene.isSleeping('GameScene')) {
      this.scene.launch('GameScene');
    }
    const game = this.scene.get('GameScene') as GameScene;
    game.loadSceneSpec(scene);
  }
}


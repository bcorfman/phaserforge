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

  private loadIntoEditorScene(scene: SceneSpec): void {
    const editor = this.scene.get('EditorScene') as EditorScene;
    const isRunning = this.scene.isActive('EditorScene') || this.scene.isSleeping('EditorScene');
    if (isRunning) {
      editor.loadSceneSpec(scene);
      return;
    }

    editor.events.once(Phaser.Scenes.Events.CREATE, () => {
      editor.loadSceneSpec(scene);
    });
    this.scene.launch('EditorScene');
  }

  private loadIntoGameScene(scene: SceneSpec): void {
    const game = this.scene.get('GameScene') as GameScene;
    const isRunning = this.scene.isActive('GameScene') || this.scene.isSleeping('GameScene');
    if (isRunning) {
      game.loadSceneSpec(scene);
      return;
    }

    game.events.once(Phaser.Scenes.Events.CREATE, () => {
      game.loadSceneSpec(scene);
    });
    this.scene.launch('GameScene');
  }

  private handleLoadScene(scene: SceneSpec, mode: 'edit' | 'play' = 'edit'): void {
    this.last = { scene, mode };

    if (mode === 'edit') {
      if (this.scene.isActive('GameScene') || this.scene.isSleeping('GameScene')) {
        this.scene.stop('GameScene');
      }
      this.loadIntoEditorScene(scene);
      return;
    }

    if (this.scene.isActive('EditorScene') || this.scene.isSleeping('EditorScene')) {
      this.scene.stop('EditorScene');
    }
    this.loadIntoGameScene(scene);
  }
}

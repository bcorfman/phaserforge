import * as Phaser from 'phaser';
import { EventBus } from './EventBus';
import { EditorScene } from './EditorScene';
import { GameScene } from './GameScene';
import type { SceneSpec } from '../model/types';

export class BootScene extends Phaser.Scene {
  private last?: { scene: SceneSpec; mode: 'edit' | 'play' };
  private lastViewState?: { zoom: number; scrollX: number; scrollY: number };

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
      editor.setPendingViewState(this.lastViewState);
      editor.loadSceneSpec(scene);
      return;
    }

    editor.events.once(Phaser.Scenes.Events.CREATE, () => {
      editor.setPendingViewState(this.lastViewState);
      editor.loadSceneSpec(scene);
    });
    this.scene.launch('EditorScene');
  }

  private loadIntoGameScene(scene: SceneSpec): void {
    const game = this.scene.get('GameScene') as GameScene;
    const isRunning = this.scene.isActive('GameScene') || this.scene.isSleeping('GameScene');
    if (isRunning) {
      game.setPendingViewState(this.lastViewState);
      game.loadSceneSpec(scene);
      return;
    }

    game.events.once(Phaser.Scenes.Events.CREATE, () => {
      game.setPendingViewState(this.lastViewState);
      game.loadSceneSpec(scene);
    });
    this.scene.launch('GameScene');
  }

  private handleLoadScene(scene: SceneSpec, mode: 'edit' | 'play' = 'edit'): void {
    const isModeSwitch = Boolean(this.last && this.last.mode !== mode);
    this.last = { scene, mode };

    if (mode === 'edit') {
      if (this.scene.isActive('GameScene') || this.scene.isSleeping('GameScene')) {
        if (isModeSwitch) {
          const game = this.scene.get('GameScene') as GameScene;
          this.lastViewState = game.getViewState();
        }
        this.scene.stop('GameScene');
      }
      this.loadIntoEditorScene(scene);
      return;
    }

    if (this.scene.isActive('EditorScene') || this.scene.isSleeping('EditorScene')) {
      if (isModeSwitch) {
        const editor = this.scene.get('EditorScene') as EditorScene;
        this.lastViewState = editor.getViewState();
      }
      this.scene.stop('EditorScene');
    }
    this.loadIntoGameScene(scene);
  }
}

import * as Phaser from 'phaser';
import { EventBus } from './EventBus';
import { EditorScene } from './EditorScene';
import { GameScene } from './GameScene';
import type { ProjectSpec, SceneSpec } from '../model/types';

export class BootScene extends Phaser.Scene {
  private project?: ProjectSpec;
  private currentSceneId?: string;
  private mode: 'edit' | 'play' = 'edit';
  private lastViewState?: { zoom: number; scrollX: number; scrollY: number };

  constructor() {
    super('BootScene');
  }

  create(): void {
    EventBus.on('runtime:load-project', this.handleLoadProject, this);
    EventBus.on('runtime:set-mode', this.handleSetMode, this);
    EventBus.on('runtime:set-active-scene', this.handleSetActiveScene, this);

    // Start in editor mode so the app can emit `current-scene-ready` and then provide scene data.
    if (!this.scene.isActive('EditorScene') && !this.scene.isSleeping('EditorScene')) {
      this.scene.launch('EditorScene');
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('runtime:load-project', this.handleLoadProject, this);
      EventBus.off('runtime:set-mode', this.handleSetMode, this);
      EventBus.off('runtime:set-active-scene', this.handleSetActiveScene, this);
    });
  }

  private resolveSceneSpec(project: ProjectSpec, sceneId: string | undefined): SceneSpec {
    if (sceneId && project.scenes[sceneId]) return project.scenes[sceneId];
    if (project.scenes[project.initialSceneId]) return project.scenes[project.initialSceneId];
    const first = Object.values(project.scenes)[0];
    if (!first) throw new Error('Project must contain at least one scene');
    return first;
  }

  private loadIntoEditorScene(scene: SceneSpec): void {
    const editor = this.scene.get('EditorScene') as EditorScene;
    const isRunning = this.scene.isActive('EditorScene') || this.scene.isSleeping('EditorScene');
    if (isRunning) {
      editor.setPendingViewState(this.lastViewState);
      editor.loadSceneSpec(scene);
      this.scene.wake('EditorScene');
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
      this.scene.wake('GameScene');
      return;
    }

    game.events.once(Phaser.Scenes.Events.CREATE, () => {
      game.setPendingViewState(this.lastViewState);
      game.loadSceneSpec(scene);
    });
    this.scene.launch('GameScene');
  }

  private syncActiveScene(): void {
    if (!this.project) return;
    const sceneSpec = this.resolveSceneSpec(this.project, this.currentSceneId);
    this.currentSceneId = sceneSpec.id;

    if (this.mode === 'edit') {
      if (this.scene.isActive('GameScene')) this.scene.sleep('GameScene');
      this.loadIntoEditorScene(sceneSpec);
      return;
    }

    if (this.scene.isActive('EditorScene')) this.scene.sleep('EditorScene');
    this.loadIntoGameScene(sceneSpec);
  }

  private captureViewStateForModeSwitch(nextMode: 'edit' | 'play'): void {
    if (this.mode === nextMode) return;
    if (nextMode === 'edit') {
      if (this.scene.isActive('GameScene') || this.scene.isSleeping('GameScene')) {
        const game = this.scene.get('GameScene') as GameScene;
        this.lastViewState = game.getViewState();
      }
      return;
    }

    if (this.scene.isActive('EditorScene') || this.scene.isSleeping('EditorScene')) {
      const editor = this.scene.get('EditorScene') as EditorScene;
      this.lastViewState = editor.getViewState();
    }
  }

  private handleLoadProject(project: ProjectSpec, currentSceneId: string, mode: 'edit' | 'play' = 'edit'): void {
    this.project = project;
    this.currentSceneId = currentSceneId;
    this.captureViewStateForModeSwitch(mode);
    this.mode = mode;
    this.syncActiveScene();
  }

  private handleSetMode(mode: 'edit' | 'play'): void {
    if (!this.project) return;
    this.captureViewStateForModeSwitch(mode);
    this.mode = mode;
    this.syncActiveScene();
  }

  private handleSetActiveScene(sceneId: string): void {
    if (!this.project) return;
    this.currentSceneId = sceneId;
    this.syncActiveScene();
  }
}

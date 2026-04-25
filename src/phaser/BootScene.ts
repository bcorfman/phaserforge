import * as Phaser from 'phaser';
import { EventBus } from './EventBus';
import { EditorScene } from './EditorScene';
import { GameScene } from './GameScene';
import type { ProjectSpec, SceneSpec } from '../model/types';
import { OpRegistry } from '../compiler/opRegistry';
import { createRuntimeServices } from './runtimeServices';
import type { RuntimeServices } from '../runtime/services/RuntimeServices';
import { resolveTarget, flattenTarget } from '../runtime/targets/resolveTarget';

export class BootScene extends Phaser.Scene {
  private project?: ProjectSpec;
  private authoredSceneId?: string;
  private runtimeSceneId?: string;
  private playStartSceneId?: string;
  private mode: 'edit' | 'play' = 'edit';
  private lastViewState?: { zoom: number; scrollX: number; scrollY: number };
  private gotoVersion = 0;
  private services: RuntimeServices;
  private opRegistry: OpRegistry;

  constructor() {
    super('BootScene');
    this.services = createRuntimeServices(this);
    this.opRegistry = new OpRegistry();
    this.registerBuiltInOps(this.opRegistry);
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

  private registerBuiltInOps(registry: OpRegistry): void {
    registry.register('scene.goto', (action) => {
      const args = (action as any).args ?? {};
      const sceneId = typeof args.sceneId === 'string' ? args.sceneId : '';
      if (!sceneId) {
        console.warn('[phaseractions] scene.goto missing sceneId');
        return;
      }
      const transitionRaw = typeof args.transition === 'string' ? args.transition : 'fade';
      const transition = transitionRaw === 'none' || transitionRaw === 'fade' ? transitionRaw : 'fade';
      const durationRaw = typeof args.durationMs === 'number' ? args.durationMs : Number(args.durationMs);
      const durationMs = Number.isFinite(durationRaw) ? Math.max(0, durationRaw) : 350;
      this.services.scene.goto(sceneId, { transition, durationMs });
    });

    // Sample/demo op used by sample scenes and docs.
    registry.register('drop', (action, ctx) => {
      const dy = (action as any).args?.dy ?? 0;
      const target = (action as any).target;
      if (!target) return;
      const resolved = resolveTarget(target, ctx.targets);
      const targets = flattenTarget(resolved);
      for (const t of targets) {
        t.y += dy;
      }
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
    const project = this.project;
    if (!project) return;
    editor.setRuntimeOps(this.opRegistry);
    if (isRunning) {
      editor.setPendingViewState(this.lastViewState);
      editor.loadSceneSpec(project, scene);
      this.scene.wake('EditorScene');
      return;
    }

    editor.events.once(Phaser.Scenes.Events.CREATE, () => {
      editor.setRuntimeOps(this.opRegistry);
      editor.setPendingViewState(this.lastViewState);
      editor.loadSceneSpec(project, scene);
    });
    this.scene.launch('EditorScene');
  }

  private loadIntoGameScene(scene: SceneSpec): void {
    const game = this.scene.get('GameScene') as GameScene;
    const isRunning = this.scene.isActive('GameScene') || this.scene.isSleeping('GameScene');
    const project = this.project;
    if (!project) return;
    game.setRuntimeOps(this.opRegistry);
    if (isRunning) {
      game.setPendingViewState(this.lastViewState);
      game.loadSceneSpec(project, scene);
      this.scene.wake('GameScene');
      return;
    }

    game.events.once(Phaser.Scenes.Events.CREATE, () => {
      game.setRuntimeOps(this.opRegistry);
      game.setPendingViewState(this.lastViewState);
      game.loadSceneSpec(project, scene);
    });
    this.scene.launch('GameScene');
  }

  private syncActiveScene(): void {
    if (!this.project) return;
    const activeSceneId = this.mode === 'play' ? (this.runtimeSceneId ?? this.authoredSceneId) : this.authoredSceneId;
    const sceneSpec = this.resolveSceneSpec(this.project, activeSceneId);
    this.runtimeSceneId = sceneSpec.id;
    if (!this.authoredSceneId) this.authoredSceneId = sceneSpec.id;

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
    this.authoredSceneId = currentSceneId;
    this.runtimeSceneId = currentSceneId;
    this.captureViewStateForModeSwitch(mode);
    this.mode = mode;
    this.playStartSceneId = mode === 'play' ? currentSceneId : undefined;
    this.syncActiveScene();
  }

  private handleSetMode(mode: 'edit' | 'play'): void {
    if (!this.project) return;
    this.captureViewStateForModeSwitch(mode);
    if (mode === 'play') {
      this.playStartSceneId = this.authoredSceneId ?? this.runtimeSceneId;
      if (this.playStartSceneId) this.runtimeSceneId = this.playStartSceneId;
    } else {
      this.playStartSceneId = undefined;
      if (this.authoredSceneId) this.runtimeSceneId = this.authoredSceneId;
    }
    this.mode = mode;
    this.syncActiveScene();
  }

  private handleSetActiveScene(sceneId: string): void {
    if (!this.project) return;
    this.authoredSceneId = sceneId;
    if (this.mode === 'play' && !this.playStartSceneId) this.playStartSceneId = sceneId;
    this.runtimeSceneId = sceneId;
    this.syncActiveScene();
  }

  public requestSceneGoto(sceneId: string, options?: { transition?: unknown; durationMs?: unknown }): void {
    if (!this.project) return;
    if (this.mode !== 'play') return;

    if (!sceneId) {
      console.warn('[phaseractions] scene.goto missing sceneId');
      return;
    }
    if (!this.project.scenes[sceneId]) {
      console.warn(`[phaseractions] scene.goto target scene not found: ${sceneId}`);
      return;
    }

    const transitionRaw = typeof options?.transition === 'string' ? options?.transition : 'fade';
    const transition = transitionRaw === 'none' || transitionRaw === 'fade' ? transitionRaw : 'fade';
    const durationRaw = typeof options?.durationMs === 'number' ? options?.durationMs : Number(options?.durationMs);
    const durationMs = Number.isFinite(durationRaw) ? Math.max(0, durationRaw) : 350;

    const game = this.scene.get('GameScene') as GameScene;
    const isRunning = this.scene.isActive('GameScene') || this.scene.isSleeping('GameScene');
    const view = isRunning ? game.getViewState() : this.lastViewState;
    const version = ++this.gotoVersion;

    const switchScene = () => {
      if (version !== this.gotoVersion) return;
      this.runtimeSceneId = sceneId;
      if (view) game.setPendingViewState(view);
      this.loadIntoGameScene(this.project!.scenes[sceneId]);
    };

    if (!isRunning || transition === 'none' || durationMs <= 0) {
      switchScene();
      return;
    }

    const fadeOutMs = Math.floor(durationMs / 2);
    const fadeInMs = Math.max(0, durationMs - fadeOutMs);
    const camera = game.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (version !== this.gotoVersion) return;
      switchScene();
      camera.fadeIn(fadeInMs, 0, 0, 0);
    });
    camera.fadeOut(fadeOutMs, 0, 0, 0);
  }
}

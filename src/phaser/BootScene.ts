import * as Phaser from 'phaser';
import { EventBus } from './EventBus';
import { setPendingRuntimeRequestedSceneId } from './pendingRuntimeRequest';
import { EditorScene } from './EditorScene';
import { GameScene } from './GameScene';
import type { ProjectSpec, SceneSpec } from '../model/types';
import { OpRegistry } from '../compiler/opRegistry';
import { createRuntimeServices } from './runtimeServices';
import { shouldPreserveViewStateOnProjectLoad } from './projectLoadViewState';
import type { RuntimeServices } from '../runtime/services/RuntimeServices';
import { resolveTarget, flattenTarget } from '../runtime/targets/resolveTarget';
import type { ViewState } from '../util/viewStateStorage';

export class BootScene extends Phaser.Scene {
  private project?: ProjectSpec;
  private authoredSceneId?: string;
  private runtimeSceneId?: string;
  private playStartSceneId?: string;
  private mode: 'edit' | 'play' = 'edit';
  private lastViewState?: ViewState;
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
        console.warn('[phaserforge] scene.goto missing sceneId');
        return;
      }
      const transitionRaw = typeof args.transition === 'string' ? args.transition : 'fade';
      const transition = transitionRaw === 'none' || transitionRaw === 'fade' ? transitionRaw : 'fade';
      const durationRaw = typeof args.durationMs === 'number' ? args.durationMs : Number(args.durationMs);
      const durationMs = Number.isFinite(durationRaw) ? Math.max(0, durationRaw) : 350;
      this.services.scene.goto(sceneId, { transition, durationMs });
    });

    registry.register('scene.gotoWave', (action) => {
      const project = this.project;
      if (!project) return;
      // `scene.gotoWave` is meant for the runtime (GameScene) path. During scene recreate/startup,
      // there is a brief window where BootScene is already in play mode but Phaser has not yet marked
      // GameScene as active/sleeping again. Accept either signal so startup-time wave switches are not lost.
      const gameRunning = this.scene.isActive('GameScene') || this.scene.isSleeping('GameScene');
      if (!gameRunning && this.mode !== 'play') return;

      const args = (action as any).args ?? {};
      const sceneId = typeof args.sceneId === 'string' ? args.sceneId : '';
      if (!sceneId) {
        console.warn('[phaserforge] scene.gotoWave missing sceneId');
        return;
      }
      if (!project.scenes[sceneId]) {
        console.warn(`[phaserforge] scene.gotoWave target scene not found: ${sceneId}`);
        return;
      }

      setPendingRuntimeRequestedSceneId(sceneId);
      EventBus.emit('runtime-request-scene', { sceneId });
    });

    registry.register('audio.play_sfx', (action) => {
      const args = (action as any).args ?? {};
      const assetId = typeof args.assetId === 'string' ? args.assetId : '';
      if (!assetId) {
        console.warn('[phaserforge] audio.play_sfx missing assetId');
        return;
      }
      const volumeRaw = typeof args.volume === 'number' ? args.volume : Number(args.volume);
      const volume = Number.isFinite(volumeRaw) ? Math.max(0, Math.min(1, volumeRaw)) : undefined;
      this.services.audio.playSfx(assetId, volume == null ? undefined : { volume });
    });

    registry.register('entity.destroy', (action, ctx) => {
      const args = (action as any).args ?? {};
      const explicitId = typeof args.entityId === 'string' ? args.entityId : '';
      const target = (action as any).target ?? (explicitId ? { type: 'entity', entityId: explicitId } : undefined);
      if (!target) {
        console.warn('[phaserforge] entity.destroy missing target');
        return;
      }
      const resolved = resolveTarget(target, ctx.targets);
      const targets = flattenTarget(resolved);
      for (const t of targets) {
        (t as any).destroyed = true;
        (t as any).visible = false;
        (t as any).vx = 0;
        (t as any).vy = 0;
        if ((t as any).body) (t as any).body.enabled = false;
        if ((t as any).collision) (t as any).collision.enabled = false;
      }
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

  private captureViewStateForProjectReload(mode: 'edit' | 'play'): void {
    try {
      // Some browsers (notably WebKit) can transiently mark scenes as neither active nor sleeping
      // during drag/drop or focus transitions. Prefer a best-effort capture if the scene exists.
      if (mode === 'edit') {
        const editor = this.scene.get('EditorScene') as unknown as { getViewState?: () => any } | undefined;
        if (editor?.getViewState) this.lastViewState = editor.getViewState();
        return;
      }
      const game = this.scene.get('GameScene') as unknown as { getViewState?: () => any } | undefined;
      if (game?.getViewState) this.lastViewState = game.getViewState();
    } catch {
      // ignore view capture errors (scene may not be ready yet)
    }
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
    const baseId = project.baseSceneId;
    const baseScene = baseId && project.scenes[baseId] ? project.scenes[baseId] : undefined;
    const bundle = baseScene && baseScene.id !== scene.id ? { active: scene, reference: baseScene } : scene;
    if (isRunning) {
      editor.setPendingViewState(this.lastViewState);
      editor.loadSceneSpec(project, bundle as any);
      this.scene.wake('EditorScene');
      return;
    }

    editor.events.once(Phaser.Scenes.Events.CREATE, () => {
      editor.setRuntimeOps(this.opRegistry);
      editor.setPendingViewState(this.lastViewState);
      editor.loadSceneSpec(project, bundle as any);
    });
    this.scene.launch('EditorScene');
  }

  private loadIntoGameScene(scene: SceneSpec): void {
    const game = this.scene.get('GameScene') as GameScene;
    const isRunning = this.scene.isActive('GameScene') || this.scene.isSleeping('GameScene');
    const project = this.project;
    if (!project) return;
    game.setRuntimeOps(this.opRegistry);
    game.queueLoad(project, scene, this.lastViewState);
    if (isRunning) {
      game.setPendingViewState(this.lastViewState);
      game.loadSceneSpec(project, scene);
      this.scene.wake('GameScene');
      return;
    }
    game.setPendingViewState(this.lastViewState);
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
    try {
      if (nextMode === 'edit') {
        const game = this.scene.get('GameScene') as unknown as { getViewState?: () => any } | undefined;
        if (game?.getViewState) this.lastViewState = game.getViewState();
        return;
      }
      const editor = this.scene.get('EditorScene') as unknown as { getViewState?: () => any } | undefined;
      if (editor?.getViewState) this.lastViewState = editor.getViewState();
    } catch {
      // ignore view capture errors
    }
  }

  private handleLoadProject(project: ProjectSpec, currentSceneId: string, mode: 'edit' | 'play' = 'edit'): void {
    // Only preserve camera state on reloads. On initial app startup the editor scene has not
    // initialized its view yet, so capturing `{ zoom: 1, scrollX: 0, scrollY: 0 }` would
    // prevent the default `fitView()` centering from running.
    if (shouldPreserveViewStateOnProjectLoad(this.project, project)) {
      this.captureViewStateForProjectReload(mode);
    } else {
      this.lastViewState = undefined;
    }
    this.project = project;
    this.authoredSceneId = currentSceneId;
    this.runtimeSceneId = currentSceneId;
    this.captureViewStateForModeSwitch(mode);
    this.mode = mode;
    if (mode === 'play') {
      try {
        (this.sound as any)?.unlock?.();
      } catch {
        // ignore unlock errors
      }
    }
    this.playStartSceneId = mode === 'play' ? currentSceneId : undefined;
    this.syncActiveScene();
  }

  private handleSetMode(mode: 'edit' | 'play'): void {
    if (!this.project) return;
    this.captureViewStateForModeSwitch(mode);
    if (mode === 'play') {
      try {
        (this.sound as any)?.unlock?.();
      } catch {
        // ignore unlock errors
      }
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
      console.warn('[phaserforge] scene.goto missing sceneId');
      return;
    }
    if (!this.project.scenes[sceneId]) {
      console.warn(`[phaserforge] scene.goto target scene not found: ${sceneId}`);
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

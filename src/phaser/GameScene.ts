import * as Phaser from 'phaser';
import { EventBus, getActiveScene, setActiveScene } from './EventBus';
import { compileScene, type CompiledScene } from '../compiler/compileScene';
import type { GameSceneSpec, ProjectSpec, SceneSpec, SpriteAssetSpec, type HitboxSpec } from '../model/types';
import { getRotatedEntityBounds } from '../runtime/geometry';
import { computeAabbBounds } from '../runtime/geometry/aabbBounds';
import { registerSceneGetter, unregisterSceneGetter } from '../testing/testBridge';
import { getSceneWorld } from '../editor/sceneWorld';
import { clampCameraScroll, clampZoom } from '../editor/viewport';
import { OpRegistry } from '../compiler/opRegistry';
import { BasicAudioService } from '../runtime/services/BasicAudioService';
import { BasicInputService } from '../runtime/services/BasicInputService';
import { BasicCollisionService } from '../runtime/services/BasicCollisionService';
import type { InputActionMapSpec } from '../model/types';
import { createTriggerCompileContext, executeTriggerScripts } from '../runtime/triggers/triggerScripts';
import type { TriggerZoneSpec } from '../model/types';

const PLACEHOLDER_TEXTURE_KEY = '__phaseractions-studio:placeholder-1x1';

type PhysicsObject =
  | Phaser.Types.Physics.Arcade.ImageWithDynamicBody
  | Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

export class GameScene extends Phaser.Scene {
  private baseCompiled?: CompiledScene;
  private compiled?: CompiledScene;
  private opRegistry: OpRegistry = new OpRegistry();
  private baseSprites = new Map<string, Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>();
  private sprites = new Map<string, Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>();
  private baseFormationPhysicsGroups = new Map<string, Phaser.Physics.Arcade.Group>();
  private formationPhysicsGroups = new Map<string, Phaser.Physics.Arcade.Group>();
  private basePhysicsObjects = new Map<string, PhysicsObject>();
  private physicsObjects = new Map<string, PhysicsObject>();
  private basePhysicsVelocityCache = new Map<string, { vx: number; vy: number }>();
  private physicsVelocityCache = new Map<string, { vx: number; vy: number }>();
  private basePhysicsSizeCache = new Map<string, { w: number; h: number }>();
  private physicsSizeCache = new Map<string, { w: number; h: number }>();
  private worldFrameGraphics?: Phaser.GameObjects.Graphics;
  private loadVersion = 0;
  private readonly sceneBridgeGetter = () => this;
  private pendingViewState?: { zoom: number; scrollX: number; scrollY: number };
  private baseBackgroundObjects: Phaser.GameObjects.GameObject[] = [];
  private backgroundObjects: Phaser.GameObjects.GameObject[] = [];
  private audioService?: BasicAudioService;
  private inputService?: BasicInputService;
  private baseCollisionService?: BasicCollisionService;
  private collisionService?: BasicCollisionService;
  private baseTriggerZones: TriggerZoneSpec[] = [];
  private triggerZones: TriggerZoneSpec[] = [];
  private baseLastProcessedTriggerEventCount = 0;
  private lastProcessedTriggerEventCount = 0;
  private lastEntityPointerDown?: { entityId: string; button: number; worldX: number; worldY: number; x: number; y: number };
  private mouseOptions: { hideOsCursorInPlay: boolean; driveEntityId?: string; affectX: boolean; affectY: boolean } = {
    hideOsCursorInPlay: false,
    driveEntityId: undefined,
    affectX: true,
    affectY: true,
  };
  private readonly handleEscape = () => {
    EventBus.emit('toggle-mode');
  };
  private readonly handleKeyDown = (event: KeyboardEvent) => {
    this.inputService?.handleKeyDown({ code: event.code, key: event.key });
  };
  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.inputService?.handleKeyUp({ code: event.code, key: event.key });
  };
  private readonly handleMouseDown = (pointer: Phaser.Input.Pointer) => {
    this.inputService?.handleMouseDown(pointer.button);
    this.baseCollisionService?.handlePointerDown({ worldX: pointer.worldX, worldY: pointer.worldY, button: pointer.button });
    this.collisionService?.handlePointerDown({ worldX: pointer.worldX, worldY: pointer.worldY, button: pointer.button });
  };
  private readonly handleMouseUp = (pointer: Phaser.Input.Pointer) => {
    this.inputService?.handleMouseUp(pointer.button);
  };
  private listenersBound = false;

  private bindSceneListeners(): void {
    if (this.listenersBound) return;
    this.listenersBound = true;
    setActiveScene(this);
    registerSceneGetter(this.sceneBridgeGetter);
    this.input.keyboard?.on('keydown-ESC', this.handleEscape);
    this.input.keyboard?.on('keydown', this.handleKeyDown as any);
    this.input.keyboard?.on('keyup', this.handleKeyUp as any);
    this.input.on('pointerdown', this.handleMouseDown, this);
    this.input.on('pointerup', this.handleMouseUp, this);
  }

  private unbindSceneListeners(): void {
    if (!this.listenersBound) return;
    this.listenersBound = false;
    if (getActiveScene() === this) setActiveScene(null);
    unregisterSceneGetter(this.sceneBridgeGetter);
    this.input.keyboard?.off('keydown-ESC', this.handleEscape);
    this.input.keyboard?.off('keydown', this.handleKeyDown as any);
    this.input.keyboard?.off('keyup', this.handleKeyUp as any);
    this.input.off('pointerdown', this.handleMouseDown, this);
    this.input.off('pointerup', this.handleMouseUp, this);
    this.audioService?.stopAll();
    this.applyCursorHidden(false);
  }

  constructor() {
    super('GameScene');
  }

  public setRuntimeOps(opRegistry: OpRegistry): void {
    this.opRegistry = opRegistry;
  }

  create(): void {
    // Match editor canvas background so offscreen space is consistent between edit and preview.
    this.cameras.main.setBackgroundColor('#0c0f1a');
    this.cameras.main.roundPixels = true;
    this.audioService = new BasicAudioService(this.sound as any);
    this.inputService = new BasicInputService({
      getGamepads: () => (typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads()) : []),
      getPointer: () => {
        const p = this.input?.activePointer;
        if (!p) return null;
        return { x: p.x, y: p.y, worldX: p.worldX, worldY: p.worldY };
      },
    });
    this.baseCollisionService = new BasicCollisionService();
    this.collisionService = new BasicCollisionService();
    this.bindSceneListeners();
    EventBus.emit('current-scene-ready', this);
    this.events.on(Phaser.Scenes.Events.SLEEP, this.unbindSceneListeners, this);
    this.events.on(Phaser.Scenes.Events.WAKE, this.bindSceneListeners, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.SLEEP, this.unbindSceneListeners, this);
      this.events.off(Phaser.Scenes.Events.WAKE, this.bindSceneListeners, this);
      this.unbindSceneListeners();
      this.clearScene();
    });
  }

  public loadSceneSpec(sceneSpec: SceneSpec): void;
  public loadSceneSpec(project: ProjectSpec, sceneSpec: SceneSpec): void;
  public loadSceneSpec(projectOrScene: ProjectSpec | SceneSpec, maybeScene?: SceneSpec): void {
    const project = maybeScene ? (projectOrScene as ProjectSpec) : undefined;
    const sceneSpec = (maybeScene ?? projectOrScene) as GameSceneSpec;
    const currentLoadVersion = ++this.loadVersion;
    const baseId = project?.baseSceneId;
    const baseSceneSpec = project && baseId && project.scenes[baseId] ? (project.scenes[baseId] as GameSceneSpec) : undefined;
    const layered = Boolean(project && baseSceneSpec && baseSceneSpec.id !== sceneSpec.id);
    const rebuildBase = layered && (!this.baseCompiled || this.baseCompiled.scene.id !== baseSceneSpec!.id);

    if (!layered) {
      this.clearScene();
      this.baseCompiled = undefined;
      this.baseTriggerZones = [];
      this.baseLastProcessedTriggerEventCount = 0;
      this.baseCollisionService?.setTriggers([]);
      this.baseCollisionService?.setCollisionRules([]);
      this.baseCollisionService?.setEntities({});
    } else if (rebuildBase) {
      this.clearScene();
      this.baseCompiled = compileScene(baseSceneSpec!, { opRegistry: this.opRegistry });
      this.configureCompiledLayer(this.baseCompiled, baseSceneSpec!, {
        collision: this.baseCollisionService,
        setTriggerZones: (zones) => { this.baseTriggerZones = zones; },
        resetTriggerCount: () => { this.baseLastProcessedTriggerEventCount = 0; },
      });
      this.baseCompiled.startAll();
    } else {
      this.clearActiveLayer();
    }

    this.compiled = compileScene(sceneSpec, { opRegistry: this.opRegistry });
    this.configureCompiledLayer(this.compiled, sceneSpec, {
      collision: this.collisionService,
      setTriggerZones: (zones) => { this.triggerZones = zones; },
      resetTriggerCount: () => { this.lastProcessedTriggerEventCount = 0; },
    });
    this.compiled.startAll();

    if (project) {
      this.audioService?.applySceneAudio(sceneSpec, project);
      this.applySceneInput(sceneSpec, project);
    } else {
      this.audioService?.stopAll();
      this.inputService?.setActiveMaps([]);
      this.mouseOptions = { hideOsCursorInPlay: false, driveEntityId: undefined, affectX: true, affectY: true };
      this.applyCursorHidden(false);
    }

    const assetScenes = layered ? [sceneSpec, baseSceneSpec!] : [sceneSpec];
    void this.ensureSceneAssets(project, assetScenes).finally(() => {
      if (currentLoadVersion !== this.loadVersion || !this.compiled) return;
      if (layered && rebuildBase && this.baseCompiled) {
        this.buildBackgroundLayersInto(project, baseSceneSpec!, this.baseBackgroundObjects);
        this.buildSpritesForLayer(this.baseCompiled, baseSceneSpec!, {
          sprites: this.baseSprites,
          physicsObjects: this.basePhysicsObjects,
          velocityCache: this.basePhysicsVelocityCache,
          sizeCache: this.basePhysicsSizeCache,
        });
        this.buildFormationPhysicsGroupsForLayer(this.baseCompiled, baseSceneSpec!, this.basePhysicsObjects, this.baseFormationPhysicsGroups);
      }

      this.buildBackgroundLayersInto(project, sceneSpec, this.backgroundObjects);
      this.buildSpritesForLayer(this.compiled, sceneSpec, {
        sprites: this.sprites,
        physicsObjects: this.physicsObjects,
        velocityCache: this.physicsVelocityCache,
        sizeCache: this.physicsSizeCache,
      });
      this.buildFormationPhysicsGroupsForLayer(this.compiled, sceneSpec, this.physicsObjects, this.formationPhysicsGroups);
      this.applyPendingViewState(sceneSpec);
      this.drawWorldFrame(sceneSpec);
    });
  }

  private configureCompiledLayer(
    compiled: CompiledScene,
    sceneSpec: GameSceneSpec,
    hooks: {
      collision?: BasicCollisionService;
      setTriggerZones: (zones: TriggerZoneSpec[]) => void;
      resetTriggerCount: () => void;
    }
  ): void {
    const triggers = sceneSpec.triggers ?? [];
    hooks.setTriggerZones(triggers);
    hooks.resetTriggerCount();
    hooks.collision?.setTriggers(triggers);
    hooks.collision?.setCollisionRules(sceneSpec.collisionRules ?? []);
    hooks.collision?.setEntities(compiled.entities as any);
    for (const [id, spec] of Object.entries(sceneSpec.entities ?? {})) {
      const runtimeEntity = (compiled.entities as any)[id];
      if (!runtimeEntity) continue;
      runtimeEntity.body = (spec as any).body;
      runtimeEntity.collision = (spec as any).collision;
    }
  }

  public getViewState(): { zoom: number; scrollX: number; scrollY: number } {
    return {
      zoom: this.cameras.main.zoom || 1,
      scrollX: this.cameras.main.scrollX,
      scrollY: this.cameras.main.scrollY,
    };
  }

  public setPendingViewState(view: { zoom: number; scrollX: number; scrollY: number } | undefined): void {
    this.pendingViewState = view;
  }

  private applyPendingViewState(sceneSpec: SceneSpec): void {
    if (!this.pendingViewState) return;
    const world = getSceneWorld(sceneSpec);
    const nextZoom = clampZoom(this.pendingViewState.zoom);
    const clamped = clampCameraScroll(
      this.pendingViewState.scrollX,
      this.pendingViewState.scrollY,
      this.scale.width,
      this.scale.height,
      world.width,
      world.height,
      nextZoom
    );
    this.cameras.main.setZoom(nextZoom);
    this.cameras.main.setScroll(clamped.scrollX, clamped.scrollY);
    this.pendingViewState = undefined;
  }

  public getTestSnapshot(): {
    ready: boolean;
    sceneKey: string;
    compiledSceneId?: string;
    baseCompiledSceneId?: string;
    zoom: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
    backgroundLayerCount: number;
    audio?: { musicAssetId?: string; ambienceAssetIds: string[] };
    input?: any;
    collisions?: any;
    lastEntityPointerDown?: { entityId: string; button: number; worldX: number; worldY: number; x: number; y: number };
  } {
    const audio = this.audioService?.getSnapshot();
    const input = this.inputService?.getSnapshot();
    const collisions = this.collisionService?.getSnapshot();
    return {
      ready: Boolean(this.compiled),
      sceneKey: this.scene.key,
      compiledSceneId: this.compiled?.scene.id,
      ...(this.baseCompiled ? { baseCompiledSceneId: this.baseCompiled.scene.id } : {}),
      zoom: this.cameras.main.zoom,
      scrollX: this.cameras.main.scrollX,
      scrollY: this.cameras.main.scrollY,
      viewportWidth: this.scale.width,
      viewportHeight: this.scale.height,
      backgroundLayerCount: this.baseBackgroundObjects.length + this.backgroundObjects.length,
      ...(audio ? { audio } : {}),
      ...(input ? { input } : {}),
      ...(collisions ? { collisions } : {}),
      ...(this.lastEntityPointerDown ? { lastEntityPointerDown: { ...this.lastEntityPointerDown } } : {}),
    };
  }

  public playMusic(assetId: string, options?: { loop?: boolean; volume?: number; fadeMs?: number }): void {
    this.audioService?.playMusic(assetId, options);
  }

  public stopMusic(options?: { fadeMs?: number }): void {
    this.audioService?.stopMusic(options);
  }

  public playSfx(assetId: string, options?: { volume?: number }): void {
    this.audioService?.playSfx(assetId, options);
  }

  public applySceneAudio(scene: Pick<GameSceneSpec, 'music' | 'ambience'>, project: Pick<ProjectSpec, 'audio'>): void {
    this.audioService?.applySceneAudio(scene, project);
  }

  public getAudioSnapshot(): { musicAssetId?: string; ambienceAssetIds: string[] } {
    return this.audioService?.getSnapshot() ?? { musicAssetId: undefined, ambienceAssetIds: [] };
  }

  public stopAllAudio(): void {
    this.audioService?.stopAll();
  }

  public setActiveInputMaps(maps: InputActionMapSpec[]): void {
    this.inputService?.setActiveMaps(maps);
  }

  public getInputSnapshot(): unknown {
    return this.inputService?.getSnapshot() ?? {};
  }

  private applySceneInput(sceneSpec: GameSceneSpec, project: ProjectSpec): void {
    const inputMaps = project.inputMaps ?? {};
    const projectDefault = project.defaultInputMapId;
    const activeMapId = sceneSpec.input?.activeMapId ?? projectDefault;
    const fallbackMapId = sceneSpec.input?.fallbackMapId ?? projectDefault;
    const ids = [activeMapId, fallbackMapId].filter((id): id is string => typeof id === 'string' && id.length > 0);
    const uniqueIds: string[] = [];
    for (const id of ids) if (!uniqueIds.includes(id)) uniqueIds.push(id);
    const maps: InputActionMapSpec[] = uniqueIds.map((id) => inputMaps[id]).filter(Boolean) as any;
    this.inputService?.setActiveMaps(maps);

    const mouse = sceneSpec.input?.mouse ?? {};
    const hideOsCursorInPlay = Boolean(mouse.hideOsCursorInPlay);
    const driveEntityId = typeof mouse.driveEntityId === 'string' ? mouse.driveEntityId : undefined;
    const affectX = Boolean(mouse.affectX ?? true);
    const affectY = Boolean(mouse.affectY ?? true);
    this.mouseOptions = { hideOsCursorInPlay, driveEntityId, affectX, affectY };
    this.applyCursorHidden(hideOsCursorInPlay);
  }

  private applyCursorHidden(hidden: boolean): void {
    const canvas = this.game.canvas;
    if (canvas) canvas.style.cursor = hidden ? 'none' : 'default';
    try {
      this.input.setDefaultCursor(hidden ? 'none' : 'default');
    } catch {
      // ignore cursor errors
    }
  }

  public getFormationPhysicsGroupInfo(groupId: string): { memberCount: number } | null {
    const group = this.formationPhysicsGroups.get(groupId) ?? this.baseFormationPhysicsGroups.get(groupId);
    if (!group) return null;
    return { memberCount: group.getChildren().length };
  }

  public getEntityWorldRect(id: string): { minX: number; minY: number; maxX: number; maxY: number; centerX: number; centerY: number } | null {
    const entity = this.compiled?.entities[id] ?? this.baseCompiled?.entities[id];
    if (!entity) return null;
    const bounds = getRotatedEntityBounds(entity);
    return {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
      centerX: entity.x,
      centerY: entity.y,
    };
  }

  public getEntitySpriteWorldRect(id: string): { minX: number; minY: number; maxX: number; maxY: number; centerX: number; centerY: number } | null {
    const sprite = this.sprites.get(id) ?? this.baseSprites.get(id);
    if (!sprite) return null;
    const bounds = sprite.getBounds();
    return {
      minX: bounds.x,
      minY: bounds.y,
      maxX: bounds.x + bounds.width,
      maxY: bounds.y + bounds.height,
      centerX: sprite.x,
      centerY: sprite.y,
    };
  }

  public getGroupWorldBounds(id: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const compiledGroup = this.compiled?.groups[id] ?? this.baseCompiled?.groups[id];
    if (!compiledGroup) return null;
    const physicsGroup = this.formationPhysicsGroups.get(id) ?? this.baseFormationPhysicsGroups.get(id);
    if (physicsGroup) {
      const rects = physicsGroup.getChildren()
        .map((child) => (child as any).body as Phaser.Physics.Arcade.Body | undefined)
        .filter((body): body is Phaser.Physics.Arcade.Body => Boolean(body))
        .map((body) => ({ minX: body.left, minY: body.top, maxX: body.right, maxY: body.bottom }));
      if (rects.length > 0) return computeAabbBounds(rects);
    }
    return compiledGroup.getBounds();
  }

  public getGroupFrameVisible(_id: string): boolean | null {
    return null;
  }

  public getGroupLabelVisible(_id: string): boolean | null {
    return null;
  }

  public getEditableBoundsRect(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    return null;
  }

  public worldToClient(point: { x: number; y: number }): { x: number; y: number } | null {
    const canvas = this.game.canvas;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const scaleX = rect.width / this.scale.width;
    const scaleY = rect.height / this.scale.height;
    const viewportCenterX = this.scale.width / 2;
    const viewportCenterY = this.scale.height / 2;
    const zoom = this.cameras.main.zoom || 1;

    return {
      x: rect.left + (((point.x - this.cameras.main.scrollX - viewportCenterX) * zoom) + viewportCenterX) * scaleX,
      y: rect.top + (((point.y - this.cameras.main.scrollY - viewportCenterY) * zoom) + viewportCenterY) * scaleY,
    };
  }

  public computeAutoHitboxForEntity(_entityId: string, _options: { alphaThreshold?: number } = {}): HitboxSpec | null {
    return null;
  }

  public testTapWorld(_point: { x: number; y: number }): void {}
  public testDragWorld(_start: { x: number; y: number }, _end: { x: number; y: number }): void {}
  public testDragBoundsHandle(_handle: string, _delta: { x: number; y: number }): void {}
  public testPanByScreenDelta(_delta: { x: number; y: number }): void {}
  public testUndo(): void {}
  public testRedo(): void {}

  update(_time: number, delta: number): void {
    if (!this.compiled && !this.baseCompiled) return;
    this.inputService?.update();
    if (this.baseCompiled) this.baseCompiled.actionManager.update(delta);
    if (this.compiled) this.compiled.actionManager.update(delta);

    const driveEntityId = this.mouseOptions.driveEntityId;
    if (driveEntityId) {
      const activeEntity = this.compiled?.entities[driveEntityId];
      const baseEntity = this.baseCompiled?.entities[driveEntityId];
      const entity = activeEntity ?? baseEntity;
      const entityScene = activeEntity ? this.compiled?.scene : baseEntity ? this.baseCompiled?.scene : undefined;
      if (entity && entityScene) {
        const pointer = this.input?.activePointer;
        if (pointer) {
          const world = getSceneWorld(entityScene);
          if (this.mouseOptions.affectX) entity.x = Math.max(0, Math.min(world.width, pointer.worldX));
          if (this.mouseOptions.affectY) entity.y = Math.max(0, Math.min(world.height, pointer.worldY));
        }
      }
    }

    this.baseCollisionService?.update();
    this.collisionService?.update();
    this.executeTriggerScriptsFromCollisionSnapshot();
    if (this.baseCompiled) {
      this.syncSpritesForLayer(this.baseCompiled, {
        sprites: this.baseSprites,
        physicsObjects: this.basePhysicsObjects,
        velocityCache: this.basePhysicsVelocityCache,
        sizeCache: this.basePhysicsSizeCache,
      });
    }
    if (this.compiled) {
      this.syncSpritesForLayer(this.compiled, {
        sprites: this.sprites,
        physicsObjects: this.physicsObjects,
        velocityCache: this.physicsVelocityCache,
        sizeCache: this.physicsSizeCache,
      });
    }
  }

  private syncSpritesForLayer(
    compiled: CompiledScene,
    stores: {
      sprites: Map<string, Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>;
      physicsObjects: Map<string, PhysicsObject>;
      velocityCache: Map<string, { vx: number; vy: number }>;
      sizeCache: Map<string, { w: number; h: number }>;
    }
  ): void {
    for (const entity of Object.values(compiled.entities)) {
      const sprite = stores.sprites.get(entity.id);
      if ((entity as any).destroyed) {
        if (sprite) {
          sprite.destroy();
          stores.sprites.delete(entity.id);
        }
        const physicsObject = stores.physicsObjects.get(entity.id);
        if (physicsObject) {
          physicsObject.destroy();
          stores.physicsObjects.delete(entity.id);
        }
        stores.velocityCache.delete(entity.id);
        stores.sizeCache.delete(entity.id);
        continue;
      }
      if (!sprite) continue;
      sprite.setPosition(entity.x, entity.y);
      this.applyEntityDisplayProps(sprite, entity, compiled.scene.entities[entity.id]?.asset as any);
      this.syncPhysicsState(entity.id, sprite, entity, stores);
    }
  }

  private executeTriggerScriptsFromCollisionSnapshotForLayer(opts: {
    compiled: CompiledScene;
    collision: BasicCollisionService;
    triggerZones: TriggerZoneSpec[];
    getLastProcessedCount: () => number;
    setLastProcessedCount: (count: number) => void;
  }): void {
    const snapshot = opts.collision.getSnapshot();
    const events = snapshot.triggerEvents;
    if (!Array.isArray(events) || events.length === 0) return;

    const previous = opts.getLastProcessedCount();
    const startIndex = events.length < previous ? 0 : previous;
    const pending = events.slice(startIndex);
    opts.setLastProcessedCount(events.length);
    if (pending.length === 0) return;

    const ctx = createTriggerCompileContext(opts.compiled.scene, { entities: opts.compiled.entities as any, groups: opts.compiled.groups as any }, this.opRegistry);
    executeTriggerScripts(opts.triggerZones, pending as any, this.opRegistry, ctx);
  }

  private executeTriggerScriptsFromCollisionSnapshot(): void {
    if (this.baseCompiled && this.baseCollisionService) {
      this.executeTriggerScriptsFromCollisionSnapshotForLayer({
        compiled: this.baseCompiled,
        collision: this.baseCollisionService,
        triggerZones: this.baseTriggerZones,
        getLastProcessedCount: () => this.baseLastProcessedTriggerEventCount,
        setLastProcessedCount: (count) => { this.baseLastProcessedTriggerEventCount = count; },
      });
    }

    if (this.compiled && this.collisionService) {
      this.executeTriggerScriptsFromCollisionSnapshotForLayer({
        compiled: this.compiled,
        collision: this.collisionService,
        triggerZones: this.triggerZones,
        getLastProcessedCount: () => this.lastProcessedTriggerEventCount,
        setLastProcessedCount: (count) => { this.lastProcessedTriggerEventCount = count; },
      });
    }
  }

  private clearActiveLayer(): void {
    this.backgroundObjects.forEach((obj) => obj.destroy());
    this.backgroundObjects = [];
    this.formationPhysicsGroups.forEach((group) => group.destroy());
    this.formationPhysicsGroups.clear();
    this.physicsObjects.forEach((obj) => obj.destroy());
    this.physicsObjects.clear();
    this.physicsVelocityCache.clear();
    this.physicsSizeCache.clear();
    this.sprites.forEach(sprite => sprite.destroy());
    this.sprites.clear();
    this.worldFrameGraphics?.destroy();
    this.worldFrameGraphics = undefined;
    this.lastEntityPointerDown = undefined;
  }

  private clearBaseLayer(): void {
    this.baseBackgroundObjects.forEach((obj) => obj.destroy());
    this.baseBackgroundObjects = [];
    this.baseFormationPhysicsGroups.forEach((group) => group.destroy());
    this.baseFormationPhysicsGroups.clear();
    this.basePhysicsObjects.forEach((obj) => obj.destroy());
    this.basePhysicsObjects.clear();
    this.basePhysicsVelocityCache.clear();
    this.basePhysicsSizeCache.clear();
    this.baseSprites.forEach(sprite => sprite.destroy());
    this.baseSprites.clear();
  }

  private clearScene(): void {
    this.clearActiveLayer();
    this.clearBaseLayer();
    this.baseCompiled = undefined;
    this.compiled = undefined;
    this.baseTriggerZones = [];
    this.triggerZones = [];
    this.baseLastProcessedTriggerEventCount = 0;
    this.lastProcessedTriggerEventCount = 0;
  }

  private drawWorldFrame(scene: SceneSpec): void {
    const world = getSceneWorld(scene);
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x445d8f, 0.95);
    graphics.strokeRect(0, 0, world.width, world.height);
    graphics.lineStyle(1, 0x27324d, 0.85);
    graphics.strokeRect(-1, -1, world.width + 2, world.height + 2);
    graphics.setDepth(10);
    this.worldFrameGraphics = graphics;
  }

  private syncPhysicsState(
    entityId: string,
    sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
    entity: CompiledScene['entities'][string],
    stores: {
      physicsObjects: Map<string, PhysicsObject>;
      velocityCache: Map<string, { vx: number; vy: number }>;
      sizeCache: Map<string, { w: number; h: number }>;
    }
  ): void {
    const physicsObject = stores.physicsObjects.get(entityId);
    if (!physicsObject) return;
    if (physicsObject !== (sprite as any)) return;

    const body = physicsObject.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;

    const vx = entity.vx ?? 0;
    const vy = entity.vy ?? 0;
    const prevVel = stores.velocityCache.get(entityId);
    if (!prevVel || prevVel.vx !== vx || prevVel.vy !== vy) {
      body.velocity.set(vx, vy);
      stores.velocityCache.set(entityId, { vx, vy });
    }

    const w = sprite instanceof Phaser.GameObjects.Rectangle ? entity.width : sprite.displayWidth;
    const h = sprite instanceof Phaser.GameObjects.Rectangle ? entity.height : sprite.displayHeight;
    const prevSize = stores.sizeCache.get(entityId);
    if (!prevSize || prevSize.w !== w || prevSize.h !== h) {
      body.setSize(w, h, true);
      stores.sizeCache.set(entityId, { w, h });
    }

    const anyBody = body as any;
    if (typeof anyBody.updateFromGameObject === 'function') {
      anyBody.updateFromGameObject();
    }
  }

  private getTextureKey(asset: SpriteAssetSpec): string {
    const sourceKey = asset.source.kind === 'embedded' ? asset.source.dataUrl : asset.source.path;
    const suffix = asset.imageType === 'spritesheet' && asset.grid
      ? `:${asset.grid.frameWidth}x${asset.grid.frameHeight}`
      : '';
    return `asset:${sourceKey}${suffix}`;
  }

  private applyEntityDisplayProps(
    sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
    entity: CompiledScene['entities'][string],
    asset?: SpriteAssetSpec
  ): void {
    sprite.setPosition(entity.x, entity.y);
    sprite.setAngle(entity.rotationDeg ?? 0);
    sprite.setOrigin(entity.originX ?? 0.5, entity.originY ?? 0.5);
    sprite.setAlpha(entity.alpha ?? 1);
    sprite.setVisible(entity.visible ?? true);
    sprite.setDepth(entity.depth ?? 0);
    if (sprite instanceof Phaser.GameObjects.Rectangle) {
      sprite.setSize(entity.width, entity.height);
      sprite.setDisplaySize(entity.width, entity.height);
      sprite.setScale((entity.flipX ? -1 : 1) * Math.abs(entity.scaleX ?? 1), (entity.flipY ? -1 : 1) * Math.abs(entity.scaleY ?? 1));
    } else {
      const displayWidth = entity.width * Math.abs(entity.scaleX ?? 1);
      const displayHeight = entity.height * Math.abs(entity.scaleY ?? 1);
      sprite.setDisplaySize(displayWidth, displayHeight);
      sprite.setFlipX(entity.flipX ?? false);
      sprite.setFlipY(entity.flipY ?? false);
      if (asset?.imageType === 'spritesheet' && sprite instanceof Phaser.GameObjects.Sprite) {
        const frame = asset.frame?.frameKey ?? asset.frame?.frameIndex;
        if (frame !== undefined) {
          sprite.setFrame(frame);
        }
      }
    }
  }

  private ensurePlaceholderTexture(): void {
    if (this.textures.exists(PLACEHOLDER_TEXTURE_KEY)) return;
    const gfx = this.add.graphics();
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(0, 0, 1, 1);
    gfx.generateTexture(PLACEHOLDER_TEXTURE_KEY, 1, 1);
    gfx.destroy();
  }

  private configurePhysicsObject(entityId: string, sprite: PhysicsObject, physicsObjects: Map<string, PhysicsObject>): void {
    const body = sprite.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;
    body.setAllowGravity(false);
    body.moves = false;
    body.setImmovable(true);
    physicsObjects.set(entityId, sprite);
  }

  private buildSpritesForLayer(
    compiled: CompiledScene,
    sceneSpec: GameSceneSpec,
    stores: {
      sprites: Map<string, Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>;
      physicsObjects: Map<string, PhysicsObject>;
      velocityCache: Map<string, { vx: number; vy: number }>;
      sizeCache: Map<string, { w: number; h: number }>;
    }
  ): void {
    void sceneSpec;
    this.ensurePlaceholderTexture();
    for (const entity of Object.values(compiled.entities)) {
      const asset = compiled.scene.entities[entity.id]?.asset as any as SpriteAssetSpec | undefined;
      const textureKey = asset ? this.getTextureKey(asset) : undefined;
      let sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
      if (asset && textureKey && this.textures.exists(textureKey)) {
        const frame = asset.frame?.frameKey ?? asset.frame?.frameIndex;
        if (asset.imageType === 'spritesheet') {
          sprite = this.physics.add.sprite(entity.x, entity.y, textureKey, frame);
        } else {
          sprite = this.physics.add.image(entity.x, entity.y, textureKey);
        }
      } else {
        sprite = this.physics.add.image(entity.x, entity.y, PLACEHOLDER_TEXTURE_KEY);
      }
      this.configurePhysicsObject(entity.id, sprite as any, stores.physicsObjects);
      sprite.setInteractive();
      sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.lastEntityPointerDown = {
          entityId: entity.id,
          button: pointer.button,
          worldX: pointer.worldX,
          worldY: pointer.worldY,
          x: pointer.x,
          y: pointer.y,
        };
      });
      this.applyEntityDisplayProps(sprite, entity, asset);
      stores.sprites.set(entity.id, sprite);
      stores.velocityCache.delete(entity.id);
      stores.sizeCache.delete(entity.id);
    }
  }

  private buildFormationPhysicsGroupsForLayer(
    compiled: CompiledScene,
    sceneSpec: SceneSpec,
    physicsObjects: Map<string, PhysicsObject>,
    out: Map<string, Phaser.Physics.Arcade.Group>
  ): void {
    void compiled;
    for (const [groupId, groupSpec] of Object.entries(sceneSpec.groups)) {
      const physicsGroup = this.physics.add.group();
      for (const memberId of groupSpec.members) {
        const obj = physicsObjects.get(memberId);
        if (obj) physicsGroup.add(obj);
      }
      out.set(groupId, physicsGroup);
    }
  }

  private getBackgroundTextureKey(assetId: string): string {
    return `bg:${assetId}`;
  }

  private buildBackgroundLayersInto(project: ProjectSpec | undefined, sceneSpec: GameSceneSpec, out: Phaser.GameObjects.GameObject[]): void {
    const layers = sceneSpec.backgroundLayers ?? [];
    if (!project || layers.length === 0) return;

    const world = getSceneWorld(sceneSpec);
    for (const layer of layers) {
      const asset = project.assets.images?.[layer.assetId];
      if (!asset) continue;
      const key = this.getBackgroundTextureKey(asset.id);
      if (!this.textures.exists(key)) continue;

      const scrollX = layer.scrollFactor?.x ?? 1;
      const scrollY = layer.scrollFactor?.y ?? 1;
      const alpha = layer.alpha ?? 1;

      if (layer.layout === 'tile') {
        const sprite = this.add.tileSprite(layer.x, layer.y, world.width, world.height, key);
        sprite.setOrigin(0, 0);
        sprite.setDepth(layer.depth);
        sprite.setScrollFactor(scrollX, scrollY);
        sprite.setAlpha(alpha);
        if (layer.tint != null) sprite.setTint(layer.tint);
        out.push(sprite);
        continue;
      }

      const image = this.add.image(layer.x, layer.y, key);
      image.setOrigin(0.5, 0.5);
      image.setDepth(layer.depth);
      image.setScrollFactor(scrollX, scrollY);
      image.setAlpha(alpha);
      if (layer.tint != null) image.setTint(layer.tint);

      const texture = this.textures.get(key);
      const source = (texture as any).getSourceImage?.() as { width: number; height: number } | undefined;
      const sourceWidth = source?.width ?? image.width;
      const sourceHeight = source?.height ?? image.height;
      if (sourceWidth > 0 && sourceHeight > 0) {
        if (layer.layout === 'stretch') {
          image.setDisplaySize(world.width, world.height);
        } else if (layer.layout === 'cover' || layer.layout === 'contain') {
          const scaleX = world.width / sourceWidth;
          const scaleY = world.height / sourceHeight;
          const scale = layer.layout === 'cover' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
          image.setDisplaySize(sourceWidth * scale, sourceHeight * scale);
        }
      }

      out.push(image);
    }
  }

  private getAudioKey(assetId: string): string {
    return `audio:${assetId}`;
  }

  private async ensureSceneAssets(project: ProjectSpec | undefined, sceneSpecs: GameSceneSpec[]): Promise<void> {
    const pendingAssets: SpriteAssetSpec[] = [];
    const pendingBackgrounds: Array<{ key: string; url: string }> = [];
    const pendingAudio: Array<{ key: string; url: string }> = [];

    for (const sceneSpec of sceneSpecs) {
      for (const asset of Object.values(sceneSpec.entities)
        .map((entity) => entity.asset)
        .filter((asset): asset is SpriteAssetSpec => Boolean(asset))) {
        const key = this.getTextureKey(asset);
        if (this.textures.exists(key)) continue;
        if (!pendingAssets.some((existing) => this.getTextureKey(existing) === key)) pendingAssets.push(asset);
      }

      const backgroundLayers = sceneSpec.backgroundLayers ?? [];
      if (project && backgroundLayers.length > 0) {
        for (const layer of backgroundLayers) {
          const asset = project.assets.images?.[layer.assetId];
          if (!asset) continue;
          const key = this.getBackgroundTextureKey(asset.id);
          if (this.textures.exists(key)) continue;
          if (!pendingBackgrounds.some((b) => b.key === key)) {
            pendingBackgrounds.push({
              key,
              url: asset.source.kind === 'embedded' ? asset.source.dataUrl : asset.source.path,
            });
          }
        }
      }

      if (project) {
        const sounds = project.audio?.sounds ?? {};
        const ids: string[] = [];
        if (sceneSpec.music?.assetId) ids.push(sceneSpec.music.assetId);
        for (const a of sceneSpec.ambience ?? []) ids.push(a.assetId);
        for (const id of ids) {
          const asset = sounds[id];
          if (!asset) continue;
          const key = this.getAudioKey(asset.id);
          const cache = (this.cache as any).audio;
          const exists = typeof cache?.exists === 'function' ? cache.exists(key) : Boolean(cache?.get?.(key));
          if (exists) continue;
          if (!pendingAudio.some((a) => a.key === key)) {
            pendingAudio.push({
              key,
              url: asset.source.kind === 'embedded' ? asset.source.dataUrl : asset.source.path,
            });
          }
        }
      }
    }

    if (pendingAssets.length === 0 && pendingBackgrounds.length === 0 && pendingAudio.length === 0) return;

    for (const asset of pendingAssets) {
      const key = this.getTextureKey(asset);
      if (asset.imageType === 'spritesheet' && asset.grid) {
        this.load.spritesheet(key, asset.source.kind === 'embedded' ? asset.source.dataUrl : asset.source.path, {
          frameWidth: asset.grid.frameWidth,
          frameHeight: asset.grid.frameHeight,
        });
      } else {
        this.load.image(key, asset.source.kind === 'embedded' ? asset.source.dataUrl : asset.source.path);
      }
    }

    for (const background of pendingBackgrounds) {
      this.load.image(background.key, background.url);
    }

    for (const audio of pendingAudio) {
      (this.load as any).audio(audio.key, audio.url);
    }

    await new Promise<void>((resolve) => {
      const timeout = globalThis.setTimeout(() => resolve(), 2500);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        globalThis.clearTimeout(timeout);
        resolve();
      });
      // Some loaders don't surface global errors reliably (especially for audio); rely on timeout as fallback.
      this.load.start();
    });
  }
}

import * as Phaser from 'phaser';
import { EventBus, getActiveScene, setActiveScene } from './EventBus';
import { compileScene, CompiledScene } from '../compiler/compileScene';
import { GameSceneSpec, ProjectSpec, SceneSpec, SpriteAssetSpec, type HitboxSpec } from '../model/types';
import { Selection } from '../editor/EditorStore';
import { getGroupFrameDisplay } from '../editor/groupFrameDisplay';
import { flattenTarget, resolveTarget } from '../runtime/targets/resolveTarget';
import { getRotatedEntityBounds } from '../runtime/geometry';
import { computeAabbBounds } from '../runtime/geometry/aabbBounds';
import { clampHitboxToEntity, computeHitboxFromImageData, mapHitboxToEntitySize } from '../editor/hitboxAuto';
import {
  hitTestCanvas,
  getCursorForHitTest,
  calculateBoundsAfterHandleDrag,
  getBoundsHandles,
  type HitTestResult
} from '../editor/canvasGeometry';
import {
  hasExceededDragThreshold,
  createDragOverlayText,
  updateDragOverlay,
  createHoverOutline,
  updateHoverOutline,
  type DragState,
  type HoverState
} from '../editor/canvasInteraction';
import { getEditableBoundsConditionId } from '../editor/boundsCondition';
import { getSceneWorld } from '../editor/sceneWorld';
import { canPanCamera, clampCameraScroll, clampZoom, getFitZoom, getNextZoom, getZoomedScroll } from '../editor/viewport';
import { registerSceneGetter, unregisterSceneGetter } from '../testing/testBridge';

const PLACEHOLDER_TEXTURE_KEY = '__phaseractions-studio:placeholder-1x1';

type PhysicsObject =
  | Phaser.Types.Physics.Arcade.ImageWithDynamicBody
  | Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

export class EditorScene extends Phaser.Scene {
  private compiled?: CompiledScene;
  private sprites = new Map<string, Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>();
  private entityToGroup = new Map<string, string>();
  private formationPhysicsGroups = new Map<string, Phaser.Physics.Arcade.Group>();
  private physicsObjects = new Map<string, PhysicsObject>();
  private physicsVelocityCache = new Map<string, { vx: number; vy: number }>();
  private physicsSizeCache = new Map<string, { w: number; h: number }>();
  private boundsGraphics?: Phaser.GameObjects.Graphics;
  private boundsHandles = new Map<string, Phaser.GameObjects.Zone>();
  private readonly autoHitboxCache = new Map<string, { x: number; y: number; width: number; height: number; sourceW: number; sourceH: number }>();
  private groupFrames = new Map<string, Phaser.GameObjects.Graphics>();
  private groupLabels = new Map<string, Phaser.GameObjects.Text>();
  private groupZones = new Map<string, Phaser.GameObjects.Zone>();
  private selection: Selection = { kind: 'none' };
  private dragState?: DragState;
  private hoverState: HoverState = { kind: 'none' };
  private dragOverlay?: Phaser.GameObjects.Text;
  private hoverOutline?: Phaser.GameObjects.Graphics;
  private selectionFrames?: Phaser.GameObjects.Graphics;
  private pendingDrag?: { startPoint: { x: number; y: number }; hitResult: HitTestResult };
  private gridEnabled = false;
  private gridSize = 8;
  private marqueeGraphics?: Phaser.GameObjects.Graphics;
  private mode: 'edit' | 'play' = 'edit';
  private activeBoundsConditionId?: string;
  private worldFrameGraphics?: Phaser.GameObjects.Graphics;
  private currentZoom = 1;
  private hasInitializedView = false;
  private pendingViewState?: { zoom: number; scrollX: number; scrollY: number };
  private backgroundObjects: Phaser.GameObjects.GameObject[] = [];
  private isSpacePanning = false;
  private isMiddleMouseDown = false;
  private wheelZoomAnchor?: { pointerX: number; pointerY: number; worldX: number; worldY: number };
  private panState?: { startPointerX: number; startPointerY: number; startScrollX: number; startScrollY: number };
  private lastPointerWorldPoint?: { x: number; y: number };
  private readonly sceneBridgeGetter = () => this;
  private loadVersion = 0;

  constructor() {
    super('EditorScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0c0f1a');
    this.cameras.main.roundPixels = true;
    this.bindSceneListeners();
    EventBus.emit('current-scene-ready', this);

    // Initialize overlays
    this.dragOverlay = createDragOverlayText(this);
    this.hoverOutline = createHoverOutline(this);
    this.selectionFrames = this.add.graphics();
    this.selectionFrames.setDepth(11);

    this.events.on(Phaser.Scenes.Events.SLEEP, this.unbindSceneListeners, this);
    this.events.on(Phaser.Scenes.Events.WAKE, this.bindSceneListeners, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.SLEEP, this.unbindSceneListeners, this);
      this.events.off(Phaser.Scenes.Events.WAKE, this.bindSceneListeners, this);
      this.unbindSceneListeners();
    });
  }

  public loadSceneSpec(sceneSpec: SceneSpec): void;
  public loadSceneSpec(project: ProjectSpec, sceneSpec: SceneSpec): void;
  public loadSceneSpec(projectOrScene: ProjectSpec | SceneSpec, maybeScene?: SceneSpec): void {
    if (maybeScene) {
      this.loadScene(projectOrScene as ProjectSpec, maybeScene as GameSceneSpec, 'edit');
      return;
    }
    this.loadScene(undefined, projectOrScene as GameSceneSpec, 'edit');
  }

  public getViewState(): { zoom: number; scrollX: number; scrollY: number } {
    return {
      zoom: this.currentZoom,
      scrollX: this.cameras.main.scrollX,
      scrollY: this.cameras.main.scrollY,
    };
  }

  public setPendingViewState(view: { zoom: number; scrollX: number; scrollY: number } | undefined): void {
    this.pendingViewState = view;
  }

  private readonly handleKeyDownBound = (event: KeyboardEvent) => {
    this.handleKeyDown(event);
  };

  private readonly handleKeyUpBound = (event: KeyboardEvent) => {
    this.handleKeyUp(event);
  };

  private readonly handleMouseDownBound = (event: MouseEvent) => {
    if (event.button === 1) {
      event.preventDefault();
      this.isMiddleMouseDown = true;
    }
  };

  private readonly handleMouseUpBound = (event: MouseEvent) => {
    if (event.button === 1) {
      event.preventDefault();
      this.isMiddleMouseDown = false;
    }
  };

  private listenersBound = false;

  private bindSceneListeners(): void {
    if (this.listenersBound) return;
    this.listenersBound = true;
    setActiveScene(this);
    registerSceneGetter(this.sceneBridgeGetter);
    EventBus.on('selection-changed', this.handleSelectionChanged, this);
    EventBus.on('canvas-update-bounds', this.updateBounds, this);
    EventBus.on('toggle-grid-snap', this.toggleGridSnap, this);
    EventBus.on('scene-zoom-in', this.zoomIn, this);
    EventBus.on('scene-zoom-out', this.zoomOut, this);
    EventBus.on('scene-fit-view', this.fitView, this);
    EventBus.on('scene-reset-zoom', this.resetZoom, this);

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('wheel', this.handleWheel, this);

    // App-level keyboard shortcuts should not depend on canvas focus.
    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);
    window.addEventListener('mousedown', this.handleMouseDownBound);
    window.addEventListener('mouseup', this.handleMouseUpBound);
  }

  private unbindSceneListeners(): void {
    if (!this.listenersBound) return;
    this.listenersBound = false;
    if (getActiveScene() === this) setActiveScene(null);
    unregisterSceneGetter(this.sceneBridgeGetter);
    EventBus.off('selection-changed', this.handleSelectionChanged, this);
    EventBus.off('canvas-update-bounds', this.updateBounds, this);
    EventBus.off('toggle-grid-snap', this.toggleGridSnap, this);
    EventBus.off('scene-zoom-in', this.zoomIn, this);
    EventBus.off('scene-zoom-out', this.zoomOut, this);
    EventBus.off('scene-fit-view', this.fitView, this);
    EventBus.off('scene-reset-zoom', this.resetZoom, this);

    this.input.off('pointerdown', this.handlePointerDown, this);
    this.input.off('pointermove', this.handlePointerMove, this);
    this.input.off('pointerup', this.handlePointerUp, this);
    this.input.off('wheel', this.handleWheel, this);

    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('keyup', this.handleKeyUpBound);
    window.removeEventListener('mousedown', this.handleMouseDownBound);
    window.removeEventListener('mouseup', this.handleMouseUpBound);
  }

  public getTestSnapshot(): {
    ready: boolean;
    sceneKey: string;
    compiledSceneId?: string;
    zoom: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
    backgroundLayerCount: number;
  } {
    return {
      ready: Boolean(this.compiled),
      sceneKey: this.scene.key,
      compiledSceneId: this.compiled?.scene.id,
      zoom: this.currentZoom,
      scrollX: this.cameras.main.scrollX,
      scrollY: this.cameras.main.scrollY,
      viewportWidth: this.scale.width,
      viewportHeight: this.scale.height,
      backgroundLayerCount: this.backgroundObjects.length,
    };
  }

  public getEntityWorldRect(id: string): { minX: number; minY: number; maxX: number; maxY: number; centerX: number; centerY: number } | null {
    const entity = this.compiled?.entities[id];
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
    const sprite = this.sprites.get(id);
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

  public computeAutoHitboxForEntity(entityId: string, options: { alphaThreshold?: number } = {}): HitboxSpec | null {
    const compiled = this.compiled;
    if (!compiled) return null;
    const entitySpec = compiled.scene.entities[entityId];
    if (!entitySpec) return null;
    const asset = entitySpec.asset;
    if (!asset) {
      return { x: 0, y: 0, width: entitySpec.width, height: entitySpec.height };
    }

    const textureKey = this.getTextureKey(asset);
    const texture = this.textures.get(textureKey);
    if (!texture) return { x: 0, y: 0, width: entitySpec.width, height: entitySpec.height };

    const frameRef = asset.frame?.frameKey ?? asset.frame?.frameIndex;
    const frameKey: string | number = frameRef === undefined ? '__BASE' : frameRef;
    const frameName = String(frameKey);
    const frame = texture.get(frameKey as any);
    if (!frame) return { x: 0, y: 0, width: entitySpec.width, height: entitySpec.height };

    const source = frame.source.image as HTMLImageElement | HTMLCanvasElement | undefined;
    if (!source) return { x: 0, y: 0, width: entitySpec.width, height: entitySpec.height };

    const sourceW = frame.cutWidth;
    const sourceH = frame.cutHeight;
    const alphaThreshold = options.alphaThreshold ?? 1;
    const cacheKey = `${textureKey}|${frameName}|${alphaThreshold}|${sourceW}x${sourceH}`;

    let raw = this.autoHitboxCache.get(cacheKey) ?? null;
    if (!raw) {
      const canvas = document.createElement('canvas');
      canvas.width = sourceW;
      canvas.height = sourceH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { x: 0, y: 0, width: entitySpec.width, height: entitySpec.height };
      try {
        ctx.clearRect(0, 0, sourceW, sourceH);
        ctx.drawImage(source, frame.cutX, frame.cutY, sourceW, sourceH, 0, 0, sourceW, sourceH);
        const imageData = ctx.getImageData(0, 0, sourceW, sourceH);
        const computed = computeHitboxFromImageData(imageData, { alphaThreshold });
        const box = computed ?? { x: 0, y: 0, width: sourceW, height: sourceH };
        raw = { ...box, sourceW, sourceH };
        this.autoHitboxCache.set(cacheKey, raw);
      } catch {
        return { x: 0, y: 0, width: entitySpec.width, height: entitySpec.height };
      }
    }

    const mapped = mapHitboxToEntitySize(
      { x: raw.x, y: raw.y, width: raw.width, height: raw.height },
      { width: raw.sourceW, height: raw.sourceH },
      { width: entitySpec.width, height: entitySpec.height }
    );
    return clampHitboxToEntity(mapped, { width: entitySpec.width, height: entitySpec.height });
  }

  public getGroupWorldBounds(id: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const group = this.compiled?.groups[id];
    if (!group) return null;

    const bounds = this.getGroupBounds(id, group.getBounds());
    return {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
    };
  }

  public getGroupFrameVisible(id: string): boolean | null {
    const frame = this.groupFrames.get(id);
    return frame ? frame.visible : null;
  }

  public getGroupLabelVisible(id: string): boolean | null {
    const label = this.groupLabels.get(id);
    return label ? label.visible : null;
  }

  public getFormationPhysicsGroupInfo(groupId: string): { memberCount: number } | null {
    if (this.mode !== 'play') return null;
    const group = this.formationPhysicsGroups.get(groupId);
    if (!group) return null;
    return { memberCount: group.getChildren().length };
  }

  public getEditableBoundsRect(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const attachmentId = this.activeBoundsConditionId;
    const attachment = attachmentId ? this.compiled?.scene.attachments[attachmentId] : undefined;
    const condition = attachment?.condition?.type === 'BoundsHit' ? attachment.condition : undefined;
    if (!condition) return null;

    return {
      minX: condition.bounds.minX,
      minY: condition.bounds.minY,
      maxX: condition.bounds.maxX,
      maxY: condition.bounds.maxY,
    };
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

    return {
      x: rect.left + (((point.x - this.cameras.main.scrollX - viewportCenterX) * this.currentZoom) + viewportCenterX) * scaleX,
      y: rect.top + (((point.y - this.cameras.main.scrollY - viewportCenterY) * this.currentZoom) + viewportCenterY) * scaleY,
    };
  }

  public hitTestAtClientPoint(clientX: number, clientY: number): { kind: 'none' | 'entity' | 'group'; id?: string } {
    if (this.mode !== 'edit') return { kind: 'none' };
    const canvas = this.game.canvas;
    if (!canvas) return { kind: 'none' };

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { kind: 'none' };

    const scaleX = this.scale.width / rect.width;
    const scaleY = this.scale.height / rect.height;
    const pointerX = (clientX - rect.left) * scaleX;
    const pointerY = (clientY - rect.top) * scaleY;
    const worldPoint = this.cameras.main.getWorldPoint(pointerX, pointerY);

    const hitResult = hitTestCanvas(
      worldPoint,
      this.compiled?.scene || { id: 'scene', entities: {}, groups: {}, attachments: {}, behaviors: {}, actions: {}, conditions: {} },
      this.sprites,
      this.groupZones,
      this.boundsHandles
    );

    if (hitResult.kind === 'entity' || hitResult.kind === 'group') {
      return { kind: hitResult.kind, id: hitResult.id };
    }

    return { kind: 'none' };
  }

  public testTapWorld(point: { x: number; y: number }): void {
    const hitResult = hitTestCanvas(
      point,
      this.compiled?.scene || { id: 'scene', entities: {}, groups: {}, attachments: {}, behaviors: {}, actions: {}, conditions: {} },
      this.sprites,
      this.groupZones,
      this.boundsHandles
    );

    if (hitResult.kind === 'entity' || hitResult.kind === 'group') {
      EventBus.emit('canvas-select', hitResult);
    } else if (hitResult.kind === 'none') {
      EventBus.emit('canvas-select-multiple', { entityIds: [], additive: false });
    }
  }

  public testDragWorld(start: { x: number; y: number }, end: { x: number; y: number }): void {
    const hitResult = hitTestCanvas(
      start,
      this.compiled?.scene || { id: 'scene', entities: {}, groups: {}, attachments: {}, behaviors: {}, actions: {}, conditions: {} },
      this.sprites,
      this.groupZones,
      this.boundsHandles
    );
    const dx = Math.round(this.snapDeltaToGrid(end.x - start.x));
    const dy = Math.round(this.snapDeltaToGrid(end.y - start.y));

    if (dx === 0 && dy === 0) return;

    switch (hitResult.kind) {
      case 'entity':
        EventBus.emit('canvas-select', hitResult);
        EventBus.emit('canvas-interaction-start', hitResult);
        EventBus.emit('canvas-move-entity', { id: hitResult.id, dx, dy });
        EventBus.emit('canvas-interaction-end');
        break;
      case 'group': {
        EventBus.emit('canvas-select', hitResult);
        EventBus.emit('canvas-interaction-start', hitResult);
        EventBus.emit('canvas-move-group', { id: hitResult.id, dx, dy });
        EventBus.emit('canvas-interaction-end');
        break;
      }
      case 'bounds-handle': {
        const attachment = this.activeBoundsConditionId ? this.compiled?.scene.attachments[this.activeBoundsConditionId] : undefined;
        const boundsCondition = attachment?.condition?.type === 'BoundsHit' ? attachment.condition : undefined;
        if (!attachment || !boundsCondition || !hitResult.handle) return;
        EventBus.emit('canvas-interaction-start', { kind: 'bounds-handle', id: attachment.id });
        const nextBounds = calculateBoundsAfterHandleDrag(boundsCondition.bounds, hitResult.handle, dx, dy);
        EventBus.emit('canvas-update-bounds', nextBounds);
        EventBus.emit('canvas-interaction-end');
        break;
      }
      default:
        break;
    }
  }

  public testDragBoundsHandle(handle: string, delta: { x: number; y: number }): void {
    const attachment = this.activeBoundsConditionId ? this.compiled?.scene.attachments[this.activeBoundsConditionId] : undefined;
    const boundsCondition = attachment?.condition?.type === 'BoundsHit' ? attachment.condition : undefined;
    if (!attachment || !boundsCondition) return;

    EventBus.emit('canvas-interaction-start', { kind: 'bounds-handle', id: attachment.id });
    const nextBounds = calculateBoundsAfterHandleDrag(boundsCondition.bounds, handle, delta.x, delta.y);
    EventBus.emit('canvas-update-bounds', nextBounds);
    EventBus.emit('canvas-interaction-end');
  }

  public testPanByScreenDelta(delta: { x: number; y: number }): void {
    const dx = delta.x / this.currentZoom;
    const dy = delta.y / this.currentZoom;
    this.applyScroll(this.cameras.main.scrollX - dx, this.cameras.main.scrollY - dy);
    this.emitViewState();
  }

  update(_time: number, delta: number): void {
    if (!this.compiled) return;
    this.compiled.actionManager.update(delta);
    for (const entity of Object.values(this.compiled.entities)) {
      const sprite = this.sprites.get(entity.id);
      if (!sprite) continue;
      sprite.setPosition(entity.x, entity.y);
      this.applyEntityDisplayProps(sprite, entity, this.compiled.scene.entities[entity.id]?.asset);
      if (this.mode === 'play') this.syncPhysicsState(entity.id, sprite, entity);
    }
    this.updateSelectionFrames();
    this.updateGroupFrames();
  }

  private syncPhysicsState(
    entityId: string,
    sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
    entity: CompiledScene['entities'][string]
  ): void {
    const physicsObject = this.physicsObjects.get(entityId);
    if (!physicsObject) return;
    if (physicsObject !== (sprite as any)) return;

    const body = physicsObject.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;

    const vx = entity.vx ?? 0;
    const vy = entity.vy ?? 0;
    const prevVel = this.physicsVelocityCache.get(entityId);
    if (!prevVel || prevVel.vx !== vx || prevVel.vy !== vy) {
      body.velocity.set(vx, vy);
      this.physicsVelocityCache.set(entityId, { vx, vy });
    }

    const w = sprite instanceof Phaser.GameObjects.Rectangle ? entity.width : sprite.displayWidth;
    const h = sprite instanceof Phaser.GameObjects.Rectangle ? entity.height : sprite.displayHeight;
    const prevSize = this.physicsSizeCache.get(entityId);
    if (!prevSize || prevSize.w !== w || prevSize.h !== h) {
      body.setSize(w, h, true);
      this.physicsSizeCache.set(entityId, { w, h });
    }

    const anyBody = body as any;
    if (typeof anyBody.updateFromGameObject === 'function') {
      anyBody.updateFromGameObject();
    }
  }

  private loadScene(project: ProjectSpec | undefined, sceneSpec: GameSceneSpec, mode: 'edit' | 'play' = 'edit'): void {
    const currentLoadVersion = ++this.loadVersion;
    this.clearScene();
    this.mode = mode;
    this.compiled = compileScene(sceneSpec, {
      callRegistry: {
        drop: (action, ctx) => {
          const dy = action.args?.dy ?? 0;
          if (!action.target) return;
          const target = resolveTarget(action.target, ctx.targets);
          const targets = flattenTarget(target);
          for (const t of targets) {
            t.y += dy;
          }
        },
        'scene.goto': (action) => {
          const sceneId = typeof action.args?.sceneId === 'string' ? String(action.args.sceneId) : '';
          console.warn(`[phaseractions] scene.goto ignored in Edit mode (sceneId=${sceneId || '""'})`);
        },
      },
    });

    void this.ensureAssetTextures(project, sceneSpec).finally(() => {
      if (currentLoadVersion !== this.loadVersion || !this.compiled) return;
      this.buildBackgroundLayers(project, sceneSpec);
      this.buildSprites();
      if (mode === 'play') this.buildFormationPhysicsGroups(sceneSpec);
      this.buildGroupFrames(sceneSpec);
      this.drawWorldFrame(sceneSpec);
      this.refreshBoundsOverlay(sceneSpec);
      this.applySelectionStyles();
      if (this.pendingViewState) {
        const nextZoom = clampZoom(this.pendingViewState.zoom);
        const world = getSceneWorld(sceneSpec);
        const clamped = clampCameraScroll(
          this.pendingViewState.scrollX,
          this.pendingViewState.scrollY,
          this.scale.width,
          this.scale.height,
          world.width,
          world.height,
          nextZoom
        );
        this.currentZoom = nextZoom;
        this.cameras.main.setZoom(nextZoom);
        this.cameras.main.setScroll(clamped.scrollX, clamped.scrollY);
        this.pendingViewState = undefined;
        this.hasInitializedView = true;
        this.emitViewState();
      } else if (!this.hasInitializedView) {
        this.fitView();
        this.hasInitializedView = true;
      } else {
        this.applyZoom(this.currentZoom);
      }
      if (mode === 'play') {
        this.compiled.startAll();
      }
    });
  }

  private clearScene(): void {
    this.backgroundObjects.forEach((obj) => obj.destroy());
    this.backgroundObjects = [];
    this.formationPhysicsGroups.forEach((group) => group.destroy());
    this.formationPhysicsGroups.clear();
    this.physicsObjects.clear();
    this.physicsVelocityCache.clear();
    this.physicsSizeCache.clear();
    this.sprites.forEach(sprite => sprite.destroy());
    this.sprites.clear();
    this.entityToGroup.clear();
    this.boundsGraphics?.destroy();
    this.boundsGraphics = undefined;
    this.boundsHandles.forEach(handle => handle.destroy());
    this.boundsHandles.clear();
    this.groupFrames.forEach(frame => frame.destroy());
    this.groupFrames.clear();
    this.groupLabels.forEach(label => label.destroy());
    this.groupLabels.clear();
    this.groupZones.forEach(zone => zone.destroy());
    this.groupZones.clear();
    this.worldFrameGraphics?.destroy();
    this.worldFrameGraphics = undefined;
    this.hoverOutline?.clear();
    this.selectionFrames?.clear();
    this.dragOverlay?.setVisible(false);
    this.activeBoundsConditionId = undefined;
  }

  private buildBackgroundLayers(project: ProjectSpec | undefined, sceneSpec: GameSceneSpec): void {
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
        this.backgroundObjects.push(sprite);
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

      this.backgroundObjects.push(image);
    }
  }

  private drawWorldFrame(scene: SceneSpec): void {
    const world = getSceneWorld(scene);
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x445d8f, 0.95);
    graphics.strokeRect(0, 0, world.width, world.height);
    graphics.lineStyle(1, 0x27324d, 0.85);
    graphics.strokeRect(-1, -1, world.width + 2, world.height + 2);
    this.worldFrameGraphics = graphics;
  }

  private buildSprites(): void {
    if (!this.compiled) return;
    const usePhysics = this.mode === 'play';
    if (usePhysics) this.ensurePlaceholderTexture();
    for (const entity of Object.values(this.compiled.entities)) {
      const asset = this.compiled.scene.entities[entity.id]?.asset;
      const textureKey = asset ? this.getTextureKey(asset) : undefined;
      let sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
      if (usePhysics) {
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
        this.configurePhysicsObject(entity.id, sprite as any);
      } else if (asset && textureKey && this.textures.exists(textureKey)) {
        const frame = asset.frame?.frameKey ?? asset.frame?.frameIndex;
        if (asset.imageType === 'spritesheet') {
          sprite = this.add.sprite(entity.x, entity.y, textureKey, frame);
        } else {
          sprite = this.add.image(entity.x, entity.y, textureKey);
        }
      } else {
        const rect = this.add.rectangle(entity.x, entity.y, entity.width, entity.height, 0x69d2ff, 0.9);
        rect.setStrokeStyle(2, 0x1a2b4a, 1);
        sprite = rect;
      }
      sprite.setInteractive();
      this.applyEntityDisplayProps(sprite, entity, asset);
      this.sprites.set(entity.id, sprite);
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

  private configurePhysicsObject(entityId: string, sprite: PhysicsObject): void {
    const body = sprite.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;

    body.setAllowGravity(false);
    body.moves = false;
    body.setImmovable(true);
    this.physicsObjects.set(entityId, sprite);
  }

  private buildFormationPhysicsGroups(scene: SceneSpec): void {
    if (this.mode !== 'play') return;
    if (!this.compiled) return;

    for (const [groupId, groupSpec] of Object.entries(scene.groups)) {
      const physicsGroup = this.physics.add.group();
      for (const memberId of groupSpec.members) {
        const obj = this.physicsObjects.get(memberId);
        if (obj) physicsGroup.add(obj);
      }
      this.formationPhysicsGroups.set(groupId, physicsGroup);
    }
  }

  private buildGroupFrames(scene: SceneSpec): void {
    if (!this.compiled) return;

    for (const [groupId, group] of Object.entries(this.compiled.groups)) {
      group.members.forEach((member) => this.entityToGroup.set(member.id, groupId));

      const frame = this.add.graphics();
      const label = this.add.text(0, 0, scene.groups[groupId]?.name ?? groupId, {
        color: '#ffdf9d',
        fontFamily: 'IBM Plex Mono',
        fontSize: '11px',
      });
      label.setDepth(10);

      const zone = this.add.zone(0, 0, 1, 1);
      zone.setInteractive();

      this.groupFrames.set(groupId, frame);
      this.groupLabels.set(groupId, label);
      this.groupZones.set(groupId, zone);
    }

    this.updateGroupFrames();
  }

  private updateGroupFrames(): void {
    if (!this.compiled) return;

    for (const [groupId, group] of Object.entries(this.compiled.groups)) {
      const frame = this.groupFrames.get(groupId);
      const label = this.groupLabels.get(groupId);
      const zone = this.groupZones.get(groupId);
      if (!frame || !label || !zone) continue;

      const bounds = this.getGroupBounds(groupId, group.getBounds());
      const display = getGroupFrameDisplay(this.selection, groupId);
      frame.clear();
      frame.setVisible(display.showFrame);
      if (display.showFrame) {
        frame.lineStyle(display.frameWidth, display.frameColor, display.frameAlpha);
        frame.strokeRoundedRect(
          bounds.minX - 10,
          bounds.minY - 10,
          bounds.maxX - bounds.minX + 20,
          bounds.maxY - bounds.minY + 20,
          10
        );
      }

      label.setPosition(bounds.minX - 6, bounds.minY - 28);
      label.setVisible(display.showLabel);
      label.setAlpha(display.labelAlpha);

      zone.setPosition((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
      zone.setSize(bounds.maxX - bounds.minX + 20, bounds.maxY - bounds.minY + 20);
    }
  }

  private getGroupBounds(
    groupId: string,
    fallback: { minX: number; minY: number; maxX: number; maxY: number }
  ): { minX: number; minY: number; maxX: number; maxY: number } {
    if (this.mode !== 'play') return fallback;
    const physicsGroup = this.formationPhysicsGroups.get(groupId);
    if (!physicsGroup) return fallback;

    const rects = physicsGroup.getChildren()
      .map((child) => (child as any).body as Phaser.Physics.Arcade.Body | undefined)
      .filter((body): body is Phaser.Physics.Arcade.Body => Boolean(body))
      .map((body) => ({ minX: body.left, minY: body.top, maxX: body.right, maxY: body.bottom }));

    if (rects.length === 0) return fallback;
    return computeAabbBounds(rects);
  }

  private updateBounds(bounds: { minX: number; minY: number; maxX: number; maxY: number }): void {
    // Update bounds graphics
    if (this.boundsGraphics) {
      this.boundsGraphics.clear();
      this.boundsGraphics.lineStyle(2, 0x3b4f82, 1);
      this.boundsGraphics.strokeRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    }

    // Update bounds handles using utility
    const handles = getBoundsHandles(bounds);
    for (const handle of handles) {
      const zone = this.boundsHandles.get(handle.id);
      if (zone) {
        zone.setPosition(handle.x, handle.y);
      }
    }
  }

  private refreshBoundsOverlay(scene: SceneSpec): void {
    this.boundsGraphics?.destroy();
    this.boundsGraphics = undefined;
    this.boundsHandles.forEach((handle) => handle.destroy());
    this.boundsHandles.clear();

    const attachmentId = getEditableBoundsConditionId(scene, this.selection);
    this.activeBoundsConditionId = attachmentId;
    const attachment = attachmentId ? scene.attachments[attachmentId] : undefined;
    const boundsCondition = attachment?.condition?.type === 'BoundsHit' ? attachment.condition : undefined;
    if (!boundsCondition) return;
    const bounds = boundsCondition.bounds;
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x3b4f82, 1);
    graphics.strokeRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    this.boundsGraphics = graphics;

    // Create resize handles using utility
    const handles = getBoundsHandles(bounds);
    for (const handle of handles) {
      const zone = this.add.zone(handle.x, handle.y, handle.size, handle.size);
      zone.setInteractive();
      this.boundsHandles.set(handle.id, zone);
    }
  }

  private handleSelectionChanged(selection: Selection): void {
    this.selection = selection;
    if (this.dragState?.kind === 'entity' && this.dragState.awaitingDuplicate) {
      const ids = selection.kind === 'entity'
        ? [selection.id]
        : selection.kind === 'entities'
          ? selection.ids
          : [];
      if (ids.length > 0) {
        this.dragState.entityIds = ids;
        this.dragState.awaitingDuplicate = false;
        if (this.lastPointerWorldPoint) {
          this.dragState.startX = this.lastPointerWorldPoint.x;
          this.dragState.startY = this.lastPointerWorldPoint.y;
        }
      }
    }
    this.applySelectionStyles();
    this.updateSelectionFrames();
    this.updateGroupFrames();
    if (this.compiled) this.refreshBoundsOverlay(this.compiled.scene);
  }

  private applySelectionStyles(): void {
    for (const [entityId, sprite] of this.sprites.entries()) {
      const groupId = this.entityToGroup.get(entityId);
      const selectedEntity = this.selection.kind === 'entity' && this.selection.id === entityId;
      const selectedGroup = this.selection.kind === 'group' && groupId === this.selection.id;
      const selectedEntities = this.selection.kind === 'entities' && this.selection.ids.includes(entityId);
      const inGroup = Boolean(groupId);
      const entity = this.compiled?.entities[entityId];
      const baseAlpha = entity?.alpha ?? 1;

      const isSelected = selectedEntity || selectedGroup || selectedEntities;
      sprite.setAlpha(isSelected ? baseAlpha : inGroup ? baseAlpha * 0.72 : baseAlpha * 0.9);
      const outlineColor = selectedEntity ? 0xffb86b : selectedGroup ? 0x9fe7ff : selectedEntities ? 0xff6b6b : 0x1a2b4a;
      if (sprite instanceof Phaser.GameObjects.Rectangle) {
        sprite.setStrokeStyle(isSelected ? 3 : 2, outlineColor, 1);
      } else {
        sprite.setTint(isSelected ? outlineColor : 0xffffff);
      }
    }
  }

  private updateSelectionFrames(): void {
    const gfx = this.selectionFrames;
    if (!gfx) return;
    gfx.clear();

    const ids = this.selection.kind === 'entity'
      ? [this.selection.id]
      : this.selection.kind === 'entities'
        ? this.selection.ids
        : [];
    if (ids.length === 0) return;

    gfx.lineStyle(2, 0xffb86b, 0.95);
    for (const id of ids) {
      const sprite = this.sprites.get(id);
      if (!sprite) continue;
      const bounds = sprite.getBounds();
      gfx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
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

  private getBackgroundTextureKey(assetId: string): string {
    return `bg:${assetId}`;
  }

  private async ensureAssetTextures(project: ProjectSpec | undefined, sceneSpec: GameSceneSpec): Promise<void> {
    const pendingAssets = Object.values(sceneSpec.entities)
      .map((entity) => entity.asset)
      .filter((asset): asset is SpriteAssetSpec => Boolean(asset))
      .filter((asset) => !this.textures.exists(this.getTextureKey(asset)));

    const pendingBackgrounds: Array<{ key: string; url: string }> = [];
    const backgroundLayers = sceneSpec.backgroundLayers ?? [];
    if (project && backgroundLayers.length > 0) {
      for (const layer of backgroundLayers) {
        const asset = project.assets.images?.[layer.assetId];
        if (!asset) continue;
        const key = this.getBackgroundTextureKey(asset.id);
        if (this.textures.exists(key)) continue;
        pendingBackgrounds.push({
          key,
          url: asset.source.kind === 'embedded' ? asset.source.dataUrl : asset.source.path,
        });
      }
    }

    if (pendingAssets.length === 0 && pendingBackgrounds.length === 0) return;

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

    await new Promise<void>((resolve) => {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.once(Phaser.Loader.Events.LOAD_ERROR, () => resolve());
      this.load.start();
    });
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.mode !== 'edit') return;
    if (this.shouldStartPan(pointer)) {
      this.panState = {
        startPointerX: pointer.x,
        startPointerY: pointer.y,
        startScrollX: this.cameras.main.scrollX,
        startScrollY: this.cameras.main.scrollY,
      };
      this.input.setDefaultCursor('grabbing');
      return;
    }
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    // Use new hit testing
    const hitResult = hitTestCanvas(
      worldPoint,
      this.compiled?.scene || { id: 'scene', entities: {}, groups: {}, attachments: {}, behaviors: {}, actions: {}, conditions: {} },
      this.sprites,
      this.groupZones,
      this.boundsHandles
    );

    if (hitResult.kind === 'none') {
      // Start marquee selection on empty canvas click
      this.pendingDrag = {
        startPoint: { x: worldPoint.x, y: worldPoint.y },
        hitResult
      };
      return;
    }

    // Store pending drag info for entity/group/bounds
    this.pendingDrag = {
      startPoint: { x: worldPoint.x, y: worldPoint.y },
      hitResult
    };
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.mode !== 'edit') return;
    this.wheelZoomAnchor = undefined;
    if (this.panState) {
      const dx = (pointer.x - this.panState.startPointerX) / this.currentZoom;
      const dy = (pointer.y - this.panState.startPointerY) / this.currentZoom;
      this.applyScroll(this.panState.startScrollX - dx, this.panState.startScrollY - dy);
      this.emitViewState();
      return;
    }
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.lastPointerWorldPoint = { x: worldPoint.x, y: worldPoint.y };

    // Update hover state and cursor
    const hitResult = hitTestCanvas(
      worldPoint,
      this.compiled?.scene || { id: 'scene', entities: {}, groups: {}, attachments: {}, behaviors: {}, actions: {}, conditions: {} },
      this.sprites,
      this.groupZones,
      this.boundsHandles
    );
    this.updateHoverState(hitResult);
    this.updateCursor(hitResult);

    // Handle pending drag (drag threshold)
    if (this.pendingDrag && !this.dragState) {
      if (hasExceededDragThreshold(this.pendingDrag.startPoint, worldPoint)) {
        const altKey = Boolean(pointer.event && 'altKey' in pointer.event && (pointer.event as MouseEvent).altKey);
        // Start actual drag
        const { hitResult } = this.pendingDrag;
        if (hitResult.kind === 'none') {
          // Start marquee selection
          this.dragState = {
            kind: 'marquee',
            startX: this.pendingDrag.startPoint.x,
            startY: this.pendingDrag.startPoint.y,
            hasMoved: false
          };
          // Create marquee rectangle
          this.createMarqueeRectangle();
        } else if (hitResult.kind === 'bounds-handle') {
          const attachmentId = this.activeBoundsConditionId;
          const attachment = attachmentId ? this.compiled?.scene.attachments[attachmentId] : undefined;
          const boundsCondition = attachment?.condition?.type === 'BoundsHit' ? attachment.condition : undefined;
          if (!attachment || !boundsCondition) return;

          this.dragState = {
            kind: 'bounds-handle',
            id: attachment.id,
            startX: worldPoint.x,
            startY: worldPoint.y,
            handle: hitResult.handle,
            hasMoved: false
          };
          EventBus.emit('canvas-interaction-start', { kind: 'bounds-handle', id: attachment.id });
        } else {
          if (hitResult.kind === 'entity') {
            const isMulti = this.selection.kind === 'entities' && this.selection.ids.includes(hitResult.id!);
            const dragEntityIds = isMulti ? this.selection.ids : [hitResult.id!];

            this.dragState = {
              kind: 'entity',
              id: hitResult.id!,
              entityIds: altKey ? [] : dragEntityIds,
              awaitingDuplicate: altKey,
              startX: worldPoint.x,
              startY: worldPoint.y,
              hasMoved: false,
            };

            EventBus.emit('canvas-interaction-start', dragEntityIds.length > 1 ? { kind: 'entities', id: dragEntityIds.join(',') } : hitResult);
            if (altKey) {
              EventBus.emit('canvas-duplicate-entities', { entityIds: dragEntityIds });
            } else if (!isMulti) {
              EventBus.emit('canvas-select', hitResult);
            }
          } else {
            EventBus.emit('canvas-select', hitResult);
            this.dragState = {
              kind: hitResult.kind as 'entity' | 'group',
              id: hitResult.id!,
              startX: worldPoint.x,
              startY: worldPoint.y,
              hasMoved: false
            };
            EventBus.emit('canvas-interaction-start', hitResult);
          }
        }
        this.pendingDrag = undefined;
      }
      return;
    }

    // Handle active drag
    if (!this.dragState) return;

    if (this.dragState.kind === 'entity' && this.dragState.awaitingDuplicate) {
      // Keep drag deltas stable until the store has created/selected the duplicates.
      this.dragState.startX = worldPoint.x;
      this.dragState.startY = worldPoint.y;
      return;
    }

    const dx = worldPoint.x - this.dragState.startX;
    const dy = worldPoint.y - this.dragState.startY;

    // Mark as moved if not already
    if (!this.dragState.hasMoved && (Math.abs(dx) > 0 || Math.abs(dy) > 0)) {
      this.dragState.hasMoved = true;
    }

    // Apply grid snapping to deltas
    const snappedDx = Math.round(this.snapDeltaToGrid(dx));
    const snappedDy = Math.round(this.snapDeltaToGrid(dy));

    if (snappedDx === 0 && snappedDy === 0 && this.dragState.kind !== 'marquee') {
      // Avoid emitting no-op mutations (prevents useless history entries).
      return;
    }

    if (this.dragState.kind === 'marquee') {
      // Update marquee rectangle
      this.dragState.currentX = worldPoint.x;
      this.dragState.currentY = worldPoint.y;
      this.updateMarqueeRectangle(this.dragState.startX, this.dragState.startY, worldPoint.x, worldPoint.y);
    } else if (this.dragState.kind === 'entity') {
      const entityIds = this.dragState.entityIds ?? (this.dragState.id ? [this.dragState.id] : []);
      if (entityIds.length > 0) {
        EventBus.emit('canvas-move-entities', { entityIds, dx: snappedDx, dy: snappedDy });
      }
    } else if (this.dragState.kind === 'group') {
      EventBus.emit('canvas-move-group', { id: this.dragState.id, dx: snappedDx, dy: snappedDy });
    } else if (this.dragState.kind === 'bounds-handle' && this.dragState.handle) {
      // Calculate new bounds based on handle being dragged
      const attachment = this.activeBoundsConditionId ? this.compiled?.scene.attachments[this.activeBoundsConditionId] : undefined;
      const boundsCondition = attachment?.condition?.type === 'BoundsHit' ? attachment.condition : undefined;
      if (!boundsCondition) return;
      const newBounds = calculateBoundsAfterHandleDrag(boundsCondition.bounds, this.dragState.handle, snappedDx, snappedDy);
      EventBus.emit('canvas-update-bounds', newBounds);
    }

    // Update drag overlay
    if (this.dragOverlay) {
      const attachment = this.activeBoundsConditionId ? this.compiled?.scene.attachments[this.activeBoundsConditionId] : undefined;
      const boundsCondition = attachment?.condition?.type === 'BoundsHit' ? attachment.condition : undefined;
      updateDragOverlay(this.dragOverlay, this.dragState, worldPoint, boundsCondition?.bounds);
    }

    if (this.dragState.kind !== 'marquee') {
      this.dragState.startX += snappedDx;
      this.dragState.startY += snappedDy;
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.mode !== 'edit') return;
    this.wheelZoomAnchor = undefined;
    if (this.panState) {
      this.panState = undefined;
      this.input.setDefaultCursor(this.isSpacePanning ? 'grab' : 'default');
      return;
    }
    if (this.dragState) {
      if (this.dragState.kind === 'marquee') {
        // Complete marquee selection
        const endX = this.dragState.currentX || this.dragState.startX;
        const endY = this.dragState.currentY || this.dragState.startY;
        const selectedEntityIds = this.getEntitiesInMarquee(this.dragState.startX, this.dragState.startY, endX, endY);
        const shiftKey = Boolean(pointer.event && 'shiftKey' in pointer.event && (pointer.event as MouseEvent).shiftKey);
        if (shiftKey) {
          const baseIds =
            this.selection.kind === 'entities'
              ? this.selection.ids
              : this.selection.kind === 'entity'
                ? [this.selection.id]
                : [];
          const merged = [...baseIds];
          for (const id of selectedEntityIds) {
            if (!merged.includes(id)) merged.push(id);
          }
          EventBus.emit('canvas-select-multiple', { entityIds: merged, additive: false });
        } else {
          EventBus.emit('canvas-select-multiple', { entityIds: selectedEntityIds, additive: false });
        }
        this.destroyMarqueeRectangle();
      }
      EventBus.emit('canvas-interaction-end');
      this.dragState = undefined;
      if (this.dragOverlay) {
        this.dragOverlay.setVisible(false);
      }
    } else if (this.pendingDrag) {
      const { hitResult } = this.pendingDrag;
      if (hitResult.kind === 'entity' || hitResult.kind === 'group') {
        const shiftKey = Boolean(pointer.event && 'shiftKey' in pointer.event && (pointer.event as MouseEvent).shiftKey);
        if (shiftKey && hitResult.kind === 'entity') {
          EventBus.emit('canvas-select-multiple', { entityIds: [hitResult.id], additive: true });
        } else {
          EventBus.emit('canvas-select', hitResult);
        }
      } else if (hitResult.kind === 'none') {
        const shiftKey = Boolean(pointer.event && 'shiftKey' in pointer.event && (pointer.event as MouseEvent).shiftKey);
        if (!shiftKey) {
          EventBus.emit('canvas-select-multiple', { entityIds: [], additive: false });
        }
      }
    }
    this.pendingDrag = undefined;
  }

  private handleWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number
  ): void {
    if (!this.compiled || this.dragState || this.panState) return;
    const rawEvent = pointer.event;
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const scaleX = canvasRect.width > 0 ? this.scale.width / canvasRect.width : 1;
    const scaleY = canvasRect.height > 0 ? this.scale.height / canvasRect.height : 1;
    const pointerX = rawEvent && 'clientX' in rawEvent
      ? (rawEvent.clientX - canvasRect.left) * scaleX
      : this.input.activePointer.x;
    const pointerY = rawEvent && 'clientY' in rawEvent
      ? (rawEvent.clientY - canvasRect.top) * scaleY
      : this.input.activePointer.y;
    this.applyWheelZoom(pointerX, pointerY, deltaX, deltaY);
  }

  private applyWheelZoom(pointerX: number, pointerY: number, deltaX: number, deltaY: number): void {
    if (!this.wheelZoomAnchor
      || Math.abs(this.wheelZoomAnchor.pointerX - pointerX) > 0.5
      || Math.abs(this.wheelZoomAnchor.pointerY - pointerY) > 0.5) {
      const worldPoint = this.cameras.main.getWorldPoint(pointerX, pointerY);
      this.wheelZoomAnchor = { pointerX, pointerY, worldX: worldPoint.x, worldY: worldPoint.y };
    }
    const dominantDelta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
    const nextZoom = clampZoom(this.currentZoom + (dominantDelta < 0 ? 0.1 : -0.1));
    if (nextZoom === this.currentZoom) return;

    const nextScroll = getZoomedScroll(
      this.wheelZoomAnchor.worldX,
      this.wheelZoomAnchor.worldY,
      this.wheelZoomAnchor.pointerX,
      this.wheelZoomAnchor.pointerY,
      nextZoom,
      this.scale.width,
      this.scale.height
    );
    this.currentZoom = nextZoom;
    this.cameras.main.setZoom(nextZoom);
    this.applyScroll(nextScroll.scrollX, nextScroll.scrollY, false);
    this.emitViewState();
  }

  private updateHoverState(hitResult: HitTestResult): void {
    const newHoverState: HoverState = {
      kind: hitResult.kind,
      id: hitResult.id,
      handle: hitResult.handle
    };

    if (this.hoverState.kind !== newHoverState.kind ||
        this.hoverState.id !== newHoverState.id ||
        this.hoverState.handle !== newHoverState.handle) {
      this.hoverState = newHoverState;
      if (this.hoverOutline) {
        const attachmentId = this.compiled?.scene ? getEditableBoundsConditionId(this.compiled.scene, this.selection) : undefined;
        const attachment = attachmentId ? this.compiled?.scene.attachments[attachmentId] : undefined;
        const bounds = attachment?.condition?.type === 'BoundsHit' ? attachment.condition.bounds : undefined;
        updateHoverOutline(this.hoverOutline, this.hoverState, this.sprites, this.groupZones, bounds);
      }
    }
  }

  private updateCursor(hitResult: HitTestResult): void {
    const cursor = getCursorForHitTest(hitResult);
    this.input.setDefaultCursor(cursor);
  }

  private zoomIn(): void {
    this.applyZoom(getNextZoom(this.currentZoom, 'in'));
  }

  private zoomOut(): void {
    this.applyZoom(getNextZoom(this.currentZoom, 'out'));
  }

  private resetZoom(): void {
    this.applyZoom(1);
  }

  private fitView(): void {
    const world = getSceneWorld(this.compiled?.scene ?? { id: '', entities: {}, groups: {}, behaviors: {}, actions: {}, conditions: {} });
    const zoom = getFitZoom(this.scale.width, this.scale.height, world.width, world.height);
    this.applyZoom(zoom);
  }

  private applyZoom(zoom: number): void {
    const world = getSceneWorld(this.compiled?.scene ?? { id: '', entities: {}, groups: {}, behaviors: {}, actions: {}, conditions: {} });
    this.currentZoom = clampZoom(zoom);
    this.cameras.main.setZoom(this.currentZoom);
    const centeredScrollX = world.width / 2 - this.scale.width / (2 * this.currentZoom);
    const centeredScrollY = world.height / 2 - this.scale.height / (2 * this.currentZoom);
    this.applyScroll(centeredScrollX, centeredScrollY);
    this.emitViewState();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.mode !== 'edit') return;
    if (event.target instanceof HTMLElement) {
      const tag = event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable) {
        return;
      }
    }
    if (event.code === 'Space') {
      event.preventDefault();
      this.isSpacePanning = true;
      if (!this.panState) this.input.setDefaultCursor('grab');
      return;
    }
    const nudgeAmount = event.shiftKey ? 10 : 1; // Shift for larger nudges

    let dx = 0;
    let dy = 0;

    switch (event.key) {
      case 'ArrowLeft':
        dx = -nudgeAmount;
        break;
      case 'ArrowRight':
        dx = nudgeAmount;
        break;
      case 'ArrowUp':
        dy = -nudgeAmount;
        break;
      case 'ArrowDown':
        dy = nudgeAmount;
        break;
      case 'z':
      case 'Z':
        return;
      case 'y':
      case 'Y':
        return;
      case 'g':
      case 'G':
        if (event.ctrlKey || event.metaKey) {
          if (event.shiftKey) {
            // Ctrl+Shift+G: Create group from selection
            if (this.selection.kind === 'entities') {
              const groupName = `Group ${Object.keys(this.compiled?.scene?.groups ?? {}).length + 1}`;
              EventBus.emit('create-group-from-selection', groupName);
            }
          } else {
            // Ctrl+G: Toggle grid
            event.preventDefault();
            this.toggleGridSnap();
          }
        }
        return;
      case 'u':
      case 'U':
        if (event.ctrlKey || event.metaKey) {
          if (event.shiftKey) {
            // Ctrl+Shift+U: Dissolve group
            if (this.selection.kind === 'group') {
              EventBus.emit('dissolve-group', this.selection.id);
            }
          }
        }
        return;
      case 'Tab':
        event.preventDefault();
        EventBus.emit('toggle-mode');
        return;
      default:
        return; // Not a handled key
    }

    event.preventDefault();

    // Apply nudge based on current selection
    if (this.selection.kind === 'entity') {
      EventBus.emit('canvas-move-entity', { id: this.selection.id, dx, dy });
    } else if (this.selection.kind === 'group') {
      EventBus.emit('canvas-move-group', { id: this.selection.id, dx, dy });
    } else if (this.selection.kind === 'entities') {
      EventBus.emit('canvas-move-entities', { entityIds: this.selection.ids, dx, dy });
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (event.code !== 'Space') return;
    this.isSpacePanning = false;
    if (!this.panState) this.input.setDefaultCursor('default');
  }

  private snapToGrid(value: number): number {
    if (!this.gridEnabled) return value;
    return Math.round(value / this.gridSize) * this.gridSize;
  }

  private snapDeltaToGrid(delta: number): number {
    if (!this.gridEnabled) return delta;
    return Math.round(delta / this.gridSize) * this.gridSize;
  }

  private toggleGridSnap(): void {
    if (this.mode !== 'edit') return;
    this.gridEnabled = !this.gridEnabled;
    EventBus.emit('grid-toggled', this.gridEnabled);
  }

  private applyScroll(scrollX: number, scrollY: number, clamp = true): void {
    if (!clamp) {
      this.cameras.main.setScroll(scrollX, scrollY);
      return;
    }
    const world = getSceneWorld(this.compiled?.scene ?? { id: '', entities: {}, groups: {}, behaviors: {}, actions: {}, conditions: {} });
    const clamped = clampCameraScroll(
      scrollX,
      scrollY,
      this.scale.width,
      this.scale.height,
      world.width,
      world.height,
      this.currentZoom
    );
    this.cameras.main.setScroll(clamped.scrollX, clamped.scrollY);
  }

  private emitViewState(): void {
    const world = getSceneWorld(this.compiled?.scene ?? { id: '', entities: {}, groups: {}, behaviors: {}, actions: {}, conditions: {} });
    EventBus.emit('scene-view-state', {
      zoom: this.currentZoom,
      worldWidth: world.width,
      worldHeight: world.height,
    });
  }

  private shouldStartPan(pointer: Phaser.Input.Pointer): boolean {
    const world = getSceneWorld(this.compiled?.scene ?? { id: '', entities: {}, groups: {}, behaviors: {}, actions: {}, conditions: {} });
    return canPanCamera(this.scale.width, this.scale.height, world.width, world.height, this.currentZoom)
      && (this.isMiddleMouseDown || pointer.button === 1 || (this.isSpacePanning && pointer.leftButtonDown()));
  }

  private createMarqueeRectangle(): void {
    if (this.marqueeGraphics) {
      this.marqueeGraphics.destroy();
    }
    this.marqueeGraphics = this.add.graphics();
    this.marqueeGraphics.setDepth(999);
  }

  private updateMarqueeRectangle(startX: number, startY: number, endX: number, endY: number): void {
    if (!this.marqueeGraphics) return;

    this.marqueeGraphics.clear();
    this.marqueeGraphics.lineStyle(2, 0x00ff00, 0.8);
    this.marqueeGraphics.fillStyle(0x00ff00, 0.1);

    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    this.marqueeGraphics.fillRect(x, y, width, height);
    this.marqueeGraphics.strokeRect(x, y, width, height);
  }

  private destroyMarqueeRectangle(): void {
    if (this.marqueeGraphics) {
      this.marqueeGraphics.destroy();
      this.marqueeGraphics = undefined;
    }
  }

  private getEntitiesInMarquee(startX: number, startY: number, endX: number, endY: number): string[] {
    if (!this.compiled?.scene) return [];

    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    const selectedEntityIds: string[] = [];

    for (const [entityId, entity] of Object.entries(this.compiled.scene.entities)) {
      if (entity.x >= x && entity.x <= x + width && entity.y >= y && entity.y <= y + height) {
        selectedEntityIds.push(entityId);
      }
    }

    return selectedEntityIds;
  }
}

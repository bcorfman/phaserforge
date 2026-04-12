import Phaser from 'phaser';
import { EventBus, setActiveScene } from './EventBus';
import { compileScene, CompiledScene } from '../compiler/compileScene';
import { SceneSpec, BoundsHitConditionSpec, SpriteAssetSpec, type HitboxSpec } from '../model/types';
import { Selection } from '../editor/EditorStore';
import { flattenTarget, resolveTarget } from '../runtime/targets/resolveTarget';
import { getRotatedEntityBounds } from '../runtime/geometry';
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
import { getCurrentAppStateSnapshot, registerSceneGetter, unregisterSceneGetter } from '../testing/testBridge';

export class EditorScene extends Phaser.Scene {
  private compiled?: CompiledScene;
  private sprites = new Map<string, Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>();
  private entityToGroup = new Map<string, string>();
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
  private pendingDrag?: { startPoint: { x: number; y: number }; hitResult: HitTestResult };
  private gridEnabled = false;
  private gridSize = 10;
  private operationHistory: Array<{
    type: 'move-entity' | 'move-group' | 'move-entities' | 'update-bounds';
    id: string;
    before: any;
    after: any;
  }> = [];
  private historyIndex = -1;
  private marqueeGraphics?: Phaser.GameObjects.Graphics;
  private mode: 'edit' | 'play' = 'edit';
  private activeBoundsConditionId?: string;
  private worldFrameGraphics?: Phaser.GameObjects.Graphics;
  private currentZoom = 1;
  private hasInitializedView = false;
  private isSpacePanning = false;
  private isMiddleMouseDown = false;
  private wheelZoomAnchor?: { pointerX: number; pointerY: number; worldX: number; worldY: number };
  private panState?: { startPointerX: number; startPointerY: number; startScrollX: number; startScrollY: number };
  private readonly sceneBridgeGetter = () => this;
  private loadVersion = 0;

  constructor() {
    super('EditorScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0c0f1a');
    this.cameras.main.roundPixels = true;
    setActiveScene(this);
    registerSceneGetter(this.sceneBridgeGetter);
    EventBus.on('load-scene', this.loadScene, this);
    EventBus.on('selection-changed', this.handleSelectionChanged, this);
    EventBus.on('canvas-update-bounds', this.updateBounds, this);
    EventBus.on('scene-zoom-in', this.zoomIn, this);
    EventBus.on('scene-zoom-out', this.zoomOut, this);
    EventBus.on('scene-fit-view', this.fitView, this);
    EventBus.on('scene-reset-zoom', this.resetZoom, this);
    EventBus.emit('current-scene-ready', this);

    // Initialize overlays
    this.dragOverlay = createDragOverlayText(this);
    this.hoverOutline = createHoverOutline(this);

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('wheel', this.handleWheel, this);

    // App-level keyboard shortcuts should not depend on canvas focus.
    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);
    window.addEventListener('mousedown', this.handleMouseDownBound);
    window.addEventListener('mouseup', this.handleMouseUpBound);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      setActiveScene(null);
      unregisterSceneGetter(this.sceneBridgeGetter);
      EventBus.off('load-scene', this.loadScene, this);
      EventBus.off('selection-changed', this.handleSelectionChanged, this);
      EventBus.off('canvas-update-bounds', this.updateBounds, this);
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
    });
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

  public getTestSnapshot(): {
    ready: boolean;
    zoom: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
  } {
    return {
      ready: Boolean(this.compiled),
      zoom: this.currentZoom,
      scrollX: this.cameras.main.scrollX,
      scrollY: this.cameras.main.scrollY,
      viewportWidth: this.scale.width,
      viewportHeight: this.scale.height,
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

    const bounds = group.getBounds();
    return {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
    };
  }

  public getEditableBoundsRect(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const conditionId = this.activeBoundsConditionId;
    const condition = conditionId ? this.compiled?.scene.conditions[conditionId] : undefined;
    if (!condition || condition.type !== 'BoundsHit') return null;

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

  public testTapWorld(point: { x: number; y: number }): void {
    const hitResult = hitTestCanvas(
      point,
      this.compiled?.scene || { entities: {}, groups: {}, behaviors: {}, actions: {}, conditions: {} },
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
      this.compiled?.scene || { entities: {}, groups: {}, behaviors: {}, actions: {}, conditions: {} },
      this.sprites,
      this.groupZones,
      this.boundsHandles
    );
    const dx = this.snapDeltaToGrid(end.x - start.x);
    const dy = this.snapDeltaToGrid(end.y - start.y);

    if (dx === 0 && dy === 0) return;

    switch (hitResult.kind) {
      case 'entity':
        this.recordOperation('move-entity', hitResult.id!, this.compiled?.entities[hitResult.id!]);
        EventBus.emit('canvas-select', hitResult);
        EventBus.emit('canvas-move-entity', { id: hitResult.id, dx, dy });
        if (this.operationHistory[this.historyIndex]?.before) {
          const before = this.operationHistory[this.historyIndex].before;
          this.operationHistory[this.historyIndex].after = { ...before, x: before.x + dx, y: before.y + dy };
        }
        break;
      case 'group': {
        const groupMembers = this.compiled?.groups[hitResult.id!]?.members || [];
        const beforeState = groupMembers.map((member) => ({ id: member.id, entity: this.compiled?.entities[member.id] }));
        this.recordOperation('move-group', hitResult.id!, beforeState);
        EventBus.emit('canvas-select', hitResult);
        EventBus.emit('canvas-move-group', { id: hitResult.id, dx, dy });
        this.operationHistory[this.historyIndex].after = beforeState.map((memberState) => ({
          id: memberState.id,
          entity: memberState.entity ? { ...memberState.entity, x: memberState.entity.x + dx, y: memberState.entity.y + dy } : undefined,
        }));
        break;
      }
      case 'bounds-handle': {
        const boundsCondition = this.activeBoundsConditionId ? this.compiled?.scene.conditions[this.activeBoundsConditionId] : undefined;
        if (boundsCondition?.type !== 'BoundsHit' || !hitResult.handle) return;
        this.recordOperation('update-bounds', boundsCondition.id, boundsCondition.bounds);
        const nextBounds = calculateBoundsAfterHandleDrag(boundsCondition.bounds, hitResult.handle, dx, dy);
        EventBus.emit('canvas-update-bounds', nextBounds);
        this.operationHistory[this.historyIndex].after = nextBounds;
        break;
      }
      default:
        break;
    }
  }

  public testDragBoundsHandle(handle: string, delta: { x: number; y: number }): void {
    const boundsCondition = this.activeBoundsConditionId ? this.compiled?.scene.conditions[this.activeBoundsConditionId] : undefined;
    if (boundsCondition?.type !== 'BoundsHit') return;

    this.recordOperation('update-bounds', boundsCondition.id, boundsCondition.bounds);
    const nextBounds = calculateBoundsAfterHandleDrag(boundsCondition.bounds, handle, delta.x, delta.y);
    EventBus.emit('canvas-update-bounds', nextBounds);
    this.operationHistory[this.historyIndex].after = nextBounds;
  }

  public testPanByScreenDelta(delta: { x: number; y: number }): void {
    const dx = delta.x / this.currentZoom;
    const dy = delta.y / this.currentZoom;
    this.applyScroll(this.cameras.main.scrollX - dx, this.cameras.main.scrollY - dy);
    this.emitViewState();
  }

  public testUndo(): void {
    this.undo();
  }

  public testRedo(): void {
    this.redo();
  }

  update(_time: number, delta: number): void {
    if (!this.compiled) return;
    this.compiled.actionManager.update(delta);
    for (const entity of Object.values(this.compiled.entities)) {
      const sprite = this.sprites.get(entity.id);
      if (!sprite) continue;
      sprite.setPosition(entity.x, entity.y);
      this.applyEntityDisplayProps(sprite, entity, this.compiled.scene.entities[entity.id]?.asset);
    }
    this.updateGroupFrames();
  }

  private loadScene(sceneSpec: SceneSpec, mode: 'edit' | 'play' = 'edit'): void {
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
      },
    });

    void this.ensureAssetTextures(sceneSpec).finally(() => {
      if (currentLoadVersion !== this.loadVersion || !this.compiled) return;
      this.buildSprites();
      this.buildGroupFrames(sceneSpec);
      this.drawWorldFrame(sceneSpec);
      this.refreshBoundsOverlay(sceneSpec);
      this.applySelectionStyles();
      if (!this.hasInitializedView) {
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
    this.dragOverlay?.setVisible(false);
    this.activeBoundsConditionId = undefined;
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
    for (const entity of Object.values(this.compiled.entities)) {
      const asset = this.compiled.scene.entities[entity.id]?.asset;
      const textureKey = asset ? this.getTextureKey(asset) : undefined;
      let sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
      if (asset && textureKey && this.textures.exists(textureKey)) {
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

      const bounds = group.getBounds();
      const selected = this.selection.kind === 'group' && this.selection.id === groupId;
      frame.clear();
      frame.lineStyle(selected ? 3 : 2, selected ? 0xffb86b : 0x5aa9c8, selected ? 0.95 : 0.55);
      frame.strokeRoundedRect(
        bounds.minX - 10,
        bounds.minY - 10,
        bounds.maxX - bounds.minX + 20,
        bounds.maxY - bounds.minY + 20,
        10
      );

      label.setPosition(bounds.minX - 6, bounds.minY - 28);
      label.setAlpha(selected ? 1 : 0.75);

      zone.setPosition((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
      zone.setSize(bounds.maxX - bounds.minX + 20, bounds.maxY - bounds.minY + 20);
    }
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

    const boundsConditionId = getEditableBoundsConditionId(scene, this.selection);
    this.activeBoundsConditionId = boundsConditionId;
    const boundsCondition = boundsConditionId ? scene.conditions[boundsConditionId] : undefined;
    if (!boundsCondition || boundsCondition.type !== 'BoundsHit') return;

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
    this.applySelectionStyles();
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

  private async ensureAssetTextures(sceneSpec: SceneSpec): Promise<void> {
    const pendingAssets = Object.values(sceneSpec.entities)
      .map((entity) => entity.asset)
      .filter((asset): asset is SpriteAssetSpec => Boolean(asset))
      .filter((asset) => !this.textures.exists(this.getTextureKey(asset)));

    if (pendingAssets.length === 0) return;

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
    const hitResult = hitTestCanvas(worldPoint, this.compiled?.scene || { entities: {}, groups: {}, behaviors: {}, actions: {}, conditions: {} }, this.sprites, this.groupZones, this.boundsHandles);

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

    // Update hover state and cursor
    const hitResult = hitTestCanvas(worldPoint, this.compiled?.scene || { entities: {}, groups: {}, behaviors: {}, actions: {}, conditions: {} }, this.sprites, this.groupZones, this.boundsHandles);
    this.updateHoverState(hitResult);
    this.updateCursor(hitResult);

    // Handle pending drag (drag threshold)
    if (this.pendingDrag && !this.dragState) {
      if (hasExceededDragThreshold(this.pendingDrag.startPoint, worldPoint)) {
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
          // Record bounds operation
          const boundsCondition = this.activeBoundsConditionId ? this.compiled?.scene.conditions[this.activeBoundsConditionId] : undefined;
          if (boundsCondition) {
            this.recordOperation('update-bounds', boundsCondition.id, boundsCondition.bounds);
          }

          this.dragState = {
            kind: 'bounds-handle',
            id: hitResult.id!,
            startX: worldPoint.x,
            startY: worldPoint.y,
            handle: hitResult.handle,
            hasMoved: false
          };
          EventBus.emit('canvas-interaction-start', { kind: 'bounds-handle', id: hitResult.id });
        } else {
          // Check if this is part of a multi-selection
          if (hitResult.kind === 'entity' && this.selection.kind === 'entities' && this.selection.ids.includes(hitResult.id!)) {
            // Start multi-entity drag
            const beforeState = this.selection.ids.map(id => ({ id, entity: this.compiled?.entities[id] }));
            this.recordOperation('move-entities' as any, this.selection.ids.join(','), beforeState);
            this.dragState = {
              kind: 'entity', // Use 'entity' kind but with multi-entity logic
              id: hitResult.id!, // Store the clicked entity ID for reference
              startX: worldPoint.x,
              startY: worldPoint.y,
              hasMoved: false
            };
            EventBus.emit('canvas-interaction-start', { kind: 'entities', id: this.selection.ids.join(',') });
          } else {
            // Record entity/group operation
            if (hitResult.kind === 'entity') {
              this.recordOperation('move-entity', hitResult.id!, this.compiled?.entities[hitResult.id!]);
            } else if (hitResult.kind === 'group') {
              const groupMembers = this.compiled?.groups[hitResult.id!]?.members || [];
              const beforeState = groupMembers.map(member => ({ id: member.id, entity: this.compiled?.entities[member.id] }));
              this.recordOperation('move-group', hitResult.id!, beforeState);
            }

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

    const dx = worldPoint.x - this.dragState.startX;
    const dy = worldPoint.y - this.dragState.startY;

    // Mark as moved if not already
    if (!this.dragState.hasMoved && (Math.abs(dx) > 0 || Math.abs(dy) > 0)) {
      this.dragState.hasMoved = true;
    }

    // Apply grid snapping to deltas
    const snappedDx = this.snapDeltaToGrid(dx);
    const snappedDy = this.snapDeltaToGrid(dy);

    if (this.dragState.kind === 'marquee') {
      // Update marquee rectangle
      this.dragState.currentX = worldPoint.x;
      this.dragState.currentY = worldPoint.y;
      this.updateMarqueeRectangle(this.dragState.startX, this.dragState.startY, worldPoint.x, worldPoint.y);
    } else if (this.dragState.kind === 'entity' && this.selection.kind === 'entities' && this.selection.ids.includes(this.dragState.id!)) {
      // Multi-entity drag
      EventBus.emit('canvas-move-entities', { entityIds: this.selection.ids, dx: snappedDx, dy: snappedDy });
    } else if (this.dragState.kind === 'entity') {
      EventBus.emit('canvas-move-entity', { id: this.dragState.id, dx: snappedDx, dy: snappedDy });
    } else if (this.dragState.kind === 'group') {
      EventBus.emit('canvas-move-group', { id: this.dragState.id, dx: snappedDx, dy: snappedDy });
    } else if (this.dragState.kind === 'bounds-handle' && this.dragState.handle) {
      // Calculate new bounds based on handle being dragged
      const boundsCondition = this.activeBoundsConditionId ? this.compiled?.scene.conditions[this.activeBoundsConditionId] : undefined;
      if (boundsCondition?.type === 'BoundsHit') {
        const newBounds = calculateBoundsAfterHandleDrag(boundsCondition.bounds, this.dragState.handle, snappedDx, snappedDy);
        EventBus.emit('canvas-update-bounds', newBounds);
      }
    }

    // Update drag overlay
    if (this.dragOverlay) {
      const boundsCondition = this.activeBoundsConditionId ? this.compiled?.scene.conditions[this.activeBoundsConditionId] : undefined;
      updateDragOverlay(this.dragOverlay, this.dragState, worldPoint, boundsCondition?.type === 'BoundsHit' ? boundsCondition.bounds : undefined);
    }

    this.dragState.startX = worldPoint.x;
    this.dragState.startY = worldPoint.y;
  }

  private handlePointerUp(): void {
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
        EventBus.emit('canvas-select-multiple', { entityIds: selectedEntityIds, additive: false });
        this.destroyMarqueeRectangle();
      }
      if (this.dragState.hasMoved) {
        this.finalizeRecordedOperation();
      }
      EventBus.emit('canvas-interaction-end');
      this.dragState = undefined;
      if (this.dragOverlay) {
        this.dragOverlay.setVisible(false);
      }
    } else if (this.pendingDrag) {
      const { hitResult } = this.pendingDrag;
      if (hitResult.kind === 'entity' || hitResult.kind === 'group') {
        EventBus.emit('canvas-select', hitResult);
      } else if (hitResult.kind === 'none') {
        EventBus.emit('canvas-select-multiple', { entityIds: [], additive: false });
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
    const pointerX = rawEvent && 'clientX' in rawEvent ? rawEvent.clientX - canvasRect.left : this.input.activePointer.x;
    const pointerY = rawEvent && 'clientY' in rawEvent ? rawEvent.clientY - canvasRect.top : this.input.activePointer.y;
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
        const boundsConditionId = this.compiled?.scene ? getEditableBoundsConditionId(this.compiled.scene, this.selection) : undefined;
        const bounds = boundsConditionId
          ? this.compiled?.scene.conditions[boundsConditionId]?.type === 'BoundsHit'
            ? this.compiled.scene.conditions[boundsConditionId].bounds
            : undefined
          : undefined;
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
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          if (event.shiftKey) {
            this.redo();
          } else {
            this.undo();
          }
        }
        return;
      case 'y':
      case 'Y':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.redo();
        }
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
            this.gridEnabled = !this.gridEnabled;
            EventBus.emit('grid-toggled', this.gridEnabled);
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
      this.recordOperation('move-entity', this.selection.id, this.compiled?.entities[this.selection.id]);
      EventBus.emit('canvas-move-entity', { id: this.selection.id, dx, dy });
    } else if (this.selection.kind === 'group') {
      // For groups, record all member positions
      const groupMembers = this.compiled?.groups[this.selection.id]?.members || [];
      const beforeState = groupMembers.map(member => ({ id: member.id, entity: this.compiled?.entities[member.id] }));
      this.recordOperation('move-group', this.selection.id, beforeState);
      EventBus.emit('canvas-move-group', { id: this.selection.id, dx, dy });
    } else if (this.selection.kind === 'entities') {
      // For multi-entity selection, record all entity positions
      const beforeState = this.selection.ids.map(id => ({ id, entity: this.compiled?.entities[id] }));
      // Record as a custom operation type for multi-entity move
      this.recordOperation('move-entities' as any, this.selection.ids.join(','), beforeState);
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

  private recordOperation(type: 'move-entity' | 'move-group' | 'update-bounds', id: string, beforeState: any): void {
    // Remove any operations after current history index (for when user does new operation after undo)
    this.operationHistory = this.operationHistory.slice(0, this.historyIndex + 1);

    // Add new operation
    this.operationHistory.push({ type, id, before: beforeState, after: null });
    this.historyIndex = this.operationHistory.length - 1;
  }

  private finalizeRecordedOperation(): void {
    const operation = this.operationHistory[this.historyIndex];
    if (!operation) return;
    operation.after = this.captureOperationState(operation.type, operation.id);
  }

  private undo(): void {
    if (this.historyIndex < 0) return;

    const operation = this.operationHistory[this.historyIndex];
    this.applyOperationInverse(operation);
    this.historyIndex--;
  }

  private redo(): void {
    if (this.historyIndex >= this.operationHistory.length - 1) return;

    this.historyIndex++;
    const operation = this.operationHistory[this.historyIndex];
    this.applyOperationForward(operation);
  }

  private applyOperationInverse(operation: any): void {
    switch (operation.type) {
      case 'move-entity':
        if (operation.before && operation.after) {
          EventBus.emit('canvas-move-entity', {
            id: operation.id,
            dx: operation.before.x - operation.after.x,
            dy: operation.before.y - operation.after.y
          });
        }
        break;
      case 'move-group':
        if (operation.before.length > 0 && operation.after?.length > 0) {
          EventBus.emit('canvas-move-group', {
            id: operation.id,
            dx: operation.before[0].entity.x - operation.after[0].entity.x,
            dy: operation.before[0].entity.y - operation.after[0].entity.y
          });
        }
        break;
      case 'move-entities':
        if (operation.before.length > 0 && operation.after?.length > 0) {
          EventBus.emit('canvas-move-entities', {
            entityIds: operation.id.split(','),
            dx: operation.before[0].entity.x - operation.after[0].entity.x,
            dy: operation.before[0].entity.y - operation.after[0].entity.y,
          });
        }
        break;
      case 'update-bounds':
        // Restore bounds
        EventBus.emit('canvas-update-bounds', operation.before);
        break;
    }
  }

  private applyOperationForward(operation: any): void {
    switch (operation.type) {
      case 'move-entity':
        if (operation.before && operation.after) {
          EventBus.emit('canvas-move-entity', {
            id: operation.id,
            dx: operation.after.x - operation.before.x,
            dy: operation.after.y - operation.before.y,
          });
        }
        break;
      case 'move-group':
        if (operation.before.length > 0 && operation.after?.length > 0) {
          EventBus.emit('canvas-move-group', {
            id: operation.id,
            dx: operation.after[0].entity.x - operation.before[0].entity.x,
            dy: operation.after[0].entity.y - operation.before[0].entity.y,
          });
        }
        break;
      case 'move-entities':
        if (operation.before.length > 0 && operation.after?.length > 0) {
          EventBus.emit('canvas-move-entities', {
            entityIds: operation.id.split(','),
            dx: operation.after[0].entity.x - operation.before[0].entity.x,
            dy: operation.after[0].entity.y - operation.before[0].entity.y,
          });
        }
        break;
      case 'update-bounds':
        if (operation.after) {
          EventBus.emit('canvas-update-bounds', operation.after);
        }
        break;
    }
  }

  private captureOperationState(type: 'move-entity' | 'move-group' | 'move-entities' | 'update-bounds', id: string): any {
    const latestScene = getCurrentAppStateSnapshot()?.scene ?? this.compiled?.scene;
    switch (type) {
      case 'move-entity':
        return latestScene?.entities[id] ? { ...latestScene.entities[id] } : undefined;
      case 'move-group': {
        const memberIds = latestScene?.groups[id]?.members ?? [];
        return memberIds.map((memberId) => ({ id: memberId, entity: latestScene?.entities[memberId] ? { ...latestScene.entities[memberId] } : undefined }));
      }
      case 'move-entities':
        return id.split(',').map((memberId) => ({ id: memberId, entity: latestScene?.entities[memberId] ? { ...latestScene.entities[memberId] } : undefined }));
      case 'update-bounds': {
        const condition = id ? latestScene?.conditions[id] : undefined;
        return condition?.type === 'BoundsHit' ? { ...condition.bounds } : undefined;
      }
    }
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

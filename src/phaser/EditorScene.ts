import Phaser from 'phaser';
import { EventBus, setActiveScene } from './EventBus';
import { compileScene, CompiledScene } from '../compiler/compileScene';
import { SceneSpec, BoundsHitConditionSpec } from '../model/types';
import { Selection } from '../editor/EditorStore';
import { flattenTarget, resolveTarget } from '../runtime/targets/resolveTarget';
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
import { getPrimaryBoundsConditionId } from '../editor/boundsCondition';

export class EditorScene extends Phaser.Scene {
  private compiled?: CompiledScene;
  private sprites = new Map<string, Phaser.GameObjects.Rectangle>();
  private entityToGroup = new Map<string, string>();
  private boundsGraphics?: Phaser.GameObjects.Graphics;
  private boundsHandles = new Map<string, Phaser.GameObjects.Zone>();
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

  constructor() {
    super('EditorScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0c0f1a');
    setActiveScene(this);
    EventBus.on('load-scene', this.loadScene, this);
    EventBus.on('selection-changed', this.handleSelectionChanged, this);
    EventBus.on('canvas-update-bounds', this.updateBounds, this);
    EventBus.emit('current-scene-ready', this);

    // Initialize overlays
    this.dragOverlay = createDragOverlayText(this);
    this.hoverOutline = createHoverOutline(this);

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);

    // Keyboard input for nudging
    this.input.keyboard.on('keydown', this.handleKeyDown, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      setActiveScene(null);
      EventBus.off('load-scene', this.loadScene, this);
      EventBus.off('selection-changed', this.handleSelectionChanged, this);
      EventBus.off('canvas-update-bounds', this.updateBounds, this);
      this.input.off('pointerdown', this.handlePointerDown, this);
      this.input.off('pointermove', this.handlePointerMove, this);
      this.input.off('pointerup', this.handlePointerUp, this);
      this.input.keyboard.off('keydown', this.handleKeyDown, this);
    });
  }

  update(_time: number, delta: number): void {
    if (!this.compiled) return;
    this.compiled.actionManager.update(delta);
    for (const entity of Object.values(this.compiled.entities)) {
      const sprite = this.sprites.get(entity.id);
      if (!sprite) continue;
      sprite.setPosition(entity.x, entity.y);
    }
    this.updateGroupFrames();
  }

  private loadScene(sceneSpec: SceneSpec, mode: 'edit' | 'play' = 'edit'): void {
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

    this.buildSprites();
    this.buildGroupFrames(sceneSpec);
    this.drawBoundsFromSpec(sceneSpec);
    this.applySelectionStyles();
    if (mode === 'play') {
      this.compiled.startAll();
    }
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
    this.hoverOutline?.clear();
    this.dragOverlay?.setVisible(false);
  }

  private buildSprites(): void {
    if (!this.compiled) return;
    for (const entity of Object.values(this.compiled.entities)) {
      const rect = this.add.rectangle(entity.x, entity.y, entity.width, entity.height, 0x69d2ff, 0.9);
      rect.setStrokeStyle(2, 0x1a2b4a, 1);
      rect.setInteractive();
      this.sprites.set(entity.id, rect);
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

  private drawBoundsFromSpec(scene: SceneSpec): void {
    const boundsCondition = Object.values(scene.conditions).find(
      (c): c is BoundsHitConditionSpec => c.type === 'BoundsHit'
    );
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
  }

  private applySelectionStyles(): void {
    for (const [entityId, sprite] of this.sprites.entries()) {
      const groupId = this.entityToGroup.get(entityId);
      const selectedEntity = this.selection.kind === 'entity' && this.selection.id === entityId;
      const selectedGroup = this.selection.kind === 'group' && groupId === this.selection.id;
      const selectedEntities = this.selection.kind === 'entities' && this.selection.ids.includes(entityId);
      const inGroup = Boolean(groupId);

      const isSelected = selectedEntity || selectedGroup || selectedEntities;
      sprite.setAlpha(isSelected ? 1 : inGroup ? 0.72 : 0.9);
      sprite.setStrokeStyle(
        isSelected ? 3 : 2,
        selectedEntity ? 0xffb86b : selectedGroup ? 0x9fe7ff : selectedEntities ? 0xff6b6b : 0x1a2b4a,
        1
      );
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.mode !== 'edit') return;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    // Use new hit testing
    const hitResult = hitTestCanvas(worldPoint, this.compiled?.sceneSpec || { entities: {}, groups: {}, behaviors: {}, actions: {}, conditions: {} }, this.sprites, this.groupZones, this.boundsHandles);

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
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    // Update hover state and cursor
    const hitResult = hitTestCanvas(worldPoint, this.compiled?.sceneSpec || { entities: {}, groups: {}, behaviors: {}, actions: {}, conditions: {} }, this.sprites, this.groupZones, this.boundsHandles);
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
          const boundsCondition = Object.values(this.compiled?.sceneSpec?.conditions ?? {}).find(
            (c): c is BoundsHitConditionSpec => c.type === 'BoundsHit'
          );
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
              const beforeState = groupMembers.map(id => ({ id, entity: this.compiled?.entities[id] }));
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
      const boundsCondition = Object.values(this.compiled?.sceneSpec?.conditions ?? {}).find(
        (c): c is BoundsHitConditionSpec => c.type === 'BoundsHit'
      );
      if (boundsCondition) {
        const newBounds = calculateBoundsAfterHandleDrag(boundsCondition.bounds, this.dragState.handle, snappedDx, snappedDy);
        EventBus.emit('canvas-update-bounds', newBounds);
      }
    }

    // Update drag overlay
    if (this.dragOverlay) {
      const boundsCondition = Object.values(this.compiled?.sceneSpec?.conditions ?? {}).find(
        (c): c is BoundsHitConditionSpec => c.type === 'BoundsHit'
      );
      updateDragOverlay(this.dragOverlay, this.dragState, worldPoint, boundsCondition?.bounds);
    }

    this.dragState.startX = worldPoint.x;
    this.dragState.startY = worldPoint.y;
  }

  private handlePointerUp(): void {
    if (this.mode !== 'edit') return;
    if (this.dragState) {
      if (this.dragState.kind === 'marquee') {
        // Complete marquee selection
        const endX = this.dragState.currentX || this.dragState.startX;
        const endY = this.dragState.currentY || this.dragState.startY;
        const selectedEntityIds = this.getEntitiesInMarquee(this.dragState.startX, this.dragState.startY, endX, endY);
        EventBus.emit('canvas-select-multiple', { entityIds: selectedEntityIds, additive: false });
        this.destroyMarqueeRectangle();
      }
      EventBus.emit('canvas-interaction-end');
      this.dragState = undefined;
      if (this.dragOverlay) {
        this.dragOverlay.setVisible(false);
      }
    }
    this.pendingDrag = undefined;
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
        const boundsConditionId = this.compiled?.sceneSpec ? getPrimaryBoundsConditionId(this.compiled.sceneSpec) : undefined;
        const bounds = boundsConditionId
          ? this.compiled?.sceneSpec.conditions[boundsConditionId]?.type === 'BoundsHit'
            ? this.compiled.sceneSpec.conditions[boundsConditionId].bounds
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

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.mode !== 'edit') return;
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
              const groupName = `Group ${Object.keys(this.compiled?.sceneSpec?.groups ?? {}).length + 1}`;
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
      const beforeState = groupMembers.map(id => ({ id, entity: this.compiled?.entities[id] }));
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
        if (this.compiled?.entities[operation.id]) {
          EventBus.emit('canvas-move-entity', {
            id: operation.id,
            dx: operation.before.x - this.compiled.entities[operation.id].x,
            dy: operation.before.y - this.compiled.entities[operation.id].y
          });
        }
        break;
      case 'move-group':
        // Restore all group member positions
        operation.before.forEach((memberState: any) => {
          const currentEntity = this.compiled?.entities[memberState.id];
          if (currentEntity) {
            EventBus.emit('canvas-move-entity', {
              id: memberState.id,
              dx: memberState.entity.x - currentEntity.x,
              dy: memberState.entity.y - currentEntity.y
            });
          }
        });
        break;
      case 'update-bounds':
        // Restore bounds
        EventBus.emit('canvas-update-bounds', operation.before);
        break;
    }
  }

  private applyOperationForward(operation: any): void {
    // For redo, we need the after state, but for now we'll skip this
    // In a full implementation, we'd store both before and after states
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
    if (!this.compiled?.sceneSpec) return [];

    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    const selectedEntityIds: string[] = [];

    for (const [entityId, entity] of Object.entries(this.compiled.sceneSpec.entities)) {
      if (entity.x >= x && entity.x <= x + width && entity.y >= y && entity.y <= y + height) {
        selectedEntityIds.push(entityId);
      }
    }

    return selectedEntityIds;
  }
}

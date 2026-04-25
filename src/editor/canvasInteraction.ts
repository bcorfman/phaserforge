/**
 * Canvas interaction utilities for drag thresholds, hover states, and overlays
 */

import * as Phaser from 'phaser';

export interface DragState {
  kind: 'entity' | 'group' | 'bounds-handle' | 'marquee';
  id?: string;
  entityIds?: string[];
  awaitingDuplicate?: boolean;
  startX: number;
  startY: number;
  currentX?: number;
  currentY?: number;
  handle?: string;
  hasMoved: boolean;
}

export interface HoverState {
  kind: 'entity' | 'group' | 'bounds-handle' | 'bounds-body' | 'none';
  id?: string;
  handle?: string;
}

export type HoverOutlineShape =
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  | { kind: 'rounded-rect'; x: number; y: number; width: number; height: number; radius: number };

/**
 * Drag threshold configuration
 */
export const DRAG_THRESHOLD = 5; // pixels

/**
 * Check if pointer movement exceeds drag threshold
 */
export function hasExceededDragThreshold(
  startPoint: { x: number; y: number },
  currentPoint: { x: number; y: number }
): boolean {
  const dx = currentPoint.x - startPoint.x;
  const dy = currentPoint.y - startPoint.y;
  return Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD;
}

/**
 * Create a drag overlay text for position/dimension feedback
 */
export function createDragOverlayText(scene: Phaser.Scene): Phaser.GameObjects.Text {
  const text = scene.add.text(0, 0, '', {
    color: '#ffffff',
    backgroundColor: '#000000',
    fontFamily: 'IBM Plex Mono',
    fontSize: '12px',
    padding: { x: 4, y: 2 },
  });
  text.setDepth(1000);
  text.setVisible(false);
  return text;
}

/**
 * Update drag overlay text with current values
 */
export function updateDragOverlay(
  overlay: Phaser.GameObjects.Text,
  dragState: DragState,
  currentPoint: { x: number; y: number },
  bounds?: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  if (!dragState.hasMoved) {
    overlay.setVisible(false);
    return;
  }

  let text = '';
  switch (dragState.kind) {
    case 'entity':
      text = `Entity: (${Math.round(currentPoint.x)}, ${Math.round(currentPoint.y)})`;
      break;
    case 'group':
      const dx = currentPoint.x - dragState.startX;
      const dy = currentPoint.y - dragState.startY;
      text = `Group: Δ(${Math.round(dx)}, ${Math.round(dy)})`;
      break;
    case 'bounds-handle':
      if (bounds) {
        const width = Math.round(bounds.maxX - bounds.minX);
        const height = Math.round(bounds.maxY - bounds.minY);
        text = `Bounds: ${width} × ${height}`;
      }
      break;
  }

  overlay.setText(text);
  overlay.setPosition(currentPoint.x + 10, currentPoint.y - 10);
  overlay.setVisible(true);
}

/**
 * Create hover outline graphics
 */
export function createHoverOutline(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  graphics.setDepth(999);
  graphics.setVisible(false);
  return graphics;
}

/**
 * Update hover outline based on hover state
 */
export function updateHoverOutline(
  outline: Phaser.GameObjects.Graphics,
  hoverState: HoverState,
  sprites: Map<string, Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>,
  groupZones: Map<string, Phaser.GameObjects.Zone>,
  bounds?: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  outline.clear();

  if (hoverState.kind === 'none') {
    outline.setVisible(false);
    return;
  }

  const shape = getHoverOutlineShape(hoverState, sprites, groupZones, bounds);
  if (!shape) {
    outline.setVisible(false);
    return;
  }

  outline.setVisible(true);
  outline.lineStyle(2, 0x00ffff, 0.8);

  if (shape.kind === 'rounded-rect') {
    outline.strokeRoundedRect(shape.x, shape.y, shape.width, shape.height, shape.radius);
  } else {
    outline.strokeRect(shape.x, shape.y, shape.width, shape.height);
  }
}

export function getHoverOutlineShape(
  hoverState: HoverState,
  sprites: Map<string, { getBounds(): { x: number; y: number; width: number; height: number } }>,
  groupZones: Map<string, { getBounds(): { x: number; y: number; width: number; height: number } }>,
  bounds?: { minX: number; minY: number; maxX: number; maxY: number }
): HoverOutlineShape | undefined {
  switch (hoverState.kind) {
    case 'entity': {
      const sprite = sprites.get(hoverState.id!);
      if (!sprite) return undefined;
      const rect = sprite.getBounds();
      return { kind: 'rect', x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }
    case 'group': {
      const zone = groupZones.get(hoverState.id!);
      if (!zone) return undefined;
      const rect = zone.getBounds();
      return { kind: 'rounded-rect', x: rect.x, y: rect.y, width: rect.width, height: rect.height, radius: 10 };
    }
    case 'bounds-handle':
    case 'bounds-body':
      if (!bounds) return undefined;
      return {
        kind: 'rect',
        x: bounds.minX,
        y: bounds.minY,
        width: bounds.maxX - bounds.minX,
        height: bounds.maxY - bounds.minY,
      };
    default:
      return undefined;
  }
}

/**
 * Get readable labels for different interaction types
 */
export function getInteractionLabel(kind: string, subType?: string): string {
  switch (kind) {
    case 'entity':
      return 'Entity';
    case 'group':
      return 'Formation';
    case 'bounds-handle':
      return `Bounds ${subType || 'Handle'}`;
    case 'bounds-body':
      return 'Bounds Area';
    default:
      return kind;
  }
}

/**
 * Format position/dimension values for display
 */
export function formatValue(value: number, unit = ''): string {
  return `${Math.round(value)}${unit}`;
}

/**
 * Check if a point is over empty canvas (for clearing selection)
 */
export function isPointOverEmptyCanvas(
  worldPoint: { x: number; y: number },
  sprites: Map<string, Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>,
  groupZones: Map<string, Phaser.GameObjects.Zone>,
  boundsHandles: Map<string, Phaser.GameObjects.Zone>,
  bounds?: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  // Check if point is over any interactive element
  for (const sprite of sprites.values()) {
    if (sprite.getBounds().contains(worldPoint.x, worldPoint.y)) return false;
  }

  for (const zone of groupZones.values()) {
    if (zone.getBounds().contains(worldPoint.x, worldPoint.y)) return false;
  }

  for (const zone of boundsHandles.values()) {
    if (zone.getBounds().contains(worldPoint.x, worldPoint.y)) return false;
  }

  if (bounds) {
    if (
      worldPoint.x >= bounds.minX &&
      worldPoint.x <= bounds.maxX &&
      worldPoint.y >= bounds.minY &&
      worldPoint.y <= bounds.maxY
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Canvas geometry utilities for hit testing and spatial calculations
 */

import Phaser from 'phaser';
import { SceneSpec, BoundsHitConditionSpec } from '../model/types';

export interface HitTestResult {
  kind: 'entity' | 'group' | 'bounds-handle' | 'bounds-body' | 'none';
  id?: string;
  handle?: string;
}

/**
 * Test if a point is inside a rectangle with optional padding
 */
export function pointInRect(
  point: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
  padding = 0
): boolean {
  return (
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.width + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.height + padding
  );
}

/**
 * Get bounds handle positions and hit areas
 */
export function getBoundsHandles(bounds: { minX: number; minY: number; maxX: number; maxY: number }) {
  const handleSize = 8;
  return [
    { id: 'nw', x: bounds.minX, y: bounds.minY, size: handleSize },
    { id: 'n', x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY, size: handleSize },
    { id: 'ne', x: bounds.maxX, y: bounds.minY, size: handleSize },
    { id: 'e', x: bounds.maxX, y: (bounds.minY + bounds.maxY) / 2, size: handleSize },
    { id: 'se', x: bounds.maxX, y: bounds.maxY, size: handleSize },
    { id: 's', x: (bounds.minX + bounds.maxX) / 2, y: bounds.maxY, size: handleSize },
    { id: 'sw', x: bounds.minX, y: bounds.maxY, size: handleSize },
    { id: 'w', x: bounds.minX, y: (bounds.minY + bounds.maxY) / 2, size: handleSize },
  ];
}

/**
 * Perform hit testing with priority order
 */
export function hitTestCanvas(
  worldPoint: { x: number; y: number },
  sceneSpec: SceneSpec,
  sprites: Map<string, Phaser.GameObjects.Rectangle>,
  groupZones: Map<string, Phaser.GameObjects.Zone>,
  boundsHandles: Map<string, Phaser.GameObjects.Zone>
): HitTestResult {
  // Priority 1: Bounds handles
  for (const [handleId, zone] of boundsHandles.entries()) {
    if (zone.getBounds().contains(worldPoint.x, worldPoint.y)) {
      return { kind: 'bounds-handle', id: 'bounds', handle: handleId };
    }
  }

  // Priority 2: Entities
  for (const [entityId, sprite] of sprites.entries()) {
    if (sprite.getBounds().contains(worldPoint.x, worldPoint.y)) {
      return { kind: 'entity', id: entityId };
    }
  }

  // Priority 3: Groups
  for (const [groupId, zone] of groupZones.entries()) {
    if (zone.getBounds().contains(worldPoint.x, worldPoint.y)) {
      return { kind: 'group', id: groupId };
    }
  }

  // Priority 4: Bounds body
  const boundsCondition = Object.values(sceneSpec.conditions).find(
    (c): c is BoundsHitConditionSpec => c.type === 'BoundsHit'
  );
  if (boundsCondition) {
    const bounds = boundsCondition.bounds;
    if (
      worldPoint.x >= bounds.minX &&
      worldPoint.x <= bounds.maxX &&
      worldPoint.y >= bounds.minY &&
      worldPoint.y <= bounds.maxY
    ) {
      return { kind: 'bounds-body', id: 'bounds' };
    }
  }

  return { kind: 'none' };
}

/**
 * Get cursor style for different interaction types
 */
export function getCursorForHitTest(result: HitTestResult): string {
  switch (result.kind) {
    case 'entity':
    case 'group':
      return 'pointer';
    case 'bounds-handle':
      switch (result.handle) {
        case 'nw':
        case 'se':
          return 'nw-resize';
        case 'ne':
        case 'sw':
          return 'ne-resize';
        case 'n':
        case 's':
          return 'ns-resize';
        case 'e':
        case 'w':
          return 'ew-resize';
        default:
          return 'pointer';
      }
    case 'bounds-body':
      return 'default';
    default:
      return 'default';
  }
}

/**
 * Calculate bounds after dragging a handle
 */
export function calculateBoundsAfterHandleDrag(
  originalBounds: { minX: number; minY: number; maxX: number; maxY: number },
  handle: string,
  deltaX: number,
  deltaY: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  let newBounds = { ...originalBounds };

  switch (handle) {
    case 'nw':
      newBounds.minX = Math.min(originalBounds.minX + deltaX, originalBounds.maxX - 10);
      newBounds.minY = Math.min(originalBounds.minY + deltaY, originalBounds.maxY - 10);
      break;
    case 'n':
      newBounds.minY = Math.min(originalBounds.minY + deltaY, originalBounds.maxY - 10);
      break;
    case 'ne':
      newBounds.maxX = Math.max(originalBounds.maxX + deltaX, originalBounds.minX + 10);
      newBounds.minY = Math.min(originalBounds.minY + deltaY, originalBounds.maxY - 10);
      break;
    case 'e':
      newBounds.maxX = Math.max(originalBounds.maxX + deltaX, originalBounds.minX + 10);
      break;
    case 'se':
      newBounds.maxX = Math.max(originalBounds.maxX + deltaX, originalBounds.minX + 10);
      newBounds.maxY = Math.max(originalBounds.maxY + deltaY, originalBounds.minY + 10);
      break;
    case 's':
      newBounds.maxY = Math.max(originalBounds.maxY + deltaY, originalBounds.minY + 10);
      break;
    case 'sw':
      newBounds.minX = Math.min(originalBounds.minX + deltaX, originalBounds.maxX - 10);
      newBounds.maxY = Math.max(originalBounds.maxY + deltaY, originalBounds.minY + 10);
      break;
    case 'w':
      newBounds.minX = Math.min(originalBounds.minX + deltaX, originalBounds.maxX - 10);
      break;
  }

  return newBounds;
}

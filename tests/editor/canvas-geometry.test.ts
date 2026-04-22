import { describe, expect, it } from 'vitest';
import {
  hitTestCanvas,
  getCursorForHitTest,
  calculateBoundsAfterHandleDrag,
  getBoundsHandles,
  pointInRect,
  type HitTestResult
} from '../../src/editor/canvasGeometry';

describe('Canvas Geometry utilities', () => {
  describe('hitTestCanvas', () => {
    const emptyScene: any = {
      id: 'scene',
      entities: {},
      groups: {},
      attachments: {},
      behaviors: {},
      actions: {},
      conditions: {},
    };

    it('prefers bounds handles over entities and groups', () => {
      const worldPoint = { x: 5, y: 5 };
      const boundsHandles = new Map([
        ['nw', { getBounds: () => ({ contains: () => true }) }],
      ]) as any;
      const sprites = new Map([
        ['e1', { getBounds: () => ({ contains: () => true }) }],
      ]) as any;
      const groupZones = new Map([
        ['g1', { getBounds: () => ({ contains: () => true }) }],
      ]) as any;

      expect(hitTestCanvas(worldPoint, emptyScene, sprites, groupZones, boundsHandles)).toEqual({ kind: 'bounds-handle', handle: 'nw' });
    });

    it('prefers entities over groups when both contain the pointer', () => {
      const worldPoint = { x: 5, y: 5 };
      const boundsHandles = new Map() as any;
      const sprites = new Map([
        ['e1', { getBounds: () => ({ contains: () => true }) }],
      ]) as any;
      const groupZones = new Map([
        ['g1', { getBounds: () => ({ contains: () => true }) }],
      ]) as any;

      expect(hitTestCanvas(worldPoint, emptyScene, sprites, groupZones, boundsHandles)).toEqual({ kind: 'entity', id: 'e1' });
    });

    it('returns group when no entity or handle is hit', () => {
      const worldPoint = { x: 5, y: 5 };
      const boundsHandles = new Map() as any;
      const sprites = new Map([
        ['e1', { getBounds: () => ({ contains: () => false }) }],
      ]) as any;
      const groupZones = new Map([
        ['g1', { getBounds: () => ({ contains: () => true }) }],
      ]) as any;

      expect(hitTestCanvas(worldPoint, emptyScene, sprites, groupZones, boundsHandles)).toEqual({ kind: 'group', id: 'g1' });
    });

    it('hit-tests bounds body only when bounds handles are present', () => {
      const sceneWithBounds: any = {
        ...emptyScene,
        attachments: {
          a1: {
            id: 'a1',
            presetId: 'MoveUntil',
            target: { type: 'group', groupId: 'g1' },
            condition: { type: 'BoundsHit', bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 }, mode: 'any' },
          },
        },
      };

      const sprites = new Map() as any;
      const groupZones = new Map() as any;

      const insideBounds = { x: 5, y: 5 };

      expect(hitTestCanvas(insideBounds, sceneWithBounds, sprites, groupZones, new Map() as any)).toEqual({ kind: 'none' });

      const boundsHandles = new Map([
        ['nw', { getBounds: () => ({ contains: () => false }) }],
      ]) as any;
      expect(hitTestCanvas(insideBounds, sceneWithBounds, sprites, groupZones, boundsHandles)).toEqual({ kind: 'bounds-body' });
    });
  });

  describe('pointInRect', () => {
    it('returns true for point inside rectangle', () => {
      const rect = { x: 0, y: 0, width: 10, height: 10 };
      expect(pointInRect({ x: 5, y: 5 }, rect)).toBe(true);
    });

    it('returns false for point outside rectangle', () => {
      const rect = { x: 0, y: 0, width: 10, height: 10 };
      expect(pointInRect({ x: 15, y: 15 }, rect)).toBe(false);
    });

    it('respects padding', () => {
      const rect = { x: 0, y: 0, width: 10, height: 10 };
      expect(pointInRect({ x: -2, y: -2 }, rect, 5)).toBe(true);
    });
  });

  describe('getBoundsHandles', () => {
    it('returns correct handle positions for bounds', () => {
      const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      const handles = getBoundsHandles(bounds);

      expect(handles).toHaveLength(8);
      expect(handles.find(h => h.id === 'nw')).toEqual({ id: 'nw', x: 0, y: 0, size: 8 });
      expect(handles.find(h => h.id === 'se')).toEqual({ id: 'se', x: 100, y: 100, size: 8 });
      expect(handles.find(h => h.id === 'n')).toEqual({ id: 'n', x: 50, y: 0, size: 8 });
    });
  });

  describe('calculateBoundsAfterHandleDrag', () => {
    const originalBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

    it('resizes from northwest handle', () => {
      const result = calculateBoundsAfterHandleDrag(originalBounds, 'nw', -10, -10);
      expect(result).toEqual({ minX: -10, minY: -10, maxX: 100, maxY: 100 });
    });

    it('resizes from southeast handle', () => {
      const result = calculateBoundsAfterHandleDrag(originalBounds, 'se', 10, 10);
      expect(result).toEqual({ minX: 0, minY: 0, maxX: 110, maxY: 110 });
    });

    it('resizes from north handle', () => {
      const result = calculateBoundsAfterHandleDrag(originalBounds, 'n', 0, -15);
      expect(result).toEqual({ minX: 0, minY: -15, maxX: 100, maxY: 100 });
    });

    it('enforces minimum size constraints', () => {
      const result = calculateBoundsAfterHandleDrag(originalBounds, 'nw', 95, 95);
      expect(result.minX).toBe(90); // maxX - 10
      expect(result.minY).toBe(90); // maxY - 10
    });
  });

  describe('getCursorForHitTest', () => {
    it('returns pointer for entities and groups', () => {
      expect(getCursorForHitTest({ kind: 'entity' })).toBe('pointer');
      expect(getCursorForHitTest({ kind: 'group' })).toBe('pointer');
    });

    it('returns appropriate resize cursors for bounds handles', () => {
      expect(getCursorForHitTest({ kind: 'bounds-handle', handle: 'nw' })).toBe('nw-resize');
      expect(getCursorForHitTest({ kind: 'bounds-handle', handle: 'se' })).toBe('nw-resize');
      expect(getCursorForHitTest({ kind: 'bounds-handle', handle: 'ne' })).toBe('ne-resize');
      expect(getCursorForHitTest({ kind: 'bounds-handle', handle: 'n' })).toBe('ns-resize');
      expect(getCursorForHitTest({ kind: 'bounds-handle', handle: 'e' })).toBe('ew-resize');
    });

    it('returns default cursor for bounds body', () => {
      expect(getCursorForHitTest({ kind: 'bounds-body' })).toBe('default');
    });

    it('returns default cursor for none', () => {
      expect(getCursorForHitTest({ kind: 'none' })).toBe('default');
    });
  });
});

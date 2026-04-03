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

    it('returns move cursor for bounds body', () => {
      expect(getCursorForHitTest({ kind: 'bounds-body' })).toBe('move');
    });

    it('returns default cursor for none', () => {
      expect(getCursorForHitTest({ kind: 'none' })).toBe('default');
    });
  });
});
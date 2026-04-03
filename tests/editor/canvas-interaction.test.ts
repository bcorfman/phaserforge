import { describe, expect, it } from 'vitest';
import {
  hasExceededDragThreshold,
  formatValue,
  getInteractionLabel,
  DRAG_THRESHOLD
} from '../../src/editor/canvasInteraction';

describe('Canvas Interaction utilities', () => {
  describe('hasExceededDragThreshold', () => {
    it('returns false for movement below threshold', () => {
      const start = { x: 0, y: 0 };
      const current = { x: 2, y: 2 };
      expect(hasExceededDragThreshold(start, current)).toBe(false);
    });

    it('returns true for movement above threshold', () => {
      const start = { x: 0, y: 0 };
      const current = { x: 10, y: 10 };
      expect(hasExceededDragThreshold(start, current)).toBe(true);
    });

    it('calculates distance correctly', () => {
      const start = { x: 0, y: 0 };
      const current = { x: DRAG_THRESHOLD + 1, y: 0 };
      expect(hasExceededDragThreshold(start, current)).toBe(true);
    });
  });

  describe('formatValue', () => {
    it('formats numbers with unit', () => {
      expect(formatValue(42, 'px')).toBe('42px');
    });

    it('formats numbers without unit', () => {
      expect(formatValue(3.14)).toBe('3');
    });

    it('rounds decimal values', () => {
      expect(formatValue(3.7)).toBe('4');
    });
  });

  describe('getInteractionLabel', () => {
    it('returns readable labels for interaction types', () => {
      expect(getInteractionLabel('entity')).toBe('Entity');
      expect(getInteractionLabel('group')).toBe('Formation');
      expect(getInteractionLabel('bounds-handle')).toBe('Bounds Handle');
      expect(getInteractionLabel('bounds-body')).toBe('Bounds Area');
      expect(getInteractionLabel('unknown')).toBe('unknown');
    });

    it('includes handle info for bounds handles', () => {
      expect(getInteractionLabel('bounds-handle', 'nw')).toBe('Bounds nw');
    });
  });
});
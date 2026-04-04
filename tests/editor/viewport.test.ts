import { describe, expect, it } from 'vitest';
import {
  clampCameraScroll,
  clampZoom,
  formatZoomPercent,
  getFitZoom,
  getNextZoom,
  getZoomedScroll,
} from '../../src/editor/viewport';

describe('viewport helpers', () => {
  it('clamps zoom to the supported range', () => {
    expect(clampZoom(0.1)).toBe(0.5);
    expect(clampZoom(5)).toBe(3);
  });

  it('calculates fit zoom from viewport size', () => {
    expect(getFitZoom(1024, 768)).toBeLessThan(1);
    expect(getFitZoom(1600, 1200)).toBe(1);
    expect(getFitZoom(1200, 900, 2000, 1500)).toBeLessThan(1);
  });

  it('steps zoom in and out predictably', () => {
    expect(getNextZoom(1, 'in')).toBe(1.2);
    expect(getNextZoom(1, 'out')).toBe(0.8);
  });

  it('formats zoom percent for the UI', () => {
    expect(formatZoomPercent(1.25)).toBe('125%');
  });

  it('keeps the pointer world position stable when zooming', () => {
    expect(getZoomedScroll(400, 300, 200, 150, 2)).toEqual({
      scrollX: 300,
      scrollY: 225,
    });
  });

  it('clamps camera scroll to the world extents', () => {
    expect(clampCameraScroll(-10, 999, 800, 600, 1024, 768, 1)).toEqual({
      scrollX: 0,
      scrollY: 168,
    });
  });

  it('centers the world when the viewport is larger than the scene', () => {
    expect(clampCameraScroll(0, 0, 1600, 1200, 1024, 768, 1)).toEqual({
      scrollX: -288,
      scrollY: -216,
    });
  });
});

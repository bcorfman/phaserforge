import { describe, expect, it } from 'vitest';
import {
  canPanCamera,
  clampCameraScroll,
  clampZoom,
  formatZoomPercent,
  getCenteredCameraScroll,
  getFitZoom,
  getMaxZoom,
  getNextZoom,
  getResizedViewportScroll,
  getZoomedScroll,
  isCameraAtFitView,
} from '../../src/editor/viewport';

describe('viewport helpers', () => {
  it('clamps zoom to the supported range', () => {
    expect(clampZoom(0.1)).toBe(0.5);
    expect(clampZoom(5)).toBe(3);
  });

  it('calculates fit zoom from viewport size', () => {
    expect(getFitZoom(1024, 768)).toBeLessThan(1);
    expect(getFitZoom(1600, 1200)).toBeGreaterThan(1);
    expect(getFitZoom(1200, 900, 2000, 1500)).toBeLessThan(1);
  });

  it('reduces fit zoom when a top safe area is reserved for canvas controls', () => {
    expect(getFitZoom(1024, 768, 1024, 768, { top: 80 })).toBeLessThan(getFitZoom(1024, 768, 1024, 768));
  });

  it('steps zoom in and out predictably', () => {
    expect(getNextZoom(1, 'in')).toBe(1.2);
    expect(getNextZoom(1, 'out')).toBe(0.8);
  });

  it('raises max zoom enough to fill the viewport when the world is small', () => {
    expect(getMaxZoom(1200, 900, 200, 150)).toBeGreaterThan(3);
  });

  it('formats zoom percent for the UI', () => {
    expect(formatZoomPercent(1.25)).toBe('125%');
  });

  it('keeps the pointer world position stable when zooming', () => {
    expect(getZoomedScroll(400, 300, 200, 150, 2, 800, 600)).toEqual({
      scrollX: 100,
      scrollY: 75,
    });
  });

  it('keeps the camera center stable when the viewport is resized', () => {
    const zoom = 1;
    const prevViewport = { w: 800, h: 600 };
    const origin = { x: 0.5, y: 0.5 };
    const scroll = { x: 100, y: 50 };
    const prevOffset = {
      x: prevViewport.w * origin.x * (1 - 1 / zoom),
      y: prevViewport.h * origin.y * (1 - 1 / zoom),
    };
    const prevCenter = {
      x: scroll.x + prevOffset.x + prevViewport.w / 2,
      y: scroll.y + prevOffset.y + prevViewport.h / 2,
    };

    const nextViewport = { w: 1200, h: 900 };
    const next = getResizedViewportScroll(
      scroll.x,
      scroll.y,
      prevViewport.w,
      prevViewport.h,
      nextViewport.w,
      nextViewport.h,
      zoom,
      origin.x,
      origin.y
    );
    const nextOffset = {
      x: nextViewport.w * origin.x * (1 - 1 / zoom),
      y: nextViewport.h * origin.y * (1 - 1 / zoom),
    };
    const nextCenter = {
      x: next.scrollX + nextOffset.x + nextViewport.w / 2,
      y: next.scrollY + nextOffset.y + nextViewport.h / 2,
    };

    expect(nextCenter.x).toBeCloseTo(prevCenter.x, 5);
    expect(nextCenter.y).toBeCloseTo(prevCenter.y, 5);
  });

  it('clamps camera scroll to the world extents', () => {
    const clamped = clampCameraScroll(-10, 999, 800, 600, 1024, 768, 1);
    expect(clamped.scrollX).toBeCloseTo(0, 5);
    expect(clamped.scrollY).toBe(168);
  });

  it('allows offset scroll when the viewport is larger than the scene', () => {
    const clamped = clampCameraScroll(-999, 999, 1600, 1200, 1024, 768, 1);
    expect(clamped.scrollX).toBe(-576);
    expect(clamped.scrollY).toBeCloseTo(0, 5);
  });

  it('reports when the current zoom actually allows panning', () => {
    expect(canPanCamera(682, 768, 1024, 768, 0.57)).toBe(true);
    expect(canPanCamera(682, 768, 1024, 768, 0.77)).toBe(true);
  });

  it('recognizes when the camera is already on the centered fit view', () => {
    const viewport = { width: 1280, height: 720 };
    const world = { width: 1024, height: 768 };
    const insets = { top: 84 };
    const zoom = getFitZoom(viewport.width, viewport.height, world.width, world.height, insets);
    const scroll = getCenteredCameraScroll(viewport.width, viewport.height, world.width, world.height, zoom, 0.5, 0.5, insets);
    expect(isCameraAtFitView(viewport.width, viewport.height, world.width, world.height, zoom, scroll.scrollX, scroll.scrollY, 0.5, 0.5, insets)).toBe(true);
    expect(isCameraAtFitView(viewport.width, viewport.height, world.width, world.height, zoom + 0.2, scroll.scrollX, scroll.scrollY, 0.5, 0.5, insets)).toBe(false);
  });
});

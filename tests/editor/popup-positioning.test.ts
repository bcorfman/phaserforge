import { describe, expect, it } from 'vitest';
import { clampPopupToViewport, placePopupNearRect } from '../../src/editor/popupPositioning';

describe('placePopupNearRect', () => {
  it('places above the anchor when there is room', () => {
    const pos = placePopupNearRect({
      anchorRect: { left: 100, top: 300, right: 140, bottom: 320 },
      popupSize: { width: 320, height: 160 },
      viewportSize: { width: 800, height: 600 },
      padding: 12,
      offset: 10,
      prefer: 'above',
      align: 'left',
    });

    expect(pos.y).toBe(300 - 160 - 10);
  });

  it('falls back below when above would go offscreen', () => {
    const pos = placePopupNearRect({
      anchorRect: { left: 100, top: 40, right: 140, bottom: 60 },
      popupSize: { width: 320, height: 160 },
      viewportSize: { width: 800, height: 600 },
      padding: 12,
      offset: 10,
      prefer: 'above',
      align: 'left',
    });

    expect(pos.y).toBe(60 + 10);
  });

  it('supports right alignment so the popup can sit in the lower-right corner', () => {
    const viewportSize = { width: 800, height: 600 };
    const popupSize = { width: 320, height: 160 };

    const pos = placePopupNearRect({
      anchorRect: { left: 0, top: 0, right: viewportSize.width - 12, bottom: viewportSize.height - 12 },
      popupSize,
      viewportSize,
      padding: 12,
      offset: 0,
      prefer: 'above',
      align: 'right',
    });

    expect(pos).toEqual({ x: viewportSize.width - 12 - popupSize.width, y: viewportSize.height - 12 - popupSize.height });
  });

  it('clamps into the viewport so the popup stays fully visible', () => {
    const viewportSize = { width: 800, height: 600 };
    const popupSize = { width: 320, height: 160 };

    const pos = placePopupNearRect({
      anchorRect: { left: 790, top: 590, right: 810, bottom: 610 },
      popupSize,
      viewportSize,
      padding: 12,
      offset: 10,
      prefer: 'below',
      align: 'left',
    });

    expect(pos.x).toBeLessThanOrEqual(viewportSize.width - 12 - popupSize.width);
    expect(pos.x).toBeGreaterThanOrEqual(12);
    expect(pos.y).toBeLessThanOrEqual(viewportSize.height - 12 - popupSize.height);
    expect(pos.y).toBeGreaterThanOrEqual(12);
  });

  it('clamps an explicit popup position into the viewport', () => {
    const viewportSize = { width: 800, height: 600 };
    const popupSize = { width: 320, height: 160 };

    expect(
      clampPopupToViewport({
        position: { x: -100, y: -200 },
        popupSize,
        viewportSize,
        padding: 12,
      })
    ).toEqual({ x: 12, y: 12 });

    expect(
      clampPopupToViewport({
        position: { x: 1000, y: 2000 },
        popupSize,
        viewportSize,
        padding: 12,
      })
    ).toEqual({ x: viewportSize.width - 12 - popupSize.width, y: viewportSize.height - 12 - popupSize.height });
  });

  it('clamps y independently so vertical dragging stays in-bounds', () => {
    const viewportSize = { width: 800, height: 600 };
    const popupSize = { width: 320, height: 160 };

    expect(
      clampPopupToViewport({
        position: { x: 100, y: -999 },
        popupSize,
        viewportSize,
        padding: 12,
      })
    ).toEqual({ x: 100, y: 12 });

    expect(
      clampPopupToViewport({
        position: { x: 100, y: 9999 },
        popupSize,
        viewportSize,
        padding: 12,
      })
    ).toEqual({ x: 100, y: viewportSize.height - 12 - popupSize.height });
  });
});

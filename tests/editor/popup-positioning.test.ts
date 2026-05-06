import { describe, expect, it } from 'vitest';
import { placePopupNearRect } from '../../src/editor/popupPositioning';

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
});


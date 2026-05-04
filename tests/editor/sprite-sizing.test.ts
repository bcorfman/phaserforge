import { describe, expect, it } from 'vitest';
import {
  displayPixelsFromBaseAndScale,
  maintainAspectDisplayHeight,
  maintainAspectDisplayWidth,
  percentFromScale,
  scaleFromDisplayPixels,
  scaleFromPercent,
} from '../../src/editor/spriteSizing';

describe('spriteSizing', () => {
  it('converts between scale and percent', () => {
    expect(percentFromScale(1)).toBe(100);
    expect(percentFromScale(0.5)).toBe(50);
    expect(scaleFromPercent(100)).toBe(1);
    expect(scaleFromPercent(25)).toBe(0.25);
  });

  it('computes displayed pixel size from base and scale', () => {
    expect(displayPixelsFromBaseAndScale(256, 1)).toBe(256);
    expect(displayPixelsFromBaseAndScale(256, 0.5)).toBe(128);
    expect(displayPixelsFromBaseAndScale(1, 0.1)).toBe(1);
  });

  it('computes scale from displayed pixels', () => {
    expect(scaleFromDisplayPixels(256, 256)).toBe(1);
    expect(scaleFromDisplayPixels(256, 128)).toBe(0.5);
    expect(scaleFromDisplayPixels(256, 1)).toBeCloseTo(1 / 256, 6);
  });

  it('maintains aspect ratio when resizing by width', () => {
    expect(maintainAspectDisplayHeight(256, 128, 256)).toBe(128);
    expect(maintainAspectDisplayHeight(256, 128, 512)).toBe(256);
  });

  it('maintains aspect ratio when resizing by height', () => {
    expect(maintainAspectDisplayWidth(256, 128, 128)).toBe(256);
    expect(maintainAspectDisplayWidth(256, 128, 256)).toBe(512);
  });
});


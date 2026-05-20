import { describe, expect, test } from 'vitest';
import { resolvePointerModifier } from '../../src/phaser/inputModifiers';

describe('resolvePointerModifier', () => {
  test('prefers pointer event modifier state over cached fallback', () => {
    expect(resolvePointerModifier({ altKey: false }, 'altKey', true)).toBe(false);
    expect(resolvePointerModifier({ shiftKey: false }, 'shiftKey', true)).toBe(false);
  });

  test('falls back when pointer event has no modifier info', () => {
    expect(resolvePointerModifier(undefined, 'altKey', true)).toBe(true);
    expect(resolvePointerModifier({}, 'altKey', true)).toBe(true);
  });

  test('returns true when pointer event modifier is true', () => {
    expect(resolvePointerModifier({ altKey: true }, 'altKey', false)).toBe(true);
    expect(resolvePointerModifier({ shiftKey: true }, 'shiftKey', false)).toBe(true);
  });
});


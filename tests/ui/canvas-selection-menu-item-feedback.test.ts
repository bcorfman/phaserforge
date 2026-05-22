import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('canvas selection menu item feedback', () => {
  test('provides visible pressed feedback for menu buttons', () => {
    const css = readText('src/app/layout.css');

    expect(css).toMatch(/\.canvas-selection-menu-item:active\b/);
  });

  test('provides visible focus feedback for menu buttons', () => {
    const css = readText('src/app/layout.css');

    expect(css).toMatch(/\.canvas-selection-menu-item:focus-visible\b/);
  });
});

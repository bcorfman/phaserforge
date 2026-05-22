import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('inspector tight-label sizing', () => {
  test('ensures tight-label fields keep number inputs readable in grid layouts', () => {
    const css = readText('src/app/layout.css');

    expect(css).toMatch(/\.inspector-grid-2 \.field\.field-tight-label > span/);
    expect(css).toMatch(/\.inspector-grid-2 \.field\.field-tight-label input/);
    expect(css).toMatch(/min-width:\s*5\.75rem/);
  });
});

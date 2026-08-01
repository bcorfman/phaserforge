import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('inspector panel scrolling', () => {
  test('allows the panel to shrink inside the pane and scroll expanded settings', () => {
    const css = readFileSync('src/app/layout.css', 'utf8');

    expect(css).toMatch(/\.panel\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*auto;/);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('font family consistency', () => {
  test('does not use IBM Plex Mono for UI labels', () => {
    const sources = [
      readText('src/app/layout.css'),
      readText('src/editor/canvasInteraction.ts'),
      readText('src/phaser/EditorScene.ts'),
    ].join('\n');

    expect(sources).not.toContain('IBM Plex Mono');
  });
});


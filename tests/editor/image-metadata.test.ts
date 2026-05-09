import { describe, expect, test } from 'vitest';
import { parseImageDimensions, readImageDimensionsFromFile } from '../../src/editor/imageMetadata';
import { readFile } from 'node:fs/promises';

describe('imageMetadata', () => {
  test('parses PNG width/height from bytes', async () => {
    const bytes = new Uint8Array(await readFile('res/images/enemy_A.png'));
    expect(parseImageDimensions(bytes)).toEqual({ width: 64, height: 64 });
  });

  test('reads PNG width/height from File', async () => {
    const bytes = new Uint8Array(await readFile('res/images/enemy_A.png'));
    const file = new File([bytes], 'enemy_A.png', { type: 'image/png' });
    await expect(readImageDimensionsFromFile(file)).resolves.toEqual({ width: 64, height: 64 });
  });
});


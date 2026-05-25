import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('editor-registry.yaml', () => {
  test('Repeat action is categorized under loops (not flow)', () => {
    const yaml = readText('public/editor-registry.yaml');
    expect(yaml).toMatch(/\n\s*-\s*type:\s*Repeat\s*\n\s*displayName:\s*Repeat\s*\n\s*category:\s*loops\s*\n/);
  });
});


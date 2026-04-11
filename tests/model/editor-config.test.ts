import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { coerceStartupMode } from '../../src/model/editorConfig';

describe('editor config helpers', () => {
  it('coerces startup mode with fallback', () => {
    expect(coerceStartupMode('reload_last_yaml', 'new_empty_scene')).toBe('reload_last_yaml');
    expect(coerceStartupMode('new_empty_scene', 'reload_last_yaml')).toBe('new_empty_scene');
    expect(coerceStartupMode('unknown', 'reload_last_yaml')).toBe('reload_last_yaml');
  });

  it('includes property target metadata for planned sprite actions', () => {
    const registryPath = path.resolve(new URL('../../public/editor-registry.yaml', import.meta.url).pathname);
    const registry = parse(fs.readFileSync(registryPath, 'utf8')) as { actions: Array<{ type: string; propertyTargets?: Array<{ key: string }> }> };
    const rotateUntil = registry.actions.find((entry) => entry.type === 'RotateUntil');
    const tweenUntil = registry.actions.find((entry) => entry.type === 'TweenUntil');

    expect(rotateUntil?.propertyTargets?.map((target) => target.key)).toContain('rotationDeg');
    expect(tweenUntil?.propertyTargets?.map((target) => target.key)).toContain('alpha');
  });
});

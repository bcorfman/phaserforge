import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { baseScene } from '../helpers';
import { parseSceneYaml } from '../../src/model/serialization';

describe('scene migration', () => {
  it('migrates legacy behavior/action graphs into attachments', () => {
    const legacy = baseScene() as any;
    delete legacy.attachments;
    const yaml = stringify(legacy, { indent: 2, lineWidth: 0, minContentWidth: 0 });

    const migrated = parseSceneYaml(yaml);

    expect(Object.keys(migrated.attachments).length).toBeGreaterThan(0);
    expect(Object.keys(migrated.behaviors).length).toBe(0);
    expect(Object.keys(migrated.actions).length).toBe(0);
    expect(Object.keys(migrated.conditions).length).toBe(0);

    const presets = Object.values(migrated.attachments).map((a) => a.presetId);
    expect(presets).toContain('MoveUntil');
    expect(presets).toContain('Call');

    const move = Object.values(migrated.attachments).find((a) => a.presetId === 'MoveUntil');
    expect(move?.condition?.type).toBe('BoundsHit');
  });
});


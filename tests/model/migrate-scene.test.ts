import { describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { baseScene } from '../helpers';
import { migrateSceneSpec } from '../../src/model/migrateScene';

describe('scene migration', () => {
  it('migrates legacy behavior/action graphs into attachments', () => {
    const legacy = baseScene() as any;
    delete legacy.attachments;
    const yaml = stringify(legacy, { indent: 2, lineWidth: 0, minContentWidth: 0 });

    const migrated = migrateSceneSpec(parse(yaml));

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

  it('migrates legacy wrapper Repeat attachments into composite children', () => {
    const scene = baseScene();
    scene.behaviors = {};
    scene.actions = {};
    scene.conditions = {};
    scene.eventBlocks = {
      ev1: { id: 'ev1', target: { type: 'entity', entityId: 'e1' }, trigger: { type: 'start' } } as any,
    };
    scene.attachments = {
      r1: { id: 'r1', target: { type: 'entity', entityId: 'e1' }, eventId: 'ev1', presetId: 'Repeat', params: { count: 2 }, order: 0 } as any,
      a1: { id: 'a1', target: { type: 'entity', entityId: 'e1' }, eventId: 'ev1', presetId: 'Wait', params: { durationMs: 1 }, order: 1 } as any,
      a2: { id: 'a2', target: { type: 'entity', entityId: 'e1' }, eventId: 'ev1', presetId: 'Call', params: { callId: 'noop' }, order: 2 } as any,
    };

    const migrated = migrateSceneSpec(JSON.parse(JSON.stringify(scene)));
    const repeat = migrated.attachments.r1 as any;
    expect(repeat.children).toEqual(['a1', 'a2']);
    expect((migrated.attachments.a1 as any).parentAttachmentId).toBe('r1');
    expect((migrated.attachments.a2 as any).parentAttachmentId).toBe('r1');
  });
});

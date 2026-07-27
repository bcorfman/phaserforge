import { describe, expect, it } from 'vitest';
import { compileScene } from '../../src/compiler/compileScene';
import type { SceneSpec } from '../../src/model/types';

function presetScene(): SceneSpec {
  const presetIds = [
    'Wait', 'Call', 'AddToCounter', 'SetCounter', 'ClampCounter',
    'AddSelfToCollection', 'RemoveSelfFromCollection', 'MoveUntil', 'MoveTo', 'MoveBy',
    'SetProperty', 'TweenUntil', 'WavePattern', 'ZigzagPattern', 'SpiralPattern',
    'FigureEightPattern', 'OrbitPattern', 'BouncePattern', 'PatrolPattern', 'MoveXUntil',
    'MoveYUntil', 'BlinkUntil', 'CallbackUntil', 'CycleFramesUntil', 'EmitEvent',
    'InputDrive', 'Repeat', 'InputFire',
  ];
  const attachments = Object.fromEntries(presetIds.map((presetId, index) => [
    `att-${index}`,
    {
      id: `att-${index}`,
      target: { type: 'entity', entityId: 'e1' },
      presetId,
      enabled: true,
      order: index,
      params: {
        callId: 'noop',
        counterId: 'score',
        collectionId: 'targets',
        delta: 1,
        value: 2,
        x: 10,
        y: 20,
        dx: 3,
        dy: 4,
        velocityX: 20,
        velocityY: 10,
        durationMs: 100,
        radius: 20,
        velocity: 30,
        axis: 'both',
        secondsUntilChange: 0.2,
        fps: 12,
        framesCsv: '0,1,2',
        eventName: 'demo.event',
        property: 'x',
        valueSource: { kind: 'constant', value: 5 },
      },
    } as any,
  ]));

  return {
    id: 'scene-1',
    world: { width: 200, height: 100 },
    entities: { e1: { id: 'e1', x: 0, y: 0, width: 10, height: 10 } },
    groups: {},
    attachments,
    behaviors: {},
    actions: {},
    conditions: {},
  };
}

describe('attachment preset compiler catalog', () => {
  it('compiles every action-library preset without requiring optional runtime services', () => {
    const compiled = compileScene(presetScene());
    expect(compiled).toBeDefined();
    expect(compiled.startAll).toBeTypeOf('function');
  });
});

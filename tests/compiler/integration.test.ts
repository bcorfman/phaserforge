import { describe, it, expect } from 'vitest';
import { compileScene } from '../../src/compiler/compileScene';
import { SceneSpec } from '../../src/model/types';

function simpleScene(): SceneSpec {
  return {
    id: 'scene-1',
    entities: {
      e1: { id: 'e1', x: 0, y: 0, width: 10, height: 10 },
    },
    groups: {},
    behaviors: {
      b1: {
        id: 'b1',
        target: { type: 'entity', entityId: 'e1' },
        rootActionId: 'a1',
      },
    },
    actions: {
      a1: { id: 'a1', type: 'Sequence', children: ['a2', 'a3'] },
      a2: { id: 'a2', type: 'Wait', durationMs: 50 },
      a3: { id: 'a3', type: 'Call', callId: 'onDone' },
    },
    conditions: {},
  };
}

function groupScene(speed: number): SceneSpec {
  return {
    id: 'scene-2',
    entities: {
      e1: { id: 'e1', x: 0, y: 0, width: 10, height: 10 },
      e2: { id: 'e2', x: 10, y: 0, width: 10, height: 10 },
      e3: { id: 'e3', x: 20, y: 0, width: 10, height: 10 },
    },
    groups: {
      g1: { id: 'g1', members: ['e1', 'e2', 'e3'] },
    },
    behaviors: {
      b1: {
        id: 'b1',
        target: { type: 'group', groupId: 'g1' },
        rootActionId: 'a1',
      },
    },
    actions: {
      a1: { id: 'a1', type: 'Sequence', children: ['a2', 'a3'] },
      a2: {
        id: 'a2',
        type: 'MoveUntil',
        target: { type: 'group', groupId: 'g1' },
        velocity: { x: speed, y: 0 },
        conditionId: 'c1',
      },
      a3: { id: 'a3', type: 'Call', callId: 'onReverse' },
    },
    conditions: {
      c1: {
        id: 'c1',
        type: 'BoundsHit',
        bounds: { minX: -10, maxX: 30, minY: -100, maxY: 100 },
        mode: 'any',
      },
    },
  };
}

describe('compiler/runtime integration', () => {
  it('C1 compile simple entity behavior', () => {
    const scene = simpleScene();
    let called = 0;
    const compiled = compileScene(scene, {
      callRegistry: {
        onDone: () => {
          called += 1;
        },
      },
    });
    compiled.startAll();
    compiled.actionManager.update(49);
    expect(called).toBe(0);
    compiled.actionManager.update(1);
    expect(called).toBe(1);
  });

  it('C2 compile group formation behavior', () => {
    const scene = groupScene(100);
    let called = 0;
    const compiled = compileScene(scene, {
      callRegistry: {
        onReverse: () => {
          called += 1;
        },
      },
    });
    compiled.startAll();
    compiled.actionManager.update(100);
    const positions = Object.values(compiled.entities).map((e) => e.x);
    expect(positions.some((x) => x > 0)).toBe(true);
    compiled.actionManager.update(100);
    expect(called).toBe(1);
  });

  it('C3 recompile with changed params changes behavior', () => {
    const sceneSlow = groupScene(50);
    const compiledSlow = compileScene(sceneSlow, { callRegistry: { onReverse: () => {} } });
    compiledSlow.startAll();
    compiledSlow.actionManager.update(100);
    const slowX = compiledSlow.entities.e1.x;

    const sceneFast = groupScene(100);
    const compiledFast = compileScene(sceneFast, { callRegistry: { onReverse: () => {} } });
    compiledFast.startAll();
    compiledFast.actionManager.update(100);
    const fastX = compiledFast.entities.e1.x;

    expect(fastX).toBeGreaterThan(slowX);
  });

  it('C4 recompile/reset does not duplicate actions', () => {
    const scene = groupScene(50);
    const compiled = compileScene(scene, { callRegistry: { onReverse: () => {} } });
    compiled.startAll();
    compiled.actionManager.update(100);
    const first = compiled.entities.e1.x;
    compiled.reset();
    compiled.startAll();
    compiled.actionManager.update(100);
    const second = compiled.entities.e1.x;
    expect(second - first).toBeCloseTo(5, 2);
  });
});

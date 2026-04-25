import { describe, it, expect } from 'vitest';
import { compileScene } from '../../src/compiler/compileScene';
import { SceneSpec } from '../../src/model/types';
import { RuntimeEntity } from '../../src/runtime/targets/types';
import { baseScene } from '../helpers';
import { OpRegistry } from '../../src/compiler/opRegistry';

function patrolScene(speed: number): SceneSpec {
  return {
    id: 'scene-patrol',
    entities: {
      e1: { id: 'e1', x: 0, y: 0, width: 10, height: 10 },
      e2: { id: 'e2', x: 10, y: 0, width: 10, height: 10 },
      e3: { id: 'e3', x: 20, y: 0, width: 10, height: 10 },
    },
    groups: {
      g1: { id: 'g1', members: ['e1', 'e2', 'e3'] },
    },
    attachments: {},
    behaviors: {
      b1: {
        id: 'b1',
        target: { type: 'group', groupId: 'g1' },
        rootActionId: 'a1',
      },
    },
    actions: {
      a1: { id: 'a1', type: 'Sequence', children: ['a2', 'a3', 'a4'] },
      a2: {
        id: 'a2',
        type: 'MoveUntil',
        target: { type: 'group', groupId: 'g1' },
        velocity: { x: speed, y: 0 },
        conditionId: 'c1',
      },
      a3: { id: 'a3', type: 'Call', callId: 'drop' },
      a4: {
        id: 'a4',
        type: 'MoveUntil',
        target: { type: 'group', groupId: 'g1' },
        velocity: { x: -speed, y: 0 },
        conditionId: 'c2',
      },
    },
    conditions: {
      c1: {
        id: 'c1',
        type: 'BoundsHit',
        bounds: { minX: -10, maxX: 30, minY: -100, maxY: 100 },
        mode: 'any',
      },
      c2: {
        id: 'c2',
        type: 'BoundsHit',
        bounds: { minX: -10, maxX: 40, minY: -100, maxY: 100 },
        mode: 'any',
      },
    },
  };
}

describe('scenario/regression', () => {
  it('D1 formation patrol scenario', () => {
    const scene = patrolScene(100);
    let entities: RuntimeEntity[] = [];
    const opRegistry = new OpRegistry();
    opRegistry.register('drop', () => {
      for (const e of entities) {
        e.y += 5;
      }
    });
    const compiled = compileScene(scene, {
      opRegistry,
    });
    entities = Object.values(compiled.entities);
    const startX = entities.map((e) => e.x);
    compiled.startAll();
    compiled.actionManager.update(100);
    const movedRight = entities.map((e) => e.x);
    expect(movedRight.some((x, i) => x > startX[i])).toBe(true);
    const dropped = entities.map((e) => e.y);
    expect(dropped.every((y) => y === 5)).toBe(true);

    compiled.actionManager.update(0);
    compiled.actionManager.update(100);
    const movedLeft = entities.map((e) => e.x);
    expect(movedLeft.some((x, i) => x < movedRight[i])).toBe(true);
  });

  it('D2 save/load round-trip', () => {
    const scene = baseScene();
    const json = JSON.stringify(scene);
    const parsed = JSON.parse(json) as SceneSpec;

    const opRegistry = new OpRegistry();
    opRegistry.register('reverse', () => {});
    const compiled = compileScene(parsed, { opRegistry });
    compiled.startAll();
    compiled.actionManager.update(100);
    expect(Object.values(compiled.entities).some((e) => e.x !== 0)).toBe(true);
  });

  it('D3 parameter patch scenario', () => {
    const scene = baseScene();
    const opA = new OpRegistry();
    opA.register('reverse', () => {});
    const compiledA = compileScene(scene, { opRegistry: opA });
    compiledA.startAll();
    compiledA.actionManager.update(100);
    const before = compiledA.entities.e1.x;

    const patched = baseScene();
    patched.actions.a2 = {
      id: 'a2',
      type: 'MoveUntil',
      target: { type: 'group', groupId: 'g1' },
      velocity: { x: 200, y: 0 },
      conditionId: 'c1',
    };
    const compiledB = compileScene(patched, {
      opRegistry: opA,
    });
    compiledB.startAll();
    compiledB.actionManager.update(100);
    const after = compiledB.entities.e1.x;

    expect(after).toBeGreaterThan(before);
  });
});

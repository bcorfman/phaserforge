import { describe, it, expect } from 'vitest';
import { validateSceneSpec } from '../../src/model/validation';
import { baseScene } from '../helpers';

describe('model validation', () => {
  it('A1 valid scene spec passes', () => {
    const scene = baseScene();
    expect(() => validateSceneSpec(scene)).not.toThrow();
  });

  it('A2 missing rootAction fails', () => {
    const scene = baseScene();
    scene.behaviors.b1.rootActionId = 'missing';
    expect(() => validateSceneSpec(scene)).toThrow(/missing root action/i);
  });

  it('A3 invalid group member fails clearly', () => {
    const scene = baseScene();
    scene.groups.g1.members.push('ghost');
    expect(() => validateSceneSpec(scene)).toThrow(/unknown entity/i);
  });

  it('A4 action cycle detection', () => {
    const scene = baseScene();
    scene.actions.a1 = { id: 'a1', type: 'Sequence', children: ['a2'] };
    scene.actions.a2 = { id: 'a2', type: 'Sequence', children: ['a1'] };
    scene.behaviors.b1.rootActionId = 'a1';
    expect(() => validateSceneSpec(scene)).toThrow(/cycle/i);
  });

  it('A5 unknown action type fails', () => {
    const scene = baseScene();
    scene.actions.a1 = { id: 'a1', type: 'Mystery' as any };
    expect(() => validateSceneSpec(scene)).toThrow(/unknown action type/i);
  });

  it('A6 invalid target reference fails', () => {
    const scene = baseScene();
    scene.behaviors.b1.target = { type: 'group', groupId: 'missing' };
    expect(() => validateSceneSpec(scene)).toThrow(/unknown group/i);
  });

  it('A7 authored sprite properties validate and default correctly', () => {
    const scene = baseScene();
    scene.entities.e1.scaleX = 1.5;
    scene.entities.e1.scaleY = 0.75;
    scene.entities.e1.originX = 0.25;
    scene.entities.e1.originY = 0.75;
    scene.entities.e1.alpha = 0.4;
    scene.entities.e1.visible = false;
    scene.entities.e1.depth = 12;
    scene.entities.e1.flipX = true;
    scene.entities.e1.flipY = true;
    expect(() => validateSceneSpec(scene)).not.toThrow();
  });

  it('A8 invalid authored sprite property ranges fail clearly', () => {
    const scene = baseScene();
    scene.entities.e1.scaleX = 0;
    expect(() => validateSceneSpec(scene)).toThrow(/scale/i);

    scene.entities.e1.scaleX = 1;
    scene.entities.e1.originX = 2;
    expect(() => validateSceneSpec(scene)).toThrow(/origin/i);

    scene.entities.e1.originX = 0.5;
    scene.entities.e1.alpha = 2;
    expect(() => validateSceneSpec(scene)).toThrow(/alpha/i);
  });

  it('A9 hitbox must fit within entity dimensions', () => {
    const scene = baseScene();
    scene.entities.e1.hitbox = { x: 2, y: 2, width: 20, height: 20 };
    expect(() => validateSceneSpec(scene)).toThrow(/hitbox/i);
  });
});

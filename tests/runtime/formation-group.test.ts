import { describe, expect, it } from 'vitest';
import { compileScene } from '../../src/compiler/compileScene';
import { FormationGroup } from '../../src/runtime/targets/types';
import { baseScene } from '../helpers';
import { OpRegistry } from '../../src/compiler/opRegistry';

describe('formation group runtime', () => {
  it('records stable home slots from compiled entity positions', () => {
    const opRegistry = new OpRegistry();
    opRegistry.register('reverse', () => {});
    const compiled = compileScene(baseScene(), { opRegistry });
    const group = compiled.groups.g1 as FormationGroup;

    expect(group.homeSlots.e1).toEqual({ x: 0, y: 0 });
    expect(group.homeSlots.e2).toEqual({ x: 20, y: 0 });
    expect(group.homeSlots.e3).toEqual({ x: 40, y: 0 });
    expect(group.members[0].homeX).toBe(0);
    expect(group.members[2].homeX).toBe(40);
  });

  it('computes current and home bounds from member edges', () => {
    const opRegistry = new OpRegistry();
    opRegistry.register('reverse', () => {});
    const compiled = compileScene(baseScene(), { opRegistry });
    const group = compiled.groups.g1 as FormationGroup;

    expect(group.getBounds()).toEqual({
      minX: -5,
      maxX: 45,
      minY: -5,
      maxY: 5,
    });
    expect(group.getHomeBounds()).toEqual({
      minX: -5,
      maxX: 45,
      minY: -5,
      maxY: 5,
    });
  });

  it('translates all members while preserving spacing', () => {
    const opRegistry = new OpRegistry();
    opRegistry.register('reverse', () => {});
    const compiled = compileScene(baseScene(), { opRegistry });
    const group = compiled.groups.g1 as FormationGroup;

    const before = group.members.map((member) => member.x);
    group.translate(15, 8);

    expect(group.members.map((member) => member.x)).toEqual(before.map((x) => x + 15));
    expect(group.members.map((member) => member.y)).toEqual([8, 8, 8]);
    expect(group.members[1].x - group.members[0].x).toBe(20);
    expect(group.members[2].x - group.members[1].x).toBe(20);
    expect(group.homeSlots.e1).toEqual({ x: 0, y: 0 });
  });

  it('sets and stops member velocities through the group API', () => {
    const opRegistry = new OpRegistry();
    opRegistry.register('reverse', () => {});
    const compiled = compileScene(baseScene(), { opRegistry });
    const group = compiled.groups.g1 as FormationGroup;

    group.setVelocity(30, -12);
    expect(group.members.every((member) => member.vx === 30 && member.vy === -12)).toBe(true);

    group.stopVelocity('x');
    expect(group.members.every((member) => member.vx === 0 && member.vy === -12)).toBe(true);

    group.stopVelocity();
    expect(group.members.every((member) => member.vx === 0 && member.vy === 0)).toBe(true);
  });
});

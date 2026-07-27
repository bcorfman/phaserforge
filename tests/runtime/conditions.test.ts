import { describe, expect, it } from 'vitest';
import { CounterCompare } from '../../src/runtime/conditions/CounterCompare';
import { ElapsedTime } from '../../src/runtime/conditions/ElapsedTime';
import { InputActionEdge } from '../../src/runtime/conditions/InputActionEdge';
import { Instant } from '../../src/runtime/conditions/Instant';

const target = {} as any;

describe('runtime conditions', () => {
  it('evaluates all counter comparison operators against the live value', () => {
    let current = 5;
    const equal = new CounterCompare(() => current, '==', 5);
    const atLeast = new CounterCompare(() => current, '>=', 5);
    const atMost = new CounterCompare(() => current, '<=', 5);

    expect(equal.isMet(target)).toBe(true);
    expect(atLeast.isMet(target)).toBe(true);
    expect(atMost.isMet(target)).toBe(true);
    current = 6;
    expect(equal.isMet(target)).toBe(false);
    expect(atLeast.isMet(target)).toBe(true);
    expect(atMost.isMet(target)).toBe(false);
    current = 4;
    expect(equal.isMet(target)).toBe(false);
    expect(atLeast.isMet(target)).toBe(false);
    expect(atMost.isMet(target)).toBe(true);
    equal.reset();
    equal.update(16);
  });

  it('tracks elapsed time and can be reset', () => {
    const condition = new ElapsedTime(100);
    expect(condition.isMet(target)).toBe(false);
    condition.update(40);
    expect(condition.isMet(target)).toBe(false);
    condition.update(60);
    expect(condition.isMet(target)).toBe(true);
    condition.reset();
    expect(condition.isMet(target)).toBe(false);
  });

  it('latches pressed and released input edges independently', () => {
    let state = { pressed: false, held: false, released: false };
    const input = { getActionState: () => state } as any;
    const pressed = new InputActionEdge(input, 'jump', 'pressed');
    const released = new InputActionEdge(input, 'jump', 'released');

    pressed.update(16);
    released.update(16);
    expect(pressed.isMet(target)).toBe(false);
    expect(released.isMet(target)).toBe(false);
    state = { pressed: true, held: true, released: false };
    pressed.update(16);
    released.update(16);
    expect(pressed.isMet(target)).toBe(true);
    expect(released.isMet(target)).toBe(false);
    state = { pressed: false, held: false, released: true };
    pressed.update(16);
    released.update(16);
    expect(pressed.isMet(target)).toBe(true);
    expect(released.isMet(target)).toBe(true);
    released.reset();
    expect(released.isMet(target)).toBe(false);
  });

  it('is immediately met regardless of target', () => {
    const condition = new Instant();
    expect(condition.isMet(target)).toBe(true);
    condition.reset();
    condition.update(16);
    expect(condition.isMet(target)).toBe(true);
  });
});

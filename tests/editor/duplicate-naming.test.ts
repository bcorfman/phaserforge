import { describe, expect, it } from 'vitest';
import { allocDuplicateName } from '../../src/editor/duplicateNaming';

describe('allocDuplicateName', () => {
  it('increments trailing numbers when present', () => {
    expect(allocDuplicateName('Ship1', new Set(['Ship1']))).toBe('Ship2');
  });

  it('skips over collisions when incrementing trailing numbers', () => {
    expect(allocDuplicateName('Ship1', new Set(['Ship1', 'Ship2', 'Ship3']))).toBe('Ship4');
  });

  it('adds a 2 suffix when no trailing number exists', () => {
    expect(allocDuplicateName('Ship', new Set(['Ship']))).toBe('Ship2');
  });

  it('skips over collisions when adding a number suffix', () => {
    expect(allocDuplicateName('Ship', new Set(['Ship', 'Ship2', 'Ship3']))).toBe('Ship4');
  });
});


import { describe, expect, it } from 'vitest';
import { createSerializedAsyncQueue } from '../../src/editor/serializedAsyncQueue';

describe('createSerializedAsyncQueue', () => {
  it('runs tasks sequentially even when earlier work resolves later', async () => {
    const queue = createSerializedAsyncQueue();
    const events: string[] = [];
    let releaseFirst: (() => void) | null = null;

    const first = queue.run(async () => {
      events.push('first:start');
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      events.push('first:end');
      return 'first';
    });

    const second = queue.run(async () => {
      events.push('second:start');
      events.push('second:end');
      return 'second';
    });

    await Promise.resolve();
    expect(events).toEqual(['first:start']);

    releaseFirst?.();

    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
    expect(events).toEqual(['first:start', 'first:end', 'second:start', 'second:end']);
  });

  it('continues running later tasks after a rejection', async () => {
    const queue = createSerializedAsyncQueue();
    const events: string[] = [];

    const first = queue.run(async () => {
      events.push('first');
      throw new Error('boom');
    });

    const second = queue.run(async () => {
      events.push('second');
      return 'ok';
    });

    await expect(first).rejects.toThrow('boom');
    await expect(second).resolves.toBe('ok');
    expect(events).toEqual(['first', 'second']);
  });
});

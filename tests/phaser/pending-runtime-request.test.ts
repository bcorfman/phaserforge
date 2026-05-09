import { describe, expect, test } from 'vitest';
import { consumePendingRuntimeRequestedSceneId, setPendingRuntimeRequestedSceneId } from '../../src/phaser/pendingRuntimeRequest';

describe('pendingRuntimeRequest', () => {
  test('stores latest sceneId until consumed', () => {
    setPendingRuntimeRequestedSceneId('wave-1');
    setPendingRuntimeRequestedSceneId('wave-2');

    expect(consumePendingRuntimeRequestedSceneId()).toBe('wave-2');
    expect(consumePendingRuntimeRequestedSceneId()).toBeNull();
  });
});


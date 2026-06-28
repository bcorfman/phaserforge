// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { configureGameAudioPersistence, createGameConfig } from '../../src/runtime/main';

describe('runtime game bootstrap', () => {
  it('uses the browser device pixel ratio for the Phaser backing canvas', () => {
    const originalDevicePixelRatio = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 2,
    });

    try {
      expect(createGameConfig('game-container').resolution).toBe(2);
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        value: originalDevicePixelRatio,
      });
    }
  });

  it('disables Phaser pause-on-blur so published audio keeps playing across focus changes', () => {
    const game = {
      sound: {
        pauseOnBlur: true,
      },
    } as any;

    configureGameAudioPersistence(game);

    expect(game.sound.pauseOnBlur).toBe(false);
  });

  it('tolerates game instances without a sound manager', () => {
    expect(() => configureGameAudioPersistence({} as any)).not.toThrow();
  });
});

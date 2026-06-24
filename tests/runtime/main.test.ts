// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { configureGameAudioPersistence } from '../../src/runtime/main';

describe('runtime game bootstrap', () => {
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

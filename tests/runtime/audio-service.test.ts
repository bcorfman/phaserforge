import { describe, expect, it } from 'vitest';
import { BasicAudioService, type SoundLike, type SoundManagerLike } from '../../src/runtime/services/BasicAudioService';

class FakeSound implements SoundLike {
  public loop = false;
  public volume = 1;
  public playCount = 0;
  public stopCount = 0;
  public destroyed = false;
  public isPlaying = false;

  play(config?: { loop?: boolean; volume?: number }): boolean {
    this.playCount += 1;
    if (config?.loop != null) this.loop = Boolean(config.loop);
    if (config?.volume != null) this.volume = Number(config.volume);
    this.isPlaying = true;
    return true;
  }

  stop(): void {
    this.stopCount += 1;
    this.isPlaying = false;
  }

  setLoop(loop: boolean): this {
    this.loop = loop;
    return this;
  }

  setVolume(volume: number): this {
    this.volume = volume;
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeSoundManager implements SoundManagerLike {
  public sounds = new Map<string, FakeSound>();
  add(key: string): FakeSound {
    const sound = new FakeSound();
    this.sounds.set(key, sound);
    return sound;
  }
  removeByKey(key: string): void {
    this.sounds.delete(key);
  }
}

describe('BasicAudioService', () => {
  it('tracks music + ambience from scene spec', () => {
    const manager = new FakeSoundManager();
    const svc = new BasicAudioService(manager, (id) => `audio:${id}`);

    const project = {
      audio: {
        sounds: {
          music_theme: { id: 'music_theme', source: { kind: 'path', path: '/x.mp3' } },
          forest: { id: 'forest', source: { kind: 'path', path: '/y.ogg' } },
        },
      },
    } as any;

    svc.applySceneAudio(
      {
        music: { assetId: 'music_theme', loop: true, volume: 0.65, fadeMs: 250 },
        ambience: [{ assetId: 'forest', loop: true, volume: 0.35 }],
      } as any,
      project,
    );

    expect(svc.getSnapshot()).toEqual({ musicAssetId: 'music_theme', ambienceAssetIds: ['forest'] });
  });

  it('clears state when scene spec has no audio', () => {
    const manager = new FakeSoundManager();
    const svc = new BasicAudioService(manager, (id) => `audio:${id}`);
    const project = { audio: { sounds: { a: { id: 'a', source: { kind: 'path', path: '/a.mp3' } } } } } as any;

    svc.applySceneAudio({ music: { assetId: 'a', loop: true, volume: 1, fadeMs: 0 } } as any, project);
    expect(svc.getSnapshot().musicAssetId).toBe('a');

    svc.applySceneAudio({} as any, project);
    expect(svc.getSnapshot()).toEqual({ musicAssetId: undefined, ambienceAssetIds: [] });
  });
});


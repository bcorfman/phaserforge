import type { AudioService } from './RuntimeServices';
import type { ProjectSpec } from '../../model/types';
import type { GameSceneSpec, Id } from '../../model/types';

type SoundConfig = { loop?: boolean; volume?: number };

export interface SoundLike {
  play(config?: SoundConfig): boolean;
  stop(): void;
  setLoop(loop: boolean): this;
  setVolume(volume: number): this;
  destroy(): void;
  isPlaying?: boolean;
}

export interface SoundManagerLike {
  add(key: string, config?: SoundConfig): SoundLike;
  get?(key: string): SoundLike | null;
  removeByKey?(key: string): void;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

export class BasicAudioService implements AudioService {
  private music?: { assetId: Id; key: string; sound?: SoundLike; volume: number; loop: boolean; fadeMs: number };
  private ambience = new Map<Id, { key: string; sound?: SoundLike; volume: number; loop: boolean }>();

  constructor(
    private readonly manager: SoundManagerLike,
    private readonly getKey: (assetId: string) => string = (assetId) => `audio:${assetId}`,
  ) {}

  public playMusic(assetId: string, options: { loop?: boolean; volume?: number; fadeMs?: number } = {}): void {
    const loop = options.loop ?? true;
    const volume = clamp01(options.volume ?? 1);
    const fadeMs = Number.isFinite(Number(options.fadeMs)) ? Math.max(0, Number(options.fadeMs)) : 0;

    if (this.music?.assetId === assetId) {
      try {
        this.music.sound?.setLoop(loop).setVolume(volume);
      } catch {
        // ignore playback errors
      }
      this.music = { ...this.music, loop, volume, fadeMs };
      return;
    }

    this.stopMusic({ fadeMs: 0 });

    const key = this.getKey(assetId);
    // Track intended state even if playback fails (headless tests, missing cache entries, etc.).
    this.music = { assetId, key, sound: undefined, volume, loop, fadeMs };
    try {
      const sound = this.manager.add(key, { loop, volume });
      sound.setLoop(loop).setVolume(volume);
      sound.play({ loop, volume });
      this.music = { assetId, key, sound, volume, loop, fadeMs };
    } catch {
      // ignore playback errors
    }
  }

  public stopMusic(_options: { fadeMs?: number } = {}): void {
    if (!this.music) return;
    const current = this.music;
    this.music = undefined;
    try {
      current.sound?.stop();
      current.sound?.destroy();
    } catch {
      // ignore
    }
    try {
      this.manager.removeByKey?.(current.key);
    } catch {
      // ignore
    }
  }

  public playSfx(assetId: string, options: { volume?: number } = {}): void {
    const volume = clamp01(options.volume ?? 1);
    const key = this.getKey(assetId);
    try {
      const sound = this.manager.add(key, { loop: false, volume });
      sound.setLoop(false).setVolume(volume);
      sound.play({ loop: false, volume });
    } catch {
      // ignore
    }
  }

  public applySceneAudio(scene: Pick<GameSceneSpec, 'music' | 'ambience'>, project: Pick<ProjectSpec, 'audio'>): void {
    const sounds = project.audio?.sounds ?? {};
    const music = scene.music;
    if (music && sounds[music.assetId]) {
      this.playMusic(music.assetId, { loop: music.loop, volume: music.volume, fadeMs: music.fadeMs });
    } else {
      this.stopMusic({ fadeMs: 0 });
    }

    const desired = (scene.ambience ?? []).filter((entry) => sounds[entry.assetId]);
    const desiredIds = new Set(desired.map((entry) => entry.assetId));

    for (const [assetId, entry] of this.ambience.entries()) {
      if (!desiredIds.has(assetId)) {
        try {
          entry.sound.stop();
          entry.sound.destroy();
        } catch {
          // ignore
        }
        this.ambience.delete(assetId);
      }
    }

    for (const entry of desired) {
      const existing = this.ambience.get(entry.assetId);
      const loop = entry.loop;
      const volume = clamp01(entry.volume);
      if (existing) {
        existing.loop = loop;
        existing.volume = volume;
        try {
          existing.sound?.setLoop(loop).setVolume(volume);
          if (existing.sound && !existing.sound.isPlaying) existing.sound.play({ loop, volume });
        } catch {
          // ignore
        }
        continue;
      }

      const key = this.getKey(entry.assetId);
      // Track intended ambience even if playback fails.
      this.ambience.set(entry.assetId, { key, sound: undefined, loop, volume });
      try {
        const sound = this.manager.add(key, { loop, volume });
        sound.setLoop(loop).setVolume(volume);
        sound.play({ loop, volume });
        this.ambience.set(entry.assetId, { key, sound, loop, volume });
      } catch {
        // ignore
      }
    }
  }

  public getSnapshot(): { musicAssetId?: string; ambienceAssetIds: string[] } {
    return {
      musicAssetId: this.music?.assetId,
      ambienceAssetIds: Array.from(this.ambience.keys()).sort(),
    };
  }

  public stopAll(): void {
    this.stopMusic({ fadeMs: 0 });
    for (const [, entry] of this.ambience.entries()) {
      try {
        entry.sound?.stop();
        entry.sound?.destroy();
      } catch {
        // ignore
      }
    }
    this.ambience.clear();
  }
}

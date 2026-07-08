import { useEffect, useMemo, useState } from 'react';
import { getActiveScene } from './phaser/EventBus';

type AudioDebugSnapshot = {
  sceneKey?: string;
  audio?: { musicAssetId?: string; ambienceAssetIds?: string[] };
  audioPlayback?: { musicIsPlaying?: boolean; ambiencePlayingAssetIds?: string[] };
  audioDebug?: {
    contextState?: string;
    locked?: boolean;
    unlocked?: boolean;
    outputRange?: number;
    usingWebAudio?: boolean;
    managerType?: 'webaudio' | 'html5' | 'unknown';
    globalMute?: boolean;
    globalVolume?: number;
    musicKey?: string;
    cacheHasCurrentMusic?: boolean;
    currentMusicResolvedUrl?: string;
    currentMusicLoadType?: string;
    currentMusicLoadStatus?: 'queued' | 'complete' | 'error' | 'cached';
    currentMusicLoadError?: string;
  };
};

function isAudioDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  return url.searchParams.get('audioDebug') === '1';
}

function readSnapshot(): AudioDebugSnapshot | null {
  const scene = getActiveScene() as { getTestSnapshot?: () => unknown } | null;
  if (!scene?.getTestSnapshot) return null;
  try {
    return scene.getTestSnapshot() as AudioDebugSnapshot;
  } catch {
    return null;
  }
}

export function AudioDebugOverlay(): JSX.Element | null {
  const enabled = useMemo(() => isAudioDebugEnabled(), []);
  const [snapshot, setSnapshot] = useState<AudioDebugSnapshot | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const update = () => setSnapshot(readSnapshot());
    update();
    const intervalId = window.setInterval(update, 250);
    return () => window.clearInterval(intervalId);
  }, [enabled]);

  if (!enabled) return null;

  const audio = snapshot?.audio;
  const playback = snapshot?.audioPlayback;
  const debug = snapshot?.audioDebug;

  return (
    <div
      data-testid="audio-debug-overlay"
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 9999,
        width: 320,
        maxWidth: 'calc(100vw - 24px)',
        borderRadius: 10,
        background: 'rgba(12, 15, 26, 0.92)',
        color: '#f7f4ea',
        padding: '10px 12px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
        font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Audio Debug</div>
      <div>scene: {snapshot?.sceneKey ?? 'n/a'}</div>
      <div>manager: {debug?.managerType ?? 'n/a'} / webAudio={String(debug?.usingWebAudio ?? false)}</div>
      <div>context: {debug?.contextState ?? 'n/a'}</div>
      <div>locked: {String(debug?.locked ?? false)} / unlocked: {String(debug?.unlocked ?? false)}</div>
      <div>mute: {String(debug?.globalMute ?? false)} / volume: {debug?.globalVolume ?? 'n/a'}</div>
      <div>musicAsset: {audio?.musicAssetId ?? 'none'}</div>
      <div>musicKey: {debug?.musicKey ?? 'none'}</div>
      <div>cacheHasCurrentMusic: {String(debug?.cacheHasCurrentMusic ?? false)}</div>
      <div>loadStatus: {debug?.currentMusicLoadStatus ?? 'n/a'}</div>
      <div>loadType: {debug?.currentMusicLoadType ?? 'n/a'}</div>
      <div>musicIsPlaying: {String(playback?.musicIsPlaying ?? false)}</div>
      <div>outputRange: {debug?.outputRange ?? 'n/a'}</div>
      <div style={{ wordBreak: 'break-all' }}>url: {debug?.currentMusicResolvedUrl ?? 'n/a'}</div>
      {debug?.currentMusicLoadError ? (
        <div style={{ wordBreak: 'break-all', color: '#ffb4a2' }}>error: {debug.currentMusicLoadError}</div>
      ) : null}
      <div>ambience: {(audio?.ambienceAssetIds ?? []).join(', ') || 'none'}</div>
    </div>
  );
}

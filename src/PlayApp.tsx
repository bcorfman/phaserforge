import { useEffect, useMemo, useState } from 'react';
import { PhaserGame } from './phaser/PhaserHost';
import { EventBus, getActiveScene } from './phaser/EventBus';
import { getGame } from './cloud/api';
import { parseProjectYaml } from './model/serialization';
import { getSceneWorld } from './editor/sceneWorld';
import type { ProjectSpec } from './model/types';
import { AudioDebugOverlay } from './AudioDebugOverlay';
import './app/layout.css';

function readPlayGameId(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const id = url.searchParams.get('playGameId');
  return id && id.trim().length > 0 ? id.trim() : null;
}

function readYamlUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const raw = url.searchParams.get('yamlUrl');
  if (raw && raw.trim().length > 0) return raw.trim();
  const globalVal = (window as any).__PHASER_FORGE_PLAY_YAML_URL;
  return typeof globalVal === 'string' && globalVal.trim().length > 0 ? globalVal.trim() : null;
}

function unlockAudioFromStartGesture(): void {
  const game = (window as any).__phaserGame;
  const sound = game?.sound;
  try {
    sound?.unlock?.();
  } catch {
    // ignore
  }
  try {
    void sound?.context?.resume?.();
  } catch {
    // ignore
  }
}

export default function PlayApp() {
  const gameId = useMemo(() => readPlayGameId(), []);
  const yamlUrl = useMemo(() => readYamlUrl(), []);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectSpec | null>(null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (yamlUrl) {
          const res = await fetch(yamlUrl, { credentials: 'omit' });
          if (!res.ok) throw new Error(`http_${res.status}`);
          const yamlText = await res.text();
          const parsed = parseProjectYaml(yamlText);
          if (cancelled) return;
          setProject(parsed);
          setSceneId(parsed.initialSceneId);
        } else {
          if (!gameId) throw new Error('Missing playGameId');
          const res = await getGame(gameId);
          if (cancelled) return;
          setProject(res.game.project);
          setSceneId(res.game.project.initialSceneId);
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load game';
        setError(msg);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [gameId, yamlUrl]);

  const world = useMemo(() => {
    if (!project || !sceneId) return null;
    const scene = project.scenes[sceneId];
    return scene ? getSceneWorld(scene) : null;
  }, [project, sceneId]);

  useEffect(() => {
    if (!hasStarted || !sceneReady || !project || !sceneId) return;
    EventBus.emit('runtime:load-project', project, sceneId, 'play');
  }, [hasStarted, sceneReady, project, sceneId]);

  useEffect(() => {
    const handleReady = () => setSceneReady(true);
    if (getActiveScene()) handleReady();
    EventBus.on('current-scene-ready', handleReady);
    return () => {
      EventBus.off('current-scene-ready', handleReady);
    };
  }, []);

  if (error) {
    return (
      <div className="play-root" data-testid="play-root">
        <div className="play-error" data-testid="play-error">
          <div className="play-error-title">Unable to launch game</div>
          <div className="play-error-message">{error}</div>
          <a className="button" href="./">
            Back to editor
          </a>
        </div>
      </div>
    );
  }

  if (!project || !sceneId) {
    return (
      <div className="play-root" data-testid="play-root">
        <div className="play-loading" data-testid="play-loading">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="play-root" data-testid="play-root">
      <AudioDebugOverlay />
      <div className="play-frame" data-testid="play-frame" style={world ? { width: world.width, height: world.height } : undefined}>
        <PhaserGame currentActiveScene={() => setSceneReady(true)} />
        {!hasStarted ? (
          <button
            className="play-start-gate"
            data-testid="play-start-gate"
            type="button"
            onClick={() => {
              unlockAudioFromStartGesture();
              setHasStarted(true);
            }}
          >
            Click to Start
          </button>
        ) : null}
      </div>
    </div>
  );
}

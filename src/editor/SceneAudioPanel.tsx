import { useMemo } from 'react';
import type { GameSceneSpec, ProjectSpec } from '../model/types';
import type { EditorAction } from './EditorStore';
import { InspectorFoldout, useInspectorFoldouts } from './InspectorFoldout';
import { ValidatedNumberInput } from './ValidatedNumberInput';

export function SceneAudioPanel({
  project,
  sceneId,
  scene,
  dispatch,
  disabled,
}: {
  project: ProjectSpec;
  sceneId: string;
  scene: GameSceneSpec;
  dispatch: React.Dispatch<EditorAction>;
  disabled: boolean;
}) {
  const foldouts = useInspectorFoldouts();

  return (
    <div className="inspector-block" data-testid="scene-audio-panel">
      <div className="inspector-title">Scene: {sceneId}</div>
      <InspectorFoldout
        title="Audio"
        open={foldouts.isOpen('scene.audio', true)}
        onToggle={() => foldouts.toggle('scene.audio', true)}
        testId="scene-audio-foldout"
      >
        <SceneAudioBody project={project} scene={scene} dispatch={dispatch} disabled={disabled} />
      </InspectorFoldout>
    </div>
  );
}

export function SceneAudioBody({
  project,
  scene,
  dispatch,
  disabled,
}: {
  project: ProjectSpec;
  scene: GameSceneSpec;
  dispatch: React.Dispatch<EditorAction>;
  disabled: boolean;
}) {
  const soundIds = useMemo(() => Object.keys(project.audio?.sounds ?? {}).sort(), [project.audio?.sounds]);
  const hasSounds = soundIds.length > 0;

  const musicAssetId = scene.music?.assetId ?? '';
  const musicLoop = scene.music?.loop ?? true;
  const musicVolume = scene.music?.volume ?? 1;
  const musicFadeMs = scene.music?.fadeMs ?? 0;

  const ambience = scene.ambience ?? [];

  const setMusicAsset = (nextAssetId: string) => {
    if (!nextAssetId) {
      dispatch({ type: 'set-scene-music', music: undefined } as any);
      return;
    }
    dispatch({
      type: 'set-scene-music',
      music: {
        assetId: nextAssetId,
        loop: musicLoop,
        volume: musicVolume,
        fadeMs: musicFadeMs,
      },
    } as any);
  };

  const patchMusic = (patch: Partial<NonNullable<GameSceneSpec['music']>>) => {
    if (!scene.music) return;
    dispatch({ type: 'set-scene-music', music: { ...scene.music, ...patch } } as any);
  };

  const setAmbience = (next: NonNullable<GameSceneSpec['ambience']>) => {
    dispatch({ type: 'set-scene-ambience', ambience: next } as any);
  };

  return (
    <>
      {!hasSounds && (
        <div className="inspector-row muted">
          Add audio assets in the left panel to enable scene music and ambience.
        </div>
      )}

      <label className="field">
        <span>Music</span>
        <select
          aria-label="Scene music asset"
          data-testid="scene-music-asset-select"
          value={musicAssetId}
          disabled={disabled || !hasSounds}
          onChange={(e) => setMusicAsset(e.target.value)}
        >
          <option value="">(none)</option>
          {soundIds.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </label>

      {scene.music && (
        <>
          <label className="field">
            <span>Loop</span>
            <input
              aria-label="Loop music"
              data-testid="scene-music-loop-input"
              type="checkbox"
              checked={musicLoop}
              disabled={disabled}
              onChange={(e) => patchMusic({ loop: e.target.checked })}
            />
          </label>
          <label className="field">
            <span>Volume</span>
            <ValidatedNumberInput
              aria-label="Music volume"
              data-testid="scene-music-volume-input"
              value={musicVolume}
              min={0}
              max={1}
              step={0.05}
              disabled={disabled}
              onCommit={(value) => patchMusic({ volume: value })}
            />
          </label>
          <label className="field">
            <span>Fade (ms)</span>
            <ValidatedNumberInput
              aria-label="Music fade ms"
              data-testid="scene-music-fade-input"
              value={musicFadeMs}
              min={0}
              step={50}
              disabled={disabled}
              onCommit={(value) => patchMusic({ fadeMs: value })}
            />
          </label>
        </>
      )}

      <div className="inspector-row" style={{ marginTop: 10, fontWeight: 700 }}>Ambience</div>
      {ambience.length === 0 && (
        <div className="inspector-row muted">No ambience tracks yet.</div>
      )}

      {ambience.map((entry, index) => (
        <div key={`${entry.assetId}:${index}`} className="inspector-row" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: 8, alignItems: 'center' }}>
            <select
              aria-label={`Ambience asset ${index}`}
              data-testid={`scene-ambience-asset-select-${index}`}
              value={entry.assetId}
              disabled={disabled || !hasSounds}
              onChange={(e) => {
                const next = ambience.slice();
                next[index] = { ...entry, assetId: e.target.value };
                setAmbience(next);
              }}
            >
              {soundIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            <label className="field" style={{ margin: 0 }}>
              <span style={{ display: 'none' }}>Loop</span>
              <input
                aria-label={`Ambience loop ${index}`}
                data-testid={`scene-ambience-loop-input-${index}`}
                type="checkbox"
                checked={entry.loop}
                disabled={disabled}
                onChange={(e) => {
                  const next = ambience.slice();
                  next[index] = { ...entry, loop: e.target.checked };
                  setAmbience(next);
                }}
              />
            </label>
            <ValidatedNumberInput
              aria-label={`Ambience volume ${index}`}
              data-testid={`scene-ambience-volume-input-${index}`}
              value={entry.volume}
              min={0}
              max={1}
              step={0.05}
              disabled={disabled}
              onCommit={(value) => {
                const next = ambience.slice();
                next[index] = { ...entry, volume: value };
                setAmbience(next);
              }}
            />
          </div>
          <button
            className="button button-danger button-compact"
            type="button"
            data-testid={`scene-ambience-remove-${index}`}
            disabled={disabled}
            onClick={() => {
              const next = ambience.slice();
              next.splice(index, 1);
              setAmbience(next);
            }}
          >
            ✕
          </button>
        </div>
      ))}

      <button
        className="button"
        data-testid="scene-ambience-add-button"
        type="button"
        disabled={disabled || !hasSounds}
        onClick={() => {
          const first = soundIds[0];
          if (!first) return;
          setAmbience([...ambience, { assetId: first, loop: true, volume: 0.35 }]);
        }}
      >
        + Add Ambience
      </button>
    </>
  );
}

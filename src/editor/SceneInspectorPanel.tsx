import type { GameSceneSpec, ProjectSpec } from '../model/types';
import type { EditorAction } from './EditorStore';
import { BackgroundLayersBody } from './BackgroundLayersPanel';
import { InspectorFoldout, useInspectorFoldouts } from './InspectorFoldout';
import { SceneAudioBody } from './SceneAudioPanel';
import { SceneCollisionsBody } from './SceneCollisionsPanel';
import { SceneInputBody } from './SceneInputPanel';
import { readSceneMapSelection } from './sceneInputMaps';
import { SceneStateBody } from './SceneStatePanel';
import { formatRgbHex, parseRgbHex } from './colorHex';

function summarizeCount(label: string, count: number): string {
  if (count === 1) return `1 ${label}`;
  return `${count} ${label}s`;
}

export function SceneInspectorPanel({
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

  const backgroundLayers = scene.backgroundLayers ?? [];
  const ambience = scene.ambience ?? [];
  const rules = scene.collisionRules ?? [];

  const musicLabel = scene.music?.assetId ? scene.music.assetId : '(none)';
  const audioSummary = `Music: ${musicLabel} · Ambience: ${ambience.length}`;

  const projectDefault = project.defaultInputMapId ?? '';
  const activeSelection = readSceneMapSelection(scene.input, 'active');
  const fallbackSelection = readSceneMapSelection(scene.input, 'fallback');
  const activeId = activeSelection.kind === 'map'
    ? activeSelection.mapId
    : activeSelection.kind === 'project-default'
      ? projectDefault
      : '';
  const fallbackId = fallbackSelection.kind === 'map'
    ? fallbackSelection.mapId
    : fallbackSelection.kind === 'project-default'
      ? projectDefault
      : '';
  const activeLabel = activeSelection.kind === 'none'
    ? '(none)'
    : activeId
      ? activeId
      : '(none)';
  const fallbackLabel = activeSelection.kind === 'none'
    ? '(disabled)'
    : (fallbackSelection.kind === 'none' ? '(none)' : fallbackId ? fallbackId : '(none)');
  const inputSummary = `Active: ${activeLabel} · Fallback: ${fallbackLabel}`;

  const backgroundSummary = summarizeCount('layer', backgroundLayers.length);
  const appearanceSummary = scene.backgroundColor == null ? 'Default' : formatRgbHex(scene.backgroundColor);
  const collisionsSummary = summarizeCount('rule', rules.length);
  const stateSummary = `${Object.keys(project.counters ?? {}).length} counters · ${Object.keys(project.collections ?? {}).length} collections`;

  const expandAll = () => {
    foldouts.setOpen('scene.backgroundLayers', true);
    foldouts.setOpen('scene.appearance', true);
    foldouts.setOpen('scene.audio', true);
    foldouts.setOpen('scene.input', true);
    foldouts.setOpen('scene.collisions', true);
    foldouts.setOpen('scene.state', true);
  };

  const collapseAll = () => {
    foldouts.setOpen('scene.backgroundLayers', false);
    foldouts.setOpen('scene.appearance', false);
    foldouts.setOpen('scene.audio', false);
    foldouts.setOpen('scene.input', false);
    foldouts.setOpen('scene.collisions', false);
    foldouts.setOpen('scene.state', false);
  };

  return (
    <div className="inspector-block" data-testid="scene-inspector-panel">
      <div className="inspector-title-row">
        <div className="inspector-title">Scene: {sceneId}</div>
        <div className="inspector-title-actions">
          <button className="button button-compact" type="button" onClick={expandAll}>
            Expand All
          </button>
          <button className="button button-compact" type="button" onClick={collapseAll}>
            Collapse All
          </button>
        </div>
      </div>

      <InspectorFoldout
        title="Scene Appearance"
        summary={appearanceSummary}
        open={foldouts.isOpen('scene.appearance', true)}
        onToggle={() => foldouts.toggle('scene.appearance', true)}
      >
        <div className="inspector-grid-2">
          <label className="field">
            <span>Background</span>
            <input
              aria-label="Scene Background Color"
              data-testid="scene-background-color-picker"
              type="color"
              value={formatRgbHex(scene.backgroundColor ?? 0x0c0f1a)}
              disabled={disabled}
              onChange={(event) => dispatch({ type: 'set-scene-background-color', backgroundColor: parseRgbHex(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>Hex</span>
            <input
              aria-label="Scene Background Hex"
              data-testid="scene-background-color-hex"
              placeholder="#rrggbb"
              value={formatRgbHex(scene.backgroundColor)}
              disabled={disabled}
              onChange={(event) => dispatch({ type: 'set-scene-background-color', backgroundColor: parseRgbHex(event.target.value) })}
            />
          </label>
        </div>
        <button
          className="button button-compact"
          type="button"
          data-testid="scene-background-use-default"
          disabled={disabled || scene.backgroundColor == null}
          onClick={() => dispatch({ type: 'set-scene-background-color', backgroundColor: undefined })}
        >
          Use default
        </button>
      </InspectorFoldout>

      <InspectorFoldout
        title="Background Layers"
        summary={backgroundSummary}
        open={foldouts.isOpen('scene.backgroundLayers', true)}
        onToggle={() => foldouts.toggle('scene.backgroundLayers', true)}
      >
        <BackgroundLayersBody
          project={project}
          sceneId={sceneId}
          layers={backgroundLayers}
          dispatch={dispatch}
          disabled={disabled}
        />
      </InspectorFoldout>

      <InspectorFoldout
        title="Audio"
        summary={audioSummary}
        open={foldouts.isOpen('scene.audio', false)}
        onToggle={() => foldouts.toggle('scene.audio', false)}
      >
        <SceneAudioBody project={project} sceneId={sceneId} scene={scene} dispatch={dispatch} disabled={disabled} />
      </InspectorFoldout>

      <InspectorFoldout
        title="Input"
        summary={inputSummary}
        open={foldouts.isOpen('scene.input', false)}
        onToggle={() => foldouts.toggle('scene.input', false)}
        testId="scene-input-foldout"
      >
        <SceneInputBody project={project} scene={scene} dispatch={dispatch} disabled={disabled} />
      </InspectorFoldout>

      <InspectorFoldout
        title="Collisions"
        summary={collisionsSummary}
        open={foldouts.isOpen('scene.collisions', false)}
        onToggle={() => foldouts.toggle('scene.collisions', false)}
      >
        <SceneCollisionsBody scene={scene} dispatch={dispatch} disabled={disabled} />
      </InspectorFoldout>

      <InspectorFoldout
        title="State"
        summary={stateSummary}
        open={foldouts.isOpen('scene.state', false)}
        onToggle={() => foldouts.toggle('scene.state', false)}
      >
        <SceneStateBody project={project} scene={scene} dispatch={dispatch} disabled={disabled} />
      </InspectorFoldout>
    </div>
  );
}

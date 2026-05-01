import type { GameSceneSpec, ProjectSpec } from '../model/types';
import type { EditorAction } from './EditorStore';
import { BackgroundLayersBody } from './BackgroundLayersPanel';
import { InspectorFoldout, useInspectorFoldouts } from './InspectorFoldout';
import { SceneAudioBody } from './SceneAudioPanel';
import { SceneCollisionsBody } from './SceneCollisionsPanel';
import { SceneInputBody } from './SceneInputPanel';

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
  const activeId = scene.input?.activeMapId ?? projectDefault;
  const fallbackId = scene.input?.fallbackMapId ?? projectDefault;
  const activeLabel = activeId ? activeId : '(none)';
  const fallbackLabel = fallbackId ? fallbackId : '(none)';
  const inputSummary = `Active: ${activeLabel} · Fallback: ${fallbackLabel}`;

  const backgroundSummary = summarizeCount('layer', backgroundLayers.length);
  const collisionsSummary = summarizeCount('rule', rules.length);

  const expandAll = () => {
    foldouts.setOpen('scene.backgroundLayers', true);
    foldouts.setOpen('scene.audio', true);
    foldouts.setOpen('scene.input', true);
    foldouts.setOpen('scene.collisions', true);
  };

  const collapseAll = () => {
    foldouts.setOpen('scene.backgroundLayers', false);
    foldouts.setOpen('scene.audio', false);
    foldouts.setOpen('scene.input', false);
    foldouts.setOpen('scene.collisions', false);
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
    </div>
  );
}

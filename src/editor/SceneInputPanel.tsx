import { useMemo } from 'react';
import type { GameSceneSpec, ProjectSpec } from '../model/types';
import type { EditorAction } from './EditorStore';
import { InspectorFoldout, useInspectorFoldouts } from './InspectorFoldout';

function summarizeActionPreview(scene: GameSceneSpec, project: ProjectSpec): Array<{ actionId: string; summary: string }> {
  const inputMaps = project.inputMaps ?? {};
  const projectDefault = project.defaultInputMapId;
  const activeId = scene.input?.activeMapId ?? projectDefault;
  const fallbackId = scene.input?.fallbackMapId ?? projectDefault;
  const ids = [activeId, fallbackId].filter((id): id is string => typeof id === 'string' && id.length > 0);
  const unique: string[] = [];
  for (const id of ids) if (!unique.includes(id)) unique.push(id);

  const merged: Record<string, string[]> = {};
  for (const id of unique) {
    const map = inputMaps[id];
    if (!map) continue;
    for (const [actionId, bindings] of Object.entries(map.actions ?? {})) {
      if (!merged[actionId]) merged[actionId] = [];
      for (const b of bindings ?? []) {
        if (b.device === 'keyboard') {
          const key = b.key.startsWith('Key') && b.key.length === 4 ? b.key.slice(3) : b.key;
          merged[actionId].push(key);
        } else if (b.device === 'gamepad') {
          merged[actionId].push(String(b.control));
        } else if (b.device === 'mouse') {
          merged[actionId].push(b.button);
        }
      }
    }
  }

  return Object.keys(merged)
    .sort()
    .map((actionId) => ({ actionId, summary: merged[actionId].join(' / ') }));
}

export function SceneInputPanel({
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
  const mapIds = useMemo(() => Object.keys(project.inputMaps ?? {}).sort(), [project.inputMaps]);
  const preview = useMemo(() => summarizeActionPreview(scene, project), [scene, project]);
  const entityIds = useMemo(() => Object.keys(scene.entities ?? {}).sort(), [scene.entities]);

  const projectDefault = project.defaultInputMapId ?? '';
  const activeValue = scene.input?.activeMapId ?? '';
  const fallbackValue = scene.input?.fallbackMapId ?? '';
  const mouse = scene.input?.mouse ?? {};
  const hideOsCursorInPlay = Boolean(mouse.hideOsCursorInPlay);
  const driveEntityId = mouse.driveEntityId ?? '';
  const affectX = mouse.affectX ?? true;
  const affectY = mouse.affectY ?? true;

  const setSceneInput = (patch: Partial<NonNullable<GameSceneSpec['input']>>) => {
    const next: any = { ...(scene.input ?? {}), ...patch };
    if (!next.activeMapId) delete next.activeMapId;
    if (!next.fallbackMapId) delete next.fallbackMapId;
    const hasAny = Boolean(next.activeMapId || next.fallbackMapId || next.mouse);
    dispatch({ type: 'set-scene-input', input: hasAny ? next : undefined } as any);
  };

  const setSceneMouse = (patch: Partial<NonNullable<NonNullable<GameSceneSpec['input']>['mouse']>>) => {
    const nextMouse: any = { ...(scene.input?.mouse ?? {}), ...patch };
    if (!nextMouse.driveEntityId) delete nextMouse.driveEntityId;
    if (nextMouse.affectX == null) delete nextMouse.affectX;
    if (nextMouse.affectY == null) delete nextMouse.affectY;
    if (nextMouse.hideOsCursorInPlay == null) delete nextMouse.hideOsCursorInPlay;
    const hasAnyMouse = Boolean(
      typeof nextMouse.hideOsCursorInPlay === 'boolean'
      || typeof nextMouse.driveEntityId === 'string'
      || typeof nextMouse.affectX === 'boolean'
      || typeof nextMouse.affectY === 'boolean'
    );
    const nextInput: any = { ...(scene.input ?? {}) };
    if (hasAnyMouse) nextInput.mouse = nextMouse;
    else delete nextInput.mouse;
    if (!nextInput.activeMapId) delete nextInput.activeMapId;
    if (!nextInput.fallbackMapId) delete nextInput.fallbackMapId;
    const hasAny = Boolean(nextInput.activeMapId || nextInput.fallbackMapId || nextInput.mouse);
    dispatch({ type: 'set-scene-input', input: hasAny ? nextInput : undefined } as any);
  };

  return (
    <div className="inspector-block" data-testid="scene-input-panel">
      <div className="inspector-title">Scene: {sceneId}</div>
      <InspectorFoldout
        title="Input"
        open={foldouts.isOpen('scene.input', true)}
        onToggle={() => foldouts.toggle('scene.input', true)}
        testId="scene-input-foldout"
      >
        {mapIds.length === 0 && (
          <div className="inspector-row muted">
            Create an input map in the left panel to enable scene bindings.
          </div>
        )}

        <label className="field">
          <span>Active Input Map</span>
          <select
            aria-label="Scene active input map"
            data-testid="scene-active-input-map-select"
            value={activeValue}
            disabled={disabled || mapIds.length === 0}
            onChange={(e) => setSceneInput({ activeMapId: e.target.value || undefined })}
          >
            <option value="">{projectDefault ? '(project default)' : '(none)'}</option>
            {mapIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Fallback</span>
          <select
            aria-label="Scene fallback input map"
            data-testid="scene-fallback-input-map-select"
            value={fallbackValue}
            disabled={disabled || mapIds.length === 0}
            onChange={(e) => setSceneInput({ fallbackMapId: e.target.value || undefined })}
          >
            <option value="">{projectDefault ? '(project default)' : '(none)'}</option>
            {mapIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </label>

        <div className="inspector-row" style={{ marginTop: 10, fontWeight: 700 }}>Actions (preview)</div>
        {preview.length === 0 && (
          <div className="inspector-row muted">No actions found in the active/fallback maps.</div>
        )}
        {preview.map((entry) => (
          <div key={entry.actionId} className="inspector-row" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 800, color: 'var(--text)' }}>{entry.actionId}</span> → {entry.summary}
            </div>
          </div>
        ))}

        <div className="inspector-row" style={{ marginTop: 12, fontWeight: 700 }}>Mouse</div>
        <label className="field field-checkbox">
          <span>Hide OS cursor (Play mode)</span>
          <input
            aria-label="Hide OS cursor in play mode"
            data-testid="scene-mouse-hide-cursor-checkbox"
            type="checkbox"
            checked={hideOsCursorInPlay}
            disabled={disabled}
            onChange={(e) => setSceneMouse({ hideOsCursorInPlay: e.target.checked })}
          />
        </label>

        <label className="field">
          <span>Drive Entity</span>
          <select
            aria-label="Mouse drives entity"
            data-testid="scene-mouse-drive-entity-select"
            value={driveEntityId}
            disabled={disabled || entityIds.length === 0}
            onChange={(e) => {
              const next = e.target.value || undefined;
              setSceneMouse({
                driveEntityId: next,
                ...(next ? { affectX, affectY } : {}),
              } as any);
            }}
          >
            <option value="">(none)</option>
            {entityIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </label>

        <div className="inspector-row muted" style={{ fontSize: 12, marginTop: 4 }}>
          Axis locks (when driving an entity)
        </div>
        <div className="inspector-grid-2">
          <label className="field field-checkbox">
            <span>Affect X</span>
            <input
              aria-label="Mouse affects X"
              data-testid="scene-mouse-affect-x-checkbox"
              type="checkbox"
              checked={Boolean(driveEntityId) ? Boolean(affectX) : false}
              disabled={disabled || !driveEntityId}
              onChange={(e) => setSceneMouse({ affectX: e.target.checked })}
            />
          </label>
          <label className="field field-checkbox">
            <span>Affect Y</span>
            <input
              aria-label="Mouse affects Y"
              data-testid="scene-mouse-affect-y-checkbox"
              type="checkbox"
              checked={Boolean(driveEntityId) ? Boolean(affectY) : false}
              disabled={disabled || !driveEntityId}
              onChange={(e) => setSceneMouse({ affectY: e.target.checked })}
            />
          </label>
        </div>
      </InspectorFoldout>
    </div>
  );
}

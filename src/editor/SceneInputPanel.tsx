import { useMemo } from 'react';
import type { GameSceneSpec, ProjectSpec } from '../model/types';
import type { EditorAction } from './EditorStore';
import { InspectorFoldout, useInspectorFoldouts } from './InspectorFoldout';
import { listActiveSceneInputActionIds, readSceneMapSelection, type SceneMapSelection } from './sceneInputMaps';

const PROJECT_DEFAULT_VALUE = '__project_default__';
const NONE_VALUE = '__none__';

function selectionValue(selection: SceneMapSelection): string {
  if (selection.kind === 'project-default') return PROJECT_DEFAULT_VALUE;
  if (selection.kind === 'none') return NONE_VALUE;
  return selection.mapId;
}

function selectionFromValue(value: string): SceneMapSelection {
  if (value === PROJECT_DEFAULT_VALUE) return { kind: 'project-default' };
  if (value === NONE_VALUE) return { kind: 'none' };
  return { kind: 'map', mapId: value };
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

  return (
    <div className="inspector-block" data-testid="scene-input-panel">
      <div className="inspector-title">Scene: {sceneId}</div>
      <InspectorFoldout
        title="Input"
        open={foldouts.isOpen('scene.input', true)}
        onToggle={() => foldouts.toggle('scene.input', true)}
        testId="scene-input-foldout"
      >
        <SceneInputBody project={project} scene={scene} dispatch={dispatch} disabled={disabled} />
      </InspectorFoldout>
    </div>
  );
}

export function SceneInputBody({
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
  const mapIds = useMemo(() => Object.keys(project.inputMaps ?? {}).sort(), [project.inputMaps]);
  const actionIds = useMemo(() => listActiveSceneInputActionIds(scene, project), [scene, project]);
  const entityIds = useMemo(() => Object.keys(scene.entities ?? {}).sort(), [scene.entities]);

  const activeSelection = readSceneMapSelection(scene.input, 'active');
  const fallbackSelection = readSceneMapSelection(scene.input, 'fallback');
  const mouse = scene.input?.mouse ?? {};
  const hideOsCursorInPlay = Boolean(mouse.hideOsCursorInPlay);
  const driveEntityId = mouse.driveEntityId ?? '';
  const affectX = mouse.affectX ?? true;
  const affectY = mouse.affectY ?? true;

  const setSceneMapSelection = (which: 'active' | 'fallback', selection: SceneMapSelection) => {
    const next: any = { ...(scene.input ?? {}) };
    if (which === 'active') {
      if (selection.kind === 'none') {
        next.activeMapNone = true;
        delete next.activeMapId;
      } else if (selection.kind === 'map') {
        delete next.activeMapNone;
        next.activeMapId = selection.mapId;
      } else {
        delete next.activeMapNone;
        delete next.activeMapId;
      }
    } else {
      if (selection.kind === 'none') {
        next.fallbackMapNone = true;
        delete next.fallbackMapId;
      } else if (selection.kind === 'map') {
        delete next.fallbackMapNone;
        next.fallbackMapId = selection.mapId;
      } else {
        delete next.fallbackMapNone;
        delete next.fallbackMapId;
      }
    }

    const hasAny = Boolean(
      next.activeMapId
      || next.fallbackMapId
      || next.activeMapNone
      || next.fallbackMapNone
      || next.mouse
    );
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
    if (!nextInput.activeMapNone) delete nextInput.activeMapNone;
    if (!nextInput.fallbackMapNone) delete nextInput.fallbackMapNone;
    const hasAny = Boolean(nextInput.activeMapId || nextInput.fallbackMapId || nextInput.mouse);
    dispatch({ type: 'set-scene-input', input: hasAny ? nextInput : undefined } as any);
  };

  return (
    <>
      {mapIds.length === 0 && (
        <div className="inspector-row muted">
          Create an input map in the Project tab to enable scene bindings.
        </div>
      )}

      <label className="field">
        <span>Active Map</span>
        <select
          aria-label="Scene active input map"
          data-testid="scene-active-input-map-select"
          value={selectionValue(activeSelection)}
          disabled={disabled || mapIds.length === 0}
          onChange={(e) => setSceneMapSelection('active', selectionFromValue(e.target.value))}
        >
          <option value={PROJECT_DEFAULT_VALUE}>(project default)</option>
          <option value={NONE_VALUE}>(none)</option>
          {mapIds.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Fallback Map</span>
        <select
          aria-label="Scene fallback input map"
          data-testid="scene-fallback-input-map-select"
          value={selectionValue(fallbackSelection)}
          disabled={disabled || mapIds.length === 0 || activeSelection.kind === 'none'}
          onChange={(e) => setSceneMapSelection('fallback', selectionFromValue(e.target.value))}
        >
          <option value={PROJECT_DEFAULT_VALUE}>(project default)</option>
          <option value={NONE_VALUE}>(none)</option>
          {mapIds.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </label>

      <div className="inspector-row muted" style={{ fontSize: 12, marginTop: 6, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <span>Input maps are defined at Project level.</span>
        <button
          type="button"
          className="button button-compact"
          data-testid="edit-input-maps-button"
          disabled={disabled}
          onClick={() => {
            dispatch({ type: 'set-sidebar-scope', scope: 'projectTree' } as any);
            window.setTimeout(() => {
              const target = document.querySelector('[data-testid=\"input-maps-panel\"]');
              (target as HTMLElement | null)?.scrollIntoView?.({ block: 'start' });
            }, 0);
          }}
        >
          Edit Input Maps…
        </button>
      </div>

      <div className="inspector-row" style={{ marginTop: 10, fontWeight: 700 }}>Actions in Active Map</div>
      {actionIds.length === 0 && (
        <div className="inspector-row muted">No actions found in the selected maps.</div>
      )}
      {actionIds.map((actionId) => (
        <div key={actionId} className="inspector-row muted" style={{ fontSize: 12 }}>
          <span style={{ fontWeight: 800, color: 'var(--text)' }}>{actionId}</span>
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
    </>
  );
}

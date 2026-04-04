import { useEffect, useRef, useState } from 'react';
import { PhaserGame } from './phaser/PhaserHost';
import { EventBus, getActiveScene } from './phaser/EventBus';
import { EditorProvider, useEditorStore } from './editor/EditorStore';
import { EntityList } from './editor/EntityList';
import { Inspector } from './editor/Inspector';
import { Toolbar } from './editor/Toolbar';
import { JsonPanel } from './editor/JsonPanel';
import { getEditableBoundsConditionId } from './editor/boundsCondition';
import { formatZoomPercent } from './editor/viewport';
import { getSceneWorld } from './editor/sceneWorld';
import { registerAppStateGetter, unregisterAppStateGetter } from './testing/testBridge';
import './app/layout.css';

function AppShell() {
  const { state, dispatch } = useEditorStore();
  const [sceneReady, setSceneReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [worldWidthDraft, setWorldWidthDraft] = useState('');
  const [worldHeightDraft, setWorldHeightDraft] = useState('');
  const readyRef = useRef(false);
  const world = getSceneWorld(state.scene);

  useEffect(() => {
    setWorldWidthDraft(String(world.width));
    setWorldHeightDraft(String(world.height));
  }, [world.width, world.height]);

  useEffect(() => {
    const getStateSnapshot = () => ({
      scene: state.scene,
      selection: state.selection,
      mode: state.mode,
      dirty: state.dirty,
      jsonText: state.jsonText,
      error: state.error,
      hasSeenViewHint: state.hasSeenViewHint,
    });

    registerAppStateGetter(getStateSnapshot);
    return () => {
      unregisterAppStateGetter(getStateSnapshot);
    };
  }, [state]);

  useEffect(() => {
    const handleReady = () => {
      readyRef.current = true;
      setSceneReady(true);
    };

    if (getActiveScene()) {
      handleReady();
    }

    EventBus.on('current-scene-ready', handleReady);
    return () => {
      EventBus.off('current-scene-ready', handleReady);
    };
  }, []);

  useEffect(() => {
    if (!sceneReady) return;
    EventBus.emit('load-scene', state.scene, state.mode);
  }, [sceneReady, state.scene, state.mode]);

  useEffect(() => {
    EventBus.emit('selection-changed', state.selection);
  }, [state.selection]);

  useEffect(() => {
    const handleViewState = (payload: { zoom: number }) => {
      setZoom(payload.zoom);
      if (!state.hasSeenViewHint) {
        dispatch({ type: 'dismiss-view-hint' });
      }
    };

    EventBus.on('scene-view-state', handleViewState);
    return () => {
      EventBus.off('scene-view-state', handleViewState);
    };
  }, [dispatch, state.hasSeenViewHint]);

  useEffect(() => {
    // IMPORTANT: Keep event handler function declarations in sync with EventBus.on calls below
    // Each event handler must be declared before being used in EventBus.on
    const handleCanvasSelect = (target: { kind: 'entity' | 'group'; id: string }) => {
      dispatch({ type: 'select', selection: target });
    };

    const handleCanvasMoveEntity = (payload: { id: string; dx: number; dy: number }) => {
      dispatch({ type: 'move-entity', id: payload.id, dx: payload.dx, dy: payload.dy });
    };

    const handleCanvasMoveGroup = (payload: { id: string; dx: number; dy: number }) => {
      dispatch({ type: 'move-group', id: payload.id, dx: payload.dx, dy: payload.dy });
    };

    const handleCanvasInteractionStart = (target: { kind: 'entity' | 'group' | 'bounds-handle'; id: string }) => {
      if (target.kind === 'bounds-handle') {
        dispatch({ type: 'begin-canvas-interaction', kind: 'bounds', id: target.id });
      } else {
        dispatch({ type: 'begin-canvas-interaction', kind: target.kind, id: target.id });
      }
    };

    const handleCanvasInteractionEnd = () => {
      dispatch({ type: 'end-canvas-interaction' });
    };

    const handleCanvasUpdateBounds = (bounds: { minX: number; maxX: number; minY: number; maxY: number }) => {
      const boundsConditionId = getEditableBoundsConditionId(state.scene, state.selection);
      if (!boundsConditionId) return;
      dispatch({ type: 'update-bounds', id: boundsConditionId, bounds });
    };

    const handleCanvasMoveEntities = (payload: { entityIds: string[]; dx: number; dy: number }) => {
      dispatch({ type: 'move-entities', entityIds: payload.entityIds, dx: payload.dx, dy: payload.dy });
    };

    const handleCanvasSelectMultiple = (payload: { entityIds: string[]; additive: boolean }) => {
      dispatch({ type: 'select-multiple', entityIds: payload.entityIds, additive: payload.additive });
    };

    const handleCreateGroupFromSelection = (name: string) => {
      dispatch({ type: 'create-group-from-selection', name });
    };

    const handleDissolveGroup = (id: string) => {
      dispatch({ type: 'dissolve-group', id });
    };

    const handleToggleMode = () => {
      dispatch({ type: 'toggle-mode' });
    };

    EventBus.on('canvas-select', handleCanvasSelect);
    EventBus.on('canvas-move-entity', handleCanvasMoveEntity);
    EventBus.on('canvas-move-group', handleCanvasMoveGroup);
    EventBus.on('canvas-move-entities', handleCanvasMoveEntities);
    EventBus.on('canvas-select-multiple', handleCanvasSelectMultiple);
    EventBus.on('create-group-from-selection', handleCreateGroupFromSelection);
    EventBus.on('dissolve-group', handleDissolveGroup);
    EventBus.on('toggle-mode', handleToggleMode);
    EventBus.on('canvas-interaction-start', handleCanvasInteractionStart);
    EventBus.on('canvas-interaction-end', handleCanvasInteractionEnd);
    EventBus.on('canvas-update-bounds', handleCanvasUpdateBounds);

    return () => {
      EventBus.off('canvas-select', handleCanvasSelect);
      EventBus.off('canvas-move-entity', handleCanvasMoveEntity);
      EventBus.off('canvas-move-group', handleCanvasMoveGroup);
      EventBus.off('canvas-move-entities', handleCanvasMoveEntities);
      EventBus.off('canvas-select-multiple', handleCanvasSelectMultiple);
      EventBus.off('create-group-from-selection', handleCreateGroupFromSelection);
      EventBus.off('dissolve-group', handleDissolveGroup);
      EventBus.off('toggle-mode', handleToggleMode);
      EventBus.off('canvas-interaction-start', handleCanvasInteractionStart);
      EventBus.off('canvas-interaction-end', handleCanvasInteractionEnd);
      EventBus.off('canvas-update-bounds', handleCanvasUpdateBounds);
    };
  }, [dispatch, state.scene, state.selection]);

  const commitWorldDraft = (dimension: 'width' | 'height') => {
    const raw = dimension === 'width' ? worldWidthDraft : worldHeightDraft;
    const parsed = Number(raw);
    const nextValue = Number.isFinite(parsed) && parsed >= 1 ? Math.round(parsed) : world[dimension];
    dispatch({
      type: 'update-scene-world',
      width: dimension === 'width' ? nextValue : world.width,
      height: dimension === 'height' ? nextValue : world.height,
    });
  };

  return (
    <div className="app-root" data-testid="app-root">
      <Toolbar />
      <div className="app-body">
        <aside className="pane pane-left" data-testid="entity-list-pane">
          <EntityList />
        </aside>
        <main className="pane pane-center" data-testid="canvas-pane">
          <div className="viewbar" data-testid="viewbar">
            <div className="viewbar-group">
              <span className="viewbar-label">View</span>
              <button
                aria-label="Fit view"
                className="button"
                data-testid="fit-view-button"
                type="button"
                onClick={() => EventBus.emit('scene-fit-view')}
              >
                Fit
              </button>
              <button
                aria-label="Reset zoom"
                className="button"
                data-testid="reset-zoom-button"
                type="button"
                onClick={() => EventBus.emit('scene-reset-zoom')}
              >
                Reset
              </button>
              <button
                aria-label="Zoom out"
                className="button button-compact"
                data-testid="zoom-out-button"
                type="button"
                onClick={() => EventBus.emit('scene-zoom-out')}
              >
                -
              </button>
              <div className="viewbar-pill" data-testid="zoom-pill">{formatZoomPercent(zoom)}</div>
              <button
                aria-label="Zoom in"
                className="button button-compact"
                data-testid="zoom-in-button"
                type="button"
                onClick={() => EventBus.emit('scene-zoom-in')}
              >
                +
              </button>
            </div>
            <div className="viewbar-group">
              <span className="viewbar-label">World</span>
              <label className="viewbar-field">
                <span>W</span>
                <input
                  aria-label="World width"
                  data-testid="world-width-input"
                  type="text"
                  inputMode="numeric"
                  value={worldWidthDraft}
                  onChange={(e) => setWorldWidthDraft(e.target.value)}
                  onBlur={() => commitWorldDraft('width')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitWorldDraft('width');
                      e.currentTarget.blur();
                    }
                  }}
                />
              </label>
              <label className="viewbar-field">
                <span>H</span>
                <input
                  aria-label="World height"
                  data-testid="world-height-input"
                  type="text"
                  inputMode="numeric"
                  value={worldHeightDraft}
                  onChange={(e) => setWorldHeightDraft(e.target.value)}
                  onBlur={() => commitWorldDraft('height')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitWorldDraft('height');
                      e.currentTarget.blur();
                    }
                  }}
                />
              </label>
            </div>
          </div>
          <div className="phaser-frame" data-testid="phaser-frame">
            {!state.hasSeenViewHint && (
              <div className="view-hint" data-testid="view-hint">
                <div className="view-hint-title">View Controls</div>
                <div className="view-hint-text">Wheel to zoom, middle-drag or Space-drag to pan, or use Fit/100% above.</div>
                <button
                  aria-label="Dismiss view hint"
                  className="button"
                  data-testid="dismiss-view-hint-button"
                  type="button"
                  onClick={() => dispatch({ type: 'dismiss-view-hint' })}
                >
                  Dismiss
                </button>
              </div>
            )}
            <PhaserGame currentActiveScene={() => {
              if (!readyRef.current) setSceneReady(true);
            }} />
          </div>
        </main>
        <aside className="pane pane-right" data-testid="inspector-pane">
          <Inspector />
          <JsonPanel />
        </aside>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <EditorProvider>
      <AppShell />
    </EditorProvider>
  );
}

import { useEffect, useRef, useState } from 'react';
import { PhaserGame } from './phaser/PhaserHost';
import { EventBus, getActiveScene } from './phaser/EventBus';
import { EditorProvider, useEditorStore } from './editor/EditorStore';
import { EntityList } from './editor/EntityList';
import { InspectorPane } from './editor/InspectorPane';
import { Toolbar } from './editor/Toolbar';
import { CanvasOverlay } from './editor/CanvasOverlay';
import { ViewbarYamlControls } from './editor/ViewbarYamlControls';
import { getEditableBoundsConditionId } from './editor/boundsCondition';
import { formatZoomPercent } from './editor/viewport';
import { getSceneWorld } from './editor/sceneWorld';
import { computeFormationDraftPositions, getTemplateSize } from './editor/formationDraft';
import {
  registerAppStateGetter,
  registerResetSceneHandler,
  registerSelectionSetter,
  registerUndoRedoHandlers,
  unregisterAppStateGetter,
  unregisterResetSceneHandler,
  unregisterSelectionSetter,
  unregisterUndoRedoHandlers,
} from './testing/testBridge';
import './app/layout.css';

function AppShell() {
  const { state, dispatch } = useEditorStore();
  const activeScene = state.project.scenes[state.currentSceneId];
  const [sceneReady, setSceneReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [gridSnapEnabled, setGridSnapEnabled] = useState(false);
  const [worldWidthDraft, setWorldWidthDraft] = useState('');
  const [worldHeightDraft, setWorldHeightDraft] = useState('');
  const readyRef = useRef(false);
  const runtimeLoadedRef = useRef(false);
  const appStateRef = useRef({
    project: state.project,
    currentSceneId: state.currentSceneId,
    scene: activeScene,
    selection: state.selection,
    mode: state.mode,
    dirty: state.dirty,
    yamlText: state.yamlText,
    error: state.error,
    hasSeenViewHint: state.hasSeenViewHint,
    startupMode: state.startupMode,
    themeMode: state.themeMode,
    uiScale: state.uiScale,
    initialized: state.initialized,
  });
  const world = getSceneWorld(activeScene);

  useEffect(() => {
    setWorldWidthDraft(String(world.width));
    setWorldHeightDraft(String(world.height));
  }, [world.width, world.height]);

  useEffect(() => {
    appStateRef.current = {
      project: state.project,
      currentSceneId: state.currentSceneId,
      scene: state.project.scenes[state.currentSceneId],
      selection: state.selection,
      mode: state.mode,
      dirty: state.dirty,
      yamlText: state.yamlText,
      error: state.error,
      hasSeenViewHint: state.hasSeenViewHint,
      startupMode: state.startupMode,
      themeMode: state.themeMode,
      uiScale: state.uiScale,
      initialized: state.initialized,
    };
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    if (state.themeMode === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', state.themeMode);
    }
  }, [state.themeMode]);

  useEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(state.uiScale));
  }, [state.uiScale]);

  useEffect(() => {
    const getStateSnapshot = () => appStateRef.current;
    registerAppStateGetter(getStateSnapshot);
    return () => {
      unregisterAppStateGetter(getStateSnapshot);
    };
  }, []);

  useEffect(() => {
    const setSelection = (selection: Parameters<typeof dispatch>[0] extends { type: 'select'; selection: infer T } ? T : never) => {
      dispatch({ type: 'select', selection });
    };

    registerSelectionSetter(setSelection);
    return () => {
      unregisterSelectionSetter(setSelection);
    };
  }, [dispatch]);

  useEffect(() => {
    const handlers = {
      undo: () => dispatch({ type: 'history-undo' }),
      redo: () => dispatch({ type: 'history-redo' }),
    };
    registerUndoRedoHandlers(handlers);
    return () => {
      unregisterUndoRedoHandlers(handlers);
    };
  }, [dispatch]);

  useEffect(() => {
    const handler = () => dispatch({ type: 'reset-scene' });
    registerResetSceneHandler(handler);
    return () => {
      unregisterResetSceneHandler(handler);
    };
  }, [dispatch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (state.mode !== 'edit') return;
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable) {
          return;
        }
      }
      if (!event.ctrlKey && !event.metaKey) return;

      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'history-redo' : 'history-undo' });
      } else if (key === 'y') {
        event.preventDefault();
        dispatch({ type: 'history-redo' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dispatch, state.mode]);

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
    EventBus.emit('runtime:load-project', state.project, state.currentSceneId, state.mode);
    runtimeLoadedRef.current = true;
  }, [sceneReady, state.project]);

  useEffect(() => {
    if (!sceneReady || !runtimeLoadedRef.current) return;
    EventBus.emit('runtime:set-active-scene', state.currentSceneId);
  }, [sceneReady, state.currentSceneId]);

  useEffect(() => {
    if (!sceneReady || !runtimeLoadedRef.current) return;
    EventBus.emit('runtime:set-mode', state.mode);
  }, [sceneReady, state.mode]);

  useEffect(() => {
    const handleRuntimeRequestScene = (payload: { sceneId?: string } | string) => {
      const sceneId = typeof payload === 'string' ? payload : payload?.sceneId;
      if (typeof sceneId !== 'string' || sceneId.length === 0) return;
      dispatch({ type: 'set-current-scene', sceneId });
    };

    EventBus.on('runtime-request-scene', handleRuntimeRequestScene);
    return () => {
      EventBus.off('runtime-request-scene', handleRuntimeRequestScene);
    };
  }, [dispatch]);

  useEffect(() => {
    EventBus.emit('selection-changed', state.selection);
  }, [state.selection]);

  useEffect(() => {
    EventBus.emit('hitbox-overlay-changed', state.showHitboxOverlay);
  }, [state.showHitboxOverlay]);

  useEffect(() => {
    if (!sceneReady || !runtimeLoadedRef.current) return;
    const draft = state.formationDraft;
    if (!draft) {
      EventBus.emit('formation-draft-changed', { active: false });
      return;
    }
    const scene = state.project.scenes[state.currentSceneId];
    const templateSize = getTemplateSize(scene, state.project, draft.template);
    const positions = computeFormationDraftPositions(
      { arrangeKind: draft.arrangeKind, params: draft.params, memberCount: draft.memberCount },
      templateSize
    );
    const center = {
      x: Math.round(Number((draft.params as any).centerX ?? (draft.params as any).startX ?? 0) || 0),
      y: Math.round(Number((draft.params as any).centerY ?? (draft.params as any).startY ?? 0) || 0),
    };
    EventBus.emit('formation-draft-changed', { active: true, positions, center });
  }, [sceneReady, state.currentSceneId, state.formationDraft, state.project]);

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
    const handleGridToggled = (enabled: boolean) => setGridSnapEnabled(enabled);
    EventBus.on('grid-toggled', handleGridToggled);
    return () => {
      EventBus.off('grid-toggled', handleGridToggled);
    };
  }, []);

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

    const handleCanvasInteractionStart = (target: { kind: 'entity' | 'entities' | 'group' | 'bounds-handle'; id: string }) => {
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
      const boundsConditionId = getEditableBoundsConditionId(activeScene, state.selection);
      if (!boundsConditionId) return;
      dispatch({ type: 'update-bounds', id: boundsConditionId, bounds });
    };

    const handleCanvasMoveEntities = (payload: { entityIds: string[]; dx: number; dy: number }) => {
      dispatch({ type: 'move-entities', entityIds: payload.entityIds, dx: payload.dx, dy: payload.dy });
    };

    const handleCanvasDuplicateEntities = (payload: { entityIds: string[] }) => {
      dispatch({ type: 'duplicate-entities', entityIds: payload.entityIds });
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

    const handleDeleteSelection = () => {
      if (state.mode !== 'edit') return;
      if (state.selection.kind === 'none') return;
      dispatch({ type: 'delete-selection' });
    };

    const handleFormationDraftCenterMoved = (payload: { x: number; y: number }) => {
      const draft = state.formationDraft;
      if (!draft) return;
      if (state.mode !== 'edit') return;
      const x = Math.round(payload.x);
      const y = Math.round(payload.y);
      const params: any = { ...(draft.params ?? {}) };
      if (draft.arrangeKind === 'grid') {
        params.centerX = x;
        params.centerY = y;
      } else if ('centerX' in params || 'centerY' in params) {
        params.centerX = x;
        params.centerY = y;
      } else if ('startX' in params || 'startY' in params) {
        params.startX = x;
        params.startY = y;
      } else {
        params.centerX = x;
        params.centerY = y;
      }
      dispatch({ type: 'update-formation-draft', patch: { params } } as any);
    };

    EventBus.on('canvas-select', handleCanvasSelect);
    EventBus.on('canvas-move-entity', handleCanvasMoveEntity);
    EventBus.on('canvas-move-group', handleCanvasMoveGroup);
    EventBus.on('canvas-move-entities', handleCanvasMoveEntities);
    EventBus.on('canvas-duplicate-entities', handleCanvasDuplicateEntities);
    EventBus.on('canvas-select-multiple', handleCanvasSelectMultiple);
    EventBus.on('create-group-from-selection', handleCreateGroupFromSelection);
    EventBus.on('dissolve-group', handleDissolveGroup);
    EventBus.on('toggle-mode', handleToggleMode);
    EventBus.on('delete-selection', handleDeleteSelection);
    EventBus.on('canvas-interaction-start', handleCanvasInteractionStart);
    EventBus.on('canvas-interaction-end', handleCanvasInteractionEnd);
    EventBus.on('canvas-update-bounds', handleCanvasUpdateBounds);
    EventBus.on('formation-draft-center-moved', handleFormationDraftCenterMoved);

    return () => {
      EventBus.off('canvas-select', handleCanvasSelect);
      EventBus.off('canvas-move-entity', handleCanvasMoveEntity);
      EventBus.off('canvas-move-group', handleCanvasMoveGroup);
      EventBus.off('canvas-move-entities', handleCanvasMoveEntities);
      EventBus.off('canvas-duplicate-entities', handleCanvasDuplicateEntities);
      EventBus.off('canvas-select-multiple', handleCanvasSelectMultiple);
      EventBus.off('create-group-from-selection', handleCreateGroupFromSelection);
      EventBus.off('dissolve-group', handleDissolveGroup);
      EventBus.off('toggle-mode', handleToggleMode);
      EventBus.off('delete-selection', handleDeleteSelection);
      EventBus.off('canvas-interaction-start', handleCanvasInteractionStart);
      EventBus.off('canvas-interaction-end', handleCanvasInteractionEnd);
      EventBus.off('canvas-update-bounds', handleCanvasUpdateBounds);
      EventBus.off('formation-draft-center-moved', handleFormationDraftCenterMoved);
    };
  }, [dispatch, activeScene, state.selection, state.mode, state.formationDraft]);

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

  const appBodyRef = useRef<HTMLDivElement | null>(null);
  const leftPaneDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [leftPaneWidth, setLeftPaneWidth] = useState(() => {
    const storage: any = (globalThis as any).localStorage;
    const raw = typeof storage?.getItem === 'function' ? storage.getItem('phaseractions.leftPaneWidth.v1') : null;
    const parsed = raw == null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? Math.max(240, Math.min(520, parsed)) : 300;
  });

  useEffect(() => {
    const storage: any = (globalThis as any).localStorage;
    if (typeof storage?.setItem === 'function') storage.setItem('phaseractions.leftPaneWidth.v1', String(leftPaneWidth));
  }, [leftPaneWidth]);

  return (
    <div className="app-root" data-testid="app-root">
      <Toolbar />
      <div
        ref={appBodyRef}
        className="app-body"
        style={{
          gridTemplateColumns: `${leftPaneWidth}px 12px minmax(0, 1fr) minmax(340px, clamp(340px, 23vw, 440px))`,
          gap: 0,
        }}
      >
        <aside
          aria-labelledby="scene-graph-heading"
          className="pane pane-left"
          data-testid="entity-list-pane"
          style={{ marginRight: '1rem' }}
        >
          <EntityList />
        </aside>
        <div
          className="pane-splitter-vertical"
          data-testid="left-pane-splitter"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={(event) => {
            leftPaneDragRef.current = { startX: event.clientX, startWidth: leftPaneWidth };
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = leftPaneDragRef.current;
            if (!drag) return;
            const body = appBodyRef.current;
            const bodyRect = body?.getBoundingClientRect();
            const delta = event.clientX - drag.startX;
            const desired = drag.startWidth + delta;
            const minWidth = 240;
            const maxWidth = 520;
            const clamped = Math.max(minWidth, Math.min(maxWidth, desired));
            if (bodyRect && bodyRect.width > 0) {
              const minCanvas = 480;
              const rightMin = 340;
              const available = bodyRect.width - 12 - rightMin - minCanvas;
              const maxByCanvas = Math.max(minWidth, Math.min(maxWidth, available));
              setLeftPaneWidth(Math.max(minWidth, Math.min(maxByCanvas, clamped)));
              return;
            }
            setLeftPaneWidth(clamped);
          }}
          onPointerUp={() => {
            leftPaneDragRef.current = null;
          }}
        />
        <main aria-labelledby="viewport-heading" className="pane pane-center" data-testid="canvas-pane">
          <section className="viewbar shell-card" data-testid="viewbar">
            <div className="viewbar-copy">
              <p className="eyebrow">Canvas</p>
              <h2 className="section-title" id="viewport-heading">Viewport</h2>
              <p className="section-copy">
                Pan with middle mouse or Space + drag. Use zoom controls to inspect sprite spacing and bounds.
              </p>
            </div>
            <div className="viewbar-controls-row">
              <div className="viewbar-group">
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
              <ViewbarYamlControls />
              <div className="viewbar-world">
                <div className="viewbar-copy viewbar-copy-secondary">
                  <p className="eyebrow">Scene Bounds</p>
                  <h3 className="section-subtitle">World Size</h3>
                </div>
                <div className="viewbar-group">
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
            </div>
          </section>
          <div className="phaser-frame" data-testid="phaser-frame">
            <CanvasOverlay gridSnapEnabled={gridSnapEnabled} />
            {!state.hasSeenViewHint && (
              <div className="view-hint" data-testid="view-hint">
                <div className="view-hint-title">View Controls</div>
                <div className="view-hint-text">
                  Pan with middle mouse or Space + drag. Use zoom controls to inspect sprite spacing and bounds.
                </div>
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
          <InspectorPane />
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

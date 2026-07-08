import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PhaserGame } from './phaser/PhaserHost';
import { EventBus, getActiveScene } from './phaser/EventBus';
import { consumePendingRuntimeRequestedSceneId } from './phaser/pendingRuntimeRequest';
import { EditorProvider, useEditorStore, type EditorAction, type Selection } from './editor/EditorStore';
import { EntityList } from './editor/EntityList';
import { InspectorPane } from './editor/InspectorPane';
import { Toolbar } from './editor/Toolbar';
import { CanvasOverlay } from './editor/CanvasOverlay';
import { ViewbarYamlControls } from './editor/ViewbarYamlControls';
import { AudioDebugOverlay } from './AudioDebugOverlay';
import { getEditableBoundsConditionId } from './editor/boundsCondition';
import { loadProjectFonts } from './editor/fontLoader';
import { projectPersistence } from './editor/projectPersistence';
import { formatZoomPercent } from './editor/viewport';
import { getSceneWorld } from './editor/sceneWorld';
import { computeFormationDraftPositions, getTemplateSize } from './editor/formationDraft';
import { appendPersistenceDebugEntry, installPersistenceDebugBridge } from './util/persistenceDebug';
import { installViewDebugBridge, isViewDebugEnabled } from './util/viewDebug';
import {
  canRestorePersistedView,
  doesReportedViewMatchCurrentScene,
  isViewStateApproximatelyEqual,
  shouldPersistViewState,
  shouldResetViewStateForProjectChange,
} from './util/viewStateStorage';
import {
  registerAppStateGetter,
  registerActionDispatcher,
  registerModeToggleHandler,
  registerResetSceneHandler,
  registerSelectionSetter,
  registerUndoRedoHandlers,
  unregisterAppStateGetter,
  unregisterActionDispatcher,
  unregisterModeToggleHandler,
  unregisterResetSceneHandler,
  unregisterSelectionSetter,
  unregisterUndoRedoHandlers,
  type AppStateSnapshot,
} from './testing/testBridge';
import './app/layout.css';

function AppShell() {
  const { state, dispatch } = useEditorStore();
  const cachedWorkspace = projectPersistence.readCachedWorkspaceStateRecord?.();
  const displayProject = state.revisionPreview?.project ?? state.project;
  const displaySceneId = state.revisionPreview?.currentSceneId ?? state.currentSceneId;
  const activeScene = displayProject.scenes[displaySceneId];
  const [sceneReady, setSceneReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [gridSnapEnabled, setGridSnapEnabled] = useState(false);
  const [worldWidthDraft, setWorldWidthDraft] = useState('');
  const [worldHeightDraft, setWorldHeightDraft] = useState('');
  const readyRef = useRef(false);
  const runtimeLoadedRef = useRef(false);
  const viewRestoreAttemptedRef = useRef(false);
  const lastViewProjectIdRef = useRef<string | null>(null);
  const layoutHydratedRef = useRef(false);
  const sceneLoadDebugKeyRef = useRef<string | null>(null);
  const viewRestoreDebugKeyRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateSnapshot>({
    project: state.project,
    currentSceneId: displaySceneId,
    scene: activeScene,
    selection: state.selection,
    mode: state.mode,
    dirty: state.dirty,
    yamlText: state.yamlText,
    error: state.error,
    hasSeenViewHint: state.hasSeenViewHint,
    startupMode: state.startupMode,
    initialized: state.initialized,
  });
  const world = getSceneWorld(activeScene);

  const logViewDebug = (...args: unknown[]) => {
    if (typeof window === 'undefined') return;
    if (!isViewDebugEnabled()) return;
    const timestamp = new Date().toISOString();
    console.info('[phaserforge:view-debug]', timestamp, ...args);
  };

  useEffect(() => {
    setWorldWidthDraft(String(world.width));
    setWorldHeightDraft(String(world.height));
  }, [world.width, world.height]);

  useEffect(() => {
    installPersistenceDebugBridge();
    installViewDebugBridge();
  }, []);

  useEffect(() => {
    void loadProjectFonts(displayProject.assets.fonts);
  }, [displayProject.assets.fonts]);

  useEffect(() => {
    appStateRef.current = {
      project: state.project,
      currentSceneId: displaySceneId,
      scene: displayProject.scenes[displaySceneId],
      selection: state.selection,
      mode: state.mode,
      dirty: state.dirty,
      yamlText: state.yamlText,
      error: state.error,
      hasSeenViewHint: state.hasSeenViewHint,
      startupMode: state.startupMode,
      initialized: state.initialized,
    };
  }, [displayProject, displaySceneId, state]);

  const [sidebarLayoutHydrated, setSidebarLayoutHydrated] = useState(() => (
    Number.isFinite(cachedWorkspace?.leftPaneWidth) || Number.isFinite(cachedWorkspace?.rightPaneWidth)
  ));
  const bootReady = state.initialized && sidebarLayoutHydrated && sceneReady;

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (state.themeMode === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', state.themeMode);
    }
  }, [state.themeMode]);

  useLayoutEffect(() => {
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
    const dispatchAction = (action: unknown) => dispatch(action as EditorAction);
    registerActionDispatcher(dispatchAction);
    return () => {
      unregisterActionDispatcher(dispatchAction);
    };
  }, [dispatch]);

  useEffect(() => {
    const setSelection = (selection: Selection) => {
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
    const handler = () => dispatch({ type: 'toggle-mode' });
    registerModeToggleHandler(handler);
    return () => {
      unregisterModeToggleHandler(handler);
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (state.mode !== 'edit') return;
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable) {
          return;
        }
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== 'F3') return;
      if (state.selection.kind !== 'entity') return;

      const entity = displayProject.scenes[displaySceneId]?.entities?.[state.selection.id];
      if (!(entity as any)?.text) return;

      event.preventDefault();
      EventBus.emit('focus-text-entity-content', entity.id);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [displayProject.scenes, displaySceneId, state.mode, state.selection]);

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
    EventBus.emit('runtime:load-project', displayProject, displaySceneId, state.mode);
    runtimeLoadedRef.current = true;
  }, [displayProject, displaySceneId, sceneReady, state.mode]);

  useEffect(() => {
    if (!sceneReady || !runtimeLoadedRef.current) return;
    EventBus.emit('runtime:set-active-scene', displaySceneId);
  }, [displaySceneId, sceneReady]);

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

    const pending = consumePendingRuntimeRequestedSceneId();
    if (pending) dispatch({ type: 'set-current-scene', sceneId: pending });

    EventBus.on('runtime-request-scene', handleRuntimeRequestScene);
    return () => {
      EventBus.off('runtime-request-scene', handleRuntimeRequestScene);
    };
  }, [dispatch]);

  useEffect(() => {
    EventBus.emit('selection-changed', state.revisionPreview ? { kind: 'none' } : state.selection);
  }, [state.revisionPreview, state.selection]);

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
    const handleViewState = (payload: { zoom: number; worldWidth?: number; worldHeight?: number }) => {
      logViewDebug('scene-view-state', {
        payload,
        initialized: appStateRef.current.initialized,
        restoreAttempted: viewRestoreAttemptedRef.current,
        projectId: appStateRef.current.project.id,
        currentSceneId: appStateRef.current.currentSceneId,
      });
      setZoom(payload.zoom);
      if (!state.hasSeenViewHint) {
        dispatch({ type: 'dismiss-view-hint' });
      }

      const expectedWorld = getSceneWorld(appStateRef.current.scene);
      const viewMatchesCurrentScene = doesReportedViewMatchCurrentScene({
        initialized: appStateRef.current.initialized,
        reportedWorldWidth: payload.worldWidth,
        reportedWorldHeight: payload.worldHeight,
        currentWorldWidth: expectedWorld.width,
        currentWorldHeight: expectedWorld.height,
      });
      logViewDebug('scene-view-state match-check', {
        payloadWorld: { width: payload.worldWidth, height: payload.worldHeight },
        expectedWorld,
        viewMatchesCurrentScene,
      });
      if (!viewMatchesCurrentScene) {
        return;
      }

      const sceneLoadDebugKey = `${appStateRef.current.project.id}:${appStateRef.current.currentSceneId}`;
      if (sceneLoadDebugKeyRef.current !== sceneLoadDebugKey) {
        sceneLoadDebugKeyRef.current = sceneLoadDebugKey;
        appendPersistenceDebugEntry('restore:scene-load-complete', {
          projectId: appStateRef.current.project.id,
          currentSceneId: appStateRef.current.currentSceneId,
          zoom: payload.zoom,
          worldWidth: payload.worldWidth ?? expectedWorld.width,
          worldHeight: payload.worldHeight ?? expectedWorld.height,
        });
      }

      if (!shouldPersistViewState({
        projectId: appStateRef.current.project.id,
        initialized: appStateRef.current.initialized,
        restoreAttempted: viewRestoreAttemptedRef.current,
      })) {
        return;
      }

      try {
        const scene = getActiveScene() as any;
        const view = scene && typeof scene.getViewState === 'function' ? (scene.getViewState() as { zoom: number; scrollX: number; scrollY: number }) : null;
        if (!view) return;
        logViewDebug('persist-view-state', {
          projectId: appStateRef.current.project.id,
          view,
        });
        void projectPersistence.saveViewState(appStateRef.current.project.id, view);
        lastViewProjectIdRef.current = appStateRef.current.project.id;
      } catch {
        // ignore persistence errors
      }
    };

    EventBus.on('scene-view-state', handleViewState);
    return () => {
      EventBus.off('scene-view-state', handleViewState);
    };
  }, [dispatch, state.hasSeenViewHint]);

  useEffect(() => {
    if (viewRestoreAttemptedRef.current) return;
    if (!sceneReady || !runtimeLoadedRef.current || !state.initialized) return;

    let cancelled = false;

    const tryRestore = () => {
      if (cancelled || viewRestoreAttemptedRef.current) return true;
      const activeScene = getActiveScene() as any;
      const expectedWorld = getSceneWorld(appStateRef.current.scene);
      const activeSceneWorld = activeScene && typeof activeScene.getSceneWorldSize === 'function'
        ? (activeScene.getSceneWorldSize() as { width?: number; height?: number })
        : null;

      const canRestoreNow = canRestorePersistedView({
        initialized: appStateRef.current.initialized,
        restoreAttempted: viewRestoreAttemptedRef.current,
        activeSceneWorldWidth: activeSceneWorld?.width,
        activeSceneWorldHeight: activeSceneWorld?.height,
        currentWorldWidth: expectedWorld.width,
        currentWorldHeight: expectedWorld.height,
      });

      logViewDebug('try-restore', {
        initialized: appStateRef.current.initialized,
        restoreAttempted: viewRestoreAttemptedRef.current,
        projectId: appStateRef.current.project.id,
        currentSceneId: appStateRef.current.currentSceneId,
        expectedWorld,
        activeSceneWorld,
        canRestoreNow,
      });

      if (!canRestoreNow) {
        return false;
      }

      const projectId = appStateRef.current.project.id;
      const viewRestoreDebugKey = `${projectId}:${appStateRef.current.currentSceneId}`;
      lastViewProjectIdRef.current = projectId;
      viewRestoreAttemptedRef.current = true;
      void projectPersistence.loadViewState(projectId).then((view) => {
        if (cancelled) return;
        if (!view) {
          if (viewRestoreDebugKeyRef.current !== viewRestoreDebugKey) {
            viewRestoreDebugKeyRef.current = viewRestoreDebugKey;
            appendPersistenceDebugEntry('restore:view-state-restored', {
              projectId,
              currentSceneId: appStateRef.current.currentSceneId,
              outcome: 'missing',
            });
          }
          return;
        }
        logViewDebug('restore-read-storage', {
          projectId,
          storedView: view,
        });
        const currentView = activeScene && typeof activeScene.getViewState === 'function'
          ? (activeScene.getViewState() as { zoom: number; scrollX: number; scrollY: number; viewportWidth?: number; viewportHeight?: number })
          : null;
        if (isViewStateApproximatelyEqual(currentView, view)) {
          logViewDebug('restore-skipped-already-applied', {
            projectId,
            currentView,
            storedView: view,
          });
          if (viewRestoreDebugKeyRef.current !== viewRestoreDebugKey) {
            viewRestoreDebugKeyRef.current = viewRestoreDebugKey;
            appendPersistenceDebugEntry('restore:view-state-restored', {
              projectId,
              currentSceneId: appStateRef.current.currentSceneId,
              outcome: 'already-applied',
              storedView: view,
            });
          }
          return;
        }
        EventBus.emit('scene-restore-view-state', view);
        const restoredScene = getActiveScene() as any;
        const restoredView = restoredScene && typeof restoredScene.getViewState === 'function'
          ? (restoredScene.getViewState() as { zoom: number; scrollX: number; scrollY: number; viewportWidth?: number; viewportHeight?: number })
          : null;
        logViewDebug('restore-emitted', {
          projectId,
          requestedView: view,
          restoredView,
        });
        if (viewRestoreDebugKeyRef.current !== viewRestoreDebugKey) {
          viewRestoreDebugKeyRef.current = viewRestoreDebugKey;
          appendPersistenceDebugEntry('restore:view-state-restored', {
            projectId,
            currentSceneId: appStateRef.current.currentSceneId,
            outcome: restoredView ? 'applied' : 'emitted-without-readback',
            storedView: view,
            restoredView,
          });
        }
        if (restoredView) {
          void projectPersistence.saveViewState(projectId, restoredView);
        }
      }).catch((error) => {
        appendPersistenceDebugEntry('restore:view-state-restored', {
          projectId,
          currentSceneId: appStateRef.current.currentSceneId,
          outcome: 'error',
          error,
        });
      });

      return true;
    };

    if (tryRestore()) return () => {
      cancelled = true;
    };

    const intervalId = window.setInterval(() => {
      if (tryRestore()) {
        window.clearInterval(intervalId);
      }
    }, 50);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [sceneReady, state.initialized, state.project.id]);

  useEffect(() => {
    const currentProjectId = state.project.id;
    const lastProjectId = lastViewProjectIdRef.current;
    if (!state.initialized) return;
    if (!lastProjectId) {
      lastViewProjectIdRef.current = currentProjectId;
      return;
    }
    const shouldResetForProjectChange = shouldResetViewStateForProjectChange({
      initialized: state.initialized,
      currentProjectId,
      lastProjectId,
    });
    logViewDebug('project-change-check', {
      currentProjectId,
      lastProjectId,
      initialized: state.initialized,
      shouldResetForProjectChange,
    });
    if (!shouldResetForProjectChange) return;

    // A different project was loaded; reset view to default and avoid leaking view state across projects.
    lastViewProjectIdRef.current = currentProjectId;
    viewRestoreAttemptedRef.current = false;
    EventBus.emit('scene-fit-view');
  }, [state.initialized, state.project.id]);

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

  const commitWorldDraft = (dimension: 'width' | 'height', rawOverride?: string) => {
    const raw = rawOverride ?? (dimension === 'width' ? worldWidthDraft : worldHeightDraft);
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
  const rightPaneDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [leftPaneMouseDragging, setLeftPaneMouseDragging] = useState(false);
  const [rightPaneMouseDragging, setRightPaneMouseDragging] = useState(false);
  const [leftPaneWidth, setLeftPaneWidth] = useState(() => (
    Number.isFinite(cachedWorkspace?.leftPaneWidth)
      ? Math.max(240, Math.min(520, cachedWorkspace?.leftPaneWidth as number))
      : 300
  ));
  const [rightPaneWidth, setRightPaneWidth] = useState(() => (
    Number.isFinite(cachedWorkspace?.rightPaneWidth)
      ? Math.max(340, Math.min(1040, cachedWorkspace?.rightPaneWidth as number))
      : 380
  ));
  const latestLeftPaneWidthRef = useRef(leftPaneWidth);
  const latestRightPaneWidthRef = useRef(rightPaneWidth);

  latestLeftPaneWidthRef.current = leftPaneWidth;
  latestRightPaneWidthRef.current = rightPaneWidth;

  const persistSidebarLayout = (trigger: 'drag-end-left' | 'drag-end-right' | 'left-pane-width-effect' | 'pagehide' | 'right-pane-width-effect' | 'visibility-hidden') => {
    if (!layoutHydratedRef.current) return;
    const nextLeftPaneWidth = latestLeftPaneWidthRef.current;
    const nextRightPaneWidth = latestRightPaneWidthRef.current;
    appendPersistenceDebugEntry('layout:persist-sidebar-widths', {
      trigger,
      leftPaneWidth: nextLeftPaneWidth,
      rightPaneWidth: nextRightPaneWidth,
    });
    projectPersistence.writeCachedWorkspaceStateRecord?.({
      leftPaneWidth: nextLeftPaneWidth,
      rightPaneWidth: nextRightPaneWidth,
    });
    void projectPersistence.updateWorkspaceStateRecord({
      leftPaneWidth: nextLeftPaneWidth,
      rightPaneWidth: nextRightPaneWidth,
    });
  };

  useEffect(() => {
    let cancelled = false;
    void projectPersistence.loadWorkspaceStateRecord().then((workspace) => {
      if (cancelled) return;
      const nextLeftPaneWidth = Number.isFinite(workspace.leftPaneWidth) ? Math.max(240, Math.min(520, workspace.leftPaneWidth as number)) : leftPaneWidth;
      const nextRightPaneWidth = Number.isFinite(workspace.rightPaneWidth) ? Math.max(340, Math.min(1040, workspace.rightPaneWidth as number)) : rightPaneWidth;
      latestLeftPaneWidthRef.current = nextLeftPaneWidth;
      latestRightPaneWidthRef.current = nextRightPaneWidth;
      if (Number.isFinite(workspace.leftPaneWidth)) setLeftPaneWidth(nextLeftPaneWidth);
      if (Number.isFinite(workspace.rightPaneWidth)) setRightPaneWidth(nextRightPaneWidth);
      layoutHydratedRef.current = true;
      setSidebarLayoutHydrated(true);
      appendPersistenceDebugEntry('layout:hydrate-sidebar-widths', {
        leftPaneWidth: nextLeftPaneWidth,
        rightPaneWidth: nextRightPaneWidth,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!layoutHydratedRef.current) return;
    persistSidebarLayout('left-pane-width-effect');
  }, [leftPaneWidth]);

  useEffect(() => {
    if (!layoutHydratedRef.current) return;
    persistSidebarLayout('right-pane-width-effect');
  }, [rightPaneWidth]);

  const startLeftPaneDrag = (clientX: number) => {
    leftPaneDragRef.current = { startX: clientX, startWidth: leftPaneWidth };
  };

  const startRightPaneDrag = (clientX: number) => {
    rightPaneDragRef.current = { startX: clientX, startWidth: rightPaneWidth };
  };

  const updateLeftPaneDrag = (clientX: number) => {
    const drag = leftPaneDragRef.current;
    if (!drag) return;
    const body = appBodyRef.current;
    const bodyRect = body?.getBoundingClientRect();
    const delta = clientX - drag.startX;
    const desired = drag.startWidth + delta;
    const minWidth = 240;
    const maxWidth = 520;
    const clamped = Math.max(minWidth, Math.min(maxWidth, desired));
    if (bodyRect && bodyRect.width > 0) {
      const minCanvas = 480;
      const available = bodyRect.width - 24 - rightPaneWidth - minCanvas;
      const maxByCanvas = Math.max(minWidth, Math.min(maxWidth, available));
      const nextLeftPaneWidth = Math.max(minWidth, Math.min(maxByCanvas, clamped));
      latestLeftPaneWidthRef.current = nextLeftPaneWidth;
      setLeftPaneWidth(nextLeftPaneWidth);
      return;
    }
    latestLeftPaneWidthRef.current = clamped;
    setLeftPaneWidth(clamped);
  };

  const updateRightPaneDrag = (clientX: number) => {
    const drag = rightPaneDragRef.current;
    if (!drag) return;
    const body = appBodyRef.current;
    const bodyRect = body?.getBoundingClientRect();
    const delta = clientX - drag.startX;
    const desired = drag.startWidth - delta;
    const minWidth = 340;
    const maxWidth = 1040;
    const clamped = Math.max(minWidth, Math.min(maxWidth, desired));
    if (bodyRect && bodyRect.width > 0) {
      const minCanvas = 480;
      const available = bodyRect.width - 24 - leftPaneWidth - minCanvas;
      const maxByCanvas = Math.max(minWidth, Math.min(maxWidth, available));
      const nextRightPaneWidth = Math.max(minWidth, Math.min(maxByCanvas, clamped));
      latestRightPaneWidthRef.current = nextRightPaneWidth;
      setRightPaneWidth(nextRightPaneWidth);
      return;
    }
    latestRightPaneWidthRef.current = clamped;
    setRightPaneWidth(clamped);
  };

  const endLeftPaneDrag = () => {
    leftPaneDragRef.current = null;
    persistSidebarLayout('drag-end-left');
  };

  const endRightPaneDrag = () => {
    rightPaneDragRef.current = null;
    persistSidebarLayout('drag-end-right');
  };

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => updateLeftPaneDrag(event.clientX);
    const onMouseUp = () => {
      if (!leftPaneMouseDragging) return;
      setLeftPaneMouseDragging(false);
      endLeftPaneDrag();
    };

    if (!leftPaneMouseDragging) return;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [leftPaneMouseDragging]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => updateRightPaneDrag(event.clientX);
    const onMouseUp = () => {
      if (!rightPaneMouseDragging) return;
      setRightPaneMouseDragging(false);
      endRightPaneDrag();
    };

    if (!rightPaneMouseDragging) return;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [rightPaneMouseDragging]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;
      persistSidebarLayout('visibility-hidden');
    };
    const handlePageHide = () => {
      persistSidebarLayout('pagehide');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  return (
    <div
      className={`app-root${bootReady ? '' : ' app-root-booting'}`}
      data-boot-ready={bootReady ? 'true' : 'false'}
      data-testid="app-root"
    >
      {!bootReady && (
        <div className="app-boot-splash" data-testid="app-boot-splash">
          <div className="app-boot-splash-card">
            <p className="eyebrow">PhaserForge</p>
            <h2 className="section-title">Opening editor…</h2>
          </div>
        </div>
      )}
      <AudioDebugOverlay />
      <Toolbar />
      <div
        ref={appBodyRef}
        className="app-body"
        style={{
          gridTemplateColumns: `${leftPaneWidth}px 12px minmax(0, 1fr) 12px ${rightPaneWidth}px`,
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
            startLeftPaneDrag(event.clientX);
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            updateLeftPaneDrag(event.clientX);
          }}
          onPointerUp={() => {
            endLeftPaneDrag();
          }}
          onMouseDown={(event) => {
            // WebKit can be flaky with Pointer Events on synthetic drags; keep a mouse fallback for e2e and real users.
            if (event.button !== 0) return;
            startLeftPaneDrag(event.clientX);
            setLeftPaneMouseDragging(true);
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
                      onBlur={(e) => commitWorldDraft('width', e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitWorldDraft('width', e.currentTarget.value);
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
                      onBlur={(e) => commitWorldDraft('height', e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitWorldDraft('height', e.currentTarget.value);
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
        <div
          className="pane-splitter-vertical"
          data-testid="right-pane-splitter"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={(event) => {
            startRightPaneDrag(event.clientX);
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            updateRightPaneDrag(event.clientX);
          }}
          onPointerUp={() => {
            endRightPaneDrag();
          }}
          onMouseDown={(event) => {
            // WebKit can be flaky with Pointer Events on synthetic drags; keep a mouse fallback for e2e and real users.
            if (event.button !== 0) return;
            startRightPaneDrag(event.clientX);
            setRightPaneMouseDragging(true);
          }}
        />
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

import { useEffect, useRef, useState } from 'react';
import { PhaserGame } from './phaser/PhaserHost';
import { EventBus, getActiveScene } from './phaser/EventBus';
import { EditorProvider, useEditorStore } from './editor/EditorStore';
import { EntityList } from './editor/EntityList';
import { Inspector } from './editor/Inspector';
import { Toolbar } from './editor/Toolbar';
import { JsonPanel } from './editor/JsonPanel';
import { getPrimaryBoundsConditionId } from './editor/boundsCondition';
import './app/layout.css';

function AppShell() {
  const { state, dispatch } = useEditorStore();
  const [sceneReady, setSceneReady] = useState(false);
  const readyRef = useRef(false);

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
      const boundsConditionId = getPrimaryBoundsConditionId(state.scene);
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
  }, [dispatch, state.scene]);

  return (
    <div className="app-root">
      <Toolbar />
      <div className="app-body">
        <aside className="pane pane-left">
          <EntityList />
        </aside>
        <main className="pane pane-center">
          <div className="phaser-frame">
            <PhaserGame currentActiveScene={() => {
              if (!readyRef.current) setSceneReady(true);
            }} />
          </div>
        </main>
        <aside className="pane pane-right">
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

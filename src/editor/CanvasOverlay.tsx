import { useEffect, useMemo, useRef, useState } from 'react';
import { EventBus, getActiveScene } from '../phaser/EventBus';
import { useEditorStore, type Selection } from './EditorStore';
import { hasDraggedAsset, readDraggedAsset } from './dragAssets';

function getSelectedEntityIds(selection: Selection): string[] {
  if (selection.kind === 'entity') return [selection.id];
  if (selection.kind === 'entities') return selection.ids;
  return [];
}

export function CanvasOverlay({ gridSnapEnabled }: { gridSnapEnabled: boolean }) {
  const { state, dispatch } = useEditorStore();
  const scene = state.project.scenes[state.currentSceneId];
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const suppressSelectionCloseRef = useRef(false);
  const latestSelectionRef = useRef(state.selection);
  const latestModeRef = useRef(state.mode);
  const latestSceneIdRef = useRef(state.currentSceneId);

  useEffect(() => {
    latestSelectionRef.current = state.selection;
    latestModeRef.current = state.mode;
    latestSceneIdRef.current = state.currentSceneId;
  }, [state.selection, state.mode, state.currentSceneId]);

  const selectedEntityIds = useMemo(() => getSelectedEntityIds(state.selection), [state.selection]);
  const hasEntitySelection = state.selection.kind === 'entity' || state.selection.kind === 'entities';
  const entityToGroupId = useMemo(() => {
    const map = new Map<string, string>();
    for (const [groupId, group] of Object.entries(scene.groups)) {
      for (const entityId of group.members) {
        if (!map.has(entityId)) map.set(entityId, groupId);
      }
    }
    return map;
  }, [scene.groups]);

  const selectedGroupedIds = useMemo(
    () => selectedEntityIds.filter((id) => entityToGroupId.has(id)),
    [entityToGroupId, selectedEntityIds]
  );

  const canGroupSelection = state.mode === 'edit'
    && state.selection.kind === 'entities'
    && state.selection.ids.length >= 2
    && selectedGroupedIds.length === 0;
  const canAddToGroup = state.mode === 'edit' && selectedEntityIds.length > 0 && Object.keys(scene.groups).length > 0;
  const canUngroupSelection = state.mode === 'edit' && selectedGroupedIds.length > 0;
  const canDissolveGroup = state.mode === 'edit' && state.selection.kind === 'group';

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const root = menuRootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (suppressSelectionCloseRef.current) return;
    setMenuOpen(false);
  }, [state.selection.kind, selectedEntityIds.join(','), state.mode]);

  useEffect(() => {
    if (state.mode !== 'edit') return;
    const container = document.querySelector<HTMLDivElement>('#game-container');
    if (!container) return;

    const handleContextMenu = (event: MouseEvent) => {
      if (latestModeRef.current !== 'edit') return;
      const target = event.target;
      if (!(target instanceof HTMLCanvasElement) && !(target instanceof Node && target.nodeName === 'CANVAS')) return;
      event.preventDefault();

      const activeScene = getActiveScene() as any;
      const hit = typeof activeScene?.hitTestAtClientPoint === 'function'
        ? activeScene.hitTestAtClientPoint(event.clientX, event.clientY)
        : { kind: 'none' as const };

      const selection = latestSelectionRef.current;
      if (hit.kind === 'entity' && hit.id) {
        suppressSelectionCloseRef.current = true;
        if (selection.kind === 'entities' && selection.ids.includes(hit.id)) {
          // keep multi-selection
        } else {
          dispatch({ type: 'select', selection: { kind: 'entity', id: hit.id } });
        }
      } else if (hit.kind === 'group' && hit.id) {
        suppressSelectionCloseRef.current = true;
        if (!(selection.kind === 'group' && selection.id === hit.id)) {
          dispatch({ type: 'select', selection: { kind: 'group', id: hit.id } });
        }
      }

      setMenuPosition({ x: event.clientX + 12, y: event.clientY + 12 });
      setMenuOpen(true);
      queueMicrotask(() => {
        suppressSelectionCloseRef.current = false;
      });
    };

    container.addEventListener('contextmenu', handleContextMenu);
    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [dispatch, state.mode]);

  useEffect(() => {
    if (state.mode !== 'edit') return;
    const container = document.querySelector<HTMLDivElement>('#game-container');
    if (!container) return;

    const handleDragOver = (event: DragEvent) => {
      if (latestModeRef.current !== 'edit') return;
      if (!hasDraggedAsset(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (event: DragEvent) => {
      if (latestModeRef.current !== 'edit') return;
      const asset = readDraggedAsset(event.dataTransfer);
      if (!asset) return;
      if (asset.assetKind !== 'image' && asset.assetKind !== 'spritesheet') return;
      event.preventDefault();

      const activeScene = getActiveScene() as any;
      const canvas = activeScene?.game?.canvas as HTMLCanvasElement | undefined;
      const rect = canvas?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) {
        dispatch({ type: 'create-entity-from-asset', assetKind: asset.assetKind, assetId: asset.assetId } as any);
        return;
      }

      const scale = activeScene?.scale;
      const camera = activeScene?.cameras?.main;
      if (!scale || !camera || typeof camera.getWorldPoint !== 'function') {
        dispatch({ type: 'create-entity-from-asset', assetKind: asset.assetKind, assetId: asset.assetId } as any);
        return;
      }

      const scaleX = scale.width / rect.width;
      const scaleY = scale.height / rect.height;
      const pointerX = (event.clientX - rect.left) * scaleX;
      const pointerY = (event.clientY - rect.top) * scaleY;
      const worldPoint = camera.getWorldPoint(pointerX, pointerY);

      dispatch({
        type: 'create-entity-from-asset',
        assetKind: asset.assetKind,
        assetId: asset.assetId,
        at: { x: worldPoint.x, y: worldPoint.y },
      } as any);
    };

    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);
    return () => {
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
    };
  }, [dispatch, state.mode]);

  const selectionLabel = useMemo(() => {
    if (state.selection.kind === 'entities') return `${state.selection.ids.length} selected`;
    if (state.selection.kind === 'group') {
      const group = scene.groups[state.selection.id];
      if (!group) return 'Formation selected';
      return `Group: ${group.name ?? group.id}`;
    }
    return '';
  }, [scene.groups, state.selection]);

  const showSelectionBar = state.mode === 'edit' && (state.selection.kind === 'entities' || state.selection.kind === 'group');
  const showSelectionTopRight = state.mode === 'edit' && (state.selection.kind === 'entities' || state.selection.kind === 'group');

  const openMenuNearElement = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const desiredWidth = 320;
    const desiredHeight = 360;
    const padding = 12;
    const x = Math.min(window.innerWidth - padding, Math.max(padding, rect.right - desiredWidth));
    let y = rect.bottom + 10;
    if (y + desiredHeight > window.innerHeight - padding) {
      y = rect.top - desiredHeight - 10;
    }
    y = Math.max(padding, Math.min(window.innerHeight - padding, y));

    setMenuPosition({ x, y });
    setMenuOpen(true);
  };

  return (
    <div className="canvas-overlay" data-testid="canvas-overlay">
      <div className="canvas-overlay-top-right" data-testid="canvas-overlay-top-right">
        <button
          aria-label="Undo"
          className="button"
          data-testid="undo-button"
          type="button"
          disabled={state.mode !== 'edit' || state.history.past.length === 0}
          onClick={() => dispatch({ type: 'history-undo' })}
        >
          Undo
        </button>
        <button
          aria-label="Redo"
          className="button"
          data-testid="redo-button"
          type="button"
          disabled={state.mode !== 'edit' || state.history.future.length === 0}
          onClick={() => dispatch({ type: 'history-redo' })}
        >
          Redo
        </button>
        <button
          aria-label="Toggle grid snapping"
          className={`button ${gridSnapEnabled ? 'active' : ''}`}
          data-testid="toggle-grid-snap-button"
          type="button"
          disabled={state.mode !== 'edit'}
          onClick={() => EventBus.emit('toggle-grid-snap')}
        >
          Snap: {gridSnapEnabled ? '8px' : 'Off'}
        </button>
        <button
          aria-label="Toggle play mode"
          className={`button ${state.mode === 'play' ? 'active' : ''}`}
          data-testid="toggle-mode-button"
          type="button"
          onClick={() => dispatch({ type: 'toggle-mode' })}
        >
          {state.mode === 'edit' ? 'Play Mode' : 'Edit Mode'}
        </button>
      </div>

      {showSelectionTopRight && (
        <div className="canvas-selection-actions-top-right" data-testid="canvas-selection-actions-top-right">
          <div className="canvas-selection-actions-pill">
            <div className="canvas-selection-actions-label">Selection</div>
            {state.selection.kind === 'entities' && (
              <button
                className="button"
                data-testid="topright-create-group-button"
                type="button"
                disabled={!canGroupSelection}
                onClick={() => dispatch({ type: 'create-group-from-selection', name: '' })}
              >
                Create Group
              </button>
            )}
            {hasEntitySelection && (
              <button
                className="button"
                data-testid="topright-add-to-group-button"
                type="button"
                disabled={!canAddToGroup}
                onClick={(e) => openMenuNearElement(e.currentTarget)}
              >
                Add to Group…
              </button>
            )}
            <button
              className={`button button-compact ${menuOpen ? 'active' : ''}`}
              data-testid="topright-selection-menu-button"
              type="button"
              onClick={(e) => {
                if (menuOpen) {
                  setMenuOpen(false);
                  return;
                }
                openMenuNearElement(e.currentTarget);
              }}
            >
              …
            </button>
          </div>
        </div>
      )}

      {showSelectionBar && (
        <div className="canvas-selection-bar" data-testid="canvas-selection-bar">
          <div className="canvas-selection-pill" data-testid="canvas-selection-label">{selectionLabel}</div>
          {state.selection.kind === 'entities' && (
            <button
              aria-label="Group selection"
              className="button"
              data-testid="canvas-group-button"
              type="button"
              disabled={!canGroupSelection}
              onClick={() => dispatch({ type: 'create-group-from-selection', name: '' })}
            >
              Group
            </button>
          )}
          {state.selection.kind === 'group' && (
            <button
              aria-label="Dissolve group"
              className="button"
              data-testid="canvas-dissolve-button"
              type="button"
              disabled={!canDissolveGroup}
              onClick={() => dispatch({ type: 'dissolve-group', id: state.selection.id })}
            >
              Ungroup
            </button>
          )}
          {state.selection.kind === 'entities' && (
            <button
              aria-label="Remove selection from groups"
              className="button"
              data-testid="canvas-ungroup-selection-button"
              type="button"
              disabled={!canUngroupSelection}
              onClick={() => dispatch({ type: 'remove-entities-from-groups', entityIds: selectedGroupedIds })}
            >
              Ungroup
            </button>
          )}
          <button
            aria-label="Selection actions"
            className={`button button-compact ${menuOpen ? 'active' : ''}`}
            data-testid="canvas-selection-menu-button"
            type="button"
            onClick={(e) => {
              if (menuOpen) {
                setMenuOpen(false);
                return;
              }
              openMenuNearElement(e.currentTarget);
            }}
          >
            …
          </button>
        </div>
      )}

      {menuOpen && menuPosition && (
        <div
          className="canvas-context-menu"
          data-testid="canvas-context-menu"
          role="menu"
          aria-label="Selection actions"
          ref={menuRootRef}
          style={{ left: menuPosition.x, top: menuPosition.y }}
        >
          {state.selection.kind === 'entities' && (
            <button
              className="canvas-selection-menu-item"
              data-testid="canvas-menu-create-group"
              type="button"
              role="menuitem"
              disabled={!canGroupSelection}
              onClick={() => {
                dispatch({ type: 'create-group-from-selection', name: '' });
                setMenuOpen(false);
              }}
            >
              Create Group from Selection
            </button>
          )}

          {hasEntitySelection && (
            <div className="canvas-selection-menu-section" data-testid="canvas-menu-add-to-group-section">
              <div className="canvas-selection-menu-heading">Add to Existing Group</div>
              {Object.values(scene.groups).map((group) => (
                <button
                  key={group.id}
                  className="canvas-selection-menu-item"
                  data-testid={`canvas-menu-add-to-${group.id}`}
                  type="button"
                  role="menuitem"
                  disabled={!canAddToGroup}
                  onClick={() => {
                    dispatch({ type: 'add-entities-to-group', groupId: group.id, entityIds: selectedEntityIds });
                    setMenuOpen(false);
                  }}
                >
                  {group.name ?? group.id}
                </button>
              ))}
            </div>
          )}

          {hasEntitySelection && (
            <button
              className="canvas-selection-menu-item"
              data-testid="canvas-menu-remove-from-group"
              type="button"
              role="menuitem"
              disabled={!canUngroupSelection}
              onClick={() => {
                dispatch({ type: 'remove-entities-from-groups', entityIds: selectedGroupedIds });
                setMenuOpen(false);
              }}
            >
              Remove from Group
            </button>
          )}

          {state.selection.kind === 'group' && (
            <button
              className="canvas-selection-menu-item"
              data-testid="canvas-menu-dissolve-group"
              type="button"
              role="menuitem"
              disabled={!canDissolveGroup}
              onClick={() => {
                dispatch({ type: 'dissolve-group', id: state.selection.id });
                setMenuOpen(false);
              }}
            >
              Dissolve Group
            </button>
          )}

          {state.selection.kind === 'group' && (
            <button
              className="canvas-selection-menu-item"
              data-testid="canvas-menu-open-layout-inspector"
              type="button"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              Convert Layout (Inspector)…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

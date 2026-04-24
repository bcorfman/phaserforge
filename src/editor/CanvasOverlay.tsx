import { useEffect, useMemo, useRef, useState } from 'react';
import { EventBus } from '../phaser/EventBus';
import { useEditorStore, type Selection } from './EditorStore';

function getSelectedEntityIds(selection: Selection): string[] {
  if (selection.kind === 'entity') return [selection.id];
  if (selection.kind === 'entities') return selection.ids;
  return [];
}

export function CanvasOverlay({ gridSnapEnabled }: { gridSnapEnabled: boolean }) {
  const { state, dispatch } = useEditorStore();
  const scene = state.project.scenes[state.currentSceneId];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRootRef = useRef<HTMLDivElement | null>(null);

  const selectedEntityIds = useMemo(() => getSelectedEntityIds(state.selection), [state.selection]);
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
    setMenuOpen(false);
  }, [state.selection.kind, selectedEntityIds.join(','), state.mode]);

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

      {showSelectionBar && (
        <div className="canvas-selection-bar" data-testid="canvas-selection-bar" ref={menuRootRef}>
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
            onClick={() => setMenuOpen((open) => !open)}
          >
            …
          </button>

          {menuOpen && (
            <div className="canvas-selection-menu" data-testid="canvas-selection-menu" role="menu" aria-label="Selection actions">
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

              {state.selection.kind === 'entities' && (
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

              {state.selection.kind === 'entities' && (
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useEditorStore, type Selection } from './EditorStore';
import { summarizeSceneGroups } from './grouping';
import type { GameSceneSpec, ProjectSpec } from '../model/types';
import { countAttachmentsForTarget } from './sceneGraphCommands';
import { InputMapsPanel } from './InputMapsPanel';
import type { Id, TriggerZoneSpec } from '../model/types';
import { AssetsDock } from './AssetsDock';

const ENTITY_DRAG_MIME = 'application/x-phaseractions-studio-entity-ids';
const ASSETS_DOCK_HEIGHT_STORAGE_KEY = 'phaseractions.assetsDockHeight.v1';

function isSelected(selection: Selection, kind: Selection['kind'], id: string): boolean {
  if (selection.kind === 'entities') {
    return kind === 'entity' && selection.ids.includes(id);
  }
  return selection.kind === kind && 'id' in selection && selection.id === id;
}

function getDragEntityIds(selection: Selection, fallbackId: string): string[] {
  if (selection.kind === 'entities' && selection.ids.includes(fallbackId)) return selection.ids;
  if (selection.kind === 'entity' && selection.id === fallbackId) return [fallbackId];
  return [fallbackId];
}

function readDragEntityIds(dataTransfer: DataTransfer | null): string[] | null {
  if (!dataTransfer) return null;
  const raw = dataTransfer.getData(ENTITY_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : null;
  } catch {
    return null;
  }
}

type OverflowMenuState =
  | { kind: 'scene'; sceneId: Id }
  | { kind: 'entity'; sceneId: Id; entityId: Id }
  | { kind: 'group'; sceneId: Id; groupId: Id }
  | { kind: 'trigger'; sceneId: Id; triggerId: Id }
  | { kind: 'group-member'; sceneId: Id; groupId: Id; entityId: Id };

function countTriggerHooks(zone: TriggerZoneSpec): { enter: boolean; exit: boolean; click: boolean } {
  return {
    enter: Boolean(zone.onEnter?.callId),
    exit: Boolean(zone.onExit?.callId),
    click: Boolean(zone.onClick?.callId),
  };
}

export function EntityList() {
  const { state, dispatch } = useEditorStore();
  const { project, currentSceneId, selection, sidebarScope, expandedGroups, mode } = state;
  const scene = project.scenes[currentSceneId];
  return (
    <EntityListView
      project={project}
      currentSceneId={currentSceneId}
      scene={scene}
      selection={selection}
      sidebarScope={sidebarScope}
      expandedGroups={expandedGroups}
      mode={mode}
      dispatch={dispatch}
    />
  );
}

export function EntityListView({
  project,
  currentSceneId,
  scene,
  selection,
  sidebarScope,
  expandedGroups,
  mode,
  dispatch,
}: {
  project: ProjectSpec;
  currentSceneId: string;
  scene: GameSceneSpec;
  selection: Selection;
  sidebarScope: 'scene' | 'project';
  expandedGroups: Record<string, boolean>;
  mode: 'edit' | 'play';
  dispatch: (action: any) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [assetsDockHeight, setAssetsDockHeight] = useState(() => {
    const storage: any = (globalThis as any).localStorage;
    const raw = typeof storage?.getItem === 'function' ? storage.getItem(ASSETS_DOCK_HEIGHT_STORAGE_KEY) : null;
    const parsed = raw == null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? Math.max(120, Math.min(420, parsed)) : 200;
  });
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKind, setEditingKind] = useState<'entity' | 'group' | 'scene' | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [dragInsert, setDragInsert] = useState<{ groupId: string; index: number } | null>(null);
  const [dragOverSprites, setDragOverSprites] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [expandedScenes, setExpandedScenes] = useState<Record<string, boolean>>(() => ({ [currentSceneId]: true }));
  const [menuOpen, setMenuOpen] = useState<OverflowMenuState | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setExpandedScenes((prev) => ({ ...prev, [currentSceneId]: true }));
  }, [currentSceneId]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const root = menuRootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setMenuOpen(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(null);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    const handleDragStart = () => setIsDragActive(true);
    const handleDragEnd = () => setIsDragActive(false);
    window.addEventListener('dragstart', handleDragStart);
    window.addEventListener('dragend', handleDragEnd);
    window.addEventListener('drop', handleDragEnd);
    return () => {
      window.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('dragend', handleDragEnd);
      window.removeEventListener('drop', handleDragEnd);
    };
  }, []);

  useEffect(() => {
    try {
      const storage: any = (globalThis as any).localStorage;
      if (typeof storage?.setItem === 'function') storage.setItem(ASSETS_DOCK_HEIGHT_STORAGE_KEY, String(assetsDockHeight));
    } catch {
      // ignore storage errors
    }
  }, [assetsDockHeight]);

  const startEditing = (kind: 'entity' | 'group' | 'scene', id: string, currentName: string) => {
    setEditingKind(kind);
    setEditingId(id);
    setEditingName(currentName);
    setEditingSceneId(kind === 'scene' ? id : currentSceneId);
  };

  const startEditingInScene = (sceneId: string, kind: 'entity' | 'group' | 'scene', id: string, currentName: string) => {
    setEditingKind(kind);
    setEditingId(id);
    setEditingName(currentName);
    setEditingSceneId(sceneId);
  };

  const cancelEditing = () => {
    setEditingKind(null);
    setEditingId(null);
    setEditingName('');
    setEditingSceneId(null);
  };

  const saveRename = () => {
    if (!editingId || !editingKind || !editingName.trim()) {
      cancelEditing();
      return;
    }

    const targetSceneId = editingSceneId ?? currentSceneId;
    if (editingKind !== 'scene' && targetSceneId !== currentSceneId) {
      dispatch({ type: 'set-current-scene', sceneId: targetSceneId });
    }

    if (editingKind === 'group') {
      const active = project.scenes[targetSceneId] as GameSceneSpec;
      const group = active.groups[editingId];
      if (group) {
        dispatch({ type: 'update-group', id: editingId, next: { ...group, name: editingName } });
      }
    } else if (editingKind === 'scene') {
      dispatch({ type: 'rename-scene', sceneId: editingId, name: editingName });
    } else if (editingKind === 'entity') {
      const active = project.scenes[targetSceneId] as GameSceneSpec;
      const entity = active.entities[editingId];
      if (entity) {
        dispatch({ type: 'update-entity', id: editingId, next: { ...entity, name: editingName } });
      }
    }
    cancelEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveRename();
    if (e.key === 'Escape') cancelEditing();
  };

  const handleEntityClick = (id: string, event: React.MouseEvent) => {
    const isMulti = event.shiftKey || event.metaKey || event.ctrlKey;
    if (isMulti) {
      dispatch({ type: 'select-multiple', entityIds: [id], additive: true });
      return;
    }
    if (editingKind == null && isSelected(selection, 'entity', id)) {
      const entity = scene.entities[id];
      startEditing('entity', id, entity?.name ?? id);
      return;
    }
    dispatch({ type: 'select', selection: { kind: 'entity', id } });
  };

  const handleGroupClick = (id: string) => {
    if (editingKind == null && isSelected(selection, 'group', id)) {
      const group = scene.groups[id];
      startEditing('group', id, group?.name ?? id);
      return;
    }
    dispatch({ type: 'select', selection: { kind: 'group', id } });
  };

  const handleSceneClick = (sceneId: string) => {
    if (mode === 'play') return;
    if (editingKind == null && sceneId === currentSceneId) {
      startEditingInScene(sceneId, 'scene', sceneId, sceneId);
      return;
    }
    dispatch({ type: 'set-current-scene', sceneId });
  };

  const ensureCurrentScene = (sceneId: string) => {
    if (sceneId !== currentSceneId) dispatch({ type: 'set-current-scene', sceneId });
  };

  const selectInScene = (sceneId: string, next: Selection) => {
    if (sceneId !== currentSceneId) dispatch({ type: 'set-current-scene', sceneId });
    dispatch({ type: 'select', selection: next });
  };

  const handleEntityDragStart = (id: string, event: React.DragEvent) => {
    const ids = getDragEntityIds(selection, id);
    try {
      event.dataTransfer.setData(ENTITY_DRAG_MIME, JSON.stringify(ids));
      event.dataTransfer.setData('text/plain', ids.join(','));
      event.dataTransfer.effectAllowed = 'move';
    } catch {
      // ignore drag data errors
    }
  };

  const handleDragEnd = () => {
    setDragOverGroupId(null);
    setDragInsert(null);
    setDragOverSprites(false);
    setIsDragActive(false);
  };

  const handleDropOnGroup = (groupId: string, event: React.DragEvent, index?: number) => {
    event.preventDefault();
    const ids = readDragEntityIds(event.dataTransfer);
    if (!ids || ids.length === 0) return;
    if (typeof index === 'number') {
      dispatch({ type: 'insert-entities-into-group', groupId, entityIds: ids, index });
    } else {
      dispatch({ type: 'add-entities-to-group', groupId, entityIds: ids });
    }
    setDragOverGroupId(null);
    setDragInsert(null);
    setIsDragActive(false);
  };

  const handleDropOnSprites = (event: React.DragEvent) => {
    event.preventDefault();
    const ids = readDragEntityIds(event.dataTransfer);
    if (!ids || ids.length === 0) return;
    dispatch({ type: 'remove-entities-from-groups', entityIds: ids });
    setDragOverSprites(false);
  };

  return (
    <div ref={rootRef} className="panel panel-scroll" data-testid="entity-list" style={{ overflow: 'hidden' }}>
      <div className="sidebar-scope-tabs" role="tablist" aria-label="Sidebar Scope">
        <button
          className={`button ${sidebarScope === 'scene' ? 'active' : ''}`}
          data-testid="sidebar-scope-tab-scene"
          type="button"
          role="tab"
          aria-selected={sidebarScope === 'scene'}
          onClick={() => dispatch({ type: 'set-sidebar-scope', scope: 'scene' })}
        >
          Scene
        </button>
        <button
          className={`button ${sidebarScope === 'project' ? 'active' : ''}`}
          data-testid="sidebar-scope-tab-project"
          type="button"
          role="tab"
          aria-selected={sidebarScope === 'project'}
          onClick={() => dispatch({ type: 'set-sidebar-scope', scope: 'project' })}
        >
          Project
        </button>
      </div>
      {sidebarScope === 'scene' ? (
        <div className="sidebar-split" style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: 0, flex: 1 }}>
          <div className="panel-scroll" style={{ overflow: 'auto', minHeight: 0, paddingRight: 2 }}>
            <section className="panel-section" aria-labelledby="scene-list">
              <div className="panel-heading-row">
                <h3 className="panel-heading" id="scene-list">Scenes</h3>
                <button
                  className="button button-compact"
                  data-testid="create-scene-button"
                  type="button"
                  disabled={mode === 'play'}
                  onClick={() => dispatch({ type: 'create-scene' })}
                >
                  + Add
                </button>
              </div>
              <div className="member-list">
                {Object.keys(project.scenes).map((sceneId) => {
              const isBase = project.baseSceneId === sceneId;
              const meta = project.sceneMeta?.[sceneId];
              const roleRaw = meta?.role;
              const role = isBase
                ? 'Base'
                : roleRaw === 'base' || roleRaw === 'wave' || roleRaw === 'stage'
                  ? `${roleRaw.slice(0, 1).toUpperCase()}${roleRaw.slice(1)}`
                  : undefined;

              const isExpanded = expandedScenes[sceneId] ?? (sceneId === currentSceneId);
              const sceneForRow = project.scenes[sceneId];
              const summary = summarizeSceneGroups(sceneForRow);
              const groupsForRow = summary.groups;
              const ungroupedForRow = summary.ungroupedEntities;
              const zonesForRow = (sceneForRow.triggers ?? []) as TriggerZoneSpec[];

              const showActiveSelection = sceneId === currentSceneId;

              const openOverflowMenu = (event: React.MouseEvent, next: OverflowMenuState) => {
                event.preventDefault();
                event.stopPropagation();
                const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                setMenuPosition({ x: Math.min(rect.left, window.innerWidth - 220), y: rect.bottom + 6 });
                setMenuOpen(next);
              };

                  return (
                <div key={sceneId} className="behavior-block">
                  <div className="member-row">
                    <button
                      aria-label={`Toggle scene ${sceneId}`}
                      className="scene-graph-button scene-graph-chevron"
                      data-testid={`toggle-scene-${sceneId}`}
                      type="button"
                      onClick={() => setExpandedScenes((prev) => ({ ...prev, [sceneId]: !(prev[sceneId] ?? (sceneId === currentSceneId)) }))}
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>

                    {editingId === sceneId && editingKind === 'scene' ? (
                      <input
                        autoFocus
                        className="scene-graph-rename-input"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={saveRename}
                        onKeyDown={handleKeyDown}
                        data-testid={`rename-scene-input-${sceneId}`}
                      />
                    ) : (
                      <button
                        className={`list-item ${sceneId === currentSceneId ? 'active' : ''}`}
                        data-testid={`scene-item-${sceneId}`}
                        type="button"
                        disabled={mode === 'play'}
                        onClick={() => handleSceneClick(sceneId)}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sceneId}</span>
                        {role ? <span className="list-item-meta">{role}</span> : null}
                      </button>
                    )}

                    <button
                      aria-label={`More options for scene ${sceneId}`}
                      className="scene-graph-button"
                      data-testid={`scene-menu-${sceneId}`}
                      type="button"
                      onClick={(e) => openOverflowMenu(e, { kind: 'scene', sceneId })}
                    >
                      ⋯
                    </button>
                  </div>

                  {isExpanded ? (
                    <div className="member-list" style={{ paddingLeft: 18 }}>
                      {/* Sprites */}
                      <div className="panel-heading-row" style={{ marginTop: 8 }}>
                        <h4 className="panel-heading" id={`scene-${sceneId}-sprites`}>Sprites</h4>
                        <button
                          className="button button-compact"
                          data-testid={`sprites-add-${sceneId}`}
                          type="button"
                          onClick={() => {
                            dispatch({ type: 'set-sidebar-scope', scope: 'project' });
                            queueMicrotask(() => {
                              const panel = document.querySelector('#project-import-sprites');
                              if (panel instanceof HTMLElement) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            });
                          }}
                        >
                          + Add
                        </button>
                      </div>

                      <div
                        className={sceneId === currentSceneId && dragOverSprites ? 'scene-graph-drop-target scene-graph-drop-target-sprites' : undefined}
                        data-testid={sceneId === currentSceneId ? 'sprites-dropzone' : `sprites-dropzone-${sceneId}`}
                        onDragOver={(e) => {
                          if (sceneId !== currentSceneId) return;
                          e.preventDefault();
                          if (!dragOverSprites) setDragOverSprites(true);
                        }}
                        onDragLeave={() => {
                          if (sceneId !== currentSceneId) return;
                          setDragOverSprites(false);
                        }}
                        onDrop={(e) => {
                          if (sceneId !== currentSceneId) return;
                          handleDropOnSprites(e);
                        }}
                      >
                        {ungroupedForRow.length === 0 ? (
                          <div className="muted">No ungrouped sprites.</div>
                        ) : (
                          ungroupedForRow.map((entity) => (
                            <div key={entity.id} className="member-row">
                              {editingId === entity.id && editingKind === 'entity' ? (
                                <input
                                  autoFocus
                                  className="scene-graph-rename-input"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onBlur={saveRename}
                                  onKeyDown={handleKeyDown}
                                  data-testid={`rename-entity-input-${entity.id}`}
                                />
                              ) : (
                                <button
                                  className={`list-item ${showActiveSelection && isSelected(selection, 'entity', entity.id) ? 'active' : ''}`}
                                  data-testid={sceneId === currentSceneId ? `ungrouped-entity-${entity.id}` : `ungrouped-entity-${sceneId}-${entity.id}`}
                                  draggable={sceneId === currentSceneId && editingKind == null}
                                  onDragStart={(e) => {
                                    if (sceneId !== currentSceneId) return;
                                    handleEntityDragStart(entity.id, e);
                                  }}
                                  onDragEnd={handleDragEnd}
                                  onClick={(e) => {
                                    if (sceneId !== currentSceneId) {
                                      selectInScene(sceneId, { kind: 'entity', id: entity.id });
                                      return;
                                    }
                                    handleEntityClick(entity.id, e);
                                  }}
                                  type="button"
                                >
                                  {entity.name ?? entity.id}
                                  <span className="list-item-meta">{countAttachmentsForTarget(sceneForRow, { type: 'entity', entityId: entity.id })}</span>
                                </button>
                              )}
                              <button
                                aria-label={`More options for sprite ${entity.name ?? entity.id}`}
                                className="scene-graph-button"
                                data-testid={sceneId === currentSceneId ? `entity-menu-${entity.id}` : `entity-menu-${sceneId}-${entity.id}`}
                                type="button"
                                onClick={(e) => openOverflowMenu(e, { kind: 'entity', sceneId, entityId: entity.id })}
                              >
                                ⋯
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Formations */}
                      <div className="panel-heading-row" style={{ marginTop: 10 }}>
                        <h4 className="panel-heading" id={`scene-${sceneId}-formations`}>Formations</h4>
                        <button
                          className="button button-compact"
                          data-testid={`formations-add-${sceneId}`}
                          type="button"
                          disabled={mode !== 'edit'}
                          onClick={() => {
                            ensureCurrentScene(sceneId);
                            dispatch({ type: 'select', selection: { kind: 'none' } });
                            queueMicrotask(() => {
                              const panel = document.querySelector('[data-testid=\"create-formation-panel\"]');
                              if (panel instanceof HTMLElement) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            });
                          }}
                        >
                          + Add
                        </button>
                      </div>

                      {groupsForRow.length === 0 ? (
                        <div className="muted">No formations.</div>
                      ) : (
                        groupsForRow.map(({ group, members }) => (
                          <div key={group.id} className="behavior-block">
                            <div className="member-row">
                              <button
                                aria-label={`Toggle formation ${group.name ?? group.id}`}
                                className="scene-graph-button scene-graph-chevron"
                                data-testid={`toggle-group-${group.id}`}
                                type="button"
                                onClick={() => {
                                  ensureCurrentScene(sceneId);
                                  dispatch({ type: 'toggle-group-expanded', id: group.id });
                                }}
                                onDragEnd={handleDragEnd}
                                disabled={sceneId !== currentSceneId}
                              >
                                {expandedGroups[group.id] ? '▾' : '▸'}
                              </button>
                              {editingId === group.id && editingKind === 'group' ? (
                                <input
                                  autoFocus
                                  className="scene-graph-rename-input"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onBlur={saveRename}
                                  onKeyDown={handleKeyDown}
                                  data-testid={`rename-group-input-${group.id}`}
                                />
                              ) : (
                                <button
                                  className={`list-item ${showActiveSelection && isSelected(selection, 'group', group.id) ? 'active' : ''} ${sceneId === currentSceneId && dragOverGroupId === group.id ? 'scene-graph-drop-target scene-graph-drop-target-group' : ''}`}
                                  data-testid={sceneId === currentSceneId ? `group-item-${group.id}` : `group-item-${sceneId}-${group.id}`}
                                  onClick={() => {
                                    if (sceneId !== currentSceneId) {
                                      selectInScene(sceneId, { kind: 'group', id: group.id });
                                      return;
                                    }
                                    handleGroupClick(group.id);
                                  }}
                                  type="button"
                                  onDragOver={(e) => {
                                    if (sceneId !== currentSceneId) return;
                                    e.preventDefault();
                                    if (dragOverGroupId !== group.id) setDragOverGroupId(group.id);
                                    setDragInsert({ groupId: group.id, index: group.members.length });
                                  }}
                                  onDragLeave={() => {
                                    if (sceneId !== currentSceneId) return;
                                    if (dragOverGroupId === group.id) setDragOverGroupId(null);
                                    if (dragInsert?.groupId === group.id) setDragInsert(null);
                                  }}
                                  onDrop={(e) => {
                                    if (sceneId !== currentSceneId) return;
                                    handleDropOnGroup(group.id, e, group.members.length);
                                  }}
                                >
                                  {group.name ?? group.id}
                                  <span className="list-item-meta">{countAttachmentsForTarget(sceneForRow, { type: 'group', groupId: group.id })}</span>
                                </button>
                              )}
                              <button
                                aria-label={`More options for formation ${group.name ?? group.id}`}
                                className="scene-graph-button"
                                data-testid={sceneId === currentSceneId ? `group-menu-${group.id}` : `group-menu-${sceneId}-${group.id}`}
                                type="button"
                                onClick={(e) => openOverflowMenu(e, { kind: 'group', sceneId, groupId: group.id })}
                              >
                                ⋯
                              </button>
                            </div>
                            {expandedGroups[group.id] && (
                              <div
                                className="member-list"
                                onDragLeave={() => {
                                  if (sceneId !== currentSceneId) return;
                                  if (dragOverGroupId === group.id) setDragOverGroupId(null);
                                  if (dragInsert?.groupId === group.id) setDragInsert(null);
                                }}
                              >
                                {members.map((member) => (
                                  <div
                                    key={member.id}
                                    className="member-row"
                                    data-testid={`group-member-row-${group.id}-${member.id}`}
                                    data-member-id={member.id}
                                    style={isDragActive ? { position: 'relative' } : undefined}
                                    onDragOver={(e) => {
                                      if (sceneId !== currentSceneId) return;
                                      e.preventDefault();
                                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                      const memberIndex = group.members.indexOf(member.id);
                                      const index = memberIndex >= 0 && e.clientY < rect.top + rect.height / 2 ? memberIndex : memberIndex + 1;
                                      setDragInsert({ groupId: group.id, index: Math.max(0, index) });
                                    }}
                                    onDrop={(e) => {
                                      if (sceneId !== currentSceneId) return;
                                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                      const memberIndex = group.members.indexOf(member.id);
                                      const index = memberIndex >= 0 && e.clientY < rect.top + rect.height / 2 ? memberIndex : memberIndex + 1;
                                      handleDropOnGroup(group.id, e, Math.max(0, index));
                                    }}
                                  >
                                    {isDragActive && sceneId === currentSceneId && (
                                      <button
                                        type="button"
                                        className="scene-graph-drop-overlay"
                                        data-testid={`group-member-drop-overlay-${group.id}-${member.id}`}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                          const memberIndex = group.members.indexOf(member.id);
                                          const index = memberIndex >= 0 && e.clientY < rect.top + rect.height / 2 ? memberIndex : memberIndex + 1;
                                          setDragInsert({ groupId: group.id, index: Math.max(0, index) });
                                        }}
                                        onDrop={(e) => {
                                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                          const memberIndex = group.members.indexOf(member.id);
                                          const index = memberIndex >= 0 && e.clientY < rect.top + rect.height / 2 ? memberIndex : memberIndex + 1;
                                          handleDropOnGroup(group.id, e, Math.max(0, index));
                                        }}
                                      />
                                    )}
                                    {editingId === member.id && editingKind === 'entity' ? (
                                      <input
                                        autoFocus
                                        className="scene-graph-rename-input"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onBlur={saveRename}
                                        onKeyDown={handleKeyDown}
                                        data-testid={`rename-entity-input-${member.id}`}
                                      />
                                    ) : (
                                      <button
                                        className={`list-item ${showActiveSelection && isSelected(selection, 'entity', member.id) ? 'active' : ''}`}
                                        data-testid={`group-member-${group.id}-${member.id}`}
                                        draggable={sceneId === currentSceneId && editingKind == null}
                                        onDragStart={(e) => {
                                          if (sceneId !== currentSceneId) return;
                                          handleEntityDragStart(member.id, e);
                                        }}
                                        onDragEnd={handleDragEnd}
                                        onClick={(e) => {
                                          if (sceneId !== currentSceneId) {
                                            selectInScene(sceneId, { kind: 'entity', id: member.id });
                                            return;
                                          }
                                          handleEntityClick(member.id, e);
                                        }}
                                        type="button"
                                      >
                                        {member.name ?? member.id}
                                      </button>
                                    )}
                                    <button
                                      aria-label={`Remove sprite ${member.name ?? member.id} from formation ${group.name ?? group.id}`}
                                      className="scene-graph-button scene-graph-remove"
                                      data-testid={`group-member-remove-${group.id}-${member.id}`}
                                      type="button"
                                      disabled={sceneId !== currentSceneId}
                                      onClick={() => dispatch({ type: 'remove-entity-from-group', groupId: group.id, entityId: member.id })}
                                    >
                                      -
                                    </button>
                                    <button
                                      aria-label={`More options for sprite ${member.name ?? member.id}`}
                                      className="scene-graph-button"
                                      data-testid={sceneId === currentSceneId ? `group-member-menu-${group.id}-${member.id}` : `group-member-menu-${sceneId}-${group.id}-${member.id}`}
                                      type="button"
                                      onClick={(e) => openOverflowMenu(e, { kind: 'group-member', sceneId, groupId: group.id, entityId: member.id })}
                                    >
                                      ⋯
                                    </button>
                                  </div>
                                ))}
                                {isDragActive && sceneId === currentSceneId && (
                                  <button
                                    type="button"
                                    className="scene-graph-drop-end"
                                    data-testid={`group-member-drop-end-${group.id}`}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      setDragInsert({ groupId: group.id, index: members.length });
                                    }}
                                    onDrop={(e) => handleDropOnGroup(group.id, e, members.length)}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}

                      {/* Trigger Zones */}
                      <div className="panel-heading-row" style={{ marginTop: 10 }}>
                        <h4 className="panel-heading" id={`scene-${sceneId}-triggers`}>Trigger Zones</h4>
                        <button
                          className="button button-compact"
                          data-testid={`trigger-zones-add-${sceneId}`}
                          type="button"
                          disabled={mode !== 'edit'}
                          onClick={() => {
                            ensureCurrentScene(sceneId);
                            dispatch({ type: 'add-trigger-zone' });
                          }}
                        >
                          + Add
                        </button>
                      </div>

                      {zonesForRow.length === 0 ? (
                        <div className="muted">No trigger zones.</div>
                      ) : (
                        zonesForRow.map((zone) => {
                          const hooks = countTriggerHooks(zone);
                          const onClass = (on: boolean) => `trigger-marker ${on ? 'on' : ''}`;
                          return (
                            <div key={zone.id} className="member-row">
                              <button
                                className={`list-item ${showActiveSelection && selection.kind === 'trigger' && selection.id === zone.id ? 'active' : ''}`}
                                data-testid={sceneId === currentSceneId ? `trigger-zone-${zone.id}` : `trigger-zone-${sceneId}-${zone.id}`}
                                type="button"
                                onClick={() => selectInScene(sceneId, { kind: 'trigger', id: zone.id as Id })}
                              >
                                {zone.name ?? zone.id}
                              </button>
                              <span className={onClass(hooks.enter)} aria-label="Enter hook" title="Enter">E</span>
                              <span className={onClass(hooks.exit)} aria-label="Exit hook" title="Exit">X</span>
                              <span className={onClass(hooks.click)} aria-label="Click hook" title="Click">C</span>
                              <button
                                aria-label={`More options for trigger zone ${zone.name ?? zone.id}`}
                                className="scene-graph-button"
                                data-testid={sceneId === currentSceneId ? `trigger-menu-${zone.id}` : `trigger-menu-${sceneId}-${zone.id}`}
                                type="button"
                                onClick={(e) => openOverflowMenu(e, { kind: 'trigger', sceneId, triggerId: zone.id })}
                              >
                                ⋯
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div
            className="assets-dock-splitter"
            data-testid="assets-dock-splitter"
            role="separator"
            aria-orientation="horizontal"
            onPointerDown={(event) => {
              if (mode === 'play') return;
              dragRef.current = { startY: event.clientY, startHeight: assetsDockHeight };
              (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag) return;
              const delta = drag.startY - event.clientY;
              const desired = drag.startHeight + delta;
              const root = rootRef.current;
              const rootHeight = root ? root.getBoundingClientRect().height : 0;
              const maxDock = rootHeight > 0 ? Math.max(140, Math.min(520, rootHeight - 220)) : 420;
              setAssetsDockHeight(Math.max(120, Math.min(maxDock, desired)));
            }}
            onPointerUp={() => {
              dragRef.current = null;
            }}
          >
            <div className="assets-dock-splitter-grip" aria-hidden="true">⋮⋮⋮</div>
          </div>

          <div style={{ height: assetsDockHeight, overflow: 'auto', minHeight: 0 }}>
            <AssetsDock project={project} sceneId={currentSceneId} selection={selection} dispatch={dispatch} disabled={mode !== 'edit'} />
          </div>
        </div>
      ) : null}

      {sidebarScope === 'project' ? (
        <>
          <InputMapsPanel project={project} dispatch={dispatch} disabled={mode !== 'edit'} />
          <section className="panel-section" aria-labelledby="project-assets-moved">
            <div className="panel-heading-row">
              <h3 className="panel-heading" id="project-assets-moved">Assets</h3>
            </div>
            <div className="muted">
              Asset importing now lives in the Scene sidebar’s docked Assets panel.
            </div>
          </section>
        </>
      ) : (
        null
      )}

      {menuOpen && menuPosition ? (
        <div
          ref={menuRootRef}
          className="scene-graph-menu"
          style={{ position: 'fixed', left: menuPosition.x, top: menuPosition.y, zIndex: 50, minWidth: 200 }}
          data-testid="scene-graph-overflow-menu"
          role="menu"
        >
          {menuOpen.kind === 'scene' ? (() => {
            const isBase = project.baseSceneId === menuOpen.sceneId;
            const canDelete = Object.keys(project.scenes).length > 1;
            return (
              <>
                <div className="scene-graph-menu-hint">{menuOpen.sceneId}</div>
                <button
                  type="button"
                  className="scene-graph-menu-item"
                  data-testid={`scene-menu-rename-${menuOpen.sceneId}`}
                  onClick={() => {
                    setMenuOpen(null);
                    startEditingInScene(menuOpen.sceneId, 'scene', menuOpen.sceneId, menuOpen.sceneId);
                  }}
                >
                  Rename…
                </button>
                <button
                  type="button"
                  className="scene-graph-menu-item"
                  data-testid={`scene-menu-duplicate-${menuOpen.sceneId}`}
                  onClick={() => {
                    setMenuOpen(null);
                    dispatch({ type: 'duplicate-scene', sceneId: menuOpen.sceneId });
                  }}
                >
                  ⧉ Duplicate Scene
                </button>
                <button
                  type="button"
                  className="scene-graph-menu-item"
                  data-testid={`scene-menu-base-${menuOpen.sceneId}`}
                  onClick={() => {
                    setMenuOpen(null);
                    dispatch({ type: 'toggle-base-scene', sceneId: menuOpen.sceneId });
                  }}
                >
                  ★ {isBase ? 'Clear Base' : 'Set as Base'}
                </button>
                <div className="scene-graph-menu-divider" />
                <button
                  type="button"
                  className={`scene-graph-menu-item scene-graph-menu-danger ${canDelete ? '' : 'disabled'}`}
                  data-testid={`scene-menu-delete-${menuOpen.sceneId}`}
                  disabled={!canDelete}
                  onClick={() => {
                    setMenuOpen(null);
                    dispatch({ type: 'delete-scene', sceneId: menuOpen.sceneId });
                  }}
                >
                  Delete…
                </button>
              </>
            );
          })() : null}

          {menuOpen.kind === 'entity' ? (
            <>
              <div className="scene-graph-menu-hint">{menuOpen.entityId}</div>
              <button
                type="button"
                className="scene-graph-menu-item"
                data-testid={`entity-menu-rename-${menuOpen.entityId}`}
                onClick={() => {
                  setMenuOpen(null);
                  ensureCurrentScene(menuOpen.sceneId);
                  const entity = project.scenes[menuOpen.sceneId]?.entities?.[menuOpen.entityId];
                  startEditingInScene(menuOpen.sceneId, 'entity', menuOpen.entityId, entity?.name ?? menuOpen.entityId);
                }}
              >
                Rename…
              </button>
              <div className="scene-graph-menu-divider" />
              <button
                type="button"
                className="scene-graph-menu-item scene-graph-menu-danger"
                data-testid={`entity-menu-delete-${menuOpen.entityId}`}
                onClick={() => {
                  setMenuOpen(null);
                  ensureCurrentScene(menuOpen.sceneId);
                  dispatch({ type: 'remove-scene-graph-item', item: { kind: 'entity', id: menuOpen.entityId } });
                }}
              >
                Delete…
              </button>
            </>
          ) : null}

          {menuOpen.kind === 'group' ? (
            <>
              <div className="scene-graph-menu-hint">{menuOpen.groupId}</div>
              <button
                type="button"
                className="scene-graph-menu-item"
                data-testid={`group-menu-rename-${menuOpen.groupId}`}
                onClick={() => {
                  setMenuOpen(null);
                  ensureCurrentScene(menuOpen.sceneId);
                  const group = project.scenes[menuOpen.sceneId]?.groups?.[menuOpen.groupId];
                  startEditingInScene(menuOpen.sceneId, 'group', menuOpen.groupId, group?.name ?? menuOpen.groupId);
                }}
              >
                Rename…
              </button>
              <button
                type="button"
                className="scene-graph-menu-item"
                data-testid={`group-menu-dissolve-${menuOpen.groupId}`}
                onClick={() => {
                  setMenuOpen(null);
                  ensureCurrentScene(menuOpen.sceneId);
                  dispatch({ type: 'dissolve-group', id: menuOpen.groupId });
                }}
              >
                Dissolve Group
              </button>
              <div className="scene-graph-menu-divider" />
              <button
                type="button"
                className="scene-graph-menu-item scene-graph-menu-danger"
                data-testid={`group-menu-delete-${menuOpen.groupId}`}
                onClick={() => {
                  setMenuOpen(null);
                  ensureCurrentScene(menuOpen.sceneId);
                  dispatch({ type: 'remove-scene-graph-item', item: { kind: 'group', id: menuOpen.groupId } });
                }}
              >
                Delete…
              </button>
            </>
          ) : null}

          {menuOpen.kind === 'group-member' ? (
            <>
              <div className="scene-graph-menu-hint">{menuOpen.entityId}</div>
              <div className="scene-graph-menu-divider" />
              <button
                type="button"
                className="scene-graph-menu-item scene-graph-menu-danger"
                data-testid={`group-member-menu-delete-${menuOpen.entityId}`}
                onClick={() => {
                  setMenuOpen(null);
                  ensureCurrentScene(menuOpen.sceneId);
                  dispatch({ type: 'remove-scene-graph-item', item: { kind: 'entity', id: menuOpen.entityId } });
                }}
              >
                Delete…
              </button>
            </>
          ) : null}

          {menuOpen.kind === 'trigger' ? (
            <>
              <div className="scene-graph-menu-hint">{menuOpen.triggerId}</div>
              <div className="scene-graph-menu-divider" />
              <button
                type="button"
                className="scene-graph-menu-item scene-graph-menu-danger"
                data-testid={`trigger-menu-delete-${menuOpen.triggerId}`}
                onClick={() => {
                  setMenuOpen(null);
                  ensureCurrentScene(menuOpen.sceneId);
                  dispatch({ type: 'remove-trigger-zone', id: menuOpen.triggerId });
                }}
              >
                Delete…
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

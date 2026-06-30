import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { useEditorStore, type Selection } from './EditorStore';
import { summarizeSceneGroups } from './grouping';
import type { GameSceneSpec, ProjectSpec } from '../model/types';
import { countAttachmentsForTarget } from './sceneGraphCommands';
import { InputMapsPanel } from './InputMapsPanel';
import type { Id, TriggerZoneSpec } from '../model/types';
import { AssetsDock } from './AssetsDock';
import { ProjectPickerPanel } from './ProjectPickerPanel';
import { buildProjectPickerModel, type ProjectPickerFilter } from './projectLibrary';
import { exportYamlToDisk } from './yamlFileExport';
import { getOpenFilePicker, readFileHandleText } from './yamlFileHandles';
import { parseProjectYaml, serializeProjectToYaml } from '../model/serialization';
import { EventBus } from '../phaser/EventBus';
import {
  buildProjectHistoryViewModel,
  buildCopyRevisionDefaultName,
  buildProjectTreeRows,
  DEFAULT_PROJECT_HISTORY_WINDOW_DAYS,
  formatProjectRevisionTimestamp,
  materializeProjectRevision,
  type ProjectHistoryWindowDays,
  type ProjectRevisionRecord,
  type SidebarScope,
} from './projectTreeHistory';
import type { ProjectHistoryEvent } from './projectHistoryEvents';
import { projectPersistence } from './projectPersistence';
import { appendPersistenceDebugEntry } from '../util/persistenceDebug';

const ENTITY_DRAG_MIME = 'application/x-phaserforge-entity-ids';
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
  | { kind: 'project-root' }
  | { kind: 'project-browser' }
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

function focusSceneGraphRow(root: HTMLElement | null, currentSceneId: string, selection: Selection): boolean {
  if (!root) return false;

  const focusSelector = (selector: string) => {
    const row = root.querySelector(selector) as HTMLElement | null;
    if (!row) return false;
    row.focus();
    return true;
  };

  if (selection.kind === 'entity') {
    if (focusSelector(`[data-testid="ungrouped-entity-${selection.id}"]`)) return true;
    if (focusSelector(`[data-testid="text-entity-${selection.id}"]`)) return true;
    const groupMemberRow = root.querySelector(`[data-member-id="${selection.id}"] .list-item`) as HTMLElement | null;
    if (groupMemberRow) {
      groupMemberRow.focus();
      return true;
    }
    return false;
  }

  if (selection.kind === 'group') return focusSelector(`[data-testid="group-item-${selection.id}"]`);
  if (selection.kind === 'trigger') return focusSelector(`[data-testid="trigger-zone-${selection.id}"]`);
  if (selection.kind === 'none') return focusSelector(`[data-testid="scene-item-${currentSceneId}"]`);
  return false;
}

export function EntityList() {
  const { state, dispatch, persistence } = useEditorStore();
  const { project, currentSceneId, selection, sidebarScope, expandedGroups, mode, projectRootEditing, revisionDialogs, revisionPreview } = state;
  const scene = project.scenes[currentSceneId];
  const stabilityDebugKeyRef = useRef<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<ProjectPickerFilter>('recent');
  const projectModel = buildProjectPickerModel({
    localProjects: persistence.localProjects,
    cloudProjects: persistence.cloudProjects,
    activeProjectId: persistence.activeProjectId,
    search: projectSearch,
    filter: projectFilter,
  });

  const importYaml = async () => {
    const picker = getOpenFilePicker();
    if (picker) {
      try {
        const handles = await picker({
          multiple: false,
          types: [{ description: 'YAML', accept: { 'application/x-yaml': ['.yaml', '.yml'] } }],
        });
        const handle = handles?.[0];
        if (handle) {
          const { text, label } = await readFileHandleText(handle);
          appendPersistenceDebugEntry('entity-list:load-yaml-text-dispatch', { sourceLabel: label });
          dispatch({ type: 'load-yaml-text', text, sourceLabel: label });
          return;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    dispatch({ type: 'set-error', error: 'File picker unavailable' });
  };

  useEffect(() => {
    if (!state.initialized) return;
    const debugKey = `${project.id}:${currentSceneId}:${sidebarScope}:${selection.kind}`;
    if (stabilityDebugKeyRef.current === debugKey) return;
    stabilityDebugKeyRef.current = debugKey;
    appendPersistenceDebugEntry('restore:entity-list-stable', {
      projectId: project.id,
      currentSceneId,
      sidebarScope,
      selectionKind: selection.kind,
    });
    appendPersistenceDebugEntry('restore:inspector-entity-list-stable', {
      projectId: project.id,
      currentSceneId,
      sidebarScope,
      selectionKind: selection.kind,
    });
  }, [currentSceneId, project.id, selection.kind, sidebarScope, state.initialized]);

  return (
    <EntityListView
      project={project}
      currentSceneId={currentSceneId}
      scene={scene}
      selection={selection}
      sidebarScope={sidebarScope}
      projectRootEditing={projectRootEditing}
      revisionDialogs={revisionDialogs}
      previewRevisionId={revisionPreview?.revisionId}
      revisions={persistence.activeProjectRevisions}
      historyEvents={persistence.activeProjectHistoryEvents}
      expandedGroups={expandedGroups}
      mode={mode}
      dispatch={dispatch}
      projectPicker={{
        projects: projectModel.visibleProjects,
        counts: projectModel.counts,
        search: projectSearch,
        filter: projectFilter,
        onSearchChange: setProjectSearch,
        onFilterChange: setProjectFilter,
        onOpenProject: (projectId: string) => void persistence.openProject(projectId),
        onRefreshCloudProjects: () => void persistence.refreshCloudProjects(),
      }}
      onCreateProject={() => void persistence.createProject()}
      onImportYaml={() => void importYaml()}
      onExportYaml={() => void exportYamlToDisk(serializeProjectToYaml(project), { suggestedName: `${project.title?.trim() || project.id}.yaml` })}
      onToggleSyncMode={() => void persistence.toggleSyncMode()}
      onCopyRevision={(revisionId, name) => void persistence.copyRevisionToNewProject(revisionId, name)}
      onArchiveHistoryRevisions={(revisionIds) => void persistence.archiveHistoryRevisions(revisionIds)}
      onDeleteHistoryRevisions={(revisionIds) => void persistence.deleteHistoryRevisions(revisionIds)}
      onRestoreRevision={(revisionId) => void persistence.restoreRevision(revisionId)}
    />
  );
}

export function EntityListView({
  project,
  currentSceneId,
  scene,
  selection,
  sidebarScope,
  projectRootEditing = false,
  revisionDialogs = {},
  previewRevisionId,
  revisions = [],
  historyEvents = [],
  expandedGroups,
  mode,
  dispatch,
  projectPicker,
  onCreateProject = () => {},
  onImportYaml = () => {},
  onExportYaml = () => {},
  onToggleSyncMode = () => {},
  onCopyRevision = () => {},
  onArchiveHistoryRevisions = () => {},
  onDeleteHistoryRevisions = () => {},
  onRestoreRevision = () => {},
}: {
  project: ProjectSpec;
  currentSceneId: string;
  scene: GameSceneSpec;
  selection: Selection;
  sidebarScope: SidebarScope;
  projectRootEditing?: boolean;
  revisionDialogs?: { copyRevisionId?: string; restoreRevisionId?: string };
  previewRevisionId?: string;
  revisions?: ProjectRevisionRecord[];
  historyEvents?: ProjectHistoryEvent[];
  expandedGroups: Record<string, boolean>;
  mode: 'edit' | 'play';
  dispatch: (action: any) => void;
  projectPicker?: ComponentProps<typeof ProjectPickerPanel>;
  onCreateProject?: () => void;
  onImportYaml?: () => void;
  onExportYaml?: () => void;
  onToggleSyncMode?: () => void;
  onCopyRevision?: (revisionId: string, name: string) => void;
  onArchiveHistoryRevisions?: (revisionIds: string[]) => void;
  onDeleteHistoryRevisions?: (revisionIds: string[]) => void;
  onRestoreRevision?: (revisionId: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cachedWorkspace = projectPersistence.readCachedWorkspaceStateRecord?.();
  const [assetsDockHeight, setAssetsDockHeight] = useState(() => (
    Number.isFinite(cachedWorkspace?.assetsDockHeight)
      ? Math.max(120, Math.min(420, cachedWorkspace?.assetsDockHeight as number))
      : 200
  ));
  const [assetsDockHeightHydrated, setAssetsDockHeightHydrated] = useState(false);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKind, setEditingKind] = useState<'entity' | 'group' | 'scene' | 'trigger' | 'project' | null>(null);
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
  const [spriteFromAssetPicker, setSpriteFromAssetPicker] = useState<{ sceneId: string; x: number; y: number } | null>(null);
  const spriteFromAssetPickerRootRef = useRef<HTMLDivElement | null>(null);
  const [duplicateDialog, setDuplicateDialog] = useState<{
    sceneId: string;
    entityIds: string[];
    x: number;
    y: number;
    includeBehaviors: boolean;
    includeHandlers: boolean;
    copyIntoSameGroup: boolean;
  } | null>(null);
  const duplicateDialogRootRef = useRef<HTMLDivElement | null>(null);
  const [copyRevisionName, setCopyRevisionName] = useState('');
  const [expandedRevisionId, setExpandedRevisionId] = useState<string | null>(null);
  const normalizedSidebarScope = sidebarScope === 'projectRevisions' ? 'projectRevisions' : 'projectTree';
  const [historyWindowDays, setHistoryWindowDays] = useState<ProjectHistoryWindowDays>(DEFAULT_PROJECT_HISTORY_WINDOW_DAYS);
  const [historyRetentionDialogOpen, setHistoryRetentionDialogOpen] = useState(false);
  const previousSidebarScopeRef = useRef<'projectTree' | 'projectRevisions'>('projectTree');
  const historyView = buildProjectHistoryViewModel({
    revisions,
    historyEvents,
    windowDays: historyWindowDays,
  });

  useEffect(() => {
    setExpandedScenes((prev) => ({ ...prev, [currentSceneId]: true }));
  }, [currentSceneId]);

  useEffect(() => {
    if (!projectRootEditing) return;
    startEditing('project', project.id, project.title?.trim() || 'Untitled Project');
  }, [project.id, project.title, projectRootEditing]);

  useEffect(() => {
    const revision = revisions.find((entry) => entry.id === revisionDialogs.copyRevisionId);
    if (!revision) return;
    setCopyRevisionName(buildCopyRevisionDefaultName(project.title, revision));
  }, [project.title, revisionDialogs.copyRevisionId, revisions]);

  useEffect(() => {
    const previousSidebarScope = previousSidebarScopeRef.current;
    if (normalizedSidebarScope === 'projectRevisions' && previousSidebarScope !== 'projectRevisions') {
      setHistoryWindowDays(DEFAULT_PROJECT_HISTORY_WINDOW_DAYS);
      setHistoryRetentionDialogOpen(historyView.staleRevisions.length > 0);
    }
    if (normalizedSidebarScope !== 'projectRevisions') {
      setHistoryWindowDays(DEFAULT_PROJECT_HISTORY_WINDOW_DAYS);
      setHistoryRetentionDialogOpen(false);
      setExpandedRevisionId(null);
    }
    previousSidebarScopeRef.current = normalizedSidebarScope;
  }, [historyView.staleRevisions.length, normalizedSidebarScope]);

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
    if (!spriteFromAssetPicker) return;
    const handlePointerDown = (event: PointerEvent) => {
      const root = spriteFromAssetPickerRootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setSpriteFromAssetPicker(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSpriteFromAssetPicker(null);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [spriteFromAssetPicker]);

  useEffect(() => {
    if (!duplicateDialog) return;
    const handlePointerDown = (event: PointerEvent) => {
      const root = duplicateDialogRootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setDuplicateDialog(null);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [duplicateDialog]);

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
    let cancelled = false;
    void projectPersistence.loadWorkspaceStateRecord().then((workspace) => {
      if (cancelled) return;
      if (Number.isFinite(workspace.assetsDockHeight)) {
        setAssetsDockHeight(Math.max(120, Math.min(420, workspace.assetsDockHeight as number)));
      }
      setAssetsDockHeightHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!assetsDockHeightHydrated) return;
    void projectPersistence.updateWorkspaceStateRecord({ assetsDockHeight });
  }, [assetsDockHeight, assetsDockHeightHydrated]);

  const startEditing = (kind: 'entity' | 'group' | 'scene' | 'trigger' | 'project', id: string, currentName: string) => {
    setEditingKind(kind);
    setEditingId(id);
    setEditingName(currentName);
    setEditingSceneId(kind === 'scene' ? id : currentSceneId);
  };

  const startEditingInScene = (sceneId: string, kind: 'entity' | 'group' | 'scene' | 'trigger' | 'project', id: string, currentName: string) => {
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

    if (editingKind === 'project') {
      dispatch({ type: 'set-project-metadata', title: editingName });
      dispatch({ type: 'close-project-root-rename' });
    } else if (editingKind === 'group') {
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
    } else if (editingKind === 'trigger') {
      dispatch({ type: 'update-trigger-zone', id: editingId, patch: { name: editingName } } as any);
    }
    cancelEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();

    const kind = editingKind;
    const id = editingId;
    const sceneId = editingSceneId ?? currentSceneId;

    if (e.key === 'Enter') saveRename();
    else cancelEditing();

    if (!kind || !id) return;
    setTimeout(() => {
      const root = rootRef.current;
      if (!root) return;

	      const testIds =
	        kind === 'entity'
	          ? [
	            `ungrouped-entity-${id}`,
	            `ungrouped-entity-${sceneId}-${id}`,
	            `text-entity-${id}`,
	            `text-entity-${sceneId}-${id}`,
	          ]
	          : kind === 'group'
	            ? [`group-item-${id}`, `group-item-${sceneId}-${id}`]
	            : kind === 'trigger'
	              ? [`trigger-zone-${id}`, `trigger-zone-${sceneId}-${id}`]
              : kind === 'scene'
                ? [`scene-item-${id}`]
                : kind === 'project'
                  ? ['project-tree-root-button']
                : [];

      for (const testId of testIds) {
        const row = root.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
        if (row) {
          row.focus();
          return;
        }
      }
    }, 0);
  };

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (normalizedSidebarScope !== 'projectTree') return;
      if (mode !== 'edit') return;
      if (editingKind != null) return;
      if (menuOpen || duplicateDialog) return;
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const root = rootRef.current;
      const active = globalThis.document?.activeElement;
      if (!root || !(active instanceof Node) || !root.contains(active)) return;

      if (active instanceof HTMLElement) {
        if (active.closest('input, textarea, [contenteditable="true"]')) return;
      }

      const sceneForKeys = project.scenes[currentSceneId] as GameSceneSpec | undefined;
      if (!sceneForKeys) return;
      const summary = summarizeSceneGroups(sceneForKeys);
      const ungroupedIds = summary.ungroupedEntities.map((e) => e.id);
      const formationIds = summary.groups.map((entry) => entry.group.id);
      const triggerIds = ((sceneForKeys.triggers ?? []) as TriggerZoneSpec[]).map((zone) => zone.id as string);

	      const focusRow = (kind: 'entity' | 'group' | 'trigger', id: string) => {
	        const root = rootRef.current;
	        if (!root) return;
	        if (kind === 'entity') {
	          const row = (root.querySelector(`[data-testid="ungrouped-entity-${id}"]`) ??
	            root.querySelector(`[data-testid="text-entity-${id}"]`)) as HTMLElement | null;
	          row?.focus();
	          return;
	        }
	        const testId = kind === 'group' ? `group-item-${id}` : `trigger-zone-${id}`;
	        const row = root.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
	        row?.focus();
	      };

      const stepSelection = (ids: string[], currentId: string, delta: number, kind: 'entity' | 'group' | 'trigger') => {
        const index = ids.indexOf(currentId);
        if (index < 0) return;
        const nextIndex = index + delta;
        if (nextIndex < 0 || nextIndex >= ids.length) return;
        const nextId = ids[nextIndex];
        dispatch({ type: 'select', selection: { kind, id: nextId } as any });
        // Keep focus in sync so only one row looks "active" (selected + focused).
        focusRow(kind, nextId);
      };

      if (event.key === 'F2') {
        if (selection.kind === 'entity' && ungroupedIds.includes(selection.id as any)) {
          const entity = (sceneForKeys.entities as any)?.[selection.id as any];
          startEditing('entity', selection.id as any, entity?.name ?? (selection.id as any));
          event.stopPropagation();
          event.preventDefault();
          return;
        }
        if (selection.kind === 'group' && formationIds.includes(selection.id as any)) {
          const group = (sceneForKeys.groups as any)?.[selection.id as any];
          startEditing('group', selection.id as any, group?.name ?? (selection.id as any));
          event.stopPropagation();
          event.preventDefault();
          return;
        }
        if (selection.kind === 'trigger' && triggerIds.includes(selection.id as any)) {
          const zone = ((sceneForKeys.triggers ?? []) as any[]).find((z) => z?.id === selection.id);
          startEditing('trigger', selection.id as any, zone?.name ?? (selection.id as any));
          event.stopPropagation();
          event.preventDefault();
          return;
        }
        return;
      }

      if (event.key === 'ArrowUp') {
        if (selection.kind === 'entity') stepSelection(ungroupedIds, selection.id as any, -1, 'entity');
        else if (selection.kind === 'group') stepSelection(formationIds, selection.id as any, -1, 'group');
        else if (selection.kind === 'trigger') stepSelection(triggerIds, selection.id as any, -1, 'trigger');
        else return;
        event.stopPropagation();
        event.preventDefault();
        return;
      }

      if (event.key === 'ArrowDown') {
        if (selection.kind === 'entity') stepSelection(ungroupedIds, selection.id as any, 1, 'entity');
        else if (selection.kind === 'group') stepSelection(formationIds, selection.id as any, 1, 'group');
        else if (selection.kind === 'trigger') stepSelection(triggerIds, selection.id as any, 1, 'trigger');
        else return;
        event.stopPropagation();
        event.preventDefault();
      }
    };

    // Capture phase so we can take priority over canvas-level handlers (e.g. arrow-key nudging)
    // when the keyboard focus is inside the entity list.
    window.addEventListener('keydown', handleWindowKeyDown, true);
    return () => window.removeEventListener('keydown', handleWindowKeyDown, true);
  }, [normalizedSidebarScope, mode, editingKind, menuOpen, duplicateDialog, project, currentSceneId, selection, dispatch]);

  useEffect(() => {
    const handleFocusSelectedSceneGraphRow = () => {
      focusSceneGraphRow(rootRef.current, currentSceneId, selection);
    };

    EventBus.on('focus-selected-scene-graph-row', handleFocusSelectedSceneGraphRow);
    return () => {
      EventBus.off('focus-selected-scene-graph-row', handleFocusSelectedSceneGraphRow);
    };
  }, [currentSceneId, selection]);

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

  const projectTreeRows = buildProjectTreeRows(project, currentSceneId);
  const selectedCopyRevision = revisions.find((entry) => entry.id === revisionDialogs.copyRevisionId);
  const selectedRestoreRevision = revisions.find((entry) => entry.id === revisionDialogs.restoreRevisionId);

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

  return (
    <div
      ref={rootRef}
      className="panel panel-scroll"
      data-testid="entity-list"
      style={{ overflow: 'hidden', flex: 1, minHeight: 0 }}
    >
      {normalizedSidebarScope === 'projectRevisions' ? (
        <div className="panel-scroll" style={{ overflow: 'auto', minHeight: 0, paddingRight: 2, flex: 1 }}>
          <section className="panel-section" aria-labelledby="project-revisions">
            <div className="panel-heading-row">
              <button
                className="button button-compact"
                data-testid="project-revisions-back-button"
                type="button"
                aria-label="Back to Project Tree"
                onClick={() => {
                  dispatch({ type: 'clear-revision-preview' });
                  dispatch({ type: 'set-sidebar-scope', scope: 'projectTree' });
                }}
              >
                ← Back
              </button>
              <h3 className="panel-heading" id="project-revisions">PROJECT REVISIONS</h3>
            </div>
            <div
              className="project-picker-tabs"
              role="tablist"
              aria-label="History filters"
              style={{ marginBottom: 12 }}
            >
              {([7, 14, 30] as ProjectHistoryWindowDays[]).map((windowDays) => (
                <button
                  key={windowDays}
                  type="button"
                  className={`button button-compact ${historyWindowDays === windowDays ? 'active' : ''}`}
                  data-testid={`project-history-filter-${windowDays}`}
                  role="tab"
                  aria-selected={historyWindowDays === windowDays}
                  onClick={() => setHistoryWindowDays(windowDays)}
                >
                  {windowDays === 7 ? 'Past 7 Days' : `Past ${windowDays}`}
                </button>
              ))}
            </div>
            <div className="member-list" data-testid="project-revisions-pane">
              {historyView.visibleEntries.length === 0 ? (
                <div className="muted">No saved revisions yet.</div>
              ) : (
                historyView.visibleEntries.map((entry) => {
                  const revision = entry.primaryRevision;
                  const detailItems = entry.detailItems;
                  const canExpandDetails = detailItems.length > 1;
                  const isExpanded = expandedRevisionId === revision.id;
                  const hiddenDetailCount = entry.hiddenDetailCount;
                  return (
                    <div key={revision.id} className="behavior-block" data-testid={`project-revision-${revision.id}`}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                        <button
                          className={`list-item ${previewRevisionId === revision.id ? 'active' : ''}`}
                          type="button"
                          data-testid={`project-revision-row-button-${revision.id}`}
                          style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start' }}
                          onClick={() => {
                            const previewProject = materializeProjectRevision(revisions, revision.id);
                            if (!previewProject) return;
                            dispatch({
                              type: 'set-revision-preview',
                              revisionId: revision.id,
                              project: previewProject,
                              currentSceneId: previewProject.initialSceneId,
                            });
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, alignItems: 'flex-start', gap: 2 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                              {revision.title}
                            </span>
                            <span
                              className="list-item-meta"
                              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
                            >
                              {entry.summary}
                            </span>
                          </div>
                          <span
                            className="list-item-meta"
                            data-testid={`project-revision-timestamp-${revision.id}`}
                            style={{ whiteSpace: 'nowrap', textAlign: 'right' }}
                          >
                            {formatProjectRevisionTimestamp(revision)}
                          </span>
                        </button>
                      </div>
                      {canExpandDetails && !isExpanded ? (
                        <div
                          className="list-item-meta"
                          data-testid={`project-revision-teaser-${revision.id}`}
                          role="button"
                          tabIndex={0}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            marginTop: 0,
                            marginLeft: 0,
                            padding: '3px 10px',
                            borderRadius: 999,
                            border: '1px solid var(--panel-border, #495869)',
                            background: 'rgba(255,255,255,0.04)',
                            cursor: 'pointer',
                          }}
                          onClick={() => setExpandedRevisionId(revision.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setExpandedRevisionId(revision.id);
                            }
                          }}
                        >
                          +{hiddenDetailCount} more change{hiddenDetailCount === 1 ? '' : 's'}
                        </div>
                      ) : null}
                      {canExpandDetails && isExpanded ? (
                        <div
                          data-testid={`project-revision-details-${revision.id}`}
                          role="button"
                          tabIndex={0}
                          style={{
                            marginTop: 8,
                            marginLeft: 0,
                            padding: '10px 12px',
                            borderRadius: 12,
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            cursor: 'pointer',
                          }}
                          onClick={() => setExpandedRevisionId(null)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setExpandedRevisionId(null);
                            }
                          }}
                        >
                          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
                            {detailItems.map((item) => (
                              <li key={item} className="list-item-meta" style={{ whiteSpace: 'normal' }}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          className="button button-danger"
                          data-testid={`project-revision-restore-${revision.id}`}
                          type="button"
                          onClick={() => dispatch({ type: 'open-restore-revision-dialog', revisionId: revision.id })}
                        >
                          Restore...
                        </button>
                        <button
                          className="button"
                          data-testid={`project-revision-copy-${revision.id}`}
                          type="button"
                          onClick={() => dispatch({ type: 'open-copy-revision-dialog', revisionId: revision.id })}
                        >
                          Copy...
                        </button>
                      </div>
                      <div
                        className="scene-graph-menu-divider"
                        data-testid={`project-revision-divider-${revision.id}`}
                        style={{ margin: '0.6rem 0 0 0' }}
                      />
                    </div>
                  );
                })
              )}
            </div>
            {historyRetentionDialogOpen && historyView.staleRevisions.length > 0 ? (
              <div
                className="scene-graph-menu"
                style={{ position: 'fixed', left: '50%', top: '20%', transform: 'translateX(-50%)', zIndex: 60, minWidth: 460 }}
                data-testid="project-history-retention-dialog"
                role="dialog"
                aria-label="Project history retention dialog"
              >
                <div className="scene-graph-menu-hint">Older versions found</div>
                <div style={{ padding: '0.75rem', display: 'grid', gap: 8 }}>
                  <div>{historyView.staleRevisions.length} project versions are older than 30 days.</div>
                  <div>Archive keeps them in storage but hides them until archived history is added to the UI.</div>
                  <div>Delete permanently removes them from project history.</div>
                  <div>Cancel keeps everything unchanged.</div>
                </div>
                <div style={{ padding: '0 0.75rem 0.75rem 0.75rem', display: 'grid', gap: 4 }}>
                  {historyView.staleRevisions.map((revision) => (
                    <div key={revision.id} className="list-item-meta">{revision.title} · {formatProjectRevisionTimestamp(revision)}</div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0.75rem' }}>
                  <button
                    type="button"
                    className="button"
                    data-testid="project-history-retention-cancel"
                    onClick={() => setHistoryRetentionDialogOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button"
                    data-testid="project-history-retention-archive"
                    onClick={() => {
                      setHistoryRetentionDialogOpen(false);
                      onArchiveHistoryRevisions(historyView.staleRevisions.map((revision) => revision.id));
                    }}
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    className="button button-danger"
                    data-testid="project-history-retention-delete"
                    onClick={() => {
                      setHistoryRetentionDialogOpen(false);
                      onDeleteHistoryRevisions(historyView.staleRevisions.map((revision) => revision.id));
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <div className="sidebar-split" style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: 0, flex: 1 }}>
          <div className="panel-scroll" style={{ overflow: 'auto', minHeight: 0, paddingRight: 2, flex: 1 }}>
            <section className="panel-section" aria-labelledby="project-tree">
              <div className="panel-heading-row">
                <h3 className="panel-heading" id="project-tree">Project Tree</h3>
                <button
                  className="button button-compact"
                  data-testid="project-tree-manage-button"
                  type="button"
                  onClick={(event) => {
                    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                    setMenuPosition({ x: Math.min(rect.left, window.innerWidth - 220), y: rect.bottom + 6 });
                    setMenuOpen({ kind: 'project-root' });
                  }}
                >
                  Manage
                </button>
              </div>
              <div className="member-row">
                {editingKind === 'project' ? (
                  <input
                    autoFocus
                    className="scene-graph-rename-input"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={saveRename}
                    onKeyDown={handleKeyDown}
                    data-testid="rename-project-input"
                  />
                ) : (
                  <button
                    className="list-item active"
                    data-testid="project-tree-root-button"
                    type="button"
                    onClick={() => dispatch({ type: 'open-project-root-rename' })}
                  >
                    <span>{projectTreeRows[0]?.label ?? 'Untitled Project'}</span>
                    <span className="list-item-meta">{projectTreeRows[0]?.sceneCount ?? 0} scenes</span>
                  </button>
                )}
              </div>
            </section>
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
	              const spriteOrder = Array.isArray((sceneForRow as any).spriteOrder)
	                ? ((sceneForRow as any).spriteOrder as string[]).filter((id) => typeof id === 'string')
	                : [];
	              const spriteIndex = new Map<string, number>();
	              spriteOrder.forEach((id, i) => spriteIndex.set(id, i));
	              const ungroupedSpritesForRow = ungroupedForRow
	                .filter((entity) => !entity.text)
	                .slice()
	                .sort((a, b) => {
	                  const ia = spriteIndex.has(a.id) ? (spriteIndex.get(a.id) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
	                  const ib = spriteIndex.has(b.id) ? (spriteIndex.get(b.id) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
	                  if (ia !== ib) return ia - ib;
	                  return String(a.name ?? a.id).localeCompare(String(b.name ?? b.id));
	                });
	              const ungroupedTextForRow = ungroupedForRow.filter((entity) => Boolean(entity.text));
	              const zonesForRow = (sceneForRow.triggers ?? []) as TriggerZoneSpec[];

              const showActiveSelection = sceneId === currentSceneId;

              const openOverflowMenu = (event: React.MouseEvent, next: OverflowMenuState) => {
                event.preventDefault();
                event.stopPropagation();
                const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                setMenuPosition({ x: Math.min(rect.left, window.innerWidth - 220), y: rect.bottom + 6 });
                setMenuOpen(next);
              };

              const reorderSpritesInList = (draggedIdsRaw: string[], insertIndex: number | undefined) => {
                const draggedIds = Array.isArray(draggedIdsRaw) ? draggedIdsRaw.filter((id) => typeof id === 'string') : [];
                if (draggedIds.length === 0) return;
                const spriteIds = ungroupedSpritesForRow.map((e) => e.id);
                const filtered = spriteIds.filter((id) => !draggedIds.includes(id));
                const clampedIndex = typeof insertIndex === 'number'
                  ? Math.max(0, Math.min(Math.floor(insertIndex), filtered.length))
                  : filtered.length;
                const nextOrder = [
                  ...filtered.slice(0, clampedIndex),
                  ...draggedIds,
                  ...filtered.slice(clampedIndex),
                ];
                dispatch({ type: 'remove-entities-from-groups', entityIds: draggedIds });
                dispatch({ type: 'reorder-sprite-order', orderedEntityIds: nextOrder });
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
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setSpriteFromAssetPicker({
                              sceneId,
                              x: Math.min(rect.left, window.innerWidth - 240),
                              y: rect.bottom + 6,
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
                          e.preventDefault();
                          const ids = readDragEntityIds(e.dataTransfer);
                          if (!ids || ids.length === 0) return;
                          dispatch({ type: 'remove-entities-from-groups', entityIds: ids });
                          setDragOverSprites(false);
                        }}
	                      >
	                        {ungroupedSpritesForRow.length === 0 ? (
	                          <div className="muted">No ungrouped sprites.</div>
	                        ) : (
	                          ungroupedSpritesForRow.map((entity) => (
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
                                  onDragOver={(e) => {
                                    if (sceneId !== currentSceneId) return;
                                    e.preventDefault();
                                  }}
                                  onDrop={(e) => {
                                    if (sceneId !== currentSceneId) return;
                                    e.preventDefault();
                                    const ids = readDragEntityIds(e.dataTransfer);
                                    if (!ids || ids.length === 0) return;
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    const index = ungroupedSpritesForRow.findIndex((it) => it.id === entity.id);
                                    const midpoint = rect.top + rect.height / 2;
                                    const clientY = typeof e.clientY === 'number' && Number.isFinite(e.clientY) ? e.clientY : (midpoint - 1);
                                    const insertIndex = clientY < midpoint ? index : index + 1;
                                    reorderSpritesInList(ids, Math.max(0, insertIndex));
                                    handleDragEnd();
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

	                      {/* Text */}
	                      <div className="panel-heading-row" style={{ marginTop: 12 }}>
	                        <h4 className="panel-heading" id={`scene-${sceneId}-text`}>Text</h4>
	                        <button
	                          className="button button-compact"
	                          data-testid={`texts-add-${sceneId}`}
	                          type="button"
	                          disabled={mode !== 'edit'}
	                          onClick={() => {
	                            ensureCurrentScene(sceneId);
	                            dispatch({ type: 'set-sidebar-scope', scope: 'projectTree' });
	                            dispatch({ type: 'create-text-entity' } as any);
	                          }}
	                        >
	                          + Add
	                        </button>
	                      </div>

	                      <div className="member-list" style={{ paddingLeft: 6 }}>
	                        {ungroupedTextForRow.length === 0 ? (
	                          <div className="muted">No text entities.</div>
	                        ) : (
	                          ungroupedTextForRow.map((entity) => (
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
		                                  data-testid={sceneId === currentSceneId ? `text-entity-${entity.id}` : `text-entity-${sceneId}-${entity.id}`}
	                                  onClick={(event) => {
	                                    if (sceneId !== currentSceneId) {
	                                      selectInScene(sceneId, { kind: 'entity', id: entity.id });
	                                      return;
	                                    }
	                                    handleEntityClick(entity.id, event);
		                                  }}
		                                  type="button"
		                                  draggable={sceneId === currentSceneId && editingKind == null}
		                                  onDragStart={(e) => {
		                                    if (sceneId !== currentSceneId) return;
		                                    if (editingKind != null) return;
		                                    handleEntityDragStart(entity.id, e);
		                                  }}
		                                  onDragEnd={handleDragEnd}
		                                  disabled={sceneId !== currentSceneId}
		                                >
	                                  {entity.name ?? entity.id}
	                                </button>
	                              )}
	                              <button
	                                aria-label={`More options for entity ${entity.id}`}
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
                            dispatch({ type: 'begin-formation-draft' } as any);
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
                              {editingId === zone.id && editingKind === 'trigger' ? (
                                <input
                                  autoFocus
                                  className="scene-graph-rename-input"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onBlur={saveRename}
                                  onKeyDown={handleKeyDown}
                                  data-testid={`rename-trigger-input-${zone.id}`}
                                />
                              ) : (
                                <button
                                  className={`list-item ${showActiveSelection && selection.kind === 'trigger' && selection.id === zone.id ? 'active' : ''}`}
                                  data-testid={sceneId === currentSceneId ? `trigger-zone-${zone.id}` : `trigger-zone-${sceneId}-${zone.id}`}
                                  type="button"
                                  onClick={() => selectInScene(sceneId, { kind: 'trigger', id: zone.id as Id })}
                                >
                                  {zone.name ?? zone.id}
                                </button>
                              )}
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
            <InputMapsPanel project={project} dispatch={dispatch} disabled={mode !== 'edit'} />
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
              if (rootHeight > 0) {
                const minDock = Math.max(120, Math.round(rootHeight * 0.25));
                const maxDock = Math.max(minDock, Math.round(rootHeight * 0.75));
                setAssetsDockHeight(Math.max(minDock, Math.min(maxDock, desired)));
                return;
              }
              setAssetsDockHeight(Math.max(120, Math.min(420, desired)));
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
      )}

      {spriteFromAssetPicker ? (
        <div
          ref={spriteFromAssetPickerRootRef}
          className="scene-graph-menu"
          style={{ position: 'fixed', left: spriteFromAssetPicker.x, top: spriteFromAssetPicker.y, zIndex: 52, minWidth: 260, maxHeight: 360, overflow: 'auto' }}
          data-testid="sprite-from-asset-picker"
          role="menu"
        >
          <div className="scene-graph-menu-hint">Sprite (from Asset)</div>
          {[
            ...Object.keys(project.assets.images ?? {}).sort().map((assetId) => ({ assetKind: 'image' as const, assetId })),
            ...Object.keys(project.assets.spriteSheets ?? {}).sort().map((assetId) => ({ assetKind: 'spritesheet' as const, assetId })),
          ].length === 0 ? (
            <div className="scene-graph-menu-item muted">No image assets yet.</div>
          ) : (
            <>
              {Object.keys(project.assets.images ?? {}).sort().map((assetId) => (
                <button
                  key={`image:${assetId}`}
                  type="button"
                  className="scene-graph-menu-item"
                  data-testid={`sprite-from-asset-pick-image-${assetId}`}
                  onClick={() => {
                    const targetSceneId = spriteFromAssetPicker.sceneId;
                    setSpriteFromAssetPicker(null);
                    ensureCurrentScene(targetSceneId);
                    dispatch({ type: 'set-sidebar-scope', scope: 'projectTree' });
                    dispatch({ type: 'create-entity-from-asset', assetKind: 'image', assetId } as any);
                  }}
                >
                  {assetId}
                </button>
              ))}
              {Object.keys(project.assets.spriteSheets ?? {}).sort().map((assetId) => (
                <button
                  key={`spritesheet:${assetId}`}
                  type="button"
                  className="scene-graph-menu-item"
                  data-testid={`sprite-from-asset-pick-spritesheet-${assetId}`}
                  onClick={() => {
                    const targetSceneId = spriteFromAssetPicker.sceneId;
                    setSpriteFromAssetPicker(null);
                    ensureCurrentScene(targetSceneId);
                    dispatch({ type: 'set-sidebar-scope', scope: 'projectTree' });
                    dispatch({ type: 'create-entity-from-asset', assetKind: 'spritesheet', assetId } as any);
                  }}
                >
                  {assetId} <span className="badge badge-inline">SHEET</span>
                </button>
              ))}
            </>
          )}
        </div>
      ) : null}

      {duplicateDialog ? (
        <div
          ref={duplicateDialogRootRef}
          className="scene-graph-menu"
          style={{ position: 'fixed', left: duplicateDialog.x, top: duplicateDialog.y, zIndex: 52, minWidth: 260 }}
          data-testid="duplicate-entity-dialog"
          role="dialog"
          aria-label="Duplicate entity options"
        >
          <div className="scene-graph-menu-hint">Duplicate…</div>
          <label className="scene-graph-menu-item" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={duplicateDialog.includeBehaviors}
              onChange={(e) => setDuplicateDialog((prev) => prev ? { ...prev, includeBehaviors: e.target.checked } : prev)}
            />
            <span>Include behaviors (attachments)</span>
          </label>
          <label className="scene-graph-menu-item" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={duplicateDialog.includeHandlers}
              onChange={(e) => setDuplicateDialog((prev) => prev ? { ...prev, includeHandlers: e.target.checked } : prev)}
            />
            <span>Include handlers (event blocks)</span>
          </label>
          <label className="scene-graph-menu-item" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={duplicateDialog.copyIntoSameGroup}
              onChange={(e) => setDuplicateDialog((prev) => prev ? { ...prev, copyIntoSameGroup: e.target.checked } : prev)}
            />
            <span>Copy into same group</span>
          </label>
          <div className="scene-graph-menu-divider" />
          <div style={{ display: 'flex', gap: 8, padding: '0.25rem 0.5rem' }}>
            <button
              type="button"
              className="button button-compact"
              data-testid="duplicate-entity-cancel"
              onClick={() => setDuplicateDialog(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button-compact"
              data-testid="duplicate-entity-confirm"
              onClick={() => {
                const dlg = duplicateDialog;
                setDuplicateDialog(null);
                ensureCurrentScene(dlg.sceneId);
                dispatch({
                  type: 'duplicate-entities',
                  entityIds: dlg.entityIds,
                  options: {
                    includeBehaviors: dlg.includeBehaviors,
                    includeHandlers: dlg.includeHandlers,
                    copyIntoSameGroup: dlg.copyIntoSameGroup,
                  },
                } as any);
              }}
            >
              Duplicate
            </button>
          </div>
        </div>
      ) : null}

      {selectedCopyRevision ? (
        <div
          className="scene-graph-menu"
          style={{ position: 'fixed', left: '50%', top: '20%', transform: 'translateX(-50%)', zIndex: 60, minWidth: 420 }}
          data-testid="copy-revision-dialog"
          role="dialog"
          aria-label="Copy revision dialog"
        >
          <div className="scene-graph-menu-hint">Copy this revision as a new project?</div>
          <label className="field" style={{ padding: '0.75rem' }}>
            <span>New Project Name</span>
            <input
              data-testid="copy-revision-name-input"
              value={copyRevisionName}
              onChange={(event) => setCopyRevisionName(event.target.value)}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0.75rem' }}>
            <button type="button" className="button" onClick={() => dispatch({ type: 'close-copy-revision-dialog' })}>Cancel</button>
            <button
              type="button"
              className="button button-primary"
              data-testid="copy-revision-confirm-button"
              onClick={() => {
                onCopyRevision(selectedCopyRevision.id, copyRevisionName);
                dispatch({ type: 'close-copy-revision-dialog' });
              }}
            >
              Create Copy
            </button>
          </div>
        </div>
      ) : null}

      {selectedRestoreRevision ? (
        <div
          className="scene-graph-menu"
          style={{ position: 'fixed', left: '50%', top: '20%', transform: 'translateX(-50%)', zIndex: 60, minWidth: 460 }}
          data-testid="restore-revision-dialog"
          role="dialog"
          aria-label="Restore revision dialog"
        >
          <div className="scene-graph-menu-hint">Restore this revision as the current project?</div>
          <div style={{ padding: '0.75rem', display: 'grid', gap: 8 }}>
            <div>The current project will be replaced by this revision as the new current state.</div>
            <div>Your current state will be saved into history first.</div>
            <div>This creates a new current head from the older revision instead of rewinding history.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0.75rem' }}>
            <button type="button" className="button" onClick={() => dispatch({ type: 'close-restore-revision-dialog' })}>Cancel</button>
            <button
              type="button"
              className="button button-danger"
              data-testid="restore-revision-confirm-button"
              onClick={() => {
                onRestoreRevision(selectedRestoreRevision.id);
                dispatch({ type: 'close-restore-revision-dialog' });
                dispatch({ type: 'clear-revision-preview' });
                dispatch({ type: 'set-sidebar-scope', scope: 'projectTree' });
              }}
            >
              Restore Current Project
            </button>
          </div>
        </div>
      ) : null}

      {menuOpen && menuPosition ? (
        <div
          ref={menuRootRef}
          className="scene-graph-menu"
          style={{
            position: 'fixed',
            left: menuPosition.x,
            top: menuPosition.y,
            zIndex: 50,
            minWidth: menuOpen.kind === 'project-browser' ? 420 : 200,
            maxWidth: menuOpen.kind === 'project-browser' ? 520 : undefined,
          }}
          data-testid="scene-graph-overflow-menu"
          role="menu"
        >
          {menuOpen.kind === 'project-root' ? (
            <>
              <div className="scene-graph-menu-hint">{project.title?.trim() || 'Untitled Project'}</div>
              <button
                type="button"
                className="scene-graph-menu-item"
                data-testid="project-manage-create"
                onClick={() => {
                  setMenuOpen(null);
                  onCreateProject();
                }}
              >
                Create New
              </button>
              <button
                type="button"
                className="scene-graph-menu-item"
                data-testid="project-manage-open"
                onClick={() => setMenuOpen({ kind: 'project-browser' })}
              >
                Open...
              </button>
              <button
                type="button"
                className="scene-graph-menu-item"
                data-testid="project-manage-toggle-sync"
                onClick={() => {
                  setMenuOpen(null);
                  onToggleSyncMode();
                }}
              >
                Toggle Sync Mode
              </button>
              <button
                type="button"
                className="scene-graph-menu-item"
                data-testid="project-manage-import-yaml"
                onClick={() => {
                  setMenuOpen(null);
                  onImportYaml();
                }}
              >
                Import YAML
              </button>
              <button
                type="button"
                className="scene-graph-menu-item"
                data-testid="project-manage-export-yaml"
                onClick={() => {
                  setMenuOpen(null);
                  onExportYaml();
                }}
              >
                Export as YAML
              </button>
              <div className="scene-graph-menu-divider" />
              <button
                type="button"
                className="scene-graph-menu-item"
                data-testid="project-manage-rename"
                onClick={() => {
                  setMenuOpen(null);
                  dispatch({ type: 'open-project-root-rename' });
                }}
              >
                Rename
              </button>
              <button
                type="button"
                className="scene-graph-menu-item"
                data-testid="project-manage-history"
                onClick={() => {
                  setMenuOpen(null);
                  dispatch({ type: 'set-sidebar-scope', scope: 'projectRevisions' });
                }}
              >
                History
              </button>
              <button
                type="button"
                className="scene-graph-menu-item scene-graph-menu-danger"
                data-testid="project-manage-clear"
                onClick={() => {
                  setMenuOpen(null);
                  const ok = window.confirm('Reset project to a new empty scene? This will discard the current project content.');
                  if (!ok) return;
                  dispatch({ type: 'reset-project' } as any);
                }}
              >
                Clear Project ...
              </button>
            </>
          ) : null}

          {menuOpen.kind === 'project-browser' ? (
            <div style={{ maxHeight: 'min(70vh, 720px)', overflow: 'auto' }}>
              <div className="panel-heading-row" style={{ padding: '0.2rem 0.2rem 0 0.2rem' }}>
                <div className="scene-graph-menu-hint" style={{ margin: 0 }}>Open Project</div>
                <button
                  type="button"
                  className="button button-compact"
                  data-testid="project-open-back"
                  onClick={() => setMenuOpen({ kind: 'project-root' })}
                >
                  Back
                </button>
              </div>
              {projectPicker ? (
                <ProjectPickerPanel
                  {...projectPicker}
                  onOpenProject={(projectId) => {
                    setMenuOpen(null);
                    projectPicker.onOpenProject(projectId);
                  }}
                />
              ) : null}
            </div>
          ) : null}

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
                  className="scene-graph-menu-item scene-graph-menu-danger"
                  data-testid={`scene-menu-clear-${menuOpen.sceneId}`}
                  onClick={() => {
                    const sceneId = menuOpen.sceneId;
                    setMenuOpen(null);
                    const ok = window.confirm(`Clear scene "${sceneId}"? This removes all entities, groups, triggers, layers, audio, and behaviors in that scene.`);
                    if (!ok) return;
                    dispatch({ type: 'clear-scene', sceneId } as any);
                  }}
                >
                  Clear Scene…
                </button>
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
                data-testid={`entity-menu-create-formation-${menuOpen.entityId}`}
                onClick={() => {
                  setMenuOpen(null);
                  ensureCurrentScene(menuOpen.sceneId);
                  dispatch({ type: 'begin-formation-draft', template: { kind: 'entity', entityId: menuOpen.entityId } } as any);
                }}
              >
                Create formation from…
              </button>
              <div className="scene-graph-menu-divider" />
              {(() => {
                const isMultiEntitySelection = selection.kind === 'entities'
                  && menuOpen.sceneId === currentSceneId
                  && selection.ids.length > 1
                  && selection.ids.includes(menuOpen.entityId);
                if (isMultiEntitySelection) return null;
                return (
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
                );
              })()}
              <button
                type="button"
                className="scene-graph-menu-item"
                data-testid={`entity-menu-duplicate-${menuOpen.entityId}`}
                onClick={(e) => {
                  setMenuOpen(null);
                  const idsToDuplicate = selection.kind === 'entities'
                    && menuOpen.sceneId === currentSceneId
                    && selection.ids.length > 1
                    && selection.ids.includes(menuOpen.entityId)
                      ? selection.ids
                      : [menuOpen.entityId];
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setDuplicateDialog({
                    sceneId: menuOpen.sceneId,
                    entityIds: idsToDuplicate,
                    x: Math.min(rect.left, window.innerWidth - 280),
                    y: rect.bottom + 6,
                    includeBehaviors: true,
                    includeHandlers: true,
                    copyIntoSameGroup: true,
                  });
                }}
              >
                ⧉ Duplicate…
              </button>
              <div className="scene-graph-menu-divider" />
              <button
                type="button"
                className="scene-graph-menu-item scene-graph-menu-danger"
                data-testid={`entity-menu-delete-${menuOpen.entityId}`}
                onClick={() => {
                  setMenuOpen(null);
                  ensureCurrentScene(menuOpen.sceneId);
                  const isMultiEntitySelection = selection.kind === 'entities'
                    && menuOpen.sceneId === currentSceneId
                    && selection.ids.length > 1
                    && selection.ids.includes(menuOpen.entityId);
                  if (isMultiEntitySelection) {
                    dispatch({ type: 'delete-selection' } as any);
                    return;
                  }
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

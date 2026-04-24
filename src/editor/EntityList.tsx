import { useState } from 'react';
import { useEditorStore, type Selection } from './EditorStore';
import { summarizeSceneGroups } from './grouping';
import type { ProjectSpec, SceneSpec } from '../model/types';
import { countAttachmentsForTarget } from './sceneGraphCommands';

const ENTITY_DRAG_MIME = 'application/x-phaseractions-studio-entity-ids';

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

export function EntityList() {
  const { state, dispatch } = useEditorStore();
  const { project, currentSceneId, selection, expandedGroups } = state;
  const scene = project.scenes[currentSceneId];
  return (
    <EntityListView
      project={project}
      currentSceneId={currentSceneId}
      scene={scene}
      selection={selection}
      expandedGroups={expandedGroups}
      dispatch={dispatch}
    />
  );
}

export function EntityListView({
  project,
  currentSceneId,
  scene,
  selection,
  expandedGroups,
  dispatch,
}: {
  project: ProjectSpec;
  currentSceneId: string;
  scene: SceneSpec;
  selection: Selection;
  expandedGroups: Record<string, boolean>;
  dispatch: (action: any) => void;
}) {
  const { groups, ungroupedEntities } = summarizeSceneGroups(scene);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKind, setEditingKind] = useState<'entity' | 'group' | null>(null);
  const [editingName, setEditingName] = useState('');
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [dragOverSprites, setDragOverSprites] = useState(false);

  const startEditing = (kind: 'entity' | 'group', id: string, currentName: string) => {
    setEditingKind(kind);
    setEditingId(id);
    setEditingName(currentName);
  };

  const cancelEditing = () => {
    setEditingKind(null);
    setEditingId(null);
    setEditingName('');
  };

  const saveRename = () => {
    if (!editingId || !editingKind || !editingName.trim()) {
      cancelEditing();
      return;
    }

    if (editingKind === 'group') {
      const group = scene.groups[editingId];
      if (group) {
        dispatch({ type: 'update-group', id: editingId, next: { ...group, name: editingName } });
      }
    } else if (editingKind === 'entity') {
      const entity = scene.entities[editingId];
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
    dispatch({ type: 'select', selection: { kind: 'entity', id } });
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
    setDragOverSprites(false);
  };

  const handleDropOnGroup = (groupId: string, event: React.DragEvent) => {
    event.preventDefault();
    const ids = readDragEntityIds(event.dataTransfer);
    if (!ids || ids.length === 0) return;
    dispatch({ type: 'add-entities-to-group', groupId, entityIds: ids });
    setDragOverGroupId(null);
  };

  const handleDropOnSprites = (event: React.DragEvent) => {
    event.preventDefault();
    const ids = readDragEntityIds(event.dataTransfer);
    if (!ids || ids.length === 0) return;
    dispatch({ type: 'remove-entities-from-groups', entityIds: ids });
    setDragOverSprites(false);
  };

  return (
    <div className="panel panel-scroll" data-testid="entity-list">
      <section className="panel-section" aria-labelledby="scene-list">
        <div className="panel-heading-row">
          <h3 className="panel-heading" id="scene-list">Scenes</h3>
        </div>
        <div className="member-list">
          {Object.keys(project.scenes).map((sceneId) => (
            <div key={sceneId} className="member-row">
              <button
                className={`list-item ${sceneId === currentSceneId ? 'active' : ''}`}
                data-testid={`scene-item-${sceneId}`}
                type="button"
                onClick={() => dispatch({ type: 'set-current-scene', sceneId })}
              >
                {sceneId}
              </button>
              <button
                aria-label={`Duplicate scene ${sceneId}`}
                className="scene-graph-button"
                data-testid={`duplicate-scene-${sceneId}`}
                type="button"
                onClick={() => dispatch({ type: 'duplicate-scene', sceneId })}
              >
                ⧉
              </button>
              <button
                aria-label={`Delete scene ${sceneId}`}
                className="scene-graph-button scene-graph-remove"
                data-testid={`delete-scene-${sceneId}`}
                type="button"
                disabled={Object.keys(project.scenes).length <= 1}
                onClick={() => dispatch({ type: 'delete-scene', sceneId })}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
        <button
          className="button"
          data-testid="create-scene-button"
          type="button"
          onClick={() => dispatch({ type: 'create-scene' })}
        >
          New Scene
        </button>
      </section>
      <section
        className={`panel-section ${dragOverSprites ? 'scene-graph-drop-target scene-graph-drop-target-sprites' : ''}`}
        aria-labelledby="scene-graph-sprites"
        data-testid="sprites-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragOverSprites) setDragOverSprites(true);
        }}
        onDragLeave={() => setDragOverSprites(false)}
        onDrop={handleDropOnSprites}
      >
        <div className="panel-heading-row">
          <h3 className="panel-heading" id="scene-graph-sprites">Sprites</h3>
        </div>
        {ungroupedEntities.map((entity) => (
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
                className={`list-item ${isSelected(selection, 'entity', entity.id) ? 'active' : ''}`}
                data-testid={`ungrouped-entity-${entity.id}`}
                draggable={editingKind == null}
                onDragStart={(e) => handleEntityDragStart(entity.id, e)}
                onDragEnd={handleDragEnd}
                onClick={(e) => handleEntityClick(entity.id, e)}
                type="button"
              >
                {entity.name ?? entity.id}
                <span className="list-item-meta">{countAttachmentsForTarget(scene, { type: 'entity', entityId: entity.id })}</span>
              </button>
            )}
            <button
              aria-label={`Rename sprite ${entity.name ?? entity.id}`}
              className="scene-graph-button scene-graph-edit"
              data-testid={`edit-entity-${entity.id}`}
              type="button"
              onClick={() => startEditing('entity', entity.id, entity.name ?? entity.id)}
            >
              ✏️
            </button>
            <button
              aria-label={`Remove sprite ${entity.name ?? entity.id}`}
              className="scene-graph-button scene-graph-remove"
              data-testid={`remove-entity-${entity.id}`}
              type="button"
              onClick={() => dispatch({ type: 'remove-scene-graph-item', item: { kind: 'entity', id: entity.id } })}
            >
              🗑
            </button>
          </div>
        ))}
      </section>

      <section className="panel-section" aria-labelledby="scene-graph-formations">
        <div className="panel-heading-row">
          <h3 className="panel-heading" id="scene-graph-formations">Formations</h3>
        </div>
        {groups.map(({ group, members }) => (
          <div key={group.id} className="behavior-block">
            <div className="member-row">
              <button
                aria-label={`Toggle formation ${group.name ?? group.id}`}
                className="scene-graph-button scene-graph-chevron"
                data-testid={`toggle-group-${group.id}`}
                type="button"
                onClick={() => dispatch({ type: 'toggle-group-expanded', id: group.id })}
                onDragEnd={handleDragEnd}
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
                  className={`list-item ${isSelected(selection, 'group', group.id) ? 'active' : ''} ${dragOverGroupId === group.id ? 'scene-graph-drop-target scene-graph-drop-target-group' : ''}`}
                  data-testid={`group-item-${group.id}`}
                  onClick={() => dispatch({ type: 'select', selection: { kind: 'group', id: group.id } })}
                  type="button"
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverGroupId !== group.id) setDragOverGroupId(group.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverGroupId === group.id) setDragOverGroupId(null);
                  }}
                  onDrop={(e) => handleDropOnGroup(group.id, e)}
                >
                  {group.name ?? group.id}
                  <span className="list-item-meta">{countAttachmentsForTarget(scene, { type: 'group', groupId: group.id })}</span>
                </button>
              )}
              <button
                aria-label={`Rename formation ${group.name ?? group.id}`}
                className="scene-graph-button scene-graph-edit"
                data-testid={`edit-group-${group.id}`}
                type="button"
                onClick={() => startEditing('group', group.id, group.name ?? group.id)}
              >
                ✏️
              </button>
              <button
                aria-label={`Remove formation ${group.name ?? group.id}`}
                className="scene-graph-button scene-graph-remove"
                data-testid={`remove-group-${group.id}`}
                type="button"
                onClick={() => dispatch({ type: 'remove-scene-graph-item', item: { kind: 'group', id: group.id } })}
              >
                🗑
              </button>
            </div>
            {expandedGroups[group.id] && (
              <div className="member-list">
                {members.map((member) => (
                  <div key={member.id} className="member-row">
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
                        className={`list-item ${isSelected(selection, 'entity', member.id) ? 'active' : ''}`}
                        data-testid={`group-member-${group.id}-${member.id}`}
                        draggable={editingKind == null}
                        onDragStart={(e) => handleEntityDragStart(member.id, e)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => handleEntityClick(member.id, e)}
                        type="button"
                      >
                        {member.name ?? member.id}
                      </button>
                    )}
                    <button
                      aria-label={`Rename sprite ${member.name ?? member.id}`}
                      className="scene-graph-button scene-graph-edit"
                      data-testid={`edit-group-member-${group.id}-${member.id}`}
                      type="button"
                      onClick={() => startEditing('entity', member.id, member.name ?? member.id)}
                    >
                      ✏️
                    </button>
                    <button
                      aria-label={`Remove sprite ${member.name ?? member.id} from formation ${group.name ?? group.id}`}
                      className="scene-graph-button scene-graph-remove"
                      data-testid={`group-member-remove-${group.id}-${member.id}`}
                      type="button"
                      onClick={() => dispatch({ type: 'remove-entity-from-group', groupId: group.id, entityId: member.id })}
                    >
                      -
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

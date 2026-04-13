import { useMemo, useState } from 'react';
import { useEditorStore, type Selection } from './EditorStore';
import { summarizeSceneGroups } from './grouping';
import type { AttachmentSpec, SceneSpec } from '../model/types';
import { countAttachmentsForTarget } from './sceneGraphCommands';
import { getTargetLabel } from './attachmentCommands';

function isSelected(selection: Selection, kind: Selection['kind'], id: string): boolean {
  if (selection.kind === 'entities') {
    return kind === 'entity' && selection.ids.includes(id);
  }
  return selection.kind === kind && 'id' in selection && selection.id === id;
}

function sortedAttachments(scene: SceneSpec): AttachmentSpec[] {
  return Object.values(scene.attachments).sort((a, b) => {
    const aTarget = getTargetLabel(scene, a.target);
    const bTarget = getTargetLabel(scene, b.target);
    if (aTarget !== bTarget) return aTarget.localeCompare(bTarget);
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });
}

export function EntityList() {
  const { state, dispatch } = useEditorStore();
  const { scene, selection, expandedGroups } = state;
  return (
    <EntityListView
      scene={scene}
      selection={selection}
      expandedGroups={expandedGroups}
      dispatch={dispatch}
    />
  );
}

export function EntityListView({
  scene,
  selection,
  expandedGroups,
  dispatch,
}: {
  scene: SceneSpec;
  selection: Selection;
  expandedGroups: Record<string, boolean>;
  dispatch: (action: any) => void;
}) {
  const { groups, ungroupedEntities } = summarizeSceneGroups(scene);
  const attachments = useMemo(() => sortedAttachments(scene), [scene]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKind, setEditingKind] = useState<'entity' | 'group' | 'attachment' | null>(null);
  const [editingName, setEditingName] = useState('');

  const startEditing = (kind: 'entity' | 'group' | 'attachment', id: string, currentName: string) => {
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
    } else if (editingKind === 'attachment') {
      const attachment = scene.attachments[editingId];
      if (attachment) {
        dispatch({ type: 'update-attachment', id: editingId, next: { ...attachment, name: editingName } });
      }
    }

    cancelEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveRename();
    if (e.key === 'Escape') cancelEditing();
  };

  return (
    <div className="panel panel-scroll" data-testid="entity-list">
      <section className="panel-section" aria-labelledby="scene-graph-sprites">
        <div className="panel-heading-row">
          <h3 className="panel-heading" id="scene-graph-sprites">Sprites</h3>
          <span className="panel-count">{Object.values(scene.entities).length}</span>
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
                onClick={() => dispatch({ type: 'select', selection: { kind: 'entity', id: entity.id } })}
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
          <span className="panel-count">{groups.length}</span>
        </div>
        {groups.map(({ group, members }) => (
          <div key={group.id} className="behavior-block">
            <div className="member-row">
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
                  className={`list-item ${isSelected(selection, 'group', group.id) ? 'active' : ''}`}
                  data-testid={`group-item-${group.id}`}
                  onClick={() => dispatch({ type: 'select', selection: { kind: 'group', id: group.id } })}
                  type="button"
                >
                  {group.name ?? group.id}
                  <span className="list-item-meta">{countAttachmentsForTarget(scene, { type: 'group', groupId: group.id })}</span>
                </button>
              )}
              <button
                aria-label={`Toggle formation ${group.name ?? group.id}`}
                className="scene-graph-button"
                data-testid={`toggle-group-${group.id}`}
                type="button"
                onClick={() => dispatch({ type: 'toggle-group-expanded', id: group.id })}
              >
                {expandedGroups[group.id] ? '▾' : '▸'}
              </button>
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
                    <button
                      className={`list-item ${isSelected(selection, 'entity', member.id) ? 'active' : ''}`}
                      data-testid={`group-member-${group.id}-${member.id}`}
                      onClick={() => dispatch({ type: 'select', selection: { kind: 'entity', id: member.id } })}
                      type="button"
                    >
                      {member.name ?? member.id}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="panel-section" aria-labelledby="scene-graph-actions">
        <div className="panel-heading-row">
          <h3 className="panel-heading" id="scene-graph-actions">Actions</h3>
          <span className="panel-count">{attachments.length}</span>
        </div>
        {attachments.map((attachment) => (
          <div key={attachment.id} className="member-row">
            {editingId === attachment.id && editingKind === 'attachment' ? (
              <input
                autoFocus
                className="scene-graph-rename-input"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={saveRename}
                onKeyDown={handleKeyDown}
                data-testid={`rename-attachment-input-${attachment.id}`}
              />
            ) : (
              <button
                className={`list-item ${isSelected(selection, 'attachment', attachment.id) ? 'active' : ''}`}
                data-testid={`attachment-item-${attachment.id}`}
                onClick={() => dispatch({ type: 'select', selection: { kind: 'attachment', id: attachment.id } })}
                type="button"
              >
                <span className="action-item-label">{attachment.name ?? attachment.id}</span>
                <span className="action-item-meta">{attachment.presetId} · {getTargetLabel(scene, attachment.target)}</span>
              </button>
            )}
            <button
              aria-label={`Rename action ${attachment.name ?? attachment.id}`}
              className="scene-graph-button scene-graph-edit"
              data-testid={`edit-attachment-${attachment.id}`}
              type="button"
              onClick={() => startEditing('attachment', attachment.id, attachment.name ?? attachment.id)}
            >
              ✏️
            </button>
            <button
              aria-label={`Remove action ${attachment.name ?? attachment.id}`}
              className="scene-graph-button scene-graph-remove"
              data-testid={`remove-attachment-${attachment.id}`}
              type="button"
              onClick={() => dispatch({ type: 'remove-scene-graph-item', item: { kind: 'attachment', id: attachment.id } })}
            >
              🗑
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

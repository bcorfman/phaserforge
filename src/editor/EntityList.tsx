import { useState } from 'react';
import { useEditorStore } from './EditorStore';
import { summarizeSceneGroups } from './grouping';
import { buildBehaviorActionTrees, type ActionTreeNode } from './actionTree';
import { type Selection } from './EditorStore';
import { type SceneSpec } from '../model/types';
import { getActionGraphLabel } from './sceneGraphCommands';

export function EntityList() {
  const { state, dispatch } = useEditorStore();
  const { scene, selection, expandedGroups } = state;
  const { groups, ungroupedEntities } = summarizeSceneGroups(scene);
  const behaviorActionTrees = buildBehaviorActionTrees(scene);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKind, setEditingKind] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const isSelected = (kind: string, id: string): boolean => {
    if (selection.kind === 'entities') {
      return kind === 'entity' && selection.ids.includes(id);
    }

    return selection.kind !== 'none' && selection.kind === kind && 'id' in selection && selection.id === id;
  };

  const startEditing = (kind: string, id: string, currentName: string) => {
    setEditingKind(kind);
    setEditingId(id);
    setEditingName(currentName);
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
    } else if (editingKind === 'behavior') {
      dispatch({ type: 'rename-behavior', id: editingId, name: editingName });
    } else if (editingKind === 'action') {
      const action = scene.actions[editingId];
      if (action) {
        dispatch({ type: 'update-action', id: editingId, next: { ...action, name: editingName } });
      }
    }

    cancelEditing();
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingKind(null);
    setEditingName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveRename();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const handleEditingNameChange = (newName: string) => {
    setEditingName(newName);
  };

  return (
    <div className="panel" data-testid="entity-list">
      <div className="panel-header">
        <p className="eyebrow">Outline</p>
        <h2 className="panel-title" id="scene-graph-heading">Scene Graph</h2>
        <p className="panel-description">
          Formations, loose entities, behaviors, and conditions stay visible while you edit.
        </p>
      </div>
      <section className="panel-section" aria-labelledby="scene-graph-formations">
        <div className="panel-heading-row">
          <h3 className="panel-heading" id="scene-graph-formations">Formations</h3>
          <span className="panel-count">{groups.length}</span>
        </div>
        {groups.map(({ group, members }) => (
          <div key={group.id} className="group-block" data-testid={`group-block-${group.id}`}>
            <div className="group-row">
              <button
                className="group-toggle"
                data-testid={`group-toggle-${group.id}`}
                type="button"
                onClick={() => dispatch({ type: 'toggle-group-expanded', id: group.id })}
                aria-label={expandedGroups[group.id] ? 'Collapse group members' : 'Expand group members'}
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
                  className={`list-item group-item ${isSelected('group', group.id) ? 'active' : ''}`}
                  data-testid={`group-item-${group.id}`}
                  onClick={() => dispatch({ type: 'select', selection: { kind: 'group', id: group.id } })}
                  type="button"
                >
                  <span>{group.name ?? group.id}</span>
                  <span className="group-meta">{members.length} members</span>
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
              <div className="group-members">
                {members.map((entity) => (
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
                        className={`list-item member-item ${isSelected('entity', entity.id) ? 'active' : ''}`}
                        data-testid={`member-item-${entity.id}`}
                        onClick={() => dispatch({ type: 'select', selection: { kind: 'entity', id: entity.id } })}
                        type="button"
                      >
                        {entity.name ?? entity.id}
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
              </div>
            )}
          </div>
        ))}
      </section>
      <section className="panel-section" aria-labelledby="scene-graph-ungrouped">
        <div className="panel-heading-row">
          <h3 className="panel-heading" id="scene-graph-ungrouped">Ungrouped Entities</h3>
          <span className="panel-count">{ungroupedEntities.length}</span>
        </div>
        {ungroupedEntities.length === 0 && <div className="muted">All entities are part of a formation.</div>}
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
                className={`list-item ${isSelected('entity', entity.id) ? 'active' : ''}`}
                data-testid={`ungrouped-entity-${entity.id}`}
                onClick={() => dispatch({ type: 'select', selection: { kind: 'entity', id: entity.id } })}
                type="button"
              >
                {entity.name ?? entity.id}
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
      <section className="panel-section" aria-labelledby="scene-graph-behaviors">
        <div className="panel-heading-row">
          <h3 className="panel-heading" id="scene-graph-behaviors">Behavior Flow</h3>
          <span className="panel-count">{behaviorActionTrees.length}</span>
        </div>
        {behaviorActionTrees.map(({ behaviorId, root }) => {
          const behavior = scene.behaviors[behaviorId];
          if (!behavior) return null;

          return (
            <div key={behavior.id} className="behavior-block">
              <div className="member-row">
                {editingId === behavior.id && editingKind === 'behavior' ? (
                  <input
                    autoFocus
                    className="scene-graph-rename-input"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={saveRename}
                    onKeyDown={handleKeyDown}
                    data-testid={`rename-behavior-input-${behavior.id}`}
                  />
                ) : (
                  <button
                    className={`list-item ${isSelected('behavior', behavior.id) ? 'active' : ''}`}
                    data-testid={`behavior-item-${behavior.id}`}
                    onClick={() => dispatch({ type: 'select', selection: { kind: 'behavior', id: behavior.id } })}
                    type="button"
                  >
                    {behavior.name ?? behavior.id}
                  </button>
                )}
                <button
                  aria-label={`Rename behavior ${behavior.name ?? behavior.id}`}
                  className="scene-graph-button scene-graph-edit"
                  data-testid={`edit-behavior-${behavior.id}`}
                  type="button"
                  onClick={() => startEditing('behavior', behavior.id, behavior.name ?? behavior.id)}
                >
                  ✏️
                </button>
                <button
                  aria-label={`Remove behavior ${behavior.name ?? behavior.id}`}
                  className="scene-graph-button scene-graph-remove"
                  data-testid={`remove-behavior-${behavior.id}`}
                  type="button"
                  onClick={() => dispatch({ type: 'remove-scene-graph-item', item: { kind: 'behavior', id: behavior.id } })}
                >
                  🗑
                </button>
              </div>
              {root ? (
                <div className="action-tree" aria-label={`${behavior.name ?? behavior.id} action hierarchy`}>
                  <ActionTreeBranch
                    node={root}
                    depth={0}
                    isSelected={isSelected}
                    onSelect={(id) => dispatch({ type: 'select', selection: { kind: 'action', id } })}
                    onRemove={(id) => dispatch({ type: 'remove-scene-graph-item', item: { kind: 'action', id } })}
                    editingId={editingId}
                    editingKind={editingKind}
                    editingName={editingName}
                    onStartEditing={startEditing}
                    onSaveRename={saveRename}
                    onCancelEditing={cancelEditing}
                    onKeyDown={handleKeyDown}
                    onEditingNameChange={handleEditingNameChange}
                    scene={scene}
                  />
                </div>
              ) : (
                <div className="muted">Root action not found.</div>
              )}
            </div>
          );
        })}
      </section>
      <section className="panel-section" aria-labelledby="scene-graph-conditions">
        <div className="panel-heading-row">
          <h3 className="panel-heading" id="scene-graph-conditions">Conditions</h3>
          <span className="panel-count">{Object.values(scene.conditions).length}</span>
        </div>
        {Object.values(scene.conditions).map((condition) => (
          <div key={condition.id} className="member-row">
            <button
              className={`list-item ${isSelected('condition', condition.id) ? 'active' : ''}`}
              data-testid={`condition-item-${condition.id}`}
              onClick={() => dispatch({ type: 'select', selection: { kind: 'condition', id: condition.id } })}
              type="button"
            >
              {condition.id} · {condition.type}
            </button>
            <button
              aria-label={`Remove condition ${condition.id}`}
              className="scene-graph-button scene-graph-remove"
              data-testid={`remove-condition-${condition.id}`}
              type="button"
              onClick={() => dispatch({ type: 'remove-scene-graph-item', item: { kind: 'condition', id: condition.id } })}
            >
              🗑
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

function ActionTreeBranch({
  node,
  depth,
  isSelected,
  onSelect,
  onRemove,
  editingId,
  editingKind,
  editingName,
  onStartEditing,
  onSaveRename,
  onCancelEditing,
  onKeyDown,
  onEditingNameChange,
  scene,
}: {
  node: ActionTreeNode;
  depth: number;
  isSelected: (kind: string, id: string) => boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  editingId: string | null;
  editingKind: string | null;
  editingName: string;
  onStartEditing: (kind: string, id: string, currentName: string) => void;
  onSaveRename: () => void;
  onCancelEditing: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onEditingNameChange: (newName: string) => void;
  scene: SceneSpec;
}) {
  return (
    <>
      <div className="member-row" style={{ marginLeft: `${depth * 14}px` }}>
        {editingId === node.id && editingKind === 'action' ? (
          <input
            autoFocus
            className="scene-graph-rename-input"
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onBlur={onSaveRename}
            onKeyDown={onKeyDown}
            data-testid={`rename-action-input-${node.id}`}
          />
        ) : (
          <button
            className={`list-item action-item ${isSelected('action', node.id) ? 'active' : ''}`}
            data-testid={`action-item-${node.id}`}
            onClick={() => onSelect(node.id)}
            type="button"
          >
            <span className="action-item-label">{node.action.name ?? node.id}</span>
            <span className="action-item-meta">{node.action.type}</span>
          </button>
        )}
        <button
          aria-label={`Rename action ${getActionGraphLabel(node.action)}`}
          className="scene-graph-button scene-graph-edit"
          data-testid={`edit-action-${node.id}`}
          type="button"
          onClick={() => onStartEditing('action', node.id, node.action.name ?? node.id)}
        >
          ✏️
        </button>
        <button
          aria-label={`Remove action ${getActionGraphLabel(node.action)}`}
          className="scene-graph-button scene-graph-remove"
          data-testid={`remove-action-${node.id}`}
          type="button"
          onClick={() => onRemove(node.id)}
        >
          🗑
        </button>
      </div>
      {node.children.map((child) => (
        <ActionTreeBranch
          key={child.id}
          node={child}
          depth={depth + 1}
          isSelected={isSelected}
          onSelect={onSelect}
          onRemove={onRemove}
          editingId={editingId}
          editingKind={editingKind}
          editingName={editingName}
          onStartEditing={onStartEditing}
          onSaveRename={onSaveRename}
          onCancelEditing={onCancelEditing}
          onKeyDown={onKeyDown}
          onEditingNameChange={onEditingNameChange}
          scene={scene}
        />
      ))}
    </>
  );
}

export function renderBehaviorHierarchy(
  scene: SceneSpec,
  selection: Selection,
  onSelectBehavior: (id: string) => void,
  onSelectAction: (id: string) => void
) {
  const behaviorActionTrees = buildBehaviorActionTrees(scene);
  const isSelected = (kind: string, id: string): boolean => {
    if (selection.kind === 'entities') {
      return kind === 'entity' && selection.ids.includes(id);
    }

    return selection.kind !== 'none' && selection.kind === kind && 'id' in selection && selection.id === id;
  };

  return (
    <>
      <div className="panel-heading">Behavior Flow</div>
      {behaviorActionTrees.map(({ behaviorId, root }) => {
        const behavior = scene.behaviors[behaviorId];
        if (!behavior) return null;

        return (
          <div key={behavior.id} className="behavior-block">
            <button
              className={`list-item ${isSelected('behavior', behavior.id) ? 'active' : ''}`}
              onClick={() => onSelectBehavior(behavior.id)}
              type="button"
            >
              {behavior.name ?? behavior.id}
            </button>
            {root ? (
              <div className="action-tree" aria-label={`${behavior.name ?? behavior.id} action hierarchy`}>
                <ActionTreeBranch
                  node={root}
                  depth={0}
                  isSelected={isSelected}
                  onSelect={onSelectAction}
                  onRemove={() => {}}
                />
              </div>
            ) : (
              <div className="muted">Root action not found.</div>
            )}
          </div>
        );
      })}
    </>
  );
}

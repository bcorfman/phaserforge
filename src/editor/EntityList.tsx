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

  const isSelected = (kind: string, id: string): boolean => {
    if (selection.kind === 'entities') {
      return kind === 'entity' && selection.ids.includes(id);
    }

    return selection.kind !== 'none' && selection.kind === kind && 'id' in selection && selection.id === id;
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
              <button
                className={`list-item group-item ${isSelected('group', group.id) ? 'active' : ''}`}
                data-testid={`group-item-${group.id}`}
                onClick={() => dispatch({ type: 'select', selection: { kind: 'group', id: group.id } })}
                type="button"
              >
                <span>{group.name ?? group.id}</span>
                <span className="group-meta">{members.length} members</span>
              </button>
              <button
                aria-label={`Remove formation ${group.name ?? group.id}`}
                className="scene-graph-remove"
                data-testid={`remove-group-${group.id}`}
                type="button"
                onClick={() => dispatch({ type: 'remove-scene-graph-item', item: { kind: 'group', id: group.id } })}
              >
                Remove
              </button>
            </div>
            {expandedGroups[group.id] && (
              <div className="group-members">
                {members.map((entity) => (
                  <div key={entity.id} className="member-row">
                    <button
                      className={`list-item member-item ${isSelected('entity', entity.id) ? 'active' : ''}`}
                      data-testid={`member-item-${entity.id}`}
                      onClick={() => dispatch({ type: 'select', selection: { kind: 'entity', id: entity.id } })}
                      type="button"
                    >
                      {entity.name ?? entity.id}
                    </button>
                    <button
                      aria-label={`Remove sprite ${entity.name ?? entity.id}`}
                      className="scene-graph-remove"
                      data-testid={`remove-entity-${entity.id}`}
                      type="button"
                      onClick={() => dispatch({ type: 'remove-scene-graph-item', item: { kind: 'entity', id: entity.id } })}
                    >
                      Remove
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
            <button
              className={`list-item ${isSelected('entity', entity.id) ? 'active' : ''}`}
              data-testid={`ungrouped-entity-${entity.id}`}
              onClick={() => dispatch({ type: 'select', selection: { kind: 'entity', id: entity.id } })}
              type="button"
            >
              {entity.name ?? entity.id}
            </button>
            <button
              aria-label={`Remove sprite ${entity.name ?? entity.id}`}
              className="scene-graph-remove"
              data-testid={`remove-entity-${entity.id}`}
              type="button"
              onClick={() => dispatch({ type: 'remove-scene-graph-item', item: { kind: 'entity', id: entity.id } })}
            >
              Remove
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
                <button
                  className={`list-item ${isSelected('behavior', behavior.id) ? 'active' : ''}`}
                  data-testid={`behavior-item-${behavior.id}`}
                  onClick={() => dispatch({ type: 'select', selection: { kind: 'behavior', id: behavior.id } })}
                  type="button"
                >
                  {behavior.name ?? behavior.id}
                </button>
                <button
                  aria-label={`Remove behavior ${behavior.name ?? behavior.id}`}
                  className="scene-graph-remove"
                  data-testid={`remove-behavior-${behavior.id}`}
                  type="button"
                  onClick={() => dispatch({ type: 'remove-scene-graph-item', item: { kind: 'behavior', id: behavior.id } })}
                >
                  Remove
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
              className="scene-graph-remove"
              data-testid={`remove-condition-${condition.id}`}
              type="button"
              onClick={() => dispatch({ type: 'remove-scene-graph-item', item: { kind: 'condition', id: condition.id } })}
            >
              Remove
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
}: {
  node: ActionTreeNode;
  depth: number;
  isSelected: (kind: string, id: string) => boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      <div className="member-row" style={{ marginLeft: `${depth * 14}px` }}>
        <button
          className={`list-item action-item ${isSelected('action', node.id) ? 'active' : ''}`}
          data-testid={`action-item-${node.id}`}
          onClick={() => onSelect(node.id)}
          type="button"
        >
          <span className="action-item-label">{node.action.name ?? node.id}</span>
          <span className="action-item-meta">{node.action.type}</span>
        </button>
        <button
          aria-label={`Remove action ${getActionGraphLabel(node.action)}`}
          className="scene-graph-remove"
          data-testid={`remove-action-${node.id}`}
          type="button"
          onClick={() => onRemove(node.id)}
        >
          Remove
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

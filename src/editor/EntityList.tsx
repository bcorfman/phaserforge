import { useEditorStore } from './EditorStore';
import { summarizeSceneGroups } from './grouping';
import { buildBehaviorActionTrees, type ActionTreeNode } from './actionTree';
import { type Selection } from './EditorStore';
import { type SceneSpec } from '../model/types';

export function EntityList() {
  const { state, dispatch } = useEditorStore();
  const { scene, selection, expandedGroups } = state;
  const { groups, ungroupedEntities } = summarizeSceneGroups(scene);
  const behaviorActionTrees = buildBehaviorActionTrees(scene);

  const isSelected = (kind: string, id: string): boolean =>
    selection.kind !== 'none' && selection.kind === kind && selection.id === id;

  return (
    <div className="panel">
      <div className="panel-title">Scene</div>
      <div className="panel-section">
        <div className="panel-heading">Formations</div>
        {groups.map(({ group, members }) => (
          <div key={group.id} className="group-block">
            <div className="group-row">
              <button
                className="group-toggle"
                type="button"
                onClick={() => dispatch({ type: 'toggle-group-expanded', id: group.id })}
                aria-label={expandedGroups[group.id] ? 'Collapse group members' : 'Expand group members'}
              >
                {expandedGroups[group.id] ? '▾' : '▸'}
              </button>
              <button
                className={`list-item group-item ${isSelected('group', group.id) ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'select', selection: { kind: 'group', id: group.id } })}
                type="button"
              >
                <span>{group.name ?? group.id}</span>
                <span className="group-meta">{members.length} members</span>
              </button>
            </div>
            {expandedGroups[group.id] && (
              <div className="group-members">
                {members.map((entity) => (
                  <button
                    key={entity.id}
                    className={`list-item member-item ${isSelected('entity', entity.id) ? 'active' : ''}`}
                    onClick={() => dispatch({ type: 'select', selection: { kind: 'entity', id: entity.id } })}
                    type="button"
                  >
                    {entity.name ?? entity.id}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="panel-section">
        <div className="panel-heading">Ungrouped Entities</div>
        {ungroupedEntities.length === 0 && <div className="muted">All entities are part of a formation.</div>}
        {ungroupedEntities.map((entity) => (
          <button
            key={entity.id}
            className={`list-item ${isSelected('entity', entity.id) ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'select', selection: { kind: 'entity', id: entity.id } })}
            type="button"
          >
            {entity.name ?? entity.id}
          </button>
        ))}
      </div>
      <div className="panel-section">
        <div className="panel-heading">Behaviors</div>
        {behaviorActionTrees.map(({ behaviorId, root }) => {
          const behavior = scene.behaviors[behaviorId];
          if (!behavior) return null;

          return (
            <div key={behavior.id} className="behavior-block">
              <button
                className={`list-item ${isSelected('behavior', behavior.id) ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'select', selection: { kind: 'behavior', id: behavior.id } })}
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
                    onSelect={(id) => dispatch({ type: 'select', selection: { kind: 'action', id } })}
                  />
                </div>
              ) : (
                <div className="muted">Root action not found.</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="panel-section">
        <div className="panel-heading">Conditions</div>
        {Object.values(scene.conditions).map((condition) => (
          <button
            key={condition.id}
            className={`list-item ${isSelected('condition', condition.id) ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'select', selection: { kind: 'condition', id: condition.id } })}
            type="button"
          >
            {condition.id} · {condition.type}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionTreeBranch({
  node,
  depth,
  isSelected,
  onSelect,
}: {
  node: ActionTreeNode;
  depth: number;
  isSelected: (kind: string, id: string) => boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <button
        className={`list-item action-item ${isSelected('action', node.id) ? 'active' : ''}`}
        onClick={() => onSelect(node.id)}
        style={{ marginLeft: `${depth * 14}px` }}
        type="button"
      >
        <span className="action-item-label">{node.action.name ?? node.id}</span>
        <span className="action-item-meta">{node.action.type}</span>
      </button>
      {node.children.map((child) => (
        <ActionTreeBranch
          key={child.id}
          node={child}
          depth={depth + 1}
          isSelected={isSelected}
          onSelect={onSelect}
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
  const isSelected = (kind: string, id: string): boolean =>
    selection.kind !== 'none' && selection.kind === kind && selection.id === id;

  return behaviorActionTrees.map(({ behaviorId, root }) => {
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
            />
          </div>
        ) : (
          <div className="muted">Root action not found.</div>
        )}
      </div>
    );
  });
}

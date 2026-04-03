import { useEditorStore } from './EditorStore';
import { summarizeSceneGroups } from './grouping';

export function EntityList() {
  const { state, dispatch } = useEditorStore();
  const { scene, selection, expandedGroups } = state;
  const { groups, ungroupedEntities } = summarizeSceneGroups(scene);

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
        {Object.values(scene.behaviors).map((behavior) => (
          <button
            key={behavior.id}
            className={`list-item ${isSelected('behavior', behavior.id) ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'select', selection: { kind: 'behavior', id: behavior.id } })}
            type="button"
          >
            {behavior.name ?? behavior.id}
          </button>
        ))}
      </div>
      <div className="panel-section">
        <div className="panel-heading">Actions</div>
        {Object.values(scene.actions).map((action) => (
          <button
            key={action.id}
            className={`list-item ${isSelected('action', action.id) ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'select', selection: { kind: 'action', id: action.id } })}
            type="button"
          >
            {action.name ?? action.id} · {action.type}
          </button>
        ))}
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

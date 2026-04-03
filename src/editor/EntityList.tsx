import { useEditorStore } from './EditorStore';

export function EntityList() {
  const { state, dispatch } = useEditorStore();
  const { scene, selection } = state;

  const isSelected = (kind: string, id: string): boolean =>
    selection.kind !== 'none' && selection.kind === kind && selection.id === id;

  return (
    <div className="panel">
      <div className="panel-title">Scene</div>
      <div className="panel-section">
        <div className="panel-heading">Groups</div>
        {Object.values(scene.groups).map((group) => (
          <button
            key={group.id}
            className={`list-item ${isSelected('group', group.id) ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'select', selection: { kind: 'group', id: group.id } })}
            type="button"
          >
            {group.name ?? group.id}
          </button>
        ))}
      </div>
      <div className="panel-section">
        <div className="panel-heading">Entities</div>
        {Object.values(scene.entities).map((entity) => (
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

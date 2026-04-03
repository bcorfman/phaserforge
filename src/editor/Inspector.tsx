import type { ReactNode } from 'react';
import { useEditorStore } from './EditorStore';
import { ActionSpec, ConditionSpec, MoveUntilActionSpec, CallActionSpec, WaitActionSpec, RepeatActionSpec, SequenceActionSpec, BoundsHitConditionSpec, ElapsedTimeConditionSpec } from '../model/types';

export function Inspector() {
  const { state, dispatch } = useEditorStore();
  const { selection, scene } = state;

  const updateAction = (next: ActionSpec) =>
    dispatch({ type: 'update-action', id: next.id, next });
  const updateCondition = (next: ConditionSpec) =>
    dispatch({ type: 'update-condition', id: next.id, next });

  let content: ReactNode = null;

  if (selection.kind === 'action') {
    const action = scene.actions[selection.id];
    if (!action) {
      content = <div className="muted">Action not found.</div>;
    } else {
      content = renderActionInspector(action, updateAction);
    }
  } else if (selection.kind === 'condition') {
    const condition = scene.conditions[selection.id];
    if (!condition) {
      content = <div className="muted">Condition not found.</div>;
    } else {
      content = renderConditionInspector(condition, updateCondition);
    }
  } else if (selection.kind === 'behavior') {
    const behavior = scene.behaviors[selection.id];
    content = behavior ? (
      <div className="inspector-block">
        <div className="inspector-title">{behavior.name ?? behavior.id}</div>
        <div className="inspector-row">Target: {behavior.target.type}</div>
        <div className="inspector-row">Root Action: {behavior.rootActionId}</div>
      </div>
    ) : (
      <div className="muted">Behavior not found.</div>
    );
  } else if (selection.kind === 'group') {
    const group = scene.groups[selection.id];
    content = group ? (
      <div className="inspector-block">
        <div className="inspector-title">{group.name ?? group.id}</div>
        <div className="inspector-row">Members: {group.members.length}</div>
      </div>
    ) : (
      <div className="muted">Group not found.</div>
    );
  } else if (selection.kind === 'entity') {
    const entity = scene.entities[selection.id];
    content = entity ? (
      <div className="inspector-block">
        <div className="inspector-title">{entity.name ?? entity.id}</div>
        <div className="inspector-row">Position: {Math.round(entity.x)}, {Math.round(entity.y)}</div>
        <div className="inspector-row">Size: {entity.width} x {entity.height}</div>
      </div>
    ) : (
      <div className="muted">Entity not found.</div>
    );
  } else {
    content = <div className="muted">Select an item to edit.</div>;
  }

  return (
    <div className="panel">
      <div className="panel-title">Inspector</div>
      {content}
    </div>
  );
}

function renderActionInspector(action: ActionSpec, onChange: (next: ActionSpec) => void) {
  switch (action.type) {
    case 'MoveUntil':
      return renderMoveUntil(action, onChange);
    case 'Wait':
      return renderWait(action, onChange);
    case 'Call':
      return renderCall(action, onChange);
    case 'Repeat':
      return renderRepeat(action, onChange);
    case 'Sequence':
      return renderSequence(action);
    default:
      return <div className="muted">Unsupported action.</div>;
  }
}

function renderMoveUntil(action: MoveUntilActionSpec, onChange: (next: ActionSpec) => void) {
  return (
    <div className="inspector-block">
      <div className="inspector-title">{action.name ?? action.id}</div>
      <label className="field">
        <span>Velocity X</span>
        <input
          type="number"
          value={action.velocity.x}
          onChange={(e) =>
            onChange({ ...action, velocity: { ...action.velocity, x: Number(e.target.value) } })
          }
        />
      </label>
      <label className="field">
        <span>Velocity Y</span>
        <input
          type="number"
          value={action.velocity.y}
          onChange={(e) =>
            onChange({ ...action, velocity: { ...action.velocity, y: Number(e.target.value) } })
          }
        />
      </label>
      <div className="inspector-row">Condition: {action.conditionId}</div>
    </div>
  );
}

function renderWait(action: WaitActionSpec, onChange: (next: ActionSpec) => void) {
  return (
    <div className="inspector-block">
      <div className="inspector-title">{action.name ?? action.id}</div>
      <label className="field">
        <span>Duration (ms)</span>
        <input
          type="number"
          value={action.durationMs}
          onChange={(e) => onChange({ ...action, durationMs: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}

function renderCall(action: CallActionSpec, onChange: (next: ActionSpec) => void) {
  const dy = action.args?.dy ?? 0;
  return (
    <div className="inspector-block">
      <div className="inspector-title">{action.name ?? action.id}</div>
      <div className="inspector-row">Call: {action.callId}</div>
      <label className="field">
        <span>Drop Distance</span>
        <input
          type="number"
          value={dy}
          onChange={(e) =>
            onChange({
              ...action,
              args: { ...(action.args ?? {}), dy: Number(e.target.value) },
            })
          }
        />
      </label>
      {action.target && (
        <div className="inspector-row">Target: {action.target.type}</div>
      )}
    </div>
  );
}

function renderRepeat(action: RepeatActionSpec, onChange: (next: ActionSpec) => void) {
  return (
    <div className="inspector-block">
      <div className="inspector-title">{action.name ?? action.id}</div>
      <label className="field">
        <span>Count (empty = infinite)</span>
        <input
          type="number"
          value={action.count ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            onChange({ ...action, count: raw === '' ? undefined : Number(raw) });
          }}
        />
      </label>
      <div className="inspector-row">Child: {action.childId}</div>
    </div>
  );
}

function renderSequence(action: SequenceActionSpec) {
  return (
    <div className="inspector-block">
      <div className="inspector-title">{action.name ?? action.id}</div>
      <div className="inspector-row">Children:</div>
      <div className="muted">{action.children.join(', ')}</div>
    </div>
  );
}

function renderConditionInspector(
  condition: ConditionSpec,
  onChange: (next: ConditionSpec) => void
) {
  switch (condition.type) {
    case 'BoundsHit':
      return renderBoundsCondition(condition, onChange);
    case 'ElapsedTime':
      return renderElapsedCondition(condition, onChange);
    default:
      return <div className="muted">Unsupported condition.</div>;
  }
}

function renderBoundsCondition(
  condition: BoundsHitConditionSpec,
  onChange: (next: ConditionSpec) => void
) {
  return (
    <div className="inspector-block">
      <div className="inspector-title">{condition.id}</div>
      <label className="field">
        <span>Min X</span>
        <input
          type="number"
          value={condition.bounds.minX}
          onChange={(e) =>
            onChange({
              ...condition,
              bounds: { ...condition.bounds, minX: Number(e.target.value) },
            })
          }
        />
      </label>
      <label className="field">
        <span>Max X</span>
        <input
          type="number"
          value={condition.bounds.maxX}
          onChange={(e) =>
            onChange({
              ...condition,
              bounds: { ...condition.bounds, maxX: Number(e.target.value) },
            })
          }
        />
      </label>
      <label className="field">
        <span>Min Y</span>
        <input
          type="number"
          value={condition.bounds.minY}
          onChange={(e) =>
            onChange({
              ...condition,
              bounds: { ...condition.bounds, minY: Number(e.target.value) },
            })
          }
        />
      </label>
      <label className="field">
        <span>Max Y</span>
        <input
          type="number"
          value={condition.bounds.maxY}
          onChange={(e) =>
            onChange({
              ...condition,
              bounds: { ...condition.bounds, maxY: Number(e.target.value) },
            })
          }
        />
      </label>
      <label className="field">
        <span>Mode</span>
        <select
          value={condition.mode}
          onChange={(e) => onChange({ ...condition, mode: e.target.value as 'any' | 'all' })}
        >
          <option value="any">Any</option>
          <option value="all">All</option>
        </select>
      </label>
    </div>
  );
}

function renderElapsedCondition(
  condition: ElapsedTimeConditionSpec,
  onChange: (next: ConditionSpec) => void
) {
  return (
    <div className="inspector-block">
      <div className="inspector-title">{condition.id}</div>
      <label className="field">
        <span>Duration (ms)</span>
        <input
          type="number"
          value={condition.durationMs}
          onChange={(e) => onChange({ ...condition, durationMs: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}

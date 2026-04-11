import { useMemo, useState } from 'react';
import { type EditorRegistryConfig, type Id, type SceneSpec, type TargetRef } from '../model/types';
import { getAssignableBehaviors, getPrimaryBehaviorForTarget, getSequenceChildren } from './behaviorCommands';

export function TargetActionPanel({
  scene,
  target,
  selectedActionId,
  registry,
  onAssignFlow,
  onAssignExistingBehavior,
  onRenameBehavior,
  onRemoveBehavior,
  onAddAction,
  onMoveAction,
  onRemoveAction,
  onSelectBehavior,
  onSelectAction,
}: {
  scene: SceneSpec;
  target: TargetRef;
  selectedActionId?: Id;
  registry: EditorRegistryConfig;
  onAssignFlow: () => void;
  onAssignExistingBehavior: (behaviorId: Id) => void;
  onRenameBehavior: (behaviorId: Id, name: string) => void;
  onRemoveBehavior: () => void;
  onAddAction: (type: 'MoveUntil' | 'Wait' | 'Call') => void;
  onMoveAction: (sequenceId: Id, childId: Id, direction: 'up' | 'down') => void;
  onRemoveAction: (sequenceId: Id, childId: Id) => void;
  onSelectBehavior: (behaviorId: Id) => void;
  onSelectAction: (actionId: Id) => void;
}) {
  const behavior = getPrimaryBehaviorForTarget(scene, target);
  const assignableBehaviors = getAssignableBehaviors(scene, target);
  const [selectedBehaviorId, setSelectedBehaviorId] = useState(assignableBehaviors[0]?.id ?? '');
  const sequenceActions = behavior ? getSequenceChildren(scene, behavior.id) : [];
  const rootSequenceId = useMemo(() => {
    if (!behavior) return '';
    const root = scene.actions[behavior.rootActionId];
    if (!root) return '';
    if (root.type === 'Sequence') return root.id;
    if (root.type === 'Repeat') {
      const sequence = scene.actions[root.childId];
      return sequence?.type === 'Sequence' ? sequence.id : '';
    }
    return '';
  }, [behavior, scene.actions]);
  const supportedActionEntries = registry.actions.filter(
    (entry) => entry.implemented && (entry.type === 'MoveUntil' || entry.type === 'Wait' || entry.type === 'Call')
  );

  return (
    <div className="inspector-block" data-testid="target-action-panel">
      <div className="inspector-title">Action Flow</div>
      {!behavior ? (
        <>
          <div className="inspector-row">
            Assign a reusable action flow to this {target.type === 'group' ? 'formation' : 'sprite'}.
          </div>
          <button
            className="button"
            data-testid="assign-action-flow-button"
            type="button"
            onClick={onAssignFlow}
          >
            Assign Action Flow
          </button>
          {assignableBehaviors.length > 0 && (
            <>
              <label className="field">
                <span>Reuse Existing Flow</span>
                <select
                  aria-label="Existing behavior"
                  data-testid="existing-behavior-select"
                  value={selectedBehaviorId}
                  onChange={(event) => setSelectedBehaviorId(event.target.value)}
                >
                  {assignableBehaviors.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name ?? entry.id}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button"
                data-testid="assign-existing-behavior-button"
                type="button"
                onClick={() => selectedBehaviorId && onAssignExistingBehavior(selectedBehaviorId)}
              >
                Use Existing Flow
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <label className="field">
            <span>Flow Name</span>
            <input
              aria-label="Flow Name"
              data-testid="behavior-name-input"
              type="text"
              value={behavior.name ?? ''}
              onChange={(event) => onRenameBehavior(behavior.id, event.target.value)}
            />
          </label>
          <div className="member-row">
            <button
              className="button"
              data-testid="open-behavior-button"
              type="button"
              onClick={() => onSelectBehavior(behavior.id)}
            >
              Open Behavior
            </button>
            <button
              className="button"
              data-testid="remove-action-flow-button"
              type="button"
              onClick={onRemoveBehavior}
            >
              Remove Flow
            </button>
          </div>
          <div className="inspector-row">
            Root sequence actions run on the selected {target.type === 'group' ? 'formation' : 'sprite'}.
          </div>
          {target.type === 'group' && (
            <div className="inspector-row">
              If this formation is dissolved, its flow retargets to the first remaining member.
            </div>
          )}
          <div className="panel-heading">Add Actions</div>
          <div className="member-tags">
            {supportedActionEntries.map((entry) => (
              <button
                key={entry.type}
                className="tag-button"
                data-testid={`add-action-${entry.type}`}
                type="button"
                onClick={() => onAddAction(entry.type as 'MoveUntil' | 'Wait' | 'Call')}
              >
                {entry.displayName}
              </button>
            ))}
          </div>
          <div className="panel-heading">Sequence</div>
          <div className="inspector-row" data-testid="action-flow-sequence-note">
            Preview runs this list from Step 1. Selecting a later step edits it, but preview still starts at the top.
          </div>
          {sequenceActions.length === 0 && (
            <div className="muted">No actions yet. Add a step to build this flow.</div>
          )}
          <div className="member-list">
            {sequenceActions.map((action, index) => (
              <div key={action.id} className="member-row">
                <button
                  className="tag-button"
                  data-testid={`action-flow-open-${action.id}`}
                  type="button"
                  onClick={() => onSelectAction(action.id)}
                >
                  {selectedActionId === action.id ? 'Selected' : `Step ${index + 1}`} · {action.name ?? action.id} · {action.type}
                </button>
                <button
                  className="tag-button"
                  data-testid={`action-flow-move-up-${action.id}`}
                  disabled={index === 0}
                  type="button"
                  onClick={() => rootSequenceId && onMoveAction(rootSequenceId, action.id, 'up')}
                >
                  Up
                </button>
                <button
                  className="tag-button"
                  data-testid={`action-flow-move-down-${action.id}`}
                  disabled={index === sequenceActions.length - 1}
                  type="button"
                  onClick={() => rootSequenceId && onMoveAction(rootSequenceId, action.id, 'down')}
                >
                  Down
                </button>
                <button
                  className="tag-button tag-button-danger"
                  data-testid={`action-flow-remove-${action.id}`}
                  type="button"
                  onClick={() => rootSequenceId && onRemoveAction(rootSequenceId, action.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { useEditorStore } from './EditorStore';
import { summarizeGridLayout } from './grouping';
import { inferGroupGridLayout, type GroupGridLayout } from './formationLayout';
import { ActionSpec, ConditionSpec, MoveUntilActionSpec, CallActionSpec, WaitActionSpec, RepeatActionSpec, SequenceActionSpec, BoundsHitConditionSpec, ElapsedTimeConditionSpec, GroupSpec, SceneSpec } from '../model/types';

export function Inspector() {
  const { state, dispatch } = useEditorStore();
  const { selection, scene, interaction } = state;
  const [pinDuringDrag, setPinDuringDrag] = useState(false);

  const updateAction = (next: ActionSpec) =>
    dispatch({ type: 'update-action', id: next.id, next });
  const updateCondition = (next: ConditionSpec) =>
    dispatch({ type: 'update-condition', id: next.id, next });
  const updateGroup = (next: GroupSpec) =>
    dispatch({ type: 'update-group', id: next.id, next });
  const arrangeGroupGrid = (id: string, layout: GroupGridLayout) =>
    dispatch({ type: 'arrange-group-grid', id, layout });

  let content: ReactNode = null;

  // Show drag information during interactions
  if (interaction && !pinDuringDrag) {
    if (interaction.kind === 'entity') {
      const entity = scene.entities[interaction.id];
      content = entity ? (
        <div className="inspector-block">
          <div className="inspector-title">Dragging: {entity.name ?? entity.id}</div>
          <div className="inspector-row">Position: {Math.round(entity.x)}, {Math.round(entity.y)}</div>
          <div className="inspector-row">Size: {entity.width} x {entity.height}</div>
        </div>
      ) : null;
    } else if (interaction.kind === 'group') {
      const group = scene.groups[interaction.id];
      content = group ? (
        <div className="inspector-block">
          <div className="inspector-title">Dragging: {group.name ?? group.id}</div>
          <div className="inspector-row">Members: {group.members.length}</div>
        </div>
      ) : null;
    } else if (interaction.kind === 'bounds') {
      const condition = scene.conditions[interaction.id] as BoundsHitConditionSpec;
      content = condition ? (
        <div className="inspector-block">
          <div className="inspector-title">Dragging: Bounds</div>
          <div className="inspector-row">Min: {condition.bounds.minX}, {condition.bounds.minY}</div>
          <div className="inspector-row">Max: {condition.bounds.maxX}, {condition.bounds.maxY}</div>
        </div>
      ) : null;
    }
  }

  // If no interaction content, show normal selection content
  if (!content) {
    if (selection.kind === 'action') {
    const action = scene.actions[selection.id];
    if (!action) {
      content = <div className="muted">Action not found.</div>;
    } else {
      content = renderActionInspector(action, scene, updateAction, updateCondition);
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
    const members = group?.members.map((memberId) => scene.entities[memberId]).filter(Boolean) ?? [];
    content = group ? (
      <GroupInspector
        group={group}
        scene={scene}
        onSelectMember={(id) => dispatch({ type: 'select', selection: { kind: 'entity', id } })}
        onRemoveMember={(entityId) => dispatch({ type: 'remove-entity-from-group', groupId: group.id, entityId })}
        onUpdateGroup={updateGroup}
        onArrangeGroupGrid={arrangeGroupGrid}
      />
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
  }

  return (
    <div className="panel" data-testid="inspector">
      <div className="panel-title">Inspector</div>
      <label className="inspector-toggle">
        <input
          aria-label="Pin selection while dragging"
          data-testid="pin-selection-checkbox"
          type="checkbox"
          checked={pinDuringDrag}
          onChange={(e) => setPinDuringDrag(e.target.checked)}
        />
        <span>Pin selection while dragging</span>
      </label>
      {content}
    </div>
  );
}

function GroupInspector({
  group,
  scene,
  onSelectMember,
  onRemoveMember,
  onUpdateGroup,
  onArrangeGroupGrid,
}: {
  group: GroupSpec;
  scene: SceneSpec;
  onSelectMember: (id: string) => void;
  onRemoveMember: (id: string) => void;
  onUpdateGroup: (next: GroupSpec) => void;
  onArrangeGroupGrid: (id: string, layout: GroupGridLayout) => void;
}) {
  const inferredLayout = inferGroupGridLayout(scene, group.id);
  const [draft, setDraft] = useState<GroupGridLayout | undefined>(inferredLayout);

  useEffect(() => {
    setDraft(inferredLayout);
  }, [inferredLayout?.rows, inferredLayout?.cols, inferredLayout?.startX, inferredLayout?.startY, inferredLayout?.spacingX, inferredLayout?.spacingY, group.id]);

  const canApplyGrid = Boolean(draft);

  return (
    renderGroupInspector(group, scene, draft, canApplyGrid, {
      onSelectMember,
      onRemoveMember,
      onUpdateGroup,
      onArrangeGroupGrid,
      onDraftChange: setDraft,
    })
  );
}

export function renderGroupInspector(
  group: GroupSpec,
  scene: SceneSpec,
  draft: GroupGridLayout | undefined,
  canApplyGrid: boolean,
  handlers: {
    onSelectMember: (id: string) => void;
    onRemoveMember: (id: string) => void;
    onUpdateGroup: (next: GroupSpec) => void;
    onArrangeGroupGrid: (id: string, layout: GroupGridLayout) => void;
    onDraftChange: (next: GroupGridLayout) => void;
  }
) {
  const members = group.members.map((memberId) => scene.entities[memberId]).filter(Boolean);
  const layoutSummary = summarizeGridLayout(members);

  return (
    <div className="inspector-block">
      <div className="inspector-title" data-testid="inspector-title">{group.name ?? group.id}</div>
      <label className="field">
        <span>Formation Name</span>
        <input
          aria-label="Formation Name"
          data-testid="formation-name-input"
          type="text"
          value={group.name ?? ''}
          onChange={(e) => handlers.onUpdateGroup({ ...group, name: e.target.value })}
        />
      </label>
      <div className="inspector-row">Members: {group.members.length}</div>
      <div className="inspector-row">
        Layout: {layoutSummary.kind === 'grid' ? `${layoutSummary.rows} x ${layoutSummary.cols} grid` : 'Freeform'}
      </div>
      {draft ? (
        <div className="inline-boundary-editor">
          <div className="panel-heading">Arrange Grid</div>
          <label className="field">
            <span>Rows</span>
            <input
              aria-label="Rows"
              data-testid="group-layout-rows-input"
              type="number"
              min={1}
              value={draft.rows}
              onChange={(e) => handlers.onDraftChange({ ...draft, rows: Math.max(1, Number(e.target.value) || 1) })}
            />
          </label>
          <label className="field">
            <span>Cols</span>
            <input
              aria-label="Cols"
              data-testid="group-layout-cols-input"
              type="number"
              min={1}
              value={draft.cols}
              onChange={(e) => handlers.onDraftChange({ ...draft, cols: Math.max(1, Number(e.target.value) || 1) })}
            />
          </label>
          <label className="field">
            <span>Start X</span>
            <input
              aria-label="Start X"
              data-testid="group-layout-start-x-input"
              type="number"
              value={draft.startX}
              onChange={(e) => handlers.onDraftChange({ ...draft, startX: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Start Y</span>
            <input
              aria-label="Start Y"
              data-testid="group-layout-start-y-input"
              type="number"
              value={draft.startY}
              onChange={(e) => handlers.onDraftChange({ ...draft, startY: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Spacing X</span>
            <input
              aria-label="Spacing X"
              data-testid="group-layout-spacing-x-input"
              type="number"
              value={draft.spacingX}
              onChange={(e) => handlers.onDraftChange({ ...draft, spacingX: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Spacing Y</span>
            <input
              aria-label="Spacing Y"
              data-testid="group-layout-spacing-y-input"
              type="number"
              value={draft.spacingY}
              onChange={(e) => handlers.onDraftChange({ ...draft, spacingY: Number(e.target.value) })}
            />
          </label>
          <div className="inspector-row">
            Grid size will become {draft.rows * draft.cols} sprites.
          </div>
          <button
            className="button"
            data-testid="apply-group-layout-button"
            disabled={!canApplyGrid}
            onClick={() => draft && handlers.onArrangeGroupGrid(group.id, draft)}
            type="button"
          >
            Apply Formation Layout
          </button>
        </div>
      ) : (
        <div className="muted">No editable layout could be inferred for this formation.</div>
      )}
      <div className="inspector-row">Member sprites are read-only here. Select one only to inspect it.</div>
      <div className="member-list">
        {members.map((member) => (
          <div key={member.id} className="member-row">
            <button
              className="tag-button"
              data-testid={`group-member-select-${member.id}`}
              type="button"
              onClick={() => handlers.onSelectMember(member.id)}
            >
              {member.name ?? member.id}
            </button>
            <button
              className="tag-button tag-button-danger"
              data-testid={`group-member-remove-${member.id}`}
              type="button"
              onClick={() => handlers.onRemoveMember(member.id)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderActionInspector(
  action: ActionSpec,
  scene: { conditions: Record<string, ConditionSpec> },
  onChange: (next: ActionSpec) => void,
  onConditionChange: (next: ConditionSpec) => void
) {
  switch (action.type) {
    case 'MoveUntil':
      return renderMoveUntil(action, scene, onChange, onConditionChange);
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

export function renderMoveUntilInspector(
  action: MoveUntilActionSpec,
  scene: { conditions: Record<string, ConditionSpec> },
  onChange: (next: ActionSpec) => void,
  onConditionChange: (next: ConditionSpec) => void
) {
  return renderMoveUntil(action, scene, onChange, onConditionChange);
}

function renderMoveUntil(
  action: MoveUntilActionSpec,
  scene: { conditions: Record<string, ConditionSpec> },
  onChange: (next: ActionSpec) => void,
  onConditionChange: (next: ConditionSpec) => void
) {
  const linkedCondition = scene.conditions[action.conditionId];
  const boundsCondition = linkedCondition?.type === 'BoundsHit' ? linkedCondition : undefined;

  return (
    <div className="inspector-block">
      <div className="inspector-title">{action.name ?? action.id}</div>
      <label className="field">
        <span>Velocity X</span>
        <input
          aria-label="Velocity X"
          data-testid="velocity-x-input"
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
          aria-label="Velocity Y"
          data-testid="velocity-y-input"
          type="number"
          value={action.velocity.y}
          onChange={(e) =>
            onChange({ ...action, velocity: { ...action.velocity, y: Number(e.target.value) } })
          }
        />
      </label>
      <div className="inspector-row">Condition: {action.conditionId}</div>
      {boundsCondition && (
        <div className="inline-boundary-editor">
          <div className="panel-heading">Boundary Limits</div>
          <div className="inspector-row">
            {describeBoundaryScope(boundsCondition.scope)} · {describeBoundaryBehavior(boundsCondition.behavior)}
          </div>
          {renderBoundsCondition(boundsCondition, onConditionChange)}
        </div>
      )}
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
      <label className="field">
        <span>Scope</span>
        <select
          value={condition.scope ?? 'member-any'}
          onChange={(e) =>
            onChange({
              ...condition,
              scope: e.target.value as BoundsHitConditionSpec['scope'],
            })
          }
        >
          <option value="member-any">member-any</option>
          <option value="member-all">member-all</option>
          <option value="group-extents">group-extents</option>
        </select>
      </label>
      <div className="inspector-row">{describeBoundaryScope(condition.scope)}</div>
      <label className="field">
        <span>Behavior</span>
        <select
          value={condition.behavior ?? 'stop'}
          onChange={(e) =>
            onChange({
              ...condition,
              behavior: e.target.value as BoundsHitConditionSpec['behavior'],
            })
          }
        >
          <option value="stop">stop</option>
          <option value="limit">limit</option>
          <option value="bounce">bounce</option>
          <option value="wrap">wrap</option>
        </select>
      </label>
      <div className="inspector-row">{describeBoundaryBehavior(condition.behavior)}</div>
    </div>
  );
}

function describeBoundaryScope(scope: BoundsHitConditionSpec['scope']): string {
  switch (scope ?? 'member-any') {
    case 'group-extents':
      return 'Formation Edges';
    case 'member-all':
      return 'Every Member';
    case 'member-any':
    default:
      return 'Any Member';
  }
}

function describeBoundaryBehavior(behavior: BoundsHitConditionSpec['behavior']): string {
  switch (behavior ?? 'stop') {
    case 'limit':
      return 'Clamp at Edge';
    case 'bounce':
      return 'Bounce Back';
    case 'wrap':
      return 'Wrap Around';
    case 'stop':
    default:
      return 'Stop on Contact';
  }
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

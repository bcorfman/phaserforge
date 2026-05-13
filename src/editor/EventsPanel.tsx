import { useMemo, useState } from 'react';
import type { AttachmentSpec, AttachmentTriggerSpec, EditorRegistryConfig, EventBlockSpec, Id, ProjectSpec, SceneSpec, TargetRef } from '../model/types';
import { type AttachedActionRow, buildAttachedActionRowsForTargetAndEvent } from './attachmentCommands';
import { getTargetLabel } from './attachmentCommands';

const SUPPORTED_PRESETS = new Set([
  'MoveUntil',
  'MoveXUntil',
  'MoveYUntil',
  'Wait',
  'Call',
  'EmitEvent',
  'Repeat',
  'BlinkUntil',
  'CallbackUntil',
  'CycleFramesUntil',
  'AddToCounter',
  'SetCounter',
  'ClampCounter',
  'AddSelfToCollection',
  'RemoveSelfFromCollection',
]);

function targetsEqual(a: TargetRef, b: TargetRef): boolean {
  if (a.type !== b.type) return false;
  return a.type === 'entity'
    ? a.entityId === (b as any).entityId
    : a.groupId === (b as any).groupId;
}

function listInputActionIds(project: ProjectSpec): string[] {
  const ids = new Set<string>();
  for (const map of Object.values(project.inputMaps ?? {})) {
    for (const id of Object.keys(map.actions ?? {})) ids.add(id);
  }
  return Array.from(ids).sort((a, b) => a.localeCompare(b));
}

export function EventsPanel({
  project,
  scene,
  target,
  selectedAttachmentId,
  registry,
  onCreateEventBlock,
  onUpdateEventBlock,
  onRemoveEventBlock,
  onAddAttachment,
  onSelectAttachment,
  onMoveAttachment,
  onRemoveAttachment,
  onMakeParallel,
  onUngroupParallel,
  onMoveParallelGroup,
  onCreateSnippetFromAttachments,
  onApplySnippet,
  onCreateMacroFromAttachments,
  onApplyMacro,
}: {
  project: ProjectSpec;
  scene: SceneSpec;
  target: TargetRef;
  selectedAttachmentId?: Id;
  registry: EditorRegistryConfig;
  onCreateEventBlock: (opts?: { name?: string; trigger?: AttachmentTriggerSpec }) => void;
  onUpdateEventBlock: (next: EventBlockSpec) => void;
  onRemoveEventBlock: (eventId: Id) => void;
  onAddAttachment: (presetId: string, init: Partial<AttachmentSpec>) => void;
  onSelectAttachment: (attachmentId: Id) => void;
  onMoveAttachment: (attachmentId: Id, direction: 'up' | 'down') => void;
  onRemoveAttachment: (attachmentId: Id) => void;
  onMakeParallel: (attachmentIds: Id[]) => void;
  onUngroupParallel: (groupId: string, eventId?: Id) => void;
  onMoveParallelGroup: (groupId: string, direction: 'up' | 'down', eventId?: Id) => void;
  onCreateSnippetFromAttachments: (attachmentIds: Id[], name?: string) => void;
  onApplySnippet: (snippetId: Id, eventId?: Id) => void;
  onCreateMacroFromAttachments: (attachmentIds: Id[], name?: string) => void;
  onApplyMacro: (macroId: Id, eventId?: Id) => void;
}) {
  const [tab, setTab] = useState<'blocks' | 'map'>('blocks');
  const eventBlocks = useMemo(() => {
    const blocks = Object.values(scene.eventBlocks ?? {}).filter((b) => targetsEqual((b as any).target, target)) as EventBlockSpec[];
    return blocks.sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
  }, [scene.eventBlocks, target]);

  const supportedPresetEntries = useMemo(
    () => registry.actions.filter((entry) => entry.implemented && SUPPORTED_PRESETS.has(entry.type)),
    [registry.actions]
  );

  const inputActionIds = useMemo(() => listInputActionIds(project), [project]);

  if (tab === 'map') {
    return (
      <div className="inspector-block" data-testid="events-panel">
        <div className="inspector-title">Events</div>
        <div className="inspector-row">
          <button className={tab === 'blocks' ? 'tag-button' : 'tag-button'} type="button" onClick={() => setTab('blocks')}>
            Blocks
          </button>
          <button className={tab === 'map' ? 'tag-button' : 'tag-button'} type="button" onClick={() => setTab('map')}>
            Map
          </button>
        </div>
        <EventWiringMap
          project={project}
          scene={scene}
          selectedTarget={target}
          onCreateHandlerEventBlock={(eventName) => onCreateEventBlock({ name: `On ${eventName}`, trigger: { type: 'event', eventName } as any })}
          onSelectAttachment={onSelectAttachment}
        />
      </div>
    );
  }

  return (
    <div className="inspector-block" data-testid="events-panel">
      <div className="inspector-title">Events</div>
      <div className="inspector-row">
        <button className="tag-button" type="button" onClick={() => setTab('blocks')}>
          Blocks
        </button>
        <button className="tag-button" type="button" onClick={() => setTab('map')}>
          Map
        </button>
      </div>
      <div className="inspector-row">
        <button className="button" data-testid="add-event-block" type="button" onClick={() => onCreateEventBlock()}>
          + Add Event
        </button>
      </div>
      <EventBlockCard
        key="__legacy__"
        block={{ id: '__legacy__', name: 'On Start (Legacy)', target, trigger: { type: 'start' } } as any}
        project={project}
        scene={scene}
        target={target}
        supportedPresetEntries={supportedPresetEntries}
        selectedAttachmentId={selectedAttachmentId}
        inputActionIds={inputActionIds}
        onUpdateEventBlock={() => {}}
        onRemoveEventBlock={() => {}}
        onAddAttachment={(presetId, init) => onAddAttachment(presetId, { ...init, eventId: undefined })}
        onSelectAttachment={onSelectAttachment}
        onMoveAttachment={onMoveAttachment}
        onRemoveAttachment={onRemoveAttachment}
        onMakeParallel={onMakeParallel}
        onUngroupParallel={(groupId) => onUngroupParallel(groupId, undefined)}
        onMoveParallelGroup={(groupId, direction) => onMoveParallelGroup(groupId, direction, undefined)}
        onCreateSnippetFromAttachments={onCreateSnippetFromAttachments}
        onApplySnippet={onApplySnippet}
        onCreateMacroFromAttachments={onCreateMacroFromAttachments}
        onApplyMacro={onApplyMacro}
        hideEventControls
        eventIdForRows={undefined}
      />

      {eventBlocks.length === 0 && <div className="muted">No custom events yet. Add an event to start building event-driven behaviors.</div>}
      {eventBlocks.map((block) => (
        <EventBlockCard
          key={block.id}
          block={block}
          project={project}
          scene={scene}
          target={target}
          supportedPresetEntries={supportedPresetEntries}
          selectedAttachmentId={selectedAttachmentId}
          inputActionIds={inputActionIds}
          onUpdateEventBlock={onUpdateEventBlock}
          onRemoveEventBlock={onRemoveEventBlock}
          onAddAttachment={onAddAttachment}
          onSelectAttachment={onSelectAttachment}
          onMoveAttachment={onMoveAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onMakeParallel={onMakeParallel}
          onUngroupParallel={onUngroupParallel}
          onMoveParallelGroup={onMoveParallelGroup}
          onCreateSnippetFromAttachments={onCreateSnippetFromAttachments}
          onApplySnippet={onApplySnippet}
          onCreateMacroFromAttachments={onCreateMacroFromAttachments}
          onApplyMacro={onApplyMacro}
          eventIdForRows={block.id}
        />
      ))}
    </div>
  );
}

function EventWiringMap({
  project,
  scene,
  selectedTarget,
  onCreateHandlerEventBlock,
  onSelectAttachment,
}: {
  project: ProjectSpec;
  scene: SceneSpec;
  selectedTarget: TargetRef;
  onCreateHandlerEventBlock: (eventName: string) => void;
  onSelectAttachment: (attachmentId: Id) => void;
}) {
  const { events, emittersByEvent, handlersByEvent } = useMemo(() => {
    const emittersByEvent = new Map<string, Array<{ attachmentId: Id; target: TargetRef; eventId?: Id }>>();
    const handlersByEvent = new Map<string, Array<{ eventBlockId: Id; target: TargetRef }>>();

    for (const attachment of Object.values(scene.attachments ?? {})) {
      if (attachment.presetId !== 'EmitEvent') continue;
      const eventName = typeof attachment.params?.eventName === 'string' ? String(attachment.params.eventName) : '';
      if (!eventName) continue;
      const list = emittersByEvent.get(eventName) ?? [];
      list.push({ attachmentId: attachment.id, target: attachment.target, eventId: attachment.eventId });
      emittersByEvent.set(eventName, list);
    }

    for (const block of Object.values(scene.eventBlocks ?? {})) {
      const trigger = (block as any).trigger;
      if (!trigger || trigger.type !== 'event') continue;
      const eventName = String(trigger.eventName ?? '');
      if (!eventName) continue;
      const list = handlersByEvent.get(eventName) ?? [];
      list.push({ eventBlockId: (block as any).id, target: (block as any).target });
      handlersByEvent.set(eventName, list);
    }

    const events = Array.from(new Set([...emittersByEvent.keys(), ...handlersByEvent.keys()])).sort((a, b) => a.localeCompare(b));
    return { events, emittersByEvent, handlersByEvent };
  }, [scene.attachments, scene.eventBlocks]);

  const selectedTargetLabel = getTargetLabel(scene, selectedTarget);
  const knownInputIds = useMemo(() => listInputActionIds(project), [project]);

  return (
    <div>
      <div className="muted">Scene-level map. Create handlers on selected target: {selectedTargetLabel}</div>
      {knownInputIds.length === 0 ? null : null}
      {events.length === 0 ? (
        <div className="muted">No emitted or handled events yet. Add an Emit Event action or an On Event trigger.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <div className="panel-heading">Emitters</div>
            {events.map((eventName) => {
              const emitters = emittersByEvent.get(eventName) ?? [];
              return (
                <div key={`emitters-${eventName}`} className="inspector-block" style={{ marginTop: 10 }}>
                  <strong>{eventName}</strong>
                  {emitters.length === 0 ? <div className="muted">None</div> : null}
                  {emitters.map((e) => (
                    <div key={e.attachmentId} className="member-row">
                      <button className="tag-button" type="button" onClick={() => onSelectAttachment(e.attachmentId)}>
                        {getTargetLabel(scene, e.target)} · {e.eventId ? `Event ${e.eventId}` : 'On Start'} · EmitEvent
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <div>
            <div className="panel-heading">Events</div>
            {events.map((eventName) => (
              <div key={`events-${eventName}`} className="inspector-block" style={{ marginTop: 10 }}>
                <strong>{eventName}</strong>
                <div className="inspector-row">
                  <button className="tag-button" type="button" onClick={() => onCreateHandlerEventBlock(eventName)}>
                    Create handler on {selectedTargetLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="panel-heading">Handlers</div>
            {events.map((eventName) => {
              const handlers = handlersByEvent.get(eventName) ?? [];
              return (
                <div key={`handlers-${eventName}`} className="inspector-block" style={{ marginTop: 10 }}>
                  <strong>{eventName}</strong>
                  {handlers.length === 0 ? <div className="muted">None</div> : null}
                  {handlers.map((h) => (
                    <div key={h.eventBlockId} className="member-row">
                      <span className="muted">{getTargetLabel(scene, h.target)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EventBlockCard({
  block,
  project,
  scene,
  target,
  supportedPresetEntries,
  selectedAttachmentId,
  inputActionIds,
  onUpdateEventBlock,
  onRemoveEventBlock,
  onAddAttachment,
  onSelectAttachment,
  onMoveAttachment,
  onRemoveAttachment,
  onMakeParallel,
  onUngroupParallel,
  onMoveParallelGroup,
  onCreateSnippetFromAttachments,
  onApplySnippet,
  onCreateMacroFromAttachments,
  onApplyMacro,
  hideEventControls,
  eventIdForRows,
}: {
  block: EventBlockSpec;
  project: ProjectSpec;
  scene: SceneSpec;
  target: TargetRef;
  supportedPresetEntries: Array<{ type: string; displayName: string }>;
  selectedAttachmentId?: Id;
  inputActionIds: string[];
  onUpdateEventBlock: (next: EventBlockSpec) => void;
  onRemoveEventBlock: (eventId: Id) => void;
  onAddAttachment: (presetId: string, init: Partial<AttachmentSpec>) => void;
  onSelectAttachment: (attachmentId: Id) => void;
  onMoveAttachment: (attachmentId: Id, direction: 'up' | 'down') => void;
  onRemoveAttachment: (attachmentId: Id) => void;
  onMakeParallel: (attachmentIds: Id[]) => void;
  onUngroupParallel: (groupId: string, eventId?: Id) => void;
  onMoveParallelGroup: (groupId: string, direction: 'up' | 'down', eventId?: Id) => void;
  onCreateSnippetFromAttachments: (attachmentIds: Id[], name?: string) => void;
  onApplySnippet: (snippetId: Id, eventId?: Id) => void;
  onCreateMacroFromAttachments: (attachmentIds: Id[], name?: string) => void;
  onApplyMacro: (macroId: Id, eventId?: Id) => void;
  hideEventControls?: boolean;
  eventIdForRows: Id | undefined;
}) {
  const trigger = block.trigger ?? { type: 'start' as const };
  const rootRows = buildAttachedActionRowsForTargetAndEvent(scene, target, eventIdForRows);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<Set<Id>>(() => new Set());
  const [selectedParallelGroupId, setSelectedParallelGroupId] = useState<string | null>(null);
  const [expandedParallelGroups, setExpandedParallelGroups] = useState<Set<string>>(() => new Set());
  const [collapsedRepeats, setCollapsedRepeats] = useState<Set<string>>(() => new Set());

  const selectedCount = selectedParallelGroupId ? 1 : selectedAttachmentIds.size;
  const clearSelection = () => {
    setSelectedAttachmentIds(new Set());
    setSelectedParallelGroupId(null);
  };
  const toggleSelected = (id: Id) => {
    setSelectedParallelGroupId(null);
    setSelectedAttachmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleExpanded = (groupId: string) => {
    setExpandedParallelGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };
  const toggleRepeatCollapsed = (attachmentId: string) => {
    setCollapsedRepeats((prev) => {
      const next = new Set(prev);
      if (next.has(attachmentId)) next.delete(attachmentId);
      else next.add(attachmentId);
      return next;
    });
  };

  const removeSelected = () => {
    if (selectedParallelGroupId) {
      const findGroup = (parentAttachmentId: Id | undefined): AttachedActionRow | undefined => {
        const rows = buildAttachedActionRowsForTargetAndEvent(scene, target, eventIdForRows, parentAttachmentId);
        const found = rows.find((r) => r.kind === 'parallel-group' && r.groupId === selectedParallelGroupId);
        if (found) return found;
        for (const row of rows) {
          if (row.kind !== 'attachment') continue;
          const attachment: any = row.attachment;
          if (attachment.presetId !== 'Repeat' || !Array.isArray(attachment.children) || attachment.children.length === 0) continue;
          const nested = findGroup(attachment.id);
          if (nested) return nested;
        }
        return undefined;
      };
      const group = findGroup(undefined);
      if (group && group.kind === 'parallel-group') {
        for (const attachment of group.attachments) onRemoveAttachment(attachment.id);
      }
      clearSelection();
      return;
    }
    for (const id of selectedAttachmentIds) onRemoveAttachment(id);
    clearSelection();
  };

  const convertSelectionToSnippet = () => {
    const ids = selectedParallelGroupId
      ? (() => {
          const findGroupAttachments = (parentAttachmentId: Id | undefined): AttachmentSpec[] | undefined => {
            const rows = buildAttachedActionRowsForTargetAndEvent(scene, target, eventIdForRows, parentAttachmentId);
            const found = rows.find((r) => r.kind === 'parallel-group' && r.groupId === selectedParallelGroupId);
            if (found && found.kind === 'parallel-group') return found.attachments;
            for (const row of rows) {
              if (row.kind !== 'attachment') continue;
              const attachment: any = row.attachment;
              if (attachment.presetId !== 'Repeat' || !Array.isArray(attachment.children) || attachment.children.length === 0) continue;
              const nested = findGroupAttachments(attachment.id);
              if (nested) return nested;
            }
            return undefined;
          };
          return (findGroupAttachments(undefined) ?? []).map((a) => a.id);
        })()
      : Array.from(selectedAttachmentIds);
    if (ids.length === 0) return;
    const defaultName = `Snippet ${Object.keys(project.snippets ?? {}).length + 1}`;
    const name = window.prompt('Snippet name', defaultName) ?? undefined;
    onCreateSnippetFromAttachments(ids, name ?? undefined);
    clearSelection();
  };
  const convertSelectionToMacro = () => {
    const ids = selectedParallelGroupId
      ? (() => {
          const findGroupAttachments = (parentAttachmentId: Id | undefined): AttachmentSpec[] | undefined => {
            const rows = buildAttachedActionRowsForTargetAndEvent(scene, target, eventIdForRows, parentAttachmentId);
            const found = rows.find((r) => r.kind === 'parallel-group' && r.groupId === selectedParallelGroupId);
            if (found && found.kind === 'parallel-group') return found.attachments;
            for (const row of rows) {
              if (row.kind !== 'attachment') continue;
              const attachment: any = row.attachment;
              if (attachment.presetId !== 'Repeat' || !Array.isArray(attachment.children) || attachment.children.length === 0) continue;
              const nested = findGroupAttachments(attachment.id);
              if (nested) return nested;
            }
            return undefined;
          };
          return (findGroupAttachments(undefined) ?? []).map((a) => a.id);
        })()
      : Array.from(selectedAttachmentIds);
    if (ids.length === 0) return;
    const defaultName = `Macro ${Object.keys(project.macros ?? {}).length + 1}`;
    const name = window.prompt('Macro name', defaultName) ?? undefined;
    onCreateMacroFromAttachments(ids, name ?? undefined);
    clearSelection();
  };

  const renderAttachmentRow = (
    attachment: any,
    indexLabel: string,
    opts: { disableUp: boolean; disableDown: boolean }
  ) => (
    <div key={attachment.id} className="member-row">
      <input
        aria-label={`Select attachment ${attachment.id}`}
        checked={selectedAttachmentIds.has(attachment.id)}
        onChange={() => toggleSelected(attachment.id)}
        type="checkbox"
      />
      <button
        className="tag-button"
        data-testid={`attachment-open-${attachment.id}`}
        type="button"
        onClick={() => onSelectAttachment(attachment.id)}
      >
        {selectedAttachmentId === attachment.id ? 'Selected' : indexLabel} · {attachment.name ?? attachment.id} · {attachment.presetId}
      </button>
      <button
        className="tag-button"
        data-testid={`attachment-move-up-${attachment.id}`}
        disabled={opts.disableUp}
        type="button"
        onClick={() => onMoveAttachment(attachment.id, 'up')}
      >
        Up
      </button>
      <button
        className="tag-button"
        data-testid={`attachment-move-down-${attachment.id}`}
        disabled={opts.disableDown}
        type="button"
        onClick={() => onMoveAttachment(attachment.id, 'down')}
      >
        Down
      </button>
      <button
        className="tag-button tag-button-danger"
        data-testid={`attachment-remove-${attachment.id}`}
        type="button"
        onClick={() => onRemoveAttachment(attachment.id)}
      >
        Remove
      </button>
    </div>
  );

  const triggerType = trigger.type ?? 'start';
  const triggerEdge = trigger.edge ?? (triggerType === 'visible' ? 'shown' : triggerType === 'input_action' ? 'pressed' : undefined);
  const triggerActionId = trigger.actionId ?? (inputActionIds[0] ?? '');
  const triggerEventName = (trigger as any).eventName ?? '';
  const knownEventNames = useMemo(() => {
    const names = new Set<string>();
    for (const attachment of Object.values(scene.attachments ?? {})) {
      if (attachment.presetId !== 'EmitEvent') continue;
      const name = typeof attachment.params?.eventName === 'string' ? String(attachment.params.eventName) : '';
      if (name) names.add(name);
    }
    for (const eb of Object.values(scene.eventBlocks ?? {})) {
      const t = (eb as any).trigger;
      if (t?.type === 'event' && typeof t.eventName === 'string' && t.eventName) names.add(String(t.eventName));
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [scene.attachments, scene.eventBlocks]);

  return (
    <div className="inspector-block" style={{ marginTop: 10 }} data-testid={`event-block-${block.id}`}>
      <div className="member-row" style={{ justifyContent: 'space-between' }}>
        <strong>{block.name ?? `Event ${block.id}`}</strong>
        {!hideEventControls && (
          <button className="tag-button tag-button-danger" type="button" onClick={() => onRemoveEventBlock(block.id)}>
            Remove Event
          </button>
        )}
      </div>
      {!hideEventControls && (
        <label className="field">
          <span>Name</span>
          <input
            aria-label="Event Name"
            type="text"
            value={block.name ?? ''}
            onChange={(e) => onUpdateEventBlock({ ...block, name: e.target.value || undefined })}
          />
        </label>
      )}
      <div className="inspector-grid-2">
        {!hideEventControls ? (
          <label className="field">
            <span>Trigger</span>
            <select
              aria-label="Event Trigger"
              value={triggerType}
              onChange={(e) => {
                const type = e.target.value as any;
                if (type === 'start') onUpdateEventBlock({ ...block, trigger: { type: 'start' } });
                else if (type === 'update') onUpdateEventBlock({ ...block, trigger: { type: 'update' } });
                else if (type === 'visible') onUpdateEventBlock({ ...block, trigger: { type: 'visible', edge: 'shown' } });
                else if (type === 'event') onUpdateEventBlock({ ...block, trigger: { type: 'event', eventName: triggerEventName || 'Event.Name' } as any });
                else onUpdateEventBlock({ ...block, trigger: { type: 'input_action', actionId: triggerActionId, edge: 'pressed' } });
              }}
            >
              <option value="start">On Start</option>
              <option value="update">On Update</option>
              <option value="input_action">On Input Action</option>
              <option value="visible">On Visible Changed</option>
              <option value="event">On Event</option>
            </select>
          </label>
        ) : (
          <div />
        )}

        {!hideEventControls && triggerType === 'input_action' ? (
          <label className="field">
            <span>Action</span>
            <select
              aria-label="Input Action Id"
              value={triggerActionId}
              onChange={(e) => onUpdateEventBlock({ ...block, trigger: { type: 'input_action', actionId: e.target.value, edge: (triggerEdge as any) ?? 'pressed' } })}
            >
              {inputActionIds.length === 0 && <option value="">(no input actions)</option>}
              {inputActionIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </label>
        ) : !hideEventControls && triggerType === 'event' ? (
          <label className="field">
            <span>Event</span>
            <input
              aria-label="Event Name"
              list={`event-names-${block.id}`}
              type="text"
              value={triggerEventName}
              onChange={(e) => onUpdateEventBlock({ ...block, trigger: { type: 'event', eventName: e.target.value } as any })}
            />
            <datalist id={`event-names-${block.id}`}>
              {knownEventNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
        ) : !hideEventControls && triggerType === 'visible' ? (
          <label className="field">
            <span>Edge</span>
            <select
              aria-label="Visible Edge"
              value={triggerEdge ?? 'shown'}
              onChange={(e) => onUpdateEventBlock({ ...block, trigger: { type: 'visible', edge: e.target.value as any } })}
            >
              <option value="shown">Shown</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>
        ) : <div />}
      </div>

      <div className="panel-heading">Add Action</div>
      <div className="member-tags">
        {supportedPresetEntries.map((entry) => (
          <button
            key={entry.type}
            className="tag-button"
            type="button"
            data-testid={hideEventControls ? `add-attachment-${entry.type}` : `add-event-attachment-${block.id}-${entry.type}`}
            onClick={() => {
              const init: Partial<AttachmentSpec> = { eventId: block.id };
              if (entry.type === 'Call') init.condition = { type: 'Instant' } as any;
              onAddAttachment(entry.type, init);
            }}
          >
            {entry.displayName}
          </button>
        ))}
      </div>

      <div className="panel-heading">Steps</div>
      {rootRows.length === 0 && <div className="muted">No actions yet.</div>}
      {selectedCount > 0 && (
        <div className="inspector-row" data-testid="event-actions-selection-bar">
          <span>{selectedCount} selected</span>{' '}
          {selectedParallelGroupId ? (
                <button className="tag-button" type="button" onClick={() => onUngroupParallel(selectedParallelGroupId, eventIdForRows ?? (block.id as any))}>
              Ungroup
            </button>
          ) : (
            selectedCount >= 2 && (
              <button
                className="tag-button"
                type="button"
                onClick={() => onMakeParallel(Array.from(selectedAttachmentIds))}
              >
                Make Parallel
              </button>
            )
          )}
          <button className="tag-button" type="button" onClick={() => clearSelection()}>
            Cancel
          </button>
          <button className="tag-button" type="button" onClick={() => convertSelectionToSnippet()}>
            Convert → Snippet
          </button>
          <button className="tag-button" type="button" onClick={() => convertSelectionToMacro()}>
            Convert → Macro
          </button>
          <button className="tag-button tag-button-danger" type="button" onClick={() => removeSelected()}>
            Remove
          </button>
        </div>
      )}

      <div className="panel-heading">Snippets</div>
      {Object.keys(project.snippets ?? {}).length === 0 ? (
        <div className="muted">No snippets yet. Select steps and convert to a snippet.</div>
      ) : (
        <div className="member-tags">
          {Object.values(project.snippets ?? {})
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((snippet) => (
              <button
                key={snippet.id}
                className="tag-button"
                type="button"
                onClick={() => onApplySnippet(snippet.id, eventIdForRows)}
              >
                Apply: {snippet.name}
              </button>
            ))}
        </div>
      )}

      <div className="panel-heading">Macros</div>
      {Object.keys(project.macros ?? {}).length === 0 ? (
        <div className="muted">No macros yet. Select steps and convert to a macro.</div>
      ) : (
        <div className="member-tags">
          {Object.values(project.macros ?? {})
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((macro) => (
              <button
                key={macro.id}
                className="tag-button"
                type="button"
                onClick={() => onApplyMacro(macro.id, eventIdForRows)}
              >
                Apply: {macro.name}
              </button>
            ))}
        </div>
      )}

      <div className="member-list">
        {(() => {
          const renderRows = (parentAttachmentId: Id | undefined, depth: number): JSX.Element[] => {
            const rows = buildAttachedActionRowsForTargetAndEvent(scene, target, eventIdForRows, parentAttachmentId);
            return rows.flatMap((row, rowIndex) => {
              if (row.kind === 'attachment') {
                const attachment: any = row.attachment;
                const isRepeat = attachment.presetId === 'Repeat' && Array.isArray(attachment.children) && attachment.children.length > 0;
                const indexLabel = `Step ${rowIndex + 1}`;
                const base = (
                  <div key={attachment.id} style={{ paddingLeft: depth * 18 }}>
                    {isRepeat ? (
                      <div className="member-row">
                        <button className="tag-button" type="button" onClick={() => toggleRepeatCollapsed(attachment.id)}>
                          {collapsedRepeats.has(attachment.id) ? '▸' : '▾'} Repeat
                        </button>
                        <span className="muted" style={{ marginLeft: 8 }}>Add child:</span>
                        {supportedPresetEntries
                          .filter((entry) => entry.type !== 'Repeat')
                          .slice(0, 3)
                          .map((entry) => (
                            <button
                              key={`add-child-${attachment.id}-${entry.type}`}
                              className="tag-button"
                              type="button"
                              onClick={() => onAddAttachment(entry.type, { eventId: block.id, parentAttachmentId: attachment.id })}
                            >
                              + {entry.displayName}
                            </button>
                          ))}
                      </div>
                    ) : null}
                    {renderAttachmentRow(attachment, indexLabel, {
                      disableUp: rowIndex === 0,
                      disableDown: rowIndex === rows.length - 1,
                    })}
                  </div>
                );
                if (!isRepeat || collapsedRepeats.has(attachment.id)) return [base];
                return [base, ...renderRows(attachment.id, depth + 1)];
              }

              const isExpanded = expandedParallelGroups.has(row.groupId);
              const header = (
                <div key={`parallel-${row.groupId}`} style={{ paddingLeft: depth * 18 }}>
                  <div className="member-row">
                    <input
                      aria-label={`Select parallel group ${row.groupId}`}
                      checked={selectedParallelGroupId === row.groupId}
                      onChange={() => {
                        setSelectedAttachmentIds(new Set());
                        setSelectedParallelGroupId((prev) => (prev === row.groupId ? null : row.groupId));
                      }}
                      type="checkbox"
                    />
                    <button className="tag-button" type="button" onClick={() => toggleExpanded(row.groupId)}>
                      {isExpanded ? '▾' : '▸'} Parallel · {row.attachments.length} actions
                    </button>
                    <button className="tag-button" type="button" onClick={() => onUngroupParallel(row.groupId, block.id)}>
                      Ungroup
                    </button>
                    <button
                      className="tag-button"
                      disabled={rowIndex === 0}
                      type="button"
                      onClick={() => onMoveParallelGroup(row.groupId, 'up', eventIdForRows ?? (block.id as any))}
                    >
                      Up
                    </button>
                    <button
                      className="tag-button"
                      disabled={rowIndex === rows.length - 1}
                      type="button"
                      onClick={() => onMoveParallelGroup(row.groupId, 'down', eventIdForRows ?? (block.id as any))}
                    >
                      Down
                    </button>
                  </div>
                  {isExpanded &&
                    row.attachments.map((attachment) => (
                      <div key={attachment.id} className="member-row" style={{ paddingLeft: 18 }}>
                        <button className="tag-button" type="button" onClick={() => onSelectAttachment(attachment.id)}>
                          • {attachment.name ?? attachment.id} · {attachment.presetId}
                        </button>
                      </div>
                    ))}
                </div>
              );
              return [header];
            });
          };

          return renderRows(undefined, 0);
        })()}
      </div>
    </div>
  );
}

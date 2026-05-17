import { useEffect, useMemo, useRef, useState } from 'react';
import type { AttachmentSpec, AttachmentTriggerSpec, EditorRegistryConfig, EventBlockSpec, Id, ParamSpec, PatternSpec, ProjectSpec, SceneSpec, TargetRef } from '../model/types';
import { type AttachedActionRow, buildAttachedActionRowsForTargetAndEvent } from './attachmentCommands';
import { getTargetLabel } from './attachmentCommands';
import { ActionLibraryDrawer } from './ActionLibraryDrawer';
import { loadPinnedActionTypes, togglePinnedActionType } from './actionPins';
import { loadPinnedPatternIds, togglePinnedPatternId } from './patternPins';

const SUPPORTED_PRESETS = new Set([
  'MoveUntil',
  'MoveXUntil',
  'MoveYUntil',
  'WavePattern',
  'ZigzagPattern',
  'FigureEightPattern',
  'SpiralPattern',
  'OrbitPattern',
  'BouncePattern',
  'PatrolPattern',
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
  onReorderAttachments,
  onRemoveAttachment,
  onMakeParallel,
  onUngroupParallel,
  onMoveParallelGroup,
  onCreatePatternFromAttachments,
  onApplyPattern,
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
  onReorderAttachments: (opts: { target: TargetRef; eventId: Id | undefined; parentAttachmentId: Id | undefined; orderedAttachmentIds: Id[] }) => void;
  onRemoveAttachment: (attachmentId: Id) => void;
  onMakeParallel: (attachmentIds: Id[]) => void;
  onUngroupParallel: (groupId: string, eventId?: Id) => void;
  onMoveParallelGroup: (groupId: string, direction: 'up' | 'down', eventId?: Id) => void;
  onCreatePatternFromAttachments: (attachmentIds: Id[], name?: string) => void;
  onApplyPattern: (patternId: Id, eventId: Id | undefined, bindings: Record<Id, unknown>) => void;
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
      <div data-testid="events-panel">
        <div className="sidebar-scope-tabs" role="tablist" aria-label="Actions/Events Scope">
          <button className={`button ${tab === 'blocks' ? 'active' : ''}`} type="button" role="tab" aria-selected={tab === 'blocks'} onClick={() => setTab('blocks')}>
            Handlers
          </button>
          <button className={`button ${tab === 'map' ? 'active' : ''}`} type="button" role="tab" aria-selected={tab === 'map'} onClick={() => setTab('map')}>
            Wiring
          </button>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          Create event handlers and edit the action steps they run.
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
    <div data-testid="events-panel">
      <div className="sidebar-scope-tabs" role="tablist" aria-label="Actions/Events Scope">
        <button className={`button ${tab === 'blocks' ? 'active' : ''}`} type="button" role="tab" aria-selected={tab === 'blocks'} onClick={() => setTab('blocks')}>
          Handlers
        </button>
        <button className={`button ${tab === 'map' ? 'active' : ''}`} type="button" role="tab" aria-selected={tab === 'map'} onClick={() => setTab('map')}>
          Wiring
        </button>
      </div>
      <div className="muted" style={{ marginTop: 8 }}>
        Create event handlers and edit the action steps they run.
      </div>
      <div className="inspector-row">
        <button className="button button-compact" data-testid="add-event-block" type="button" onClick={() => onCreateEventBlock()}>
          + Add Event
        </button>
      </div>
      <EventBlockCard
        key="__legacy__"
        block={{ id: '__legacy__', name: 'OnSceneStart', target, trigger: { type: 'start' } } as any}
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
        onReorderAttachments={(opts) => onReorderAttachments({ ...opts, eventId: undefined })}
        onRemoveAttachment={onRemoveAttachment}
        onMakeParallel={onMakeParallel}
        onUngroupParallel={(groupId) => onUngroupParallel(groupId, undefined)}
        onMoveParallelGroup={(groupId, direction) => onMoveParallelGroup(groupId, direction, undefined)}
        onCreatePatternFromAttachments={onCreatePatternFromAttachments}
        onApplyPattern={onApplyPattern}
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
          onReorderAttachments={onReorderAttachments}
          onRemoveAttachment={onRemoveAttachment}
          onMakeParallel={onMakeParallel}
          onUngroupParallel={onUngroupParallel}
          onMoveParallelGroup={onMoveParallelGroup}
          onCreatePatternFromAttachments={onCreatePatternFromAttachments}
          onApplyPattern={onApplyPattern}
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
                        {getTargetLabel(scene, e.target)} · {e.eventId ? `Event ${e.eventId}` : 'OnSceneStart'} · EmitEvent
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
  onReorderAttachments,
  onRemoveAttachment,
  onMakeParallel,
  onUngroupParallel,
  onMoveParallelGroup,
  onCreatePatternFromAttachments,
  onApplyPattern,
  hideEventControls,
  eventIdForRows,
}: {
  block: EventBlockSpec;
  project: ProjectSpec;
  scene: SceneSpec;
  target: TargetRef;
  supportedPresetEntries: Array<{ type: string; displayName: string; category?: string }>;
  selectedAttachmentId?: Id;
  inputActionIds: string[];
  onUpdateEventBlock: (next: EventBlockSpec) => void;
  onRemoveEventBlock: (eventId: Id) => void;
  onAddAttachment: (presetId: string, init: Partial<AttachmentSpec>) => void;
  onSelectAttachment: (attachmentId: Id) => void;
  onMoveAttachment: (attachmentId: Id, direction: 'up' | 'down') => void;
  onReorderAttachments: (opts: { target: TargetRef; eventId: Id | undefined; parentAttachmentId: Id | undefined; orderedAttachmentIds: Id[] }) => void;
  onRemoveAttachment: (attachmentId: Id) => void;
  onMakeParallel: (attachmentIds: Id[]) => void;
  onUngroupParallel: (groupId: string, eventId?: Id) => void;
  onMoveParallelGroup: (groupId: string, direction: 'up' | 'down', eventId?: Id) => void;
  onCreatePatternFromAttachments: (attachmentIds: Id[], name?: string) => void;
  onApplyPattern: (patternId: Id, eventId: Id | undefined, bindings: Record<Id, unknown>) => void;
  hideEventControls?: boolean;
  eventIdForRows: Id | undefined;
}) {
  const trigger = block.trigger ?? { type: 'start' as const };
  const rootRows = buildAttachedActionRowsForTargetAndEvent(scene, target, eventIdForRows);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<Set<Id>>(() => new Set());
  const [selectedParallelGroupId, setSelectedParallelGroupId] = useState<string | null>(null);
  const [expandedParallelGroups, setExpandedParallelGroups] = useState<Set<string>>(() => new Set());
  const [collapsedRepeats, setCollapsedRepeats] = useState<Set<string>>(() => new Set());
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerCategory, setDrawerCategory] = useState<string>('All');
  const [pinnedTypes, setPinnedTypes] = useState<Set<string>>(() => new Set(loadPinnedActionTypes()));
  const [pinnedPatternIds, setPinnedPatternIds] = useState<Set<string>>(() => new Set(loadPinnedPatternIds()));
  const [drawerAnchorRect, setDrawerAnchorRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [draggingRow, setDraggingRow] = useState<{ kind: 'attachment' | 'parallel-group'; id: string; parentAttachmentId: Id | undefined } | null>(null);
  const [applyPatternPrompt, setApplyPatternPrompt] = useState<{
    patternId: Id;
    bindings: Record<Id, string | boolean>;
  } | null>(null);
  const [overflowMenu, setOverflowMenu] = useState<{ kind: 'attachment'; attachmentId: Id } | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!overflowMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = menuRootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setOverflowMenu(null);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [overflowMenu]);

  useEffect(() => {
    if (!drawerOpen) return;
    const update = () => {
      const rect = addButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDrawerAnchorRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [drawerOpen]);

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

  const convertSelectionToPattern = () => {
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
    const defaultName = `Pattern ${Object.keys(project.patterns ?? {}).length + 1}`;
    const name = window.prompt('Pattern name', defaultName) ?? undefined;
    onCreatePatternFromAttachments(ids, name ?? undefined);
    clearSelection();
  };

  const renderAttachmentRow = (
    attachment: any,
    indexLabel: string,
    opts: { disableDrag: boolean; parentAttachmentId: Id | undefined }
  ) => (
    <div key={attachment.id} className="member-row">
      <input
        aria-label={`Select attachment ${attachment.id}`}
        checked={selectedAttachmentIds.has(attachment.id)}
        onChange={() => toggleSelected(attachment.id)}
        type="checkbox"
      />
      <button
        aria-label="Reorder step"
        className="scene-graph-button"
        data-testid={`attachment-drag-${attachment.id}`}
        disabled={opts.disableDrag}
        draggable={!opts.disableDrag}
        type="button"
        onDragStart={(e) => {
          setDraggingRow({ kind: 'attachment', id: attachment.id, parentAttachmentId: opts.parentAttachmentId });
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', attachment.id);
        }}
        onDragEnd={() => setDraggingRow(null)}
        title={opts.disableDrag ? 'Drag disabled' : 'Drag to reorder'}
      >
        ⋮⋮
      </button>
      <button
        className="list-item"
        data-testid={`attachment-open-${attachment.id}`}
        type="button"
        onClick={() => onSelectAttachment(attachment.id)}
      >
        {selectedAttachmentId === attachment.id ? 'Selected' : indexLabel} · {attachment.name ?? attachment.id} · {attachment.presetId}
      </button>
      <button
        aria-label={`More options for step ${attachment.name ?? attachment.id}`}
        className="scene-graph-button"
        data-testid={`attachment-menu-${attachment.id}`}
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          setMenuPosition({ x: Math.min(rect.left, window.innerWidth - 220), y: rect.bottom + 6 });
          setOverflowMenu({ kind: 'attachment', attachmentId: attachment.id });
        }}
      >
        ⋯
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

  const patternsSorted = useMemo(
    () => Object.values(project.patterns ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [project.patterns]
  );

  const pickPreset = (presetId: string) => {
    const init: Partial<AttachmentSpec> = { eventId: block.id };
    if (presetId === 'Call') init.condition = { type: 'Instant' } as any;
    onAddAttachment(presetId, init);
    setDrawerOpen(false);
  };

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
              <option value="start">OnSceneStart</option>
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

      <div className="panel-heading-row">
        <div className="panel-heading" />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1 }}>
          <button
            ref={addButtonRef}
            className={`button button-compact ${drawerOpen ? 'active' : ''}`}
            type="button"
            data-testid={hideEventControls ? 'event-add-open' : `event-add-open-${block.id}`}
            onClick={() => {
              setPinnedTypes(new Set(loadPinnedActionTypes()));
              setPinnedPatternIds(new Set(loadPinnedPatternIds()));
              const rect = addButtonRef.current?.getBoundingClientRect();
              if (rect) setDrawerAnchorRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
              setDrawerOpen(true);
            }}
          >
            + Add Action ▾
          </button>
        </div>
      </div>

      {(() => {
        const activePattern: PatternSpec | undefined = applyPatternPrompt ? (project.patterns ?? {})[applyPatternPrompt.patternId] : undefined;
        const validateParam = (param: ParamSpec, value: string | boolean | undefined): string | undefined => {
          const hasDefault = param.default !== undefined;
          if (param.type === 'boolean') return undefined;
          const s = typeof value === 'string' ? value : '';
          if (s.trim().length === 0 && !hasDefault) return 'Required';
          if (param.type === 'number') {
            const n = Number(s);
            if (!Number.isFinite(n)) return 'Invalid number';
          }
          return undefined;
        };
        const promptErrors: Record<string, string> = {};
        if (activePattern) {
          for (const param of activePattern.params ?? []) {
            const raw = applyPatternPrompt?.bindings?.[param.id];
            const err = validateParam(param as any, raw);
            if (err) promptErrors[param.id] = err;
          }
        }
        const canApply = !activePattern || Object.keys(promptErrors).length === 0;

        return (
          <>
            {applyPatternPrompt && activePattern && (
              <div className="inspector-block" data-testid="pattern-apply-prompt" style={{ marginTop: 10 }}>
                <div className="panel-heading">Apply Pattern: {activePattern.name}</div>
                {(activePattern.params ?? []).map((param) => {
                  const value = applyPatternPrompt.bindings[param.id];
                  const error = promptErrors[param.id];
                  if (param.type === 'boolean') {
                    return (
                      <label key={param.id} className="field">
                        <span>{param.name}</span>
                        <input
                          aria-label={`Pattern param ${param.id}`}
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={(e) => setApplyPatternPrompt((prev) => prev ? ({ ...prev, bindings: { ...prev.bindings, [param.id]: e.target.checked } }) : prev)}
                        />
                      </label>
                    );
                  }
                  return (
                    <label key={param.id} className="field">
                      <span>{param.name}</span>
                      <input
                        aria-label={`Pattern param ${param.id}`}
                        className="text-input"
                        type={param.type === 'number' ? 'number' : 'text'}
                        value={typeof value === 'string' ? value : (param.default != null ? String(param.default) : '')}
                        onChange={(e) =>
                          setApplyPatternPrompt((prev) =>
                            prev ? ({ ...prev, bindings: { ...prev.bindings, [param.id]: e.target.value } }) : prev
                          )
                        }
                      />
                      {error ? <div className="muted">{error}</div> : null}
                    </label>
                  );
                })}
                <div className="inspector-row" style={{ gap: 10 }}>
                  <button
                    className="button"
                    type="button"
                    disabled={!canApply}
                    onClick={() => {
                      if (!activePattern) return;
                      const bindings = applyPatternPrompt.bindings ?? {};
                      onApplyPattern(activePattern.id, eventIdForRows, bindings);
                      setApplyPatternPrompt(null);
                      setAddMenuOpen(false);
                    }}
                  >
                    Apply
                  </button>
                  <button className="button" type="button" onClick={() => setApplyPatternPrompt(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Patterns are now in the Action Library drawer as a Category. */}
          </>
        );
      })()}

      <ActionLibraryDrawer
        open={drawerOpen}
        title="Action Library"
        actions={supportedPresetEntries}
        patterns={patternsSorted.map((p) => ({ id: p.id, name: p.name }))}
        pinnedTypes={pinnedTypes}
        onTogglePin={(type) => setPinnedTypes(new Set(togglePinnedActionType(type)))}
        pinnedPatternIds={pinnedPatternIds}
        onTogglePinnedPattern={(id) => setPinnedPatternIds(new Set(togglePinnedPatternId(id)))}
        selectedCategory={drawerCategory}
        onSelectCategory={setDrawerCategory}
        onPickAction={(type) => pickPreset(type)}
        onPickPattern={(patternId) => {
          const pattern = (project.patterns ?? {})[patternId];
          if (!pattern) return;
          if ((pattern.params ?? []).length > 0) {
            const initial: Record<Id, string | boolean> = {};
            for (const param of pattern.params ?? []) {
              if (param.type === 'boolean') initial[param.id] = Boolean(param.default);
              else if (param.default != null) initial[param.id] = String(param.default);
              else initial[param.id] = '';
            }
            setApplyPatternPrompt({ patternId: pattern.id, bindings: initial });
            setDrawerOpen(false);
            return;
          }
          onApplyPattern(pattern.id, eventIdForRows, {});
          setDrawerOpen(false);
        }}
        anchorRect={drawerAnchorRect}
        onClose={() => setDrawerOpen(false)}
      />

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
          <button className="tag-button" type="button" onClick={() => convertSelectionToPattern()}>
            Convert → Pattern
          </button>
          <button className="tag-button tag-button-danger" type="button" onClick={() => removeSelected()}>
            Remove
          </button>
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
                const childRows = isRepeat ? renderRows(attachment.id, depth + 1) : [];
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
                    <div
                      data-testid={`attachment-dropzone-${attachment.id}`}
                      onDragOver={(e) => {
                        if (!draggingRow) return;
                        if (draggingRow.parentAttachmentId !== parentAttachmentId) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        if (!draggingRow) return;
                        if (draggingRow.parentAttachmentId !== parentAttachmentId) return;
                        e.preventDefault();
                        const siblingRows = buildAttachedActionRowsForTargetAndEvent(scene, target, eventIdForRows, parentAttachmentId);
                        const fromIndex = siblingRows.findIndex((r) =>
                          draggingRow.kind === 'attachment'
                            ? r.kind === 'attachment' && r.attachment.id === draggingRow.id
                            : r.kind === 'parallel-group' && r.groupId === draggingRow.id
                        );
                        const toIndex = siblingRows.findIndex((r) => r.kind === 'attachment' && r.attachment.id === attachment.id);
                        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
                        const moved = siblingRows.splice(fromIndex, 1)[0];
                        siblingRows.splice(toIndex, 0, moved);
                        const orderedAttachmentIds = siblingRows.flatMap((r) => (r.kind === 'attachment' ? [r.attachment.id] : r.attachments.map((a) => a.id)));
                        onReorderAttachments({ target, eventId: eventIdForRows, parentAttachmentId, orderedAttachmentIds });
                      }}
                    >
                      {renderAttachmentRow(attachment, indexLabel, {
                        disableDrag: false,
                        parentAttachmentId,
                      })}
                    </div>
                  </div>
                );
                if (!isRepeat) return [base];
                if (collapsedRepeats.has(attachment.id)) return [base];
                return [base, ...childRows];
              }

              const isExpanded = expandedParallelGroups.has(row.groupId);
              const header = (
                <div
                  key={`parallel-${row.groupId}`}
                  style={{ paddingLeft: depth * 18 }}
                  onDragOver={(e) => {
                    if (!draggingRow) return;
                    if (draggingRow.parentAttachmentId !== parentAttachmentId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    if (!draggingRow) return;
                    if (draggingRow.parentAttachmentId !== parentAttachmentId) return;
                    e.preventDefault();
                    const siblingRows = buildAttachedActionRowsForTargetAndEvent(scene, target, eventIdForRows, parentAttachmentId);
                    const fromIndex = siblingRows.findIndex((r) =>
                      draggingRow.kind === 'attachment'
                        ? r.kind === 'attachment' && r.attachment.id === draggingRow.id
                        : r.kind === 'parallel-group' && r.groupId === draggingRow.id
                    );
                    const toIndex = siblingRows.findIndex((r) => r.kind === 'parallel-group' && r.groupId === row.groupId);
                    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
                    const moved = siblingRows.splice(fromIndex, 1)[0];
                    siblingRows.splice(toIndex, 0, moved);
                    const orderedAttachmentIds = siblingRows.flatMap((r) => (r.kind === 'attachment' ? [r.attachment.id] : r.attachments.map((a) => a.id)));
                    onReorderAttachments({ target, eventId: eventIdForRows, parentAttachmentId, orderedAttachmentIds });
                  }}
                >
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
                      aria-label="Reorder parallel group"
                      className="scene-graph-button"
                      data-testid={`parallel-group-drag-${row.groupId}`}
                      disabled={false}
                      draggable
                      type="button"
                      onDragStart={(e) => {
                        setDraggingRow({ kind: 'parallel-group', id: row.groupId, parentAttachmentId });
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', row.groupId);
                      }}
                      onDragEnd={() => setDraggingRow(null)}
                      title="Drag to reorder"
                    >
                      ⋮⋮
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

      {overflowMenu && menuPosition ? (
        <div
          ref={menuRootRef}
          className="scene-graph-menu"
          style={{ position: 'fixed', left: menuPosition.x, top: menuPosition.y, zIndex: 50, minWidth: 200 }}
          role="menu"
          data-testid="events-overflow-menu"
        >
          {overflowMenu.kind === 'attachment' ? (
            <>
              <div className="scene-graph-menu-hint">{overflowMenu.attachmentId}</div>
              <button
                type="button"
                className="scene-graph-menu-item"
                data-testid={`attachment-menu-open-${overflowMenu.attachmentId}`}
                onClick={() => {
                  onSelectAttachment(overflowMenu.attachmentId);
                  setOverflowMenu(null);
                }}
              >
                Open
              </button>
              <div className="scene-graph-menu-divider" />
              <button
                type="button"
                className="scene-graph-menu-item scene-graph-menu-danger"
                data-testid={`attachment-menu-remove-${overflowMenu.attachmentId}`}
                onClick={() => {
                  onRemoveAttachment(overflowMenu.attachmentId);
                  setOverflowMenu(null);
                }}
              >
                Remove…
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

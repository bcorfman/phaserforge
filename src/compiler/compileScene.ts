import { SceneSpec } from '../model/types';
import { resolveEntityDefaults } from '../model/entityDefaults';
import { validateSceneSpec } from '../model/validation';
import { ActionManager } from '../runtime/ActionManager';
import type { Action } from '../runtime/Action';
import { RuntimeEntity, RuntimeGroup } from '../runtime/targets/types';
import { createFormationGroup } from '../runtime/targets/createFormationGroup';
import { CompileOptions } from './compileBehaviors';
import { compileAttachments, type CompiledAttachmentScript } from './compileAttachments';
import { migrateSceneSpec } from '../model/migrateScene';
import type { BoundaryEvent } from '../runtime/boundaries/BoundaryEngine';
import type { TargetRef } from '../model/types';
import type { RuntimeEventEnvelope } from '../runtime/events';

interface RuntimeEventDebugEntry {
  family: RuntimeEventEnvelope['family'];
  type: string;
  outcome?: string;
  sourceId?: string;
  axis?: string;
  side?: string;
  occurrenceId: string;
  occurrenceOrder: number;
}

export interface CompiledScene {
  scene: SceneSpec;
  entities: Record<string, RuntimeEntity>;
  groups: Record<string, RuntimeGroup>;
  behaviors: Record<string, Action>;
  scripts: CompiledAttachmentScript[];
  actionManager: ActionManager;
  debug?: {
    pendingEvents: number;
    lastDrainedEventNames: string[];
    lastDrainedEvents: RuntimeEventDebugEntry[];
    lastStartedEventScriptKeys: string[];
    lastStartedEventContexts: RuntimeEventDebugEntry[];
  };
  startAll(): void;
  updateTriggers(dtMs: number): void;
  reset(): void;
}

export function compileScene(scene: SceneSpec, options?: CompileOptions): CompiledScene {
  const migrated = migrateSceneSpec(JSON.parse(JSON.stringify(scene)));
  validateSceneSpec(migrated);

  const entities: Record<string, RuntimeEntity> = {};
  for (const entity of Object.values(migrated.entities)) {
    const resolved = resolveEntityDefaults(entity);
    entities[entity.id] = {
      id: resolved.id,
      x: resolved.x,
      y: resolved.y,
      width: resolved.width,
      height: resolved.height,
      rotationDeg: resolved.rotationDeg,
      scaleX: resolved.scaleX,
      scaleY: resolved.scaleY,
      originX: resolved.originX,
      originY: resolved.originY,
      alpha: resolved.alpha,
      tint: resolved.tint,
      visible: resolved.visible,
      depth: resolved.depth,
      flipX: resolved.flipX,
      flipY: resolved.flipY,
      asset: resolved.asset,
      hitbox: resolved.hitbox,
      homeX: resolved.x,
      homeY: resolved.y,
      vx: 0,
      vy: 0,
    };
  }

  const groups: Record<string, RuntimeGroup> = {};
  for (const group of Object.values(migrated.groups)) {
    groups[group.id] = createFormationGroup(
      group.id,
      group.members.map((memberId) => entities[memberId])
    );
  }

  const actionManager = new ActionManager();

  type RuntimeEvent = RuntimeEventEnvelope & (
    | { family: 'custom'; sourceAttachment: { targetKey: string; eventId?: string } }
    | { family: 'bounds'; boundaryEvent: BoundaryEvent; sourceAttachment: { targetKey: string; eventId?: string } }
  );
  const eventQueue: RuntimeEvent[] = [];
  let nextEventOrder = 0;
  const nextOccurrence = () => {
    nextEventOrder += 1;
    return { id: `evt-${String(nextEventOrder).padStart(6, '0')}`, order: nextEventOrder };
  };
  const lastDrainedEventNames: string[] = [];
  const lastDrainedEvents: RuntimeEventDebugEntry[] = [];
  const lastStartedEventScriptKeys: string[] = [];
  const lastStartedEventContexts: RuntimeEventDebugEntry[] = [];
  const debug = {
    pendingEvents: 0,
    lastDrainedEventNames,
    lastDrainedEvents,
    lastStartedEventScriptKeys,
    lastStartedEventContexts,
  } satisfies NonNullable<CompiledScene['debug']>;
  const mergedOptions: CompileOptions = {
    ...(options ?? {}),
    events: {
      emit: (eventName, payload, source) => {
        eventQueue.push({
          family: 'custom',
          type: eventName,
          payload,
          source: { targetKey: source.targetKey, target: targetRefFromTargetKey(source.targetKey) },
          owner: { targetKey: source.targetKey, eventBlockId: source.eventId },
          occurrence: nextOccurrence(),
          sourceAttachment: source,
        });
      },
      emitBounds: (event, source) => {
        eventQueue.push({
          family: 'bounds',
          type: event.outcome,
          phase: event.outcome === 'contact-entered' || event.outcome === 'contact-exited' ? 'edge' : 'outcome',
          payload: { axis: event.axis, side: event.side },
          source: {
            targetKey: `entity:${event.source.id}`,
            target: { type: 'entity', entityId: event.source.id },
            entityId: event.source.id,
          },
          owner: { targetKey: source.targetKey, eventBlockId: source.eventId },
          occurrence: nextOccurrence(),
          details: {
            axis: event.axis,
            side: event.side,
            priorPosition: event.priorPosition,
            position: event.position,
          },
          boundaryEvent: event,
          sourceAttachment: source,
        });
      },
    },
  };

  const scripts = compileAttachments(migrated, { targets: { entities, groups }, options: mergedOptions });
  const behaviors: Record<string, Action> = Object.fromEntries(scripts.map((s) => [s.key, s.action]));

  const startAll = (): void => {
    for (const script of scripts) {
      const triggerType = script.trigger?.type ?? 'start';
      if (triggerType !== 'start') continue;
      script.action.reset?.();
      actionManager.add(script.action, { targetKey: script.targetKey, eventId: script.eventId });
    }
  };

  const lastVisibleByTargetKey = new Map<string, boolean>();
  const computeVisibleForTargetKey = (targetKey: string): boolean => {
    if (targetKey.startsWith('entity:')) {
      const id = targetKey.slice('entity:'.length);
      return entities[id]?.visible !== false;
    }
    if (targetKey.startsWith('group:')) {
      const id = targetKey.slice('group:'.length);
      const group = groups[id];
      if (!group) return true;
      const members = group.members ?? [];
      return members.some((m) => m.visible !== false);
    }
    return true;
  };

  for (const script of scripts) {
    if (!lastVisibleByTargetKey.has(script.targetKey)) {
      lastVisibleByTargetKey.set(script.targetKey, computeVisibleForTargetKey(script.targetKey));
    }
  }

  const updateTriggers = (_dtMs: number): void => {
    // Runtime event queue
    if (eventQueue.length > 0) {
      const drained = eventQueue.splice(0, eventQueue.length);
      lastDrainedEventNames.splice(
        0,
        lastDrainedEventNames.length,
        ...drained.map((e) => e.family === 'custom' ? e.type : `bounds:${e.type}`)
      );
      lastDrainedEvents.splice(
        0,
        lastDrainedEvents.length,
        ...drained.map((event) => summarizeRuntimeEvent(event))
      );
      lastStartedEventScriptKeys.splice(0, lastStartedEventScriptKeys.length);
      lastStartedEventContexts.splice(0, lastStartedEventContexts.length);
      for (const evt of drained) {
        for (const script of scripts) {
          if (evt.family === 'custom') {
            if (script.trigger?.type !== 'event') continue;
            if ((script.trigger as any).eventName !== evt.type) continue;
            if (actionManager.getActionsForTarget(script.targetKey, script.eventId).length > 0) continue;
            const eventSource = targetRefFromRuntimeEvent(evt);
            const action = script.createActionForEvent?.(eventSource) ?? script.action;
            action.reset?.();
            actionManager.add(action, { targetKey: script.targetKey, eventId: script.eventId, context: { event: evt } });
            lastStartedEventScriptKeys.push(script.key);
            lastStartedEventContexts.push(summarizeRuntimeEvent(evt));
            continue;
          }

          if (script.trigger?.type !== 'bounds') continue;
          if (!boundsTriggerMatches(script.trigger, evt.boundaryEvent)) continue;
          if (!boundsEventIsInScriptScope(script.targetKey, evt.boundaryEvent)) continue;
          const eventSource = targetRefFromBoundaryEvent(evt.boundaryEvent);
          const action = script.createActionForEvent?.(eventSource) ?? script.action;
          action.reset?.();
          actionManager.add(action, { targetKey: script.targetKey, eventId: script.eventId, context: { event: evt } });
          lastStartedEventScriptKeys.push(script.key);
          lastStartedEventContexts.push(summarizeRuntimeEvent(evt));
        }
      }
    }
    debug.pendingEvents = eventQueue.length;

    // Visibility edges
    for (const [targetKey, prev] of Array.from(lastVisibleByTargetKey.entries())) {
      const cur = computeVisibleForTargetKey(targetKey);
      lastVisibleByTargetKey.set(targetKey, cur);
      if (cur === prev) continue;
      const edge: 'shown' | 'hidden' = cur ? 'shown' : 'hidden';
      for (const script of scripts) {
        if (script.targetKey !== targetKey) continue;
        if (script.trigger?.type !== 'visible') continue;
        if (script.trigger.edge !== edge) continue;
        if (actionManager.getActionsForTarget(script.targetKey, script.eventId).length > 0) continue;
        script.action.reset?.();
        actionManager.add(script.action, { targetKey: script.targetKey, eventId: script.eventId });
      }
    }

    // Input action edges
    const input = options?.input;
    if (input) {
      for (const script of scripts) {
        if (script.trigger?.type !== 'input_action') continue;
        const actionId = script.trigger.actionId ?? '';
        const edge = script.trigger.edge === 'released' ? 'released' : 'pressed';
        const state = input.getActionState(actionId);
        const fired = edge === 'pressed' ? state.pressed : state.released;
        if (!fired) continue;
        if (actionManager.getActionsForTarget(script.targetKey, script.eventId).length > 0) continue;
        script.action.reset?.();
        actionManager.add(script.action, { targetKey: script.targetKey, eventId: script.eventId });
      }
    }

    // Update tick trigger (start when idle)
    for (const script of scripts) {
      if (script.trigger?.type !== 'update') continue;
      if (actionManager.getActionsForTarget(script.targetKey, script.eventId).length > 0) continue;
      script.action.reset?.();
      actionManager.add(script.action, { targetKey: script.targetKey, eventId: script.eventId });
    }
  };

  const reset = (): void => {
    actionManager.clear();
    for (const action of Object.values(behaviors)) {
      if (action.reset) action.reset();
    }
    eventQueue.splice(0, eventQueue.length);
    lastDrainedEventNames.splice(0, lastDrainedEventNames.length);
    lastDrainedEvents.splice(0, lastDrainedEvents.length);
    lastStartedEventScriptKeys.splice(0, lastStartedEventScriptKeys.length);
    lastStartedEventContexts.splice(0, lastStartedEventContexts.length);
    debug.pendingEvents = 0;
  };

  return { scene: migrated, entities, groups, behaviors, scripts, actionManager, debug, startAll, updateTriggers, reset };

  function boundsTriggerMatches(trigger: NonNullable<CompiledAttachmentScript['trigger']>, event: BoundaryEvent): boolean {
    if (trigger.type !== 'bounds') return false;
    if (trigger.boundsEvent !== event.outcome) return false;
    if ((trigger.axis ?? 'any') !== 'any' && trigger.axis !== event.axis) return false;
    if ((trigger.side ?? 'any') !== 'any' && trigger.side !== event.side) return false;
    return true;
  }

  function boundsEventIsInScriptScope(targetKey: string, event: BoundaryEvent): boolean {
    if (targetKey.startsWith('entity:')) return targetKey === `entity:${event.source.id}`;
    if (!targetKey.startsWith('group:')) return false;
    const group = groups[targetKey.slice('group:'.length)];
    if (!group) return false;
    return group.members.some((member) => member.id === event.source.id);
  }

  function targetRefFromBoundaryEvent(event: BoundaryEvent): TargetRef | undefined {
    const entity = entities[event.source.id];
    if (entity) return { type: 'entity', entityId: entity.id };
    const group = groups[event.source.id];
    if (group) return { type: 'group', groupId: group.id };
    return undefined;
  }

  function targetRefFromRuntimeEvent(event: RuntimeEventEnvelope): TargetRef | undefined {
    if (event.source?.target) return event.source.target;
    if (event.source?.targetKey) return targetRefFromTargetKey(event.source.targetKey);
    return undefined;
  }

  function targetRefFromTargetKey(targetKey: string): TargetRef | undefined {
    if (targetKey.startsWith('entity:')) return { type: 'entity', entityId: targetKey.slice('entity:'.length) };
    if (targetKey.startsWith('group:')) return { type: 'group', groupId: targetKey.slice('group:'.length) };
    return undefined;
  }

  function summarizeRuntimeEvent(event: RuntimeEventEnvelope): RuntimeEventDebugEntry {
    return {
      family: event.family,
      type: event.type,
      ...(event.family === 'bounds'
        ? {
            outcome: event.type,
            axis: event.details.axis,
            side: event.details.side,
          }
        : {}),
      sourceId: event.source?.entityId ?? event.source?.target?.entityId ?? event.source?.target?.groupId ?? event.source?.targetKey,
      occurrenceId: event.occurrence.id,
      occurrenceOrder: event.occurrence.order,
    };
  }
}

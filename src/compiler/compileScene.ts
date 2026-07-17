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
    lastStartedEventScriptKeys: string[];
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

  type RuntimeEvent = {
    kind: 'custom';
    name: string;
    payload: Record<string, number | string | boolean | null>;
    source: { targetKey: string; eventId?: string };
  } | {
    kind: 'bounds';
    event: BoundaryEvent;
    source: { targetKey: string; eventId?: string };
  };
  const eventQueue: RuntimeEvent[] = [];
  const lastDrainedEventNames: string[] = [];
  const lastStartedEventScriptKeys: string[] = [];
  const debug = { pendingEvents: 0, lastDrainedEventNames, lastStartedEventScriptKeys } satisfies NonNullable<CompiledScene['debug']>;
  const mergedOptions: CompileOptions = {
    ...(options ?? {}),
    events: {
      emit: (eventName, payload, source) => {
        eventQueue.push({ kind: 'custom', name: eventName, payload, source });
      },
      emitBounds: (event, source) => {
        eventQueue.push({ kind: 'bounds', event, source });
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
        ...drained.map((e) => e.kind === 'custom' ? e.name : `bounds:${e.event.outcome}`)
      );
      lastStartedEventScriptKeys.splice(0, lastStartedEventScriptKeys.length);
      for (const evt of drained) {
        for (const script of scripts) {
          if (evt.kind === 'custom') {
            if (script.trigger?.type !== 'event') continue;
            if ((script.trigger as any).eventName !== evt.name) continue;
            if (actionManager.getActionsForTarget(script.targetKey, script.eventId).length > 0) continue;
            script.action.reset?.();
            actionManager.add(script.action, { targetKey: script.targetKey, eventId: script.eventId });
            lastStartedEventScriptKeys.push(script.key);
            continue;
          }

          if (script.trigger?.type !== 'bounds') continue;
          if (!boundsTriggerMatches(script.trigger, evt.event)) continue;
          if (!boundsEventIsInScriptScope(script.targetKey, evt.event)) continue;
          const eventSource = targetRefFromBoundaryEvent(evt.event);
          const action = script.createActionForEvent?.(eventSource) ?? script.action;
          action.reset?.();
          actionManager.add(action, { targetKey: script.targetKey, eventId: script.eventId });
          lastStartedEventScriptKeys.push(script.key);
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
}

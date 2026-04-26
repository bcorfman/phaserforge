import type { CallActionSpec, SceneSpec, TargetRef, TriggerCallSpec, TriggerZoneSpec } from '../../model/types';
import type { OpRegistry } from '../../compiler/opRegistry';
import type { CompileContext } from '../../compiler/compileBehaviors';
import type { TriggerEvent } from '../services/BasicCollisionService';

function resolveTriggerTarget(call: TriggerCallSpec | undefined, event: TriggerEvent): TargetRef | undefined {
  if (!call) return undefined;
  const args = call.args ?? {};
  const explicitEntityId = typeof args.entityId === 'string' ? args.entityId : '';
  if (explicitEntityId) return { type: 'entity', entityId: explicitEntityId };

  const wantsInstigator = typeof args.target === 'string' ? args.target : '';
  const instigatorId = 'entityId' in event ? event.entityId : undefined;
  if (wantsInstigator === 'instigator' && instigatorId) return { type: 'entity', entityId: instigatorId };

  if (instigatorId) return { type: 'entity', entityId: instigatorId };
  return undefined;
}

function callForEvent(zone: TriggerZoneSpec, event: TriggerEvent): TriggerCallSpec | undefined {
  if (event.type === 'enter') return zone.onEnter;
  if (event.type === 'exit') return zone.onExit;
  if (event.type === 'click') return zone.onClick;
  return undefined;
}

export function executeTriggerScripts(
  triggers: TriggerZoneSpec[],
  events: TriggerEvent[],
  opRegistry: OpRegistry,
  ctx: CompileContext,
): void {
  if (!Array.isArray(triggers) || triggers.length === 0) return;
  if (!Array.isArray(events) || events.length === 0) return;

  const zonesById = new Map<string, TriggerZoneSpec>();
  for (const zone of triggers) zonesById.set(zone.id, zone);

  let index = 0;
  for (const event of events) {
    if (event.type === 'stay') continue;
    const zone = zonesById.get(event.id);
    if (!zone) continue;
    if (zone.enabled === false) continue;
    const call = callForEvent(zone, event);
    const callId = call?.callId?.trim() ?? '';
    if (!callId) continue;

    const action: CallActionSpec = {
      id: `trigger:${zone.id}:${event.type}:${index++}`,
      type: 'Call',
      callId,
      target: resolveTriggerTarget(call, event),
      args: call?.args,
    };

    opRegistry.invoke(callId, action, ctx);
  }
}

export function createTriggerCompileContext(
  scene: SceneSpec,
  targets: CompileContext['targets'],
  opRegistry: OpRegistry,
): CompileContext {
  return { scene, targets, options: { opRegistry } };
}


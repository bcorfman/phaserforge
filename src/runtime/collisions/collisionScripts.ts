import type { CallActionSpec, CollisionRuleSpec, TargetRef } from '../../model/types';
import type { OpRegistry } from '../../compiler/opRegistry';
import type { CompileContext } from '../../compiler/compileBehaviors';
import type { CollisionEvent } from '../services/BasicCollisionService';

type CollisionCallSpec = { callId: string; args?: Record<string, number | string | boolean | null> };

function callsForRule(rule: CollisionRuleSpec): CollisionCallSpec[] {
  const raw = (rule as any).onEnter;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean) as any;
  return [raw] as any;
}

function resolveCollisionTarget(call: CollisionCallSpec, event: CollisionEvent): TargetRef | undefined {
  const args = (call.args ?? {}) as any;
  const explicitEntityId = typeof args.entityId === 'string' ? args.entityId : '';
  if (explicitEntityId) return { type: 'entity', entityId: explicitEntityId };

  const wants = typeof args.target === 'string' ? args.target : '';
  if (wants === 'a' || wants === 'instigator') return { type: 'entity', entityId: event.aId };
  if (wants === 'b' || wants === 'other') return { type: 'entity', entityId: event.bId };

  return { type: 'entity', entityId: event.aId };
}

export function executeCollisionScripts(
  collisionRules: CollisionRuleSpec[],
  events: CollisionEvent[],
  opRegistry: OpRegistry,
  ctx: CompileContext,
): void {
  if (!Array.isArray(collisionRules) || collisionRules.length === 0) return;
  if (!Array.isArray(events) || events.length === 0) return;

  const rulesById = new Map<string, CollisionRuleSpec>();
  for (const rule of collisionRules) rulesById.set(rule.id, rule);

  let index = 0;
  for (const event of events) {
    if (event.type !== 'enter') continue;
    const rule = rulesById.get(event.ruleId);
    if (!rule) continue;
    const calls = callsForRule(rule);
    if (calls.length === 0) continue;

    for (const call of calls) {
      const callId = call?.callId?.trim() ?? '';
      if (!callId) continue;

      const action: CallActionSpec = {
        id: `collision:${rule.id}:${event.type}:${index++}`,
        type: 'Call',
        callId,
        target: resolveCollisionTarget(call, event),
        args: call.args,
      };

      opRegistry.invoke(callId, action, ctx);
    }
  }
}


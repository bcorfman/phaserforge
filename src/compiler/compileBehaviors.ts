import {
  ActionSpec,
  BehaviorSpec,
  ConditionSpec,
  SceneSpec,
} from '../model/types';
import { Action } from '../runtime/Action';
import { Sequence } from '../runtime/actions/Sequence';
import { MoveUntil } from '../runtime/actions/MoveUntil';
import { Wait } from '../runtime/actions/Wait';
import { Call } from '../runtime/actions/Call';
import { Repeat } from '../runtime/actions/Repeat';
import { BoundsHit } from '../runtime/conditions/BoundsHit';
import { ElapsedTime } from '../runtime/conditions/ElapsedTime';
import { Condition } from '../runtime/conditions/Condition';
import { resolveTarget, TargetContext } from '../runtime/targets/resolveTarget';
import { CallActionSpec } from '../model/types';

export interface CompileOptions {
  callRegistry?: Record<string, CallHandler>;
}

export interface CompileContext {
  scene: SceneSpec;
  targets: TargetContext;
  options?: CompileOptions;
}

export type CallHandler = (action: CallActionSpec, ctx: CompileContext) => void;

export function compileBehavior(behavior: BehaviorSpec, ctx: CompileContext): Action {
  const callRegistry = ctx.options?.callRegistry ?? {};
  const stack = new Set<string>();
  const built = new Map<string, Action>();

  const buildAction = (actionId: string): Action => {
    if (built.has(actionId)) return built.get(actionId)!;
    if (stack.has(actionId)) {
      throw new Error(`Action cycle detected at ${actionId}`);
    }
    const action = ctx.scene.actions[actionId];
    if (!action) {
      throw new Error(`Unknown action ${actionId}`);
    }
    stack.add(actionId);
    const instance = instantiateAction(action, buildAction, ctx, callRegistry);
    built.set(actionId, instance);
    stack.delete(actionId);
    return instance;
  };

  if (!behavior.rootActionId) {
    return new Sequence([]);
  }

  return buildAction(behavior.rootActionId);
}

function instantiateAction(
  action: ActionSpec,
  buildAction: (id: string) => Action,
  ctx: CompileContext,
  callRegistry: Record<string, CallHandler>
): Action {
  switch (action.type) {
    case 'Sequence': {
      const children = action.children.map((childId) => buildAction(childId));
      return new Sequence(children);
    }
    case 'Wait':
      return new Wait(action.durationMs);
    case 'Call': {
      const callback = callRegistry[action.callId];
      const handler =
        callback ??
        ((_action: CallActionSpec, _ctx: CompileContext) => {
          console.warn(`[phaseractions] Missing call handler for ${action.callId}`);
        });
      return new Call(() => handler(action, ctx));
    }
    case 'Repeat': {
      const child = buildAction(action.childId);
      return new Repeat(child, action.count);
    }
    case 'MoveUntil': {
      const target = resolveTarget(action.target, ctx.targets);
      const conditionSpec = ctx.scene.conditions[action.conditionId];
      if (!conditionSpec) {
        throw new Error(`Unknown condition ${action.conditionId}`);
      }
      const condition = instantiateCondition(conditionSpec);
      return new MoveUntil(target, action.velocity, condition);
    }
    default:
      throw new Error(`Unknown action type: ${(action as ActionSpec).type}`);
  }
}

function instantiateCondition(condition: ConditionSpec): Condition {
  switch (condition.type) {
    case 'BoundsHit':
      return new BoundsHit(condition.bounds, condition.mode, {
        scope: condition.scope,
        behavior: condition.behavior,
      });
    case 'ElapsedTime':
      return new ElapsedTime(condition.durationMs);
    default:
      throw new Error(`Unknown condition type: ${(condition as ConditionSpec).type}`);
  }
}

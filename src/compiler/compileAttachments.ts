import type { AttachmentSpec, InlineConditionSpec, SceneSpec, TargetRef } from '../model/types';
import type { Action } from '../runtime/Action';
import { Call } from '../runtime/actions/Call';
import { MoveUntil } from '../runtime/actions/MoveUntil';
import { Repeat } from '../runtime/actions/Repeat';
import { Sequence } from '../runtime/actions/Sequence';
import { Wait } from '../runtime/actions/Wait';
import { Parallel } from '../runtime/actions/Parallel';
import { InputDrive } from '../runtime/actions/InputDrive';
import { InputFire } from '../runtime/actions/InputFire';
import { BoundsHit } from '../runtime/conditions/BoundsHit';
import { ElapsedTime } from '../runtime/conditions/ElapsedTime';
import { Never } from '../runtime/conditions/Never';
import { flattenTarget, resolveTarget, type TargetContext } from '../runtime/targets/resolveTarget';
import type { CompileOptions, CompileContext } from './compileBehaviors';
import type { CallActionSpec } from '../model/types';

type CallArgPrimitive = number | string | boolean | null;

function isCallArgPrimitive(value: unknown): value is CallArgPrimitive {
  return value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean';
}

function attachmentEnabled(attachment: AttachmentSpec): boolean {
  return attachment.enabled !== false;
}

function stableTargetKey(target: TargetRef): string {
  return target.type === 'entity' ? `entity:${target.entityId}` : `group:${target.groupId}`;
}

function instantiateInlineCondition(condition: InlineConditionSpec | undefined) {
  if (!condition) return new Never();
  if (condition.type === 'BoundsHit') {
    return new BoundsHit(condition.bounds, condition.mode, {
      scope: condition.scope,
      behavior: condition.behavior,
    });
  }
  if (condition.type === 'ElapsedTime') {
    return new ElapsedTime(condition.durationMs);
  }
  return new Never();
}

function compileCallAttachment(attachment: AttachmentSpec, ctx: CompileContext): Action {
  const callId = String(attachment.params?.callId ?? attachment.presetId);
  const opRegistry = ctx.options?.opRegistry;

  const spec: CallActionSpec = {
    id: attachment.id,
    type: 'Call',
    name: attachment.name,
    callId,
    target: attachment.target,
    args: Object.fromEntries(
      Object.entries(attachment.params ?? {}).filter(([key, value]) => key !== 'callId' && isCallArgPrimitive(value))
    ) as Record<string, CallArgPrimitive>,
  };
  return new Call(() => {
    if (!opRegistry) {
      console.warn(`[phaseractions] Missing opRegistry for Call ${callId}`);
      return;
    }
    opRegistry.invoke(callId, spec, ctx);
  });
}

function compileAtomicAttachment(attachment: AttachmentSpec, ctx: CompileContext, targetOverride?: TargetRef): Action {
  const presetId = attachment.presetId;
  if (presetId === 'Wait') {
    const durationMs = Number(attachment.params?.durationMs ?? 0);
    return new Wait(durationMs);
  }
  if (presetId === 'Call') {
    return compileCallAttachment({ ...attachment, target: targetOverride ?? attachment.target }, ctx);
  }
  if (presetId === 'MoveUntil') {
    const velocityX = Number(attachment.params?.velocityX ?? 0);
    const velocityY = Number(attachment.params?.velocityY ?? 0);
    const targetRef = targetOverride ?? attachment.target;
    const target = resolveTarget(targetRef, ctx.targets);
    const condition = instantiateInlineCondition(attachment.condition);
    return new MoveUntil(target, { x: velocityX, y: velocityY }, condition);
  }
  if (presetId === 'Repeat') {
    // Repeat is handled at the script level (wrapper). If it appears here, treat as no-op.
    return new Sequence([]);
  }
  if (presetId === 'InputDrive') {
    const input = ctx.options?.input;
    if (!input) {
      console.warn('[phaseractions] InputDrive requires CompileOptions.input');
      return new Sequence([]);
    }
    const speedX = Number(attachment.params?.speedX ?? attachment.params?.speed ?? 0);
    const speedY = Number(attachment.params?.speedY ?? attachment.params?.speed ?? 0);
    const targetRef = targetOverride ?? attachment.target;
    const resolved = resolveTarget(targetRef, ctx.targets);
    const targets = flattenTarget(resolved);
    if (targets.length === 0) return new Sequence([]);
    const entity = targets[0] as any;
    return new InputDrive(entity, input, {
      speedX,
      speedY,
      leftActionId: typeof attachment.params?.leftActionId === 'string' ? String(attachment.params.leftActionId) : undefined,
      rightActionId: typeof attachment.params?.rightActionId === 'string' ? String(attachment.params.rightActionId) : undefined,
      upActionId: typeof attachment.params?.upActionId === 'string' ? String(attachment.params.upActionId) : undefined,
      downActionId: typeof attachment.params?.downActionId === 'string' ? String(attachment.params.downActionId) : undefined,
    });
  }
  if (presetId === 'InputFire') {
    const input = ctx.options?.input;
    const spawnEntity = ctx.options?.runtime?.spawnEntity;
    if (!input || !spawnEntity) {
      console.warn('[phaseractions] InputFire requires CompileOptions.input and CompileOptions.runtime.spawnEntity');
      return new Sequence([]);
    }
    const fireActionId = typeof attachment.params?.fireActionId === 'string' ? String(attachment.params.fireActionId) : '';
    const templateEntityId = typeof attachment.params?.templateEntityId === 'string' ? String(attachment.params.templateEntityId) : '';
    if (!fireActionId || !templateEntityId) return new Sequence([]);
    const cooldownMs = Number(attachment.params?.cooldownMs ?? 180);
    const offsetX = Number(attachment.params?.offsetX ?? 0);
    const offsetY = Number(attachment.params?.offsetY ?? 0);
    const velocityX = Number(attachment.params?.velocityX ?? 0);
    const velocityY = Number(attachment.params?.velocityY ?? -500);
    const layerRaw = typeof attachment.params?.layer === 'string' ? String(attachment.params.layer) : '';
    const layer = layerRaw === 'base' || layerRaw === 'active' ? layerRaw : undefined;

    const targetRef = targetOverride ?? attachment.target;
    const resolved = resolveTarget(targetRef, ctx.targets);
    const targets = flattenTarget(resolved);
    if (targets.length === 0) return new Sequence([]);
    const shooter = targets[0] as any;
    return new InputFire(shooter, input, spawnEntity, {
      fireActionId,
      templateEntityId,
      ...(layer ? { layer } : {}),
      cooldownMs,
      offsetX,
      offsetY,
      velocityX,
      velocityY,
    });
  }

  throw new Error(`Unknown attachment presetId: ${presetId}`);
}

export function compileAttachments(scene: SceneSpec, ctx: { targets: TargetContext; options?: CompileOptions }): Record<string, Action> {
  const compileCtx: CompileContext = { scene, targets: ctx.targets, options: ctx.options };
  const enabled = Object.values(scene.attachments).filter(attachmentEnabled);
  const byTarget = new Map<string, AttachmentSpec[]>();
  for (const attachment of enabled) {
    const key = stableTargetKey(attachment.target);
    const list = byTarget.get(key) ?? [];
    list.push(attachment);
    byTarget.set(key, list);
  }

  const scripts: Record<string, Action> = {};
  for (const [key, attachments] of byTarget.entries()) {
    const sorted = [...attachments].sort((a, b) => {
      const ao = a.order ?? 0;
      const bo = b.order ?? 0;
      if (ao !== bo) return ao - bo;
      return a.id.localeCompare(b.id);
    });

    const repeat = sorted.find((a) => a.presetId === 'Repeat');
    const steps = sorted.filter((a) => a.presetId !== 'Repeat');

    const compiledSteps: Action[] = [];
    for (const step of steps) {
      if (step.target.type === 'group' && step.applyTo === 'members') {
        const group = scene.groups[step.target.groupId];
        const members = group?.members ?? [];
        const perMember = members.map((entityId) => compileAtomicAttachment(step, compileCtx, { type: 'entity', entityId }));
        compiledSteps.push(new Parallel(perMember));
      } else {
        compiledSteps.push(compileAtomicAttachment(step, compileCtx));
      }
    }

    let script: Action = new Sequence(compiledSteps);
    if (repeat) {
      const countRaw = repeat.params?.count;
      const count = typeof countRaw === 'number' ? countRaw : undefined;
      script = new Repeat(script, count);
    }
    scripts[key] = script;
  }

  return scripts;
}

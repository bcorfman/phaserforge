import type { AttachmentSpec, InlineConditionSpec, SceneSpec, TargetRef } from '../model/types';
import type { Action } from '../runtime/Action';
import { Call } from '../runtime/actions/Call';
import { MoveUntil } from '../runtime/actions/MoveUntil';
import { Repeat } from '../runtime/actions/Repeat';
import { Sequence } from '../runtime/actions/Sequence';
import { Wait } from '../runtime/actions/Wait';
import { Parallel } from '../runtime/actions/Parallel';
import { BoundsHit } from '../runtime/conditions/BoundsHit';
import { ElapsedTime } from '../runtime/conditions/ElapsedTime';
import { Never } from '../runtime/conditions/Never';
import { resolveTarget, type TargetContext } from '../runtime/targets/resolveTarget';
import type { CompileOptions, CompileContext } from './compileBehaviors';
import type { CallActionSpec } from '../model/types';

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
  const callRegistry = ctx.options?.callRegistry ?? {};
  const callback = callRegistry[callId];
  if (!callback) {
    throw new Error(`Missing call handler for ${callId}`);
  }
  const spec: CallActionSpec = {
    id: attachment.id,
    type: 'Call',
    name: attachment.name,
    callId,
    target: attachment.target,
    args: Object.fromEntries(
      Object.entries(attachment.params ?? {}).filter(([key, value]) => key !== 'callId' && typeof value === 'number')
    ) as Record<string, number>,
  };
  return new Call(() => callback(spec, ctx));
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


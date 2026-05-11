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
import { MoveXUntil } from '../runtime/actions/MoveXUntil';
import { MoveYUntil } from '../runtime/actions/MoveYUntil';
import { BlinkUntil } from '../runtime/actions/BlinkUntil';
import { CallbackUntil } from '../runtime/actions/CallbackUntil';
import { CycleFramesUntil } from '../runtime/actions/CycleFramesUntil';
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

export interface CompiledAttachmentScript {
  key: string;
  targetKey: string;
  tag?: string;
  action: Action;
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
  const opRegistry = ctx.options?.opRegistry;
  const buildCallback = (callId: string | undefined): (() => void) | undefined => {
    if (!callId) return undefined;
    if (!opRegistry) {
      console.warn(`[phaseractions] Missing opRegistry for callback ${callId}`);
      return undefined;
    }
    const spec: CallActionSpec = {
      id: attachment.id,
      type: 'Call',
      name: attachment.name,
      callId,
      target: targetOverride ?? attachment.target,
      args: {},
    };
    return () => opRegistry.invoke(callId, spec, ctx);
  };

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
  if (presetId === 'MoveXUntil') {
    const velocityX = Number(attachment.params?.velocityX ?? attachment.params?.velocity ?? 0);
    const targetRef = targetOverride ?? attachment.target;
    const target = resolveTarget(targetRef, ctx.targets);
    const condition = instantiateInlineCondition(attachment.condition);
    return new MoveXUntil(target, velocityX, condition);
  }
  if (presetId === 'MoveYUntil') {
    const velocityY = Number(attachment.params?.velocityY ?? attachment.params?.velocity ?? 0);
    const targetRef = targetOverride ?? attachment.target;
    const target = resolveTarget(targetRef, ctx.targets);
    const condition = instantiateInlineCondition(attachment.condition);
    return new MoveYUntil(target, velocityY, condition);
  }
  if (presetId === 'BlinkUntil') {
    const secondsUntilChange = Number(attachment.params?.secondsUntilChange ?? 0.25);
    const startVisible = attachment.params?.startVisible !== false;
    const targetRef = targetOverride ?? attachment.target;
    const target = resolveTarget(targetRef, ctx.targets);
    const condition = instantiateInlineCondition(attachment.condition);
    const onEnterVisible = buildCallback(typeof attachment.params?.onEnterCallId === 'string' ? String(attachment.params.onEnterCallId) : undefined);
    const onExitVisible = buildCallback(typeof attachment.params?.onExitCallId === 'string' ? String(attachment.params.onExitCallId) : undefined);
    return new BlinkUntil(target, { secondsUntilChange, startVisible, condition, onEnterVisible, onExitVisible });
  }
  if (presetId === 'CallbackUntil') {
    const secondsBetweenCalls = typeof attachment.params?.secondsBetweenCalls === 'number'
      ? Number(attachment.params.secondsBetweenCalls)
      : typeof attachment.params?.secondsBetweenCalls === 'string'
        ? Number(attachment.params.secondsBetweenCalls)
        : undefined;
    const targetRef = targetOverride ?? attachment.target;
    const target = resolveTarget(targetRef, ctx.targets);
    const condition = instantiateInlineCondition(attachment.condition);
    const callId = typeof attachment.params?.callId === 'string' ? String(attachment.params.callId) : undefined;
    const cb = buildCallback(callId);
    if (!cb) return new Sequence([]);
    return new CallbackUntil({ targets: target, condition, callback: cb, secondsBetweenCalls });
  }
  if (presetId === 'CycleFramesUntil') {
    const fps = Number(attachment.params?.fps ?? 6);
    const directionRaw = attachment.params?.direction;
    const direction = directionRaw === -1 || directionRaw === 'backward' ? -1 : 1;
    const targetRef = targetOverride ?? attachment.target;
    const target = resolveTarget(targetRef, ctx.targets);
    const condition = instantiateInlineCondition(attachment.condition);

    const frames: Array<string | number> = [];
    if (attachment.params?.framesCsv && typeof attachment.params.framesCsv === 'string') {
      const parts = attachment.params.framesCsv.split(',').map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        const num = Number(part);
        frames.push(Number.isFinite(num) && part !== '' && String(num) === part ? num : part);
      }
    } else {
      const startFrame = Number(attachment.params?.startFrame ?? 0);
      const endFrame = Number(attachment.params?.endFrame ?? startFrame);
      const a = Math.min(startFrame, endFrame);
      const b = Math.max(startFrame, endFrame);
      for (let i = a; i <= b; i += 1) frames.push(i);
    }

    return new CycleFramesUntil(target, { frames, fps, direction, condition });
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

export function compileAttachments(scene: SceneSpec, ctx: { targets: TargetContext; options?: CompileOptions }): CompiledAttachmentScript[] {
  const compileCtx: CompileContext = { scene, targets: ctx.targets, options: ctx.options };
  const enabled = Object.values(scene.attachments).filter(attachmentEnabled);
  const byTargetAndTag = new Map<string, { targetKey: string; tag?: string; attachments: AttachmentSpec[] }>();
  for (const attachment of enabled) {
    const targetKey = stableTargetKey(attachment.target);
    const tag = typeof attachment.tag === 'string' && attachment.tag.length > 0 ? attachment.tag : undefined;
    const key = `${targetKey}::${tag ?? ''}`;
    const bucket = byTargetAndTag.get(key) ?? { targetKey, tag, attachments: [] };
    bucket.attachments.push(attachment);
    byTargetAndTag.set(key, bucket);
  }

  const scripts: CompiledAttachmentScript[] = [];
  for (const bucket of byTargetAndTag.values()) {
    const sorted = [...bucket.attachments].sort((a, b) => {
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
    scripts.push({
      key: bucket.tag ? `${bucket.targetKey}#${bucket.tag}` : bucket.targetKey,
      targetKey: bucket.targetKey,
      tag: bucket.tag,
      action: script,
    });
  }

  return scripts;
}

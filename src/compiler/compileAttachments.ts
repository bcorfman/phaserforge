import type { AttachmentSpec, InlineConditionSpec, SceneSpec, TargetRef } from '../model/types';
import type { Action } from '../runtime/Action';
import { Call } from '../runtime/actions/Call';
import { MoveUntil } from '../runtime/actions/MoveUntil';
import { Repeat } from '../runtime/actions/Repeat';
import { Sequence } from '../runtime/actions/Sequence';
import { Wait } from '../runtime/actions/Wait';
import { Parallel } from '../runtime/actions/Parallel';
import { EmitEvent } from '../runtime/actions/EmitEvent';
import { InputDrive } from '../runtime/actions/InputDrive';
import { InputFire } from '../runtime/actions/InputFire';
import { MoveXUntil } from '../runtime/actions/MoveXUntil';
import { MoveYUntil } from '../runtime/actions/MoveYUntil';
import { BlinkUntil } from '../runtime/actions/BlinkUntil';
import { CallbackUntil } from '../runtime/actions/CallbackUntil';
import { CycleFramesUntil } from '../runtime/actions/CycleFramesUntil';
import { AddSelfToCollection } from '../runtime/actions/AddSelfToCollection';
import { AddToCounter } from '../runtime/actions/AddToCounter';
import { ClampCounter } from '../runtime/actions/ClampCounter';
import { HoldUntil } from '../runtime/actions/HoldUntil';
import { RemoveSelfFromCollection } from '../runtime/actions/RemoveSelfFromCollection';
import { SetCounter } from '../runtime/actions/SetCounter';
import { BoundsHit } from '../runtime/conditions/BoundsHit';
import { CounterCompare } from '../runtime/conditions/CounterCompare';
import { ElapsedTime } from '../runtime/conditions/ElapsedTime';
import { InputActionEdge } from '../runtime/conditions/InputActionEdge';
import { Instant } from '../runtime/conditions/Instant';
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

const PARALLEL_GROUP_TAG_PREFIX = 'pargrp:';

function parseParallelGroupTag(tag: string | undefined): { groupId: string; slot: string } | null {
  if (!tag) return null;
  if (!tag.startsWith(PARALLEL_GROUP_TAG_PREFIX)) return null;
  const rest = tag.slice(PARALLEL_GROUP_TAG_PREFIX.length);
  const parts = rest.split(':');
  if (parts.length < 2) return null;
  const groupId = parts[0];
  const slot = parts.slice(1).join(':');
  if (!groupId || !slot) return null;
  return { groupId, slot };
}

function stableTriggerKey(trigger: AttachmentSpec['trigger'] | undefined): string {
  if (!trigger) return 'start';
  if (trigger.type === 'update') return 'update';
  if (trigger.type === 'visible') return `visible:${trigger.edge ?? ''}`;
  if (trigger.type === 'input_action') return `input_action:${trigger.actionId ?? ''}:${trigger.edge ?? ''}`;
  if (trigger.type === 'event') return `event:${trigger.eventName ?? ''}`;
  return 'start';
}

export interface CompiledAttachmentScript {
  key: string;
  targetKey: string;
  eventId?: string;
  trigger?: AttachmentSpec['trigger'];
  action: Action;
}

function instantiateInlineCondition(condition: InlineConditionSpec | undefined, ctx: CompileContext) {
  if (!condition) return new Never();
  if (condition.type === 'Instant') return new Instant();
  if (condition.type === 'BoundsHit') {
    return new BoundsHit(condition.bounds, condition.mode, {
      scope: condition.scope,
      behavior: condition.behavior,
    });
  }
  if (condition.type === 'ElapsedTime') {
    return new ElapsedTime(condition.durationMs);
  }
  if (condition.type === 'CounterCompare') {
    const vars = ctx.options?.vars;
    const getValue = () => vars?.getCounter(condition.counterId) ?? 0;
    return new CounterCompare(getValue, condition.op, condition.value);
  }
  if (condition.type === 'InputActionEdge') {
    const input = ctx.options?.input;
    if (!input) return new Never();
    return new InputActionEdge(input, condition.actionId, condition.edge);
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
    const call = compileCallAttachment({ ...attachment, target: targetOverride ?? attachment.target }, ctx);
    if (!attachment.condition) return call;
    const targetRef = targetOverride ?? attachment.target;
    const target = resolveTarget(targetRef, ctx.targets);
    const condition = instantiateInlineCondition(attachment.condition, ctx);
    return new HoldUntil(call, condition, target);
  }
  if (presetId === 'AddToCounter') {
    const vars = ctx.options?.vars;
    if (!vars) return new Sequence([]);
    const counterId = String(attachment.params?.counterId ?? '');
    const delta = Number(attachment.params?.delta ?? attachment.params?.amount ?? 0);
    if (!counterId) return new Sequence([]);
    return new AddToCounter(vars, counterId, Number.isFinite(delta) ? delta : 0);
  }
  if (presetId === 'SetCounter') {
    const vars = ctx.options?.vars;
    if (!vars) return new Sequence([]);
    const counterId = String(attachment.params?.counterId ?? '');
    const value = Number(attachment.params?.value ?? 0);
    if (!counterId) return new Sequence([]);
    return new SetCounter(vars, counterId, Number.isFinite(value) ? value : 0);
  }
  if (presetId === 'ClampCounter') {
    const vars = ctx.options?.vars;
    if (!vars) return new Sequence([]);
    const counterId = String(attachment.params?.counterId ?? '');
    const min = attachment.params?.min;
    const max = attachment.params?.max;
    if (!counterId) return new Sequence([]);
    return new ClampCounter(vars, counterId, {
      ...(typeof min === 'number' && Number.isFinite(min) ? { min } : {}),
      ...(typeof max === 'number' && Number.isFinite(max) ? { max } : {}),
    });
  }
  if (presetId === 'AddSelfToCollection') {
    const vars = ctx.options?.vars;
    if (!vars) return new Sequence([]);
    const collectionId = String(attachment.params?.collectionId ?? '');
    if (!collectionId) return new Sequence([]);
    const targetRef = targetOverride ?? attachment.target;
    const target = resolveTarget(targetRef, ctx.targets);
    return new AddSelfToCollection(vars, collectionId, target);
  }
  if (presetId === 'RemoveSelfFromCollection') {
    const vars = ctx.options?.vars;
    if (!vars) return new Sequence([]);
    const collectionId = String(attachment.params?.collectionId ?? '');
    if (!collectionId) return new Sequence([]);
    const targetRef = targetOverride ?? attachment.target;
    const target = resolveTarget(targetRef, ctx.targets);
    return new RemoveSelfFromCollection(vars, collectionId, target);
  }
  if (presetId === 'MoveUntil') {
    const velocityX = Number(attachment.params?.velocityX ?? 0);
    const velocityY = Number(attachment.params?.velocityY ?? 0);
    const targetRef = targetOverride ?? attachment.target;
    const target = resolveTarget(targetRef, ctx.targets);
    const condition = instantiateInlineCondition(attachment.condition, ctx);
    return new MoveUntil(target, { x: velocityX, y: velocityY }, condition);
  }
  if (presetId === 'MoveXUntil') {
    const velocityX = Number(attachment.params?.velocityX ?? attachment.params?.velocity ?? 0);
    const targetRef = targetOverride ?? attachment.target;
    const target = resolveTarget(targetRef, ctx.targets);
    const condition = instantiateInlineCondition(attachment.condition, ctx);
    return new MoveXUntil(target, velocityX, condition);
  }
  if (presetId === 'MoveYUntil') {
    const velocityY = Number(attachment.params?.velocityY ?? attachment.params?.velocity ?? 0);
    const targetRef = targetOverride ?? attachment.target;
    const target = resolveTarget(targetRef, ctx.targets);
    const condition = instantiateInlineCondition(attachment.condition, ctx);
    return new MoveYUntil(target, velocityY, condition);
  }
  if (presetId === 'BlinkUntil') {
    const secondsUntilChange = Number(attachment.params?.secondsUntilChange ?? 0.25);
    const startVisible = attachment.params?.startVisible !== false;
    const targetRef = targetOverride ?? attachment.target;
    const target = resolveTarget(targetRef, ctx.targets);
    const condition = instantiateInlineCondition(attachment.condition, ctx);
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
    const condition = instantiateInlineCondition(attachment.condition, ctx);
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
    const condition = instantiateInlineCondition(attachment.condition, ctx);

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
  if (presetId === 'EmitEvent') {
    const events = ctx.options?.events;
    const eventName = typeof attachment.params?.eventName === 'string' ? String(attachment.params.eventName) : '';
    if (!events || !eventName) return new Sequence([]);
    const payload = Object.fromEntries(
      Object.entries(attachment.params ?? {}).filter(([key, value]) => key !== 'eventName' && isCallArgPrimitive(value))
    ) as Record<string, number | string | boolean | null>;
    const source = { targetKey: stableTargetKey(targetOverride ?? attachment.target), eventId: attachment.eventId };
    return new EmitEvent(eventName, payload, (name, data) => events.emit(name, data, source));
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
  if (presetId === 'Repeat') {
    // Repeat is handled as a composite container at the script level.
    return new Sequence([]);
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
  const byTargetEventAndTrigger = new Map<string, { targetKey: string; eventId?: string; triggerKey: string; trigger?: AttachmentSpec['trigger']; attachments: AttachmentSpec[] }>();
  for (const attachment of enabled) {
    const targetKey = stableTargetKey(attachment.target);
    const eventId = typeof attachment.eventId === 'string' && attachment.eventId.length > 0 ? attachment.eventId : undefined;
    const trigger = eventId ? (scene.eventBlocks?.[eventId]?.trigger ?? { type: 'start' as const }) : (attachment.trigger ?? { type: 'start' as const });
    const triggerKey = stableTriggerKey(trigger);
    const key = `${targetKey}::${eventId ?? ''}::${triggerKey}`;
    const bucket =
      byTargetEventAndTrigger.get(key) ?? { targetKey, eventId, triggerKey, trigger, attachments: [] };
    bucket.attachments.push(attachment);
    byTargetEventAndTrigger.set(key, bucket);
  }

  const scripts: CompiledAttachmentScript[] = [];
  for (const bucket of byTargetEventAndTrigger.values()) {
    const byId = new Map<string, AttachmentSpec>(bucket.attachments.map((a) => [a.id, a]));

    const compileNode = (attachment: AttachmentSpec): Action => {
      if (attachment.presetId === 'Repeat' && Array.isArray(attachment.children) && attachment.children.length > 0) {
        const countRaw = attachment.params?.count;
        const count = typeof countRaw === 'number' ? countRaw : undefined;
        const children = attachment.children
          .map((id) => byId.get(id))
          .filter((a): a is AttachmentSpec => Boolean(a))
          .sort((a, b) => {
            const ao = a.order ?? 0;
            const bo = b.order ?? 0;
            if (ao !== bo) return ao - bo;
            return a.id.localeCompare(b.id);
          });
        return new Repeat(new Sequence(compileSiblings(children)), count);
      }
      if (attachment.target.type === 'group' && attachment.applyTo === 'members') {
        const group = scene.groups[attachment.target.groupId];
        const members = group?.members ?? [];
        const perMember = members.map((entityId) => compileAtomicAttachment(attachment, compileCtx, { type: 'entity', entityId }));
        return new Parallel(perMember);
      }
      return compileAtomicAttachment(attachment, compileCtx);
    };

    function compileSiblings(siblings: AttachmentSpec[]): Action[] {
      const byParallelGroupId = new Map<string, AttachmentSpec[]>();
      const ungrouped: AttachmentSpec[] = [];
      for (const step of siblings) {
        const parsed = parseParallelGroupTag(step.tag);
        if (!parsed) {
          ungrouped.push(step);
          continue;
        }
        const list = byParallelGroupId.get(parsed.groupId) ?? [];
        list.push(step);
        byParallelGroupId.set(parsed.groupId, list);
      }

      const rows: Array<{ sortKey: { order: number; id: string }; row: { kind: 'attachment'; attachment: AttachmentSpec } | { kind: 'parallel'; groupId: string; attachments: AttachmentSpec[] } }> = [];
      for (const step of ungrouped) {
        rows.push({ sortKey: { order: step.order ?? 0, id: step.id }, row: { kind: 'attachment', attachment: step } });
      }
      for (const [groupId, groupSteps] of byParallelGroupId.entries()) {
        if (groupSteps.length < 2) {
          const only = groupSteps[0];
          rows.push({ sortKey: { order: only.order ?? 0, id: only.id }, row: { kind: 'attachment', attachment: only } });
          continue;
        }
        const sortedGroup = [...groupSteps].sort((a, b) => {
          const pa = parseParallelGroupTag(a.tag);
          const pb = parseParallelGroupTag(b.tag);
          const sa = pa?.slot ?? '';
          const sb = pb?.slot ?? '';
          if (sa !== sb) return sa.localeCompare(sb, undefined, { numeric: true });
          const ao = a.order ?? 0;
          const bo = b.order ?? 0;
          if (ao !== bo) return ao - bo;
          return a.id.localeCompare(b.id);
        });
        const minOrder = Math.min(...sortedGroup.map((a) => a.order ?? 0));
        const minId = sortedGroup[0]?.id ?? groupId;
        rows.push({ sortKey: { order: minOrder, id: minId }, row: { kind: 'parallel', groupId, attachments: sortedGroup } });
      }

      const compiledRows = rows
        .sort((a, b) => (a.sortKey.order !== b.sortKey.order ? a.sortKey.order - b.sortKey.order : a.sortKey.id.localeCompare(b.sortKey.id)))
        .map((r) => r.row);

      const compiled: Action[] = [];
      for (const row of compiledRows) {
        if (row.kind === 'attachment') {
          compiled.push(compileNode(row.attachment));
          continue;
        }
        compiled.push(new Parallel(row.attachments.map((a) => compileNode(a))));
      }
      return compiled;
    }

    const roots = bucket.attachments
      .filter((a) => !a.parentAttachmentId)
      .sort((a, b) => {
        const ao = a.order ?? 0;
        const bo = b.order ?? 0;
        if (ao !== bo) return ao - bo;
        return a.id.localeCompare(b.id);
      });

    const script: Action = new Sequence(compileSiblings(roots));

    const isDefaultKey = !bucket.eventId && bucket.triggerKey === 'start';
    const key = isDefaultKey ? bucket.targetKey : `${bucket.targetKey}#${bucket.eventId ?? 'event'}#${bucket.triggerKey}`;
    scripts.push({
      targetKey: bucket.targetKey,
      key,
      eventId: bucket.eventId,
      trigger: bucket.trigger,
      action: script,
    });
  }

  return scripts;
}

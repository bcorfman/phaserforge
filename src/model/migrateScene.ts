import type {
  ActionSpec,
  AttachmentSpec,
  ConditionSpec,
  InlineConditionSpec,
  SceneSpec,
  TargetRef,
} from './types';

function coerceRecord<T>(value: unknown): Record<string, T> {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, T>;
}

function ensureTarget(target: TargetRef | undefined, fallback: TargetRef): TargetRef {
  if (!target) return fallback;
  if (target.type === 'entity' && typeof (target as any).entityId === 'string') return target;
  if (target.type === 'group' && typeof (target as any).groupId === 'string') return target;
  return fallback;
}

function toInlineCondition(condition: ConditionSpec | undefined): InlineConditionSpec | undefined {
  if (!condition) return undefined;
  if (condition.type === 'BoundsHit') {
    return {
      type: 'BoundsHit',
      bounds: condition.bounds,
      mode: condition.mode,
      scope: condition.scope,
      behavior: condition.behavior,
    };
  }
  if (condition.type === 'ElapsedTime') {
    return { type: 'ElapsedTime', durationMs: condition.durationMs };
  }
  return undefined;
}

function collectLegacyActionsInOrder(scene: SceneSpec, actionId: string | undefined): ActionSpec[] {
  if (!actionId) return [];
  const action = scene.actions[actionId];
  if (!action) return [];

  if (action.type === 'Sequence') {
    return action.children.flatMap((childId) => collectLegacyActionsInOrder(scene, childId));
  }
  if (action.type === 'Repeat') {
    return collectLegacyActionsInOrder(scene, action.childId);
  }
  return [action];
}

function buildAttachmentsFromLegacy(scene: SceneSpec): Record<string, AttachmentSpec> {
  const next: Record<string, AttachmentSpec> = {};
  const usedIds = new Set<string>();

  const allocId = (base: string): string => {
    let candidate = base;
    let counter = 2;
    while (usedIds.has(candidate)) {
      candidate = `${base}-${counter}`;
      counter += 1;
    }
    usedIds.add(candidate);
    return candidate;
  };

  const behaviors = Object.values(scene.behaviors ?? {});
  for (const behavior of behaviors) {
    const targetFallback = ensureTarget(behavior.target, { type: 'entity', entityId: Object.keys(scene.entities ?? {})[0] ?? '' });
    const ordered = collectLegacyActionsInOrder(scene, behavior.rootActionId);
    ordered.forEach((action, index) => {
      const presetId = action.type;
      const attachmentId = allocId(`att-${action.id}`);
      const attachment: AttachmentSpec = {
        id: attachmentId,
        name: (action as any).name,
        order: index,
        target: targetFallback,
        enabled: true,
        presetId,
      };

      if (action.type === 'MoveUntil') {
        attachment.target = ensureTarget(action.target, targetFallback);
        attachment.applyTo = attachment.target.type === 'group' ? 'group' : undefined;
        attachment.params = { velocityX: action.velocity.x, velocityY: action.velocity.y };
        attachment.condition = toInlineCondition(scene.conditions?.[action.conditionId]);
      } else if (action.type === 'Wait') {
        attachment.params = { durationMs: action.durationMs };
      } else if (action.type === 'Call') {
        attachment.target = ensureTarget(action.target, targetFallback);
        attachment.applyTo = attachment.target.type === 'group' ? 'group' : undefined;
        attachment.params = { callId: action.callId, ...(action.args ?? {}) };
      } else if (action.type === 'Repeat') {
        // Repeat nodes should have been flattened above; keep as no-op if encountered.
      }

      next[attachmentId] = attachment;
    });
  }

  return next;
}

export function migrateSceneSpec(raw: unknown): SceneSpec {
  const parsed = (raw && typeof raw === 'object') ? (raw as any) : {};
  const base: SceneSpec = {
    id: String(parsed.id ?? 'scene-1'),
    world: parsed.world,
    entities: coerceRecord(parsed.entities),
    groups: coerceRecord(parsed.groups),
    attachments: coerceRecord(parsed.attachments),
    ...(parsed.eventBlocks !== undefined ? { eventBlocks: coerceRecord(parsed.eventBlocks) } : {}),
    behaviors: coerceRecord(parsed.behaviors),
    actions: coerceRecord(parsed.actions),
    conditions: coerceRecord(parsed.conditions),
  };

  const migrateRepeatWrappers = (scene: SceneSpec): SceneSpec => {
    const attachments = scene.attachments ?? {};
    const buckets = new Map<string, AttachmentSpec[]>();
    for (const attachment of Object.values(attachments)) {
      const eventId = attachment.eventId ?? '';
      const trigger = eventId ? (scene.eventBlocks?.[eventId]?.trigger ?? { type: 'start' }) : (attachment.trigger ?? { type: 'start' });
      const key = `${JSON.stringify(attachment.target)}::${eventId}::${JSON.stringify(trigger)}`;
      const list = buckets.get(key) ?? [];
      list.push(attachment);
      buckets.set(key, list);
    }

    for (const list of buckets.values()) {
      const repeats = list.filter((a) => a.presetId === 'Repeat');
      if (repeats.length !== 1) continue;
      const repeat = repeats[0];
      if (Array.isArray(repeat.children) && repeat.children.length > 0) continue;
      if (repeat.parentAttachmentId) continue;
      const others = list.filter((a) => a.id !== repeat.id);
      if (others.length === 0) continue;
      if (others.some((a) => a.parentAttachmentId)) continue;
      if (others.some((a) => Array.isArray(a.children) && a.children.length > 0)) continue;
      const sorted = [...others].sort((a, b) => {
        const ao = a.order ?? 0;
        const bo = b.order ?? 0;
        if (ao !== bo) return ao - bo;
        return a.id.localeCompare(b.id);
      });
      repeat.children = sorted.map((a) => a.id);
      for (const child of sorted) {
        child.parentAttachmentId = repeat.id;
      }
    }

    return scene;
  };

  if (Object.keys(base.attachments).length > 0) {
    return migrateRepeatWrappers(base);
  }

  if (Object.keys(base.behaviors).length === 0) {
    return {
      ...base,
      attachments: {},
      behaviors: {},
      actions: {},
      conditions: {},
    };
  }

  const attachments = buildAttachmentsFromLegacy(base);
  return migrateRepeatWrappers({
    ...base,
    attachments,
    behaviors: {},
    actions: {},
    conditions: {},
  });
}

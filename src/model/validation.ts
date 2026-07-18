import {
  CollisionRuleSpec,
  ProjectSpec,
  SpriteAssetSpec,
  SceneSpec,
  ActionSpec,
  SequenceActionSpec,
  ParallelActionSpec,
  MoveUntilActionSpec,
  CallActionSpec,
  RepeatActionSpec,
  TargetRef,
  TriggerZoneSpec,
  type AttachmentSpec,
  type AttachmentTriggerSpec,
  type InlineConditionSpec,
} from './types';
import { normalizeProjectPixelsPerUnit, normalizeProjectRenderMode } from './projectPixelScale';
import { resolveEntityDefaults } from './entityDefaults';
import { BOUNDS_AXIS_FILTER_VALUES, BOUNDS_EVENT_VALUES, BOUNDS_SIDE_FILTER_VALUES } from './events';

export function validateProjectSpec(project: ProjectSpec): void {
  if (!project || typeof project !== 'object') throw new Error('Project must be an object');
  if (typeof project.id !== 'string' || project.id.length === 0) throw new Error('Project must have an id');
  if (!project.assets || typeof project.assets !== 'object') throw new Error('Project must have assets');
  if (!project.audio || typeof project.audio !== 'object') throw new Error('Project must have audio');
  if (!project.inputMaps || typeof project.inputMaps !== 'object') throw new Error('Project must have inputMaps');
  if (!project.scenes || typeof project.scenes !== 'object') throw new Error('Project must have scenes');
  if (project.pixelsPerUnit !== undefined && normalizeProjectPixelsPerUnit(project.pixelsPerUnit) !== project.pixelsPerUnit) {
    throw new Error('Project pixelsPerUnit must be a positive integer');
  }
  if (project.renderMode !== undefined && normalizeProjectRenderMode(project.renderMode) !== project.renderMode) {
    throw new Error('Project renderMode must be pixel-art or smooth-2d');
  }
  if (typeof project.initialSceneId !== 'string' || project.initialSceneId.length === 0) {
    throw new Error('Project must have an initialSceneId');
  }
  if (!project.scenes[project.initialSceneId]) {
    throw new Error(`initialSceneId references unknown scene ${project.initialSceneId}`);
  }
  if (project.baseSceneId && !project.scenes[project.baseSceneId]) {
    throw new Error(`baseSceneId references unknown scene ${project.baseSceneId}`);
  }
  if (project.defaultInputMapId && !project.inputMaps[project.defaultInputMapId]) {
    throw new Error(`defaultInputMapId references unknown input map ${project.defaultInputMapId}`);
  }
  for (const [sceneId, scene] of Object.entries(project.scenes)) {
    if (scene.id !== sceneId) {
      throw new Error(`Scene id mismatch: key=${sceneId} value=${scene.id}`);
    }
    validateSceneSpec(scene);
  }
}

export function validateSceneSpec(scene: SceneSpec): void {
  validateSceneAppearance(scene);
  validateEntities(scene);
  validateGroups(scene);
  validateCollisionsAndTriggers(scene);
  validateAttachments(scene);
  validateActions(scene);
  validateBehaviors(scene);
  detectCycles(scene);
}

function validateRgbInteger(value: unknown, context: string): void {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 0xffffff) {
    throw new Error(`${context} must be an integer RGB value between 0x000000 and 0xFFFFFF`);
  }
}

function validateSceneAppearance(scene: SceneSpec): void {
  const backgroundColor = (scene as any).backgroundColor;
  if (backgroundColor !== undefined) validateRgbInteger(backgroundColor, 'Scene backgroundColor');
}

function validateEntities(scene: SceneSpec): void {
  if (scene.world && (scene.world.width < 1 || scene.world.height < 1)) {
    throw new Error('Scene world must have positive width and height');
  }
  for (const [id, entity] of Object.entries(scene.entities)) {
    const resolved = resolveEntityDefaults(entity);
    if (entity.id !== id) {
      throw new Error(`Entity id mismatch: key=${id} value=${entity.id}`);
    }
    if ((entity as any).text && entity.asset) {
      throw new Error(`Entity ${id} cannot have both text and asset`);
    }
    if (resolved.rotationDeg < 0 || resolved.rotationDeg > 359) {
      throw new Error(`Entity ${id} rotation must be between 0 and 359 degrees`);
    }
    if (resolved.scaleX <= 0 || resolved.scaleY <= 0) {
      throw new Error(`Entity ${id} scale must be greater than 0`);
    }
    if (resolved.originX < 0 || resolved.originX > 1 || resolved.originY < 0 || resolved.originY > 1) {
      throw new Error(`Entity ${id} origin must be between 0 and 1`);
    }
    if (resolved.alpha < 0 || resolved.alpha > 1) {
      throw new Error(`Entity ${id} alpha must be between 0 and 1`);
    }
    if (entity.tint !== undefined) {
      validateRgbInteger(entity.tint, `Entity ${id} tint`);
    }
    if (entity.hitbox) {
      validateHitbox(entity.hitbox, resolved, id);
    }
    if (entity.asset) {
      validateAsset(entity.asset, id);
    }
  }
}

function validateHitbox(
  hitbox: { x: number; y: number; width: number; height: number },
  entity: { width: number; height: number },
  entityId: string
): void {
  if (hitbox.width <= 0 || hitbox.height <= 0) {
    throw new Error(`Entity ${entityId} hitbox must have positive width and height`);
  }
  if (hitbox.x < 0 || hitbox.y < 0) {
    throw new Error(`Entity ${entityId} hitbox position must be >= 0`);
  }
  if (hitbox.x + hitbox.width > entity.width || hitbox.y + hitbox.height > entity.height) {
    throw new Error(`Entity ${entityId} hitbox must fit within entity width/height`);
  }
}

function validateAsset(asset: SpriteAssetSpec, entityId: string): void {
  if (asset.source.kind === 'asset') {
    if (!asset.source.assetId) {
      throw new Error(`Entity ${entityId} asset reference requires an assetId`);
    }
  } else {
    if (asset.source.kind === 'embedded' && !asset.source.dataUrl.startsWith('data:')) {
      throw new Error(`Entity ${entityId} embedded asset must use a data URL`);
    }
    if (asset.source.kind === 'path' && !asset.source.path.trim()) {
      throw new Error(`Entity ${entityId} path asset must include a path`);
    }
    if (asset.source.kind === 'cloud' && !asset.source.assetId) {
      throw new Error(`Entity ${entityId} cloud asset must include an assetId`);
    }
  }

  if (asset.imageType === 'spritesheet') {
    if (!asset.grid) {
      throw new Error(`Entity ${entityId} spritesheet asset requires grid metadata`);
    }
    if (asset.grid.frameWidth < 1 || asset.grid.frameHeight < 1 || asset.grid.columns < 1 || asset.grid.rows < 1) {
      throw new Error(`Entity ${entityId} spritesheet grid dimensions must be positive`);
    }
    if (asset.frame?.kind === 'spritesheet-frame') {
      if ((asset.frame.frameIndex === undefined || asset.frame.frameIndex < 0) && !asset.frame.frameKey) {
        throw new Error(`Entity ${entityId} spritesheet frame requires a non-negative frame index or frame key`);
      }
    }
  }
}

function validateGroups(scene: SceneSpec): void {
  for (const [id, group] of Object.entries(scene.groups)) {
    if (group.id !== id) {
      throw new Error(`Group id mismatch: key=${id} value=${group.id}`);
    }
    for (const memberId of group.members) {
      if (!scene.entities[memberId]) {
        throw new Error(`Group ${id} references unknown entity ${memberId}`);
      }
    }
    if (group.layout?.type === 'grid') {
      if (group.layout.rows < 1 || group.layout.cols < 1) {
        throw new Error(`Group ${id} has invalid grid layout size`);
      }
      if (group.layout.rows * group.layout.cols !== group.members.length) {
        throw new Error(`Group ${id} grid layout does not match member count`);
      }
    }
  }
}

function validateCollisionsAndTriggers(scene: SceneSpec): void {
  const anyScene = scene as any as { collisionRules?: CollisionRuleSpec[]; triggers?: TriggerZoneSpec[] };

  const validateCall = (call: any, context: string) => {
    if (!call || typeof call !== 'object') throw new Error(`${context} must be an object`);
    if (typeof call.callId !== 'string' || call.callId.length === 0) throw new Error(`${context} must have callId`);
    if (call.args != null && (typeof call.args !== 'object' || Array.isArray(call.args))) throw new Error(`${context} args must be an object`);
  };

  const collisionRules = anyScene.collisionRules ?? [];
  if (!Array.isArray(collisionRules)) {
    throw new Error('Scene collisionRules must be an array');
  }
  for (const rule of collisionRules) {
    if (!rule || typeof rule !== 'object') throw new Error('Collision rule must be an object');
    if (typeof (rule as any).id !== 'string' || (rule as any).id.length === 0) throw new Error('Collision rule must have an id');
    if ((rule as any).a?.type !== 'layer' || typeof (rule as any).a?.layer !== 'string' || (rule as any).a.layer.length === 0) {
      throw new Error(`Collision rule ${(rule as any).id} must have a.layer`);
    }
    if ((rule as any).b?.type !== 'layer' || typeof (rule as any).b?.layer !== 'string' || (rule as any).b.layer.length === 0) {
      throw new Error(`Collision rule ${(rule as any).id} must have b.layer`);
    }
    if ((rule as any).interaction !== 'block' && (rule as any).interaction !== 'overlap') {
      throw new Error(`Collision rule ${(rule as any).id} must have interaction=block|overlap`);
    }

    const onEnter = (rule as any).onEnter;
    if (onEnter != null) {
      if (Array.isArray(onEnter)) {
        for (let i = 0; i < onEnter.length; i += 1) {
          validateCall(onEnter[i], `Collision rule ${(rule as any).id} onEnter[${i}]`);
        }
      } else {
        validateCall(onEnter, `Collision rule ${(rule as any).id} onEnter`);
      }
    }
  }

  const triggers = anyScene.triggers ?? [];
  if (!Array.isArray(triggers)) throw new Error('Scene triggers must be an array');
  for (const zone of triggers) {
    if (!zone || typeof zone !== 'object') throw new Error('Trigger zone must be an object');
    if (typeof (zone as any).id !== 'string' || (zone as any).id.length === 0) throw new Error('Trigger zone must have an id');
    const rect = (zone as any).rect;
    if (!rect || typeof rect !== 'object') throw new Error(`Trigger zone ${(zone as any).id} must have rect`);
    const w = Number(rect.width);
    const h = Number(rect.height);
    if (!Number.isFinite(Number(rect.x)) || !Number.isFinite(Number(rect.y)) || !Number.isFinite(w) || !Number.isFinite(h)) {
      throw new Error(`Trigger zone ${(zone as any).id} rect must be numeric`);
    }
    if (w <= 0 || h <= 0) throw new Error(`Trigger zone ${(zone as any).id} rect must have positive width/height`);
  }
}

function validateTarget(scene: SceneSpec, target: TargetRef, context: string): void {
  if (target.type === 'entity') {
    if (!scene.entities[target.entityId]) {
      throw new Error(`${context} references unknown entity ${target.entityId}`);
    }
    return;
  }
  if (!scene.groups[target.groupId]) {
    throw new Error(`${context} references unknown group ${target.groupId}`);
  }
}

function validateInlineCondition(condition: InlineConditionSpec, context: string): void {
  switch (condition.type) {
    case 'BoundsHit': {
      const b = (condition as any).bounds;
      if (!b || typeof b !== 'object') throw new Error(`${context} bounds must be an object`);
      for (const key of ['minX', 'maxX', 'minY', 'maxY'] as const) {
        if (!Number.isFinite(Number((b as any)[key]))) throw new Error(`${context} bounds.${key} must be numeric`);
      }
      return;
    }
    case 'ElapsedTime': {
      const ms = Number((condition as any).durationMs);
      if (!Number.isFinite(ms) || ms < 0) throw new Error(`${context} durationMs must be >= 0`);
      return;
    }
    case 'Instant':
      return;
    case 'CounterCompare': {
      if (typeof (condition as any).counterId !== 'string' || (condition as any).counterId.length === 0) {
        throw new Error(`${context} counterId must be a non-empty string`);
      }
      const value = Number((condition as any).value);
      if (!Number.isFinite(value)) throw new Error(`${context} value must be numeric`);
      const op = String((condition as any).op);
      if (op !== '==' && op !== '>=' && op !== '<=') throw new Error(`${context} op must be one of ==, >=, <=`);
      return;
    }
    case 'InputActionEdge': {
      if (typeof (condition as any).actionId !== 'string' || (condition as any).actionId.length === 0) {
        throw new Error(`${context} actionId must be a non-empty string`);
      }
      const edge = String((condition as any).edge);
      if (edge !== 'pressed' && edge !== 'released') throw new Error(`${context} edge must be pressed|released`);
      return;
    }
    default:
      throw new Error(`${context} has unknown type ${(condition as any).type}`);
  }
}

function validateAttachmentTrigger(trigger: AttachmentTriggerSpec, context: string): void {
  const type = String((trigger as any).type);
  if (type !== 'start' && type !== 'update' && type !== 'input_action' && type !== 'visible' && type !== 'event' && type !== 'bounds') {
    throw new Error(`${context} type must be start|update|input_action|visible|event|bounds`);
  }
  if (type === 'input_action') {
    if (typeof (trigger as any).actionId !== 'string' || (trigger as any).actionId.length === 0) {
      throw new Error(`${context} actionId must be a non-empty string`);
    }
    const edge = String((trigger as any).edge);
    if (edge !== 'pressed' && edge !== 'released') throw new Error(`${context} edge must be pressed|released`);
  }
  if (type === 'visible') {
    const edge = String((trigger as any).edge);
    if (edge !== 'shown' && edge !== 'hidden') throw new Error(`${context} edge must be shown|hidden`);
  }
  if (type === 'event') {
    if (typeof (trigger as any).eventName !== 'string' || (trigger as any).eventName.length === 0) {
      throw new Error(`${context} eventName must be a non-empty string`);
    }
  }
  if (type === 'bounds') {
    const boundsEvent = String((trigger as any).boundsEvent ?? '');
    if (!(BOUNDS_EVENT_VALUES as readonly string[]).includes(boundsEvent)) {
      throw new Error(`${context} boundsEvent must be ${BOUNDS_EVENT_VALUES.join('|')}`);
    }
    const axis = String((trigger as any).axis ?? 'any');
    if (!(BOUNDS_AXIS_FILTER_VALUES as readonly string[]).includes(axis)) {
      throw new Error(`${context} axis must be ${BOUNDS_AXIS_FILTER_VALUES.join('|')}`);
    }
    const side = String((trigger as any).side ?? 'any');
    if (!(BOUNDS_SIDE_FILTER_VALUES as readonly string[]).includes(side)) {
      throw new Error(`${context} side must be ${BOUNDS_SIDE_FILTER_VALUES.join('|')}`);
    }
  }
}

function validateAttachments(scene: SceneSpec): void {
  const eventBlocks = (scene as any).eventBlocks ?? {};
  if (eventBlocks && typeof eventBlocks !== 'object') throw new Error('Scene eventBlocks must be an object');
  for (const [id, block] of Object.entries(eventBlocks)) {
    if (!block || typeof block !== 'object') throw new Error(`EventBlock ${id} must be an object`);
    if (String((block as any).id) !== id) throw new Error(`EventBlock id mismatch: key=${id} value=${(block as any).id}`);
    validateTarget(scene, (block as any).target, `EventBlock ${id} target`);
    if ((block as any).trigger) validateAttachmentTrigger((block as any).trigger, `EventBlock ${id} trigger`);
  }

  for (const [id, attachment] of Object.entries(scene.attachments ?? {})) {
    if (!attachment || typeof attachment !== 'object') throw new Error(`Attachment ${id} must be an object`);
    const a = attachment as AttachmentSpec;
    if (a.id !== id) throw new Error(`Attachment id mismatch: key=${id} value=${(a as any).id}`);
    validateTarget(scene, a.target, `Attachment ${id} target`);
    if (typeof (a as any).presetId !== 'string' || (a as any).presetId.length === 0) {
      throw new Error(`Attachment ${id} presetId must be a non-empty string`);
    }
    if (a.applyTo && a.applyTo !== 'group' && a.applyTo !== 'members') {
      throw new Error(`Attachment ${id} applyTo must be group|members`);
    }
    if ((a as any).targetMode && (a as any).targetMode !== 'owner' && (a as any).targetMode !== 'event-source') {
      throw new Error(`Attachment ${id} targetMode must be owner|event-source`);
    }
    if (a.eventId) {
      const block = (eventBlocks as any)[a.eventId];
      if (!block) throw new Error(`Attachment ${id} references unknown eventBlock ${a.eventId}`);
      const targetA = JSON.stringify(a.target);
      const targetB = JSON.stringify((block as any).target);
      if (targetA !== targetB) throw new Error(`Attachment ${id} target must match eventBlock ${a.eventId} target`);
    }
    if (a.trigger) validateAttachmentTrigger(a.trigger, `Attachment ${id} trigger`);
    if (a.condition) validateInlineCondition(a.condition, `Attachment ${id} condition`);
    if (a.presetId === 'SetProperty') validateSetPropertyAttachment(a, `Attachment ${id}`);
  }

  const attachments = scene.attachments ?? {};
  const getAttachmentBucketKey = (a: AttachmentSpec): string => {
    const targetKey = JSON.stringify(a.target);
    const eventId = a.eventId ?? '';
    const trigger = a.trigger ?? (scene.eventBlocks?.[a.eventId ?? ''] as any)?.trigger;
    return `${targetKey}::${eventId}::${JSON.stringify(trigger ?? { type: 'start' })}`;
  };

  // Composite nesting validation (Repeat only for v1).
  for (const [id, attachment] of Object.entries(attachments)) {
    const a = attachment as AttachmentSpec;
    if (a.parentAttachmentId) {
      const parent = attachments[a.parentAttachmentId];
      if (!parent) throw new Error(`Attachment ${id} references unknown parentAttachmentId ${a.parentAttachmentId}`);
      if ((parent as any).presetId !== 'Repeat') throw new Error(`Attachment ${id} parent ${a.parentAttachmentId} must be a Repeat composite`);
      const parentChildren = (parent as any).children;
      if (!Array.isArray(parentChildren) || !parentChildren.includes(id)) {
        throw new Error(`Attachment ${id} parent ${a.parentAttachmentId} children must include ${id}`);
      }
      if (getAttachmentBucketKey(a) !== getAttachmentBucketKey(parent as any)) {
        throw new Error(`Attachment ${id} must share target/event/trigger bucket with parent ${a.parentAttachmentId}`);
      }
    }

    if (a.children) {
      if ((a as any).presetId !== 'Repeat') throw new Error(`Attachment ${id} children are only supported for Repeat composites`);
      if (!Array.isArray(a.children)) throw new Error(`Attachment ${id} children must be an array`);
      const seen = new Set<string>();
      for (const childId of a.children) {
        if (typeof childId !== 'string' || childId.length === 0) throw new Error(`Attachment ${id} children must contain ids`);
        if (seen.has(childId)) throw new Error(`Attachment ${id} children must not contain duplicates (${childId})`);
        seen.add(childId);
        const child = attachments[childId];
        if (!child) throw new Error(`Attachment ${id} references unknown child ${childId}`);
        if ((child as any).parentAttachmentId !== id) throw new Error(`Attachment ${childId} parentAttachmentId must equal ${id}`);
        if (getAttachmentBucketKey(child as any) !== getAttachmentBucketKey(a)) {
          throw new Error(`Attachment ${childId} must share target/event/trigger bucket with parent ${id}`);
        }
      }
    }
  }

  // Cycle detection across attachment nesting.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visitAttachment = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Attachment nesting cycle detected at ${id}`);
    visiting.add(id);
    const a = attachments[id];
    const children = (a as any)?.children;
    if (Array.isArray(children)) {
      for (const childId of children) visitAttachment(String(childId));
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of Object.keys(attachments)) visitAttachment(id);
}

function validateSetPropertyAttachment(attachment: AttachmentSpec, context: string): void {
  const property = String((attachment.params as any)?.property ?? '');
  const propertyTypes: Record<string, 'number' | 'boolean' | 'color'> = {
    x: 'number',
    y: 'number',
    vx: 'number',
    vy: 'number',
    alpha: 'number',
    tint: 'color',
    visible: 'boolean',
  };
  const type = propertyTypes[property];
  if (!type) throw new Error(`${context} SetProperty property must be x|y|vx|vy|alpha|tint|visible`);

  const source = (attachment.params as any)?.valueSource ?? { kind: 'constant', value: (attachment.params as any)?.value };
  if (!source || typeof source !== 'object') throw new Error(`${context} valueSource must be an object`);
  const kind = String((source as any).kind ?? 'constant');
  if (kind === 'constant') {
    const value = (source as any).value;
    if (type === 'boolean' && typeof value !== 'boolean') throw new Error(`${context} valueSource.value must be boolean`);
    if (type === 'number' && !Number.isFinite(Number(value))) throw new Error(`${context} valueSource.value must be numeric`);
    if (type === 'color') validateRgbInteger(value, `${context} valueSource.value`);
    return;
  }
  if (kind === 'randomRange') {
    if (type === 'boolean') throw new Error(`${context} visible does not support randomRange`);
    if (!Number.isFinite(Number((source as any).min)) || !Number.isFinite(Number((source as any).max))) {
      throw new Error(`${context} randomRange min/max must be numeric`);
    }
    if (typeof (source as any).seed !== 'string' && typeof (source as any).seed !== 'number') {
      throw new Error(`${context} randomRange seed must be string or number`);
    }
    return;
  }
  if (kind === 'eventField') {
    const field = String((source as any).field ?? '');
    const numericFields = new Set(['positionX', 'positionY', 'priorPositionX', 'priorPositionY']);
    const primitiveFields = new Set(['sourceId', 'outcome', 'axis', 'side', ...numericFields]);
    if (!primitiveFields.has(field)) {
      throw new Error(`${context} eventField field must be sourceId|outcome|axis|side|positionX|positionY|priorPositionX|priorPositionY`);
    }
    if (type === 'boolean') throw new Error(`${context} visible does not support eventField`);
    if (!numericFields.has(field)) throw new Error(`${context} eventField must select a numeric field for ${property}`);
    return;
  }
  throw new Error(`${context} valueSource.kind must be constant|randomRange|eventField`);
}

function validateActions(scene: SceneSpec): void {
  for (const [id, action] of Object.entries(scene.actions)) {
    if (action.id !== id) {
      throw new Error(`Action id mismatch: key=${id} value=${action.id}`);
    }

    switch (action.type) {
      case 'Sequence': {
        const seq = action as SequenceActionSpec;
        for (const childId of seq.children) {
          if (!scene.actions[childId]) {
            throw new Error(`Sequence ${id} references unknown action ${childId}`);
          }
        }
        break;
      }
      case 'Parallel': {
        const par = action as ParallelActionSpec;
        for (const childId of par.children) {
          if (!scene.actions[childId]) {
            throw new Error(`Parallel ${id} references unknown action ${childId}`);
          }
        }
        break;
      }
      case 'MoveUntil': {
        const move = action as MoveUntilActionSpec;
        validateTarget(scene, move.target, `MoveUntil ${id} target`);
        if (!scene.conditions[move.conditionId]) {
          throw new Error(`MoveUntil ${id} references unknown condition ${move.conditionId}`);
        }
        break;
      }
      case 'Wait':
      case 'Call':
        if (action.type === 'Call') {
          const call = action as CallActionSpec;
          if (call.target) {
            validateTarget(scene, call.target, `Call ${id} target`);
          }
        }
        break;
      case 'Repeat': {
        const repeat = action as RepeatActionSpec;
        if (!scene.actions[repeat.childId]) {
          throw new Error(`Repeat ${id} references unknown action ${repeat.childId}`);
        }
        break;
      }
      default:
        throw new Error(`Unknown action type: ${(action as ActionSpec).type}`);
    }
  }
}

function validateBehaviors(scene: SceneSpec): void {
  for (const [id, behavior] of Object.entries(scene.behaviors)) {
    if (behavior.id !== id) {
      throw new Error(`Behavior id mismatch: key=${id} value=${behavior.id}`);
    }
    validateTarget(scene, behavior.target, `Behavior ${id} target`);
    if (behavior.rootActionId && !scene.actions[behavior.rootActionId]) {
      throw new Error(`Behavior ${id} references missing root action ${behavior.rootActionId}`);
    }
  }
}

function detectCycles(scene: SceneSpec): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (actionId: string | undefined): void => {
    if (!actionId) return;
    if (visiting.has(actionId)) {
      throw new Error(`Action cycle detected at ${actionId}`);
    }
    if (visited.has(actionId)) return;
    visiting.add(actionId);
    const action = scene.actions[actionId];
    if (!action) {
      throw new Error(`Unknown action ${actionId} during cycle check`);
    }
    if (action.type === 'Sequence' || action.type === 'Parallel') {
      for (const childId of action.children) visit(childId);
    }
    visiting.delete(actionId);
    visited.add(actionId);
  };

  for (const behavior of Object.values(scene.behaviors)) {
    visit(behavior.rootActionId);
  }
}

import {
  SpriteAssetSpec,
  SceneSpec,
  ActionSpec,
  SequenceActionSpec,
  MoveUntilActionSpec,
  CallActionSpec,
  RepeatActionSpec,
  TargetRef,
} from './types';
import { resolveEntityDefaults } from './entityDefaults';

export function validateSceneSpec(scene: SceneSpec): void {
  validateEntities(scene);
  validateGroups(scene);
  validateActions(scene);
  validateBehaviors(scene);
  detectCycles(scene);
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
  if (asset.source.kind === 'embedded') {
    if (!asset.source.dataUrl.startsWith('data:')) {
      throw new Error(`Entity ${entityId} embedded asset must use a data URL`);
    }
  } else if (!asset.source.path) {
    throw new Error(`Entity ${entityId} path asset requires a path`);
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
    if (action.type === 'Sequence') {
      for (const childId of action.children) {
        visit(childId);
      }
    }
    visiting.delete(actionId);
    visited.add(actionId);
  };

  for (const behavior of Object.values(scene.behaviors)) {
    visit(behavior.rootActionId);
  }
}

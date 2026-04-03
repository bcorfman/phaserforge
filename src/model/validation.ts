import {
  SceneSpec,
  ActionSpec,
  SequenceActionSpec,
  MoveUntilActionSpec,
  TargetRef,
} from './types';

export function validateSceneSpec(scene: SceneSpec): void {
  validateEntities(scene);
  validateGroups(scene);
  validateActions(scene);
  validateBehaviors(scene);
  detectCycles(scene);
}

function validateEntities(scene: SceneSpec): void {
  for (const [id, entity] of Object.entries(scene.entities)) {
    if (entity.id !== id) {
      throw new Error(`Entity id mismatch: key=${id} value=${entity.id}`);
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
        break;
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
    if (!scene.actions[behavior.rootActionId]) {
      throw new Error(`Behavior ${id} references missing root action ${behavior.rootActionId}`);
    }
  }
}

function detectCycles(scene: SceneSpec): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (actionId: string): void => {
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

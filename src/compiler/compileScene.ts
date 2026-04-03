import { SceneSpec } from '../model/types';
import { validateSceneSpec } from '../model/validation';
import { ActionManager } from '../runtime/ActionManager';
import { RuntimeEntity, RuntimeGroup } from '../runtime/targets/types';
import { createFormationGroup } from '../runtime/targets/createFormationGroup';
import { compileBehavior, CompileOptions } from './compileBehaviors';

export interface CompiledScene {
  scene: SceneSpec;
  entities: Record<string, RuntimeEntity>;
  groups: Record<string, RuntimeGroup>;
  behaviors: Record<string, ReturnType<typeof compileBehavior>>;
  actionManager: ActionManager;
  startAll(): void;
  reset(): void;
}

export function compileScene(scene: SceneSpec, options?: CompileOptions): CompiledScene {
  validateSceneSpec(scene);

  const entities: Record<string, RuntimeEntity> = {};
  for (const entity of Object.values(scene.entities)) {
    entities[entity.id] = {
      id: entity.id,
      x: entity.x,
      y: entity.y,
      width: entity.width,
      height: entity.height,
      homeX: entity.x,
      homeY: entity.y,
      vx: 0,
      vy: 0,
    };
  }

  const groups: Record<string, RuntimeGroup> = {};
  for (const group of Object.values(scene.groups)) {
    groups[group.id] = createFormationGroup(
      group.id,
      group.members.map((memberId) => entities[memberId])
    );
  }

  const actionManager = new ActionManager();
  const behaviors: Record<string, ReturnType<typeof compileBehavior>> = {};
  for (const behavior of Object.values(scene.behaviors)) {
    behaviors[behavior.id] = compileBehavior(behavior, {
      scene,
      targets: { entities, groups },
      options,
    });
  }

  const startAll = (): void => {
    for (const action of Object.values(behaviors)) {
      actionManager.add(action);
    }
  };

  const reset = (): void => {
    actionManager.clear();
    for (const action of Object.values(behaviors)) {
      if (action.reset) action.reset();
    }
  };

  return { scene, entities, groups, behaviors, actionManager, startAll, reset };
}

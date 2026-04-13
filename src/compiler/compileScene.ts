import { SceneSpec } from '../model/types';
import { resolveEntityDefaults } from '../model/entityDefaults';
import { validateSceneSpec } from '../model/validation';
import { ActionManager } from '../runtime/ActionManager';
import { RuntimeEntity, RuntimeGroup } from '../runtime/targets/types';
import { createFormationGroup } from '../runtime/targets/createFormationGroup';
import { CompileOptions } from './compileBehaviors';
import { compileAttachments } from './compileAttachments';
import { migrateSceneSpec } from '../model/migrateScene';

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
  const migrated = migrateSceneSpec(scene);
  validateSceneSpec(migrated);

  const entities: Record<string, RuntimeEntity> = {};
  for (const entity of Object.values(migrated.entities)) {
    const resolved = resolveEntityDefaults(entity);
    entities[entity.id] = {
      id: resolved.id,
      x: resolved.x,
      y: resolved.y,
      width: resolved.width,
      height: resolved.height,
      rotationDeg: resolved.rotationDeg,
      scaleX: resolved.scaleX,
      scaleY: resolved.scaleY,
      originX: resolved.originX,
      originY: resolved.originY,
      alpha: resolved.alpha,
      visible: resolved.visible,
      depth: resolved.depth,
      flipX: resolved.flipX,
      flipY: resolved.flipY,
      asset: resolved.asset,
      hitbox: resolved.hitbox,
      homeX: resolved.x,
      homeY: resolved.y,
      vx: 0,
      vy: 0,
    };
  }

  const groups: Record<string, RuntimeGroup> = {};
  for (const group of Object.values(migrated.groups)) {
    groups[group.id] = createFormationGroup(
      group.id,
      group.members.map((memberId) => entities[memberId])
    );
  }

  const actionManager = new ActionManager();
  const behaviors = compileAttachments(migrated, { targets: { entities, groups }, options });

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

  return { scene: migrated, entities, groups, behaviors, actionManager, startAll, reset };
}

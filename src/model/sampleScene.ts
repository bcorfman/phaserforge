import { arrangeGrid } from './formation';
import { SceneSpec } from './types';

const enemyEntities = arrangeGrid(
  undefined,
  {
    rows: 3,
    cols: 5,
    startX: 220,
    startY: 140,
    spacingX: 48,
    spacingY: 40,
    factory: (index) => ({
      id: `e${index + 1}`,
      x: 0,
      y: 0,
      width: 28,
      height: 20,
      scaleX: 1,
      scaleY: 1,
      originX: 0.5,
      originY: 0.5,
      alpha: 1,
      visible: true,
      depth: 0,
      flipX: false,
      flipY: false,
      rotationDeg: 0,
    }),
  }
);

const entities = Object.fromEntries(enemyEntities.map((entity) => [entity.id, entity]));
const enemyIds = enemyEntities.map((entity) => entity.id);

export const sampleScene: SceneSpec = {
  id: 'scene-1',
  world: {
    width: 1024,
    height: 768,
  },
  entities,
  groups: {
    'g-enemies': {
      id: 'g-enemies',
      name: 'Enemy Formation',
      members: enemyIds,
      layout: {
        type: 'grid',
        rows: 3,
        cols: 5,
        startX: 220,
        startY: 140,
        spacingX: 48,
        spacingY: 40,
      },
    },
  },
  behaviors: {
    'b-formation': {
      id: 'b-formation',
      name: 'Formation Patrol',
      target: { type: 'group', groupId: 'g-enemies' },
      rootActionId: 'a-root',
    },
  },
  actions: {
    'a-root': { id: 'a-root', type: 'Repeat', name: 'Loop', childId: 'a-seq' },
    'a-seq': {
      id: 'a-seq',
      type: 'Sequence',
      name: 'Sweep + Drop',
      children: ['a-move-right', 'a-drop-right', 'a-wait-right', 'a-move-left', 'a-drop-left', 'a-wait-left'],
    },
    'a-move-right': {
      id: 'a-move-right',
      type: 'MoveUntil',
      name: 'Move Right',
      target: { type: 'group', groupId: 'g-enemies' },
      velocity: { x: 80, y: 0 },
      conditionId: 'c-bounds',
    },
    'a-move-left': {
      id: 'a-move-left',
      type: 'MoveUntil',
      name: 'Move Left',
      target: { type: 'group', groupId: 'g-enemies' },
      velocity: { x: -80, y: 0 },
      conditionId: 'c-bounds',
    },
    'a-drop-right': {
      id: 'a-drop-right',
      type: 'Call',
      name: 'Drop',
      callId: 'drop',
      target: { type: 'group', groupId: 'g-enemies' },
      args: { dy: 24 },
    },
    'a-drop-left': {
      id: 'a-drop-left',
      type: 'Call',
      name: 'Drop',
      callId: 'drop',
      target: { type: 'group', groupId: 'g-enemies' },
      args: { dy: 24 },
    },
    'a-wait-right': { id: 'a-wait-right', type: 'Wait', name: 'Pause', durationMs: 150 },
    'a-wait-left': { id: 'a-wait-left', type: 'Wait', name: 'Pause', durationMs: 150 },
  },
  conditions: {
    'c-bounds': {
      id: 'c-bounds',
      type: 'BoundsHit',
      bounds: { minX: 80, maxX: 944, minY: 60, maxY: 720 },
      mode: 'any',
      scope: 'group-extents',
      behavior: 'limit',
    },
  },
};

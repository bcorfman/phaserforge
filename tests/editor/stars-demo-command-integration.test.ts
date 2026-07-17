import { describe, expect, it } from 'vitest';
import { compileScene } from '../../src/compiler/compileScene';
import { initState, reducer } from '../../src/editor/EditorStore';
import { createEmptyProject } from '../../src/model/emptyProject';
import { serializeProjectToYaml, parseProjectYaml } from '../../src/model/serialization';

const STARS_SEEDS = ['stars-1', 'stars-2', 'stars-3', 'stars-4', 'stars-5'];

function seededState() {
  const base = initState();
  const project = createEmptyProject() as any;
  const scene = project.scenes[project.initialSceneId];
  scene.world = { width: 720, height: 1280 };
  scene.entities.e1 = {
    id: 'e1',
    name: 'Star Template',
    x: 0,
    y: 0,
    width: 3,
    height: 3,
    tint: 0xffffff,
  };
  return {
    ...base,
    project,
    currentSceneId: project.initialSceneId,
  };
}

function createStarsFormation(state: ReturnType<typeof seededState>, index: number) {
  const seed = STARS_SEEDS[index];
  let next = reducer(state as any, { type: 'begin-formation-draft', template: { kind: 'entity', entityId: 'e1' } } as any);
  next = reducer(next, {
    type: 'update-formation-draft',
    patch: {
      name: `Stars Blink ${index + 1}`,
      arrangeKind: 'scatter',
      memberCount: 80,
      params: {
        minX: 0,
        maxX: 720,
        minY: 5,
        maxY: 1285,
        seed,
        randomTint: true,
        tintMinR: 20,
        tintMaxR: 255,
        tintMinG: 20,
        tintMaxG: 255,
        tintMinB: 20,
        tintMaxB: 255,
      },
    },
  } as any);
  return reducer(next, { type: 'commit-formation-draft' } as any) as any;
}

function createAttachment(state: any, groupId: string, presetId: string, init: any) {
  const next = reducer(state, {
    type: 'create-attachment',
    target: { type: 'group', groupId },
    presetId,
    init,
  } as any) as any;
  const attachmentId = next.selection.kind === 'attachment' ? next.selection.id : undefined;
  if (!attachmentId) throw new Error(`Expected ${presetId} attachment selection`);
  return { state: next, attachmentId };
}

describe('stars demo command integration', () => {
  it('builds the faithful 400-star project through editor commands and runs the wrap reroll behavior', () => {
    let state: any = seededState();
    state = reducer(state, { type: 'set-scene-background-color', backgroundColor: 0x000000 } as any);

    for (let i = 0; i < STARS_SEEDS.length; i += 1) {
      state = createStarsFormation(state, i);
      const groupId = `g-stars-blink-${i + 1}`;

      const createdMove = createAttachment(state, groupId, 'MoveUntil', {
        applyTo: 'members',
        order: 0,
        params: { velocityX: 0, velocityY: -240 },
        condition: {
          type: 'BoundsHit',
          bounds: { minX: 0, minY: -5, maxX: 720, maxY: 1285 },
          mode: 'any',
          scope: 'member-any',
          behavior: 'wrap',
        },
      });
      state = createdMove.state;

      state = reducer(state, {
        type: 'create-event-block',
        target: { type: 'group', groupId },
        name: 'When Wrapped',
        trigger: { type: 'bounds', boundsEvent: 'wrapped', axis: 'y', side: 'any' },
      } as any);
      const afterEventScene = state.project.scenes[state.currentSceneId] as any;
      const eventEntry = Object.values(afterEventScene.eventBlocks).find((block: any) => block.target?.groupId === groupId && block.name === 'When Wrapped') as any;
      expect(eventEntry).toBeTruthy();

      const createdSet = createAttachment(state, groupId, 'SetProperty', {
        eventId: eventEntry.id,
        targetMode: 'event-source',
        order: 0,
        params: { property: 'x', valueSource: { kind: 'randomRange', min: 0, max: 720, seed: `wrap-${i + 1}` } },
      });
      state = createdSet.state;

      const updatedScene = state.project.scenes[state.currentSceneId] as any;
      expect(updatedScene.groups[groupId].members).toHaveLength(80);
      expect(updatedScene.attachments[createdMove.attachmentId].condition.behavior).toBe('wrap');
      expect(updatedScene.attachments[createdSet.attachmentId].targetMode).toBe('event-source');
    }

    const scene: any = state.project.scenes[state.currentSceneId];
    const groupIds = STARS_SEEDS.map((_, index) => `g-stars-blink-${index + 1}`);
    const memberIds = groupIds.flatMap((id) => scene.groups[id].members);
    expect(scene.backgroundColor).toBe(0x000000);
    expect(memberIds).toHaveLength(400);
    expect(new Set(memberIds).size).toBe(400);
    expect(memberIds.every((id) => Number.isInteger(scene.entities[id].tint))).toBe(true);

    const yaml = serializeProjectToYaml(state.project);
    const parsed = parseProjectYaml(yaml) as any;
    expect(parsed.scenes[state.currentSceneId].backgroundColor).toBe(0x000000);
    expect(parsed.scenes[state.currentSceneId].groups['g-stars-blink-1'].members).toHaveLength(80);

    const firstMemberId = scene.groups['g-stars-blink-1'].members[0];
    scene.entities[firstMemberId] = { ...scene.entities[firstMemberId], y: -10, x: 100 };
    const compiled = compileScene(scene);
    compiled.startAll();
    compiled.actionManager.update(0);
    compiled.updateTriggers(0);

    expect(compiled.debug?.lastDrainedEventNames).toContain('bounds:wrapped');
    expect(compiled.entities[firstMemberId].y).toBeGreaterThan(1200);
    expect(compiled.entities[firstMemberId].x).toBeGreaterThanOrEqual(0);
    expect(compiled.entities[firstMemberId].x).toBeLessThanOrEqual(720);
    expect(compiled.entities[firstMemberId].x).not.toBe(100);
    expect(Object.keys(compiled.entities)).toHaveLength(Object.keys(scene.entities).length);
  });
});

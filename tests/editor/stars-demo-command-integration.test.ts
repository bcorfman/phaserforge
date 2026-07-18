import { describe, expect, it } from 'vitest';
import { compileScene } from '../../src/compiler/compileScene';
import { initState, reducer } from '../../src/editor/EditorStore';
import { createEmptyProject } from '../../src/model/emptyProject';
import { parseProjectYaml, serializeProjectToYaml } from '../../src/model/serialization';

const STARS_SEEDS = ['stars-1', 'stars-2', 'stars-3', 'stars-4', 'stars-5'];
const BLINK_PERIODS = [200, 250, 300, 350, 400];
const WRAP_SEEDS = ['wrap-1', 'wrap-2', 'wrap-3', 'wrap-4', 'wrap-5'];

function sceneOf(state: any) {
  return state.project.scenes[state.currentSceneId];
}

function seededState() {
  const base = initState();
  const project = createEmptyProject() as any;
  const scene = project.scenes[project.initialSceneId];
  scene.world = { width: 720, height: 1280 };

  let state: any = { ...base, project, currentSceneId: project.initialSceneId };
  state = reducer(state, {
    type: 'add-image-asset-from-file',
    file: {
      dataUrl: 'data:image/png;base64,AAAA',
      originalName: 'star.png',
      mimeType: 'image/png',
      width: 3,
      height: 3,
    },
  } as any);
  const assetId = Object.keys(state.project.assets.images)[0];
  state = reducer(state, {
    type: 'create-entity-from-asset',
    assetKind: 'image',
    assetId,
    at: { x: 0, y: 0 },
  } as any);
  const templateId = Object.keys(sceneOf(state).entities).at(-1);
  if (!templateId) throw new Error('Expected the imported star entity to be selected');
  state = reducer(state, {
    type: 'update-entity',
    id: templateId,
    next: { ...sceneOf(state).entities[templateId], name: 'Star Template', width: 3, height: 3, tint: 0xffffff },
  } as any);
  state = reducer(state, { type: 'set-scene-background-color', backgroundColor: 0x000000 } as any);
  return { state, templateId, assetId };
}

function createFormation(state: any, templateId: string, index: number) {
  let next = reducer(state, { type: 'begin-formation-draft', template: { kind: 'entity', entityId: templateId } } as any);
  next = reducer(next, {
    type: 'update-formation-draft',
    patch: {
      name: `Stars Blink ${index + 1}`,
      arrangeKind: 'scatter',
      memberCount: 80,
      params: {
        minX: 0, maxX: 720, minY: 5, maxY: 1285, seed: STARS_SEEDS[index], randomTint: true,
        tintMinR: 20, tintMaxR: 255, tintMinG: 20, tintMaxG: 255, tintMinB: 20, tintMaxB: 255,
      },
    },
  } as any);
  return reducer(next, { type: 'commit-formation-draft' } as any);
}

function createAttachment(state: any, groupId: string, presetId: string, init: any) {
  const next = reducer(state, {
    type: 'create-attachment', target: { type: 'group', groupId }, presetId, init,
  } as any) as any;
  const attachmentId = next.selection.kind === 'attachment' ? next.selection.id : undefined;
  if (!attachmentId) throw new Error(`Expected ${presetId} attachment selection`);
  return { state: next, attachmentId };
}

function addVelocityRecipe(state: any, groupId: string, index: number) {
  const attachments: string[] = [];
  const add = (presetId: string, init: any) => {
    const created = createAttachment(state, groupId, presetId, init);
    state = created.state;
    attachments.push(created.attachmentId);
  };
  const parallelTag = `pargrp:stars-velocity-${index + 1}`;
  add('BlinkUntil', { applyTo: 'members', order: 0, tag: `${parallelTag}:blink`, params: { secondsUntilChange: BLINK_PERIODS[index] / 1000 } });
  add('MoveUntil', {
    applyTo: 'members', order: 1, tag: `${parallelTag}:move`, params: { velocityX: 0, velocityY: 0 },
    condition: { type: 'BoundsHit', bounds: { minX: 0, minY: -5, maxX: 720, maxY: 1285 }, mode: 'any', scope: 'member-any', behavior: 'wrap' },
  });
  const repeat = createAttachment(state, groupId, 'Repeat', { applyTo: 'members', order: 2, tag: `${parallelTag}:sequence`, params: {} });
  state = repeat.state;
  const repeatId = repeat.attachmentId;
  const children: string[] = [];
  const child = (presetId: string, order: number, params: any) => {
    const created = createAttachment(state, groupId, presetId, { applyTo: 'members', parentAttachmentId: repeatId, order, params });
    state = created.state;
    children.push(created.attachmentId);
  };
  child('Wait', 0, { durationMs: 1000 });
  child('TweenUntil', 1, { property: 'vy', from: 'current', endValue: -240, durationMs: 2000, easing: 'easeIn' });
  child('Wait', 2, { durationMs: 5000 });
  child('TweenUntil', 3, { property: 'vy', from: 'current', endValue: 840, durationMs: 500, easing: 'easeOut' });
  child('Wait', 4, { durationMs: 1500 });
  child('TweenUntil', 5, { property: 'vy', from: 'current', endValue: 0, durationMs: 2000, easing: 'easeOut' });
  state = reducer(state, {
    type: 'update-attachment',
    id: repeatId,
    next: { ...sceneOf(state).attachments[repeatId], children },
  } as any);
  return { state, attachments };
}

function buildStarsFixture() {
  const seeded = seededState();
  let state: any = seeded.state;
  const groupIds: string[] = [];
  for (let index = 0; index < STARS_SEEDS.length; index += 1) {
    state = createFormation(state, seeded.templateId, index);
    const groupId = Object.keys(sceneOf(state).groups).find((id) => sceneOf(state).groups[id].name === `Stars Blink ${index + 1}`)!;
    groupIds.push(groupId);
    const before = sceneOf(state);
    expect(before.groups[groupId].members).toHaveLength(80);
    expect(before.groups[groupId].layout.params).toMatchObject({ minX: 0, maxX: 720, minY: 5, maxY: 1285, seed: STARS_SEEDS[index], randomTint: true });

    state = addVelocityRecipe(state, groupId, index).state;
    state = reducer(state, { type: 'create-event-block', target: { type: 'group', groupId }, name: 'When Wrapped', trigger: { type: 'bounds', boundsEvent: 'wrapped', axis: 'y', side: 'any' } } as any);
    const event = Object.values(sceneOf(state).eventBlocks ?? {}).find((block: any) => block.target?.groupId === groupId) as any;
    const set = createAttachment(state, groupId, 'SetProperty', {
      eventId: event.id, targetMode: 'event-source', order: 0,
      params: { property: 'x', valueSource: { kind: 'randomRange', min: 0, max: 720, seed: WRAP_SEEDS[index] } },
    });
    state = set.state;
  }
  return { state, groupIds, templateId: seeded.templateId, assetId: seeded.assetId };
}

describe('stars demo command integration', () => {
  it('builds and persists the documented 400-star fixture through editor commands', () => {
    const fixture = buildStarsFixture();
    const scene: any = sceneOf(fixture.state);
    const members = fixture.groupIds.flatMap((id) => scene.groups[id].members);
    expect(scene.world).toEqual({ width: 720, height: 1280 });
    expect(scene.backgroundColor).toBe(0x000000);
    expect(Object.keys(fixture.state.project.assets.images)).toEqual([fixture.assetId]);
    expect(scene.entities[fixture.templateId].asset.source.assetId).toBe(fixture.assetId);
    expect(members).toHaveLength(400);
    expect(new Set(members).size).toBe(400);
    expect(members.every((id: string) => Number.isInteger(scene.entities[id].tint))).toBe(true);

    const attachmentList = Object.values(scene.attachments) as any[];
    expect(attachmentList.filter((a) => a.presetId === 'BlinkUntil').map((a) => a.params.secondsUntilChange * 1000)).toEqual(BLINK_PERIODS);
    expect(attachmentList.filter((a) => a.presetId === 'SetProperty')).toHaveLength(5);
    expect(attachmentList.filter((a) => a.presetId === 'SetProperty').every((a) => a.targetMode === 'event-source')).toBe(true);
    expect(attachmentList.filter((a) => a.presetId === 'Repeat')).toHaveLength(5);
    expect(attachmentList.filter((a) => a.presetId === 'TweenUntil').map((a) => [a.params.endValue, a.params.durationMs])).toEqual([
      [-240, 2000], [840, 500], [0, 2000], [-240, 2000], [840, 500], [0, 2000], [-240, 2000], [840, 500], [0, 2000], [-240, 2000], [840, 500], [0, 2000], [-240, 2000], [840, 500], [0, 2000],
    ]);

    const yaml = serializeProjectToYaml(JSON.parse(JSON.stringify(fixture.state.project)));
    const imported = parseProjectYaml(yaml) as any;
    expect(imported.scenes[fixture.state.currentSceneId]).toEqual(scene);

    const reloaded = JSON.parse(JSON.stringify(fixture.state.project));
    expect(reloaded.scenes[fixture.state.currentSceneId]).toEqual(scene);
    const duplicated = reducer(fixture.state, { type: 'duplicate-scene', sceneId: fixture.state.currentSceneId } as any);
    const duplicateScene = Object.values(duplicated.project.scenes).find((candidate: any) => candidate.id !== fixture.state.currentSceneId) as any;
    expect(Object.values(duplicateScene.groups).map((group: any) => group.members.length)).toEqual([80, 80, 80, 80, 80]);

    const undone = reducer(duplicated, { type: 'history-undo' } as any);
    expect(Object.keys(undone.project.scenes)).toHaveLength(1);
    const redone = reducer(undone, { type: 'history-redo' } as any);
    expect(Object.keys(redone.project.scenes)).toHaveLength(2);
  });

  it('compiles the full cycle, blink rates, wrap relocation, and continuous motion', () => {
    const fixture = buildStarsFixture();
    const scene: any = sceneOf(fixture.state);
    const runtimeScene = JSON.parse(JSON.stringify(scene));
    const firstId = scene.groups[fixture.groupIds[0]].members[0];
    runtimeScene.entities[firstId] = { ...runtimeScene.entities[firstId], x: 100, y: -10, vy: 0 };
    const move = Object.values(runtimeScene.attachments).find((a: any) => a.presetId === 'MoveUntil') as any;
    move.params.velocityY = -240;
    const compiled = compileScene(runtimeScene);
    compiled.startAll();
    compiled.actionManager.update(0);
    compiled.updateTriggers(0);
    expect(compiled.debug?.lastDrainedEventNames).toContain('bounds:wrapped');
    expect(compiled.entities[firstId].y).toBeGreaterThan(1200);
    expect(compiled.entities[firstId].x).toBeGreaterThanOrEqual(0);
    expect(compiled.entities[firstId].x).toBeLessThanOrEqual(720);
    expect(compiled.entities[firstId].x).not.toBe(100);
    expect(compiled.entities[firstId].visible).toBe(true);
    compiled.actionManager.update(200);
    expect(compiled.entities[firstId].visible).toBe(false);

    compiled.actionManager.update(1000);
    const y0 = compiled.entities[firstId].y;
    compiled.actionManager.update(1000);
    expect(compiled.entities[firstId].y).not.toBe(y0);
    expect(compiled.entities[firstId].x).toBeGreaterThanOrEqual(0);
    expect(compiled.actionManager.size()).toBeGreaterThan(0);
    expect(Object.keys(compiled.entities)).toHaveLength(Object.keys(runtimeScene.entities).length);

    const allX = fixture.groupIds.flatMap((id) => scene.groups[id].members).map((id: string) => compiled.entities[id].x);
    expect(allX.every((x: number) => x >= 0 && x <= 720)).toBe(true);
    expect(new Set(allX).size).toBeGreaterThan(10);
    expect(new Set(fixture.groupIds.map((id) => scene.groups[id].members.length))).toEqual(new Set([80]));
  });

  it('records a practical authoring budget for the 400-member fixture', () => {
    const started = performance.now();
    const fixture = buildStarsFixture();
    const authoringMs = performance.now() - started;
    const saveStarted = performance.now();
    const yaml = serializeProjectToYaml(JSON.parse(JSON.stringify(fixture.state.project)));
    const saveMs = performance.now() - saveStarted;
    const compileStarted = performance.now();
    const compiled = compileScene(JSON.parse(JSON.stringify(sceneOf(fixture.state))));
    compiled.startAll();
    for (let frame = 0; frame < 60; frame += 1) compiled.actionManager.update(16);
    const compileAndFrameMs = performance.now() - compileStarted;
    const yamlBytes = new TextEncoder().encode(yaml).byteLength;
    expect(authoringMs).toBeLessThan(2000);
    expect(saveMs).toBeLessThan(500);
    expect(compileAndFrameMs).toBeLessThan(2000);
    expect(yamlBytes).toBeLessThan(2_000_000);
    expect(Object.keys(sceneOf(fixture.state).entities)).toHaveLength(401);
  });
});

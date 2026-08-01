import { writeFile } from 'node:fs/promises';
import { createEmptyProject } from '../src/model/emptyProject';
import { initState, reducer } from '../src/editor/EditorStore';
import { serializeProjectToYaml } from '../src/model/serialization';

const STARS_SEEDS = ['stars-1', 'stars-2', 'stars-3', 'stars-4', 'stars-5'];
const BLINK_PERIODS = [200, 250, 300, 350, 400];
const WRAP_SEEDS = ['wrap-1', 'wrap-2', 'wrap-3', 'wrap-4', 'wrap-5'];

// A valid 3x3 RGBA PNG: transparent background with a single white center pixel.
const STAR_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAYAAABWKLW/AAAADklEQVR4nGP4jwQYcHIAu4cj3ZP55DwAAAAASUVORK5CYII=';

function sceneOf(state: any) {
  return state.project.scenes[state.currentSceneId];
}

function createAttachment(state: any, groupId: string, presetId: string, init: any) {
  const next = reducer(state, { type: 'create-attachment', target: { type: 'group', groupId }, presetId, init } as any) as any;
  const attachmentId = next.selection.kind === 'attachment' ? next.selection.id : undefined;
  if (!attachmentId) throw new Error(`Expected ${presetId} attachment selection`);
  return { state: next, attachmentId };
}

function addVelocityRecipe(state: any, groupId: string, index: number) {
  const parallelTag = `pargrp:stars-velocity-${index + 1}`;
  const add = (presetId: string, init: any) => {
    const created = createAttachment(state, groupId, presetId, init);
    state = created.state;
  };

  add('BlinkUntil', { applyTo: 'members', order: 0, tag: `${parallelTag}:blink`, params: { secondsUntilChange: BLINK_PERIODS[index] / 1000 } });
  add('MoveUntil', {
    applyTo: 'members', order: 1, tag: `${parallelTag}:move`, params: { velocityX: 0, velocityY: 0 },
    condition: { type: 'BoundsHit', bounds: { minX: 0, minY: -5, maxX: 720, maxY: 1285 }, mode: 'any', scope: 'member-any', behavior: 'wrap' },
  });

  const repeat = createAttachment(state, groupId, 'Repeat', { applyTo: 'members', order: 2, tag: `${parallelTag}:sequence`, params: {} });
  state = repeat.state;
  const children: string[] = [];
  const child = (presetId: string, order: number, params: any) => {
    const created = createAttachment(state, groupId, presetId, { applyTo: 'members', parentAttachmentId: repeat.attachmentId, order, params });
    state = created.state;
    children.push(created.attachmentId);
  };
  child('Wait', 0, { durationMs: 1000 });
  child('TweenUntil', 1, { property: 'vy', from: 'current', endValue: -240, durationMs: 2000, easing: 'easeIn' });
  child('Wait', 2, { durationMs: 5000 });
  child('TweenUntil', 3, { property: 'vy', from: 'current', endValue: 840, durationMs: 500, easing: 'easeOut' });
  child('Wait', 4, { durationMs: 1500 });
  child('TweenUntil', 5, { property: 'vy', from: 'current', endValue: 0, durationMs: 2000, easing: 'easeOut' });
  return reducer(state, { type: 'update-attachment', id: repeat.attachmentId, next: { ...sceneOf(state).attachments[repeat.attachmentId], children } } as any);
}

function buildStarsProject() {
  const base = initState();
  const project = createEmptyProject() as any;
  project.title = 'Stars Demo';
  project.renderMode = 'pixel-art';
  const scene = project.scenes[project.initialSceneId];
  scene.world = { width: 720, height: 1280 };

  let state: any = { ...base, project, currentSceneId: project.initialSceneId };
  state = reducer(state, {
    type: 'add-image-asset-from-file',
    file: { dataUrl: STAR_PNG_DATA_URL, originalName: 'star.png', mimeType: 'image/png', width: 3, height: 3 },
  } as any);
  const assetId = Object.keys(state.project.assets.images)[0];
  state = reducer(state, { type: 'create-entity-from-asset', assetKind: 'image', assetId, at: { x: 0, y: 0 } } as any);
  const templateId = Object.keys(sceneOf(state).entities).at(-1);
  if (!templateId) throw new Error('The star template entity was not created');
  state = reducer(state, {
    type: 'update-entity', id: templateId,
    next: { ...sceneOf(state).entities[templateId], name: 'Star Template', width: 3, height: 3, tint: 0xffffff },
  } as any);
  state = reducer(state, { type: 'set-scene-background-color', backgroundColor: 0x000000 } as any);

  for (let index = 0; index < STARS_SEEDS.length; index += 1) {
    state = reducer(state, { type: 'begin-formation-draft', template: { kind: 'entity', entityId: templateId } } as any);
    state = reducer(state, {
      type: 'update-formation-draft',
      patch: {
        name: `Stars Blink ${index + 1}`, arrangeKind: 'scatter', memberCount: 80,
        params: { minX: 0, maxX: 720, minY: 5, maxY: 1285, seed: STARS_SEEDS[index], randomTint: true, tintMinR: 20, tintMaxR: 255, tintMinG: 20, tintMaxG: 255, tintMinB: 20, tintMaxB: 255 },
      },
    } as any);
    state = reducer(state, { type: 'commit-formation-draft' } as any);
    const groupId = Object.keys(sceneOf(state).groups).find((id) => sceneOf(state).groups[id].name === `Stars Blink ${index + 1}`)!;
    state = addVelocityRecipe(state, groupId, index);
    state = reducer(state, { type: 'create-event-block', target: { type: 'group', groupId }, name: 'When Stars Wrap', trigger: { type: 'bounds', boundsEvent: 'wrapped', axis: 'y', side: 'any' } } as any);
    const event = Object.values(sceneOf(state).eventBlocks ?? {}).find((block: any) => block.target?.groupId === groupId) as any;
    state = createAttachment(state, groupId, 'SetProperty', {
      eventId: event.id, targetMode: 'event-source', order: 0,
      params: { property: 'x', valueSource: { kind: 'randomRange', min: 0, max: 720, seed: WRAP_SEEDS[index] } },
    }).state;
  }
  return state.project;
}

const outputPath = process.argv[2] ?? 'samples/stars-demo.yaml';
const project = JSON.parse(JSON.stringify(buildStarsProject()));
void writeFile(outputPath, serializeProjectToYaml(project), 'utf8').then(() => {
  console.log(`Wrote ${outputPath}`);
});

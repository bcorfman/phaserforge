import { describe, expect, it, vi } from 'vitest';
import { initState, reducer } from '../../src/editor/EditorStore';
import { sampleProject } from '../../src/model/sampleProject';

function seededState() {
  const base = initState();
  return {
    ...base,
    project: sampleProject,
    currentSceneId: sampleProject.initialSceneId,
    expandedGroups: { 'g-enemies': false },
  };
}

function sceneOf(state: any) {
  return state.project.scenes[state.currentSceneId];
}

function latestSummary(state: any) {
  return state.history.past[state.history.past.length - 1]?.summary;
}

describe('EditorStore history', () => {
  it('undo/redo restores scene content and selection metadata', () => {
    const state0 = reducer(seededState(), { type: 'select', selection: { kind: 'entity', id: 'e1' } } as any);
    const scene0 = sceneOf(state0);

    const state1 = reducer(state0, {
      type: 'update-entity',
      id: 'e1',
      next: { ...scene0.entities.e1, x: scene0.entities.e1.x + 100 },
    });
    expect(sceneOf(state1).entities.e1.x).toBe(scene0.entities.e1.x + 100);
    expect(state1.history.past).toHaveLength(1);

    const undone = reducer(state1, { type: 'history-undo' } as any);
    expect(sceneOf(undone).entities.e1.x).toBe(scene0.entities.e1.x);
    expect(undone.selection).toEqual({ kind: 'entity', id: 'e1' });
    expect(undone.history.past).toHaveLength(0);
    expect(undone.history.future).toHaveLength(1);

    const redone = reducer(undone, { type: 'history-redo' } as any);
    expect(sceneOf(redone).entities.e1.x).toBe(scene0.entities.e1.x + 100);
    expect(redone.selection).toEqual({ kind: 'entity', id: 'e1' });
    expect(redone.history.past).toHaveLength(1);
    expect(redone.history.future).toHaveLength(0);
  });

  it('undo restores deleted scene graph items', () => {
    const state0 = seededState();
    const scene0 = sceneOf(state0);
    expect(scene0.entities.e1).toBeDefined();

    const removed = reducer(state0, { type: 'remove-scene-graph-item', item: { kind: 'entity', id: 'e1' } } as any);
    expect(sceneOf(removed).entities.e1).toBeUndefined();
    expect(removed.history.past).toHaveLength(1);

    const undone = reducer(removed, { type: 'history-undo' } as any);
    expect(sceneOf(undone).entities.e1).toBeDefined();
  });

  it('undo/redo works for project-scoped scene creation', () => {
    const state0 = seededState();
    const beforeSceneIds = Object.keys(state0.project.scenes);
    const created = reducer(state0, { type: 'create-scene' } as any);
    expect(Object.keys(created.project.scenes).length).toBe(beforeSceneIds.length + 1);
    expect(created.history.past).toHaveLength(1);

    const undone = reducer(created, { type: 'history-undo' } as any);
    expect(Object.keys(undone.project.scenes)).toEqual(beforeSceneIds);
    expect(undone.currentSceneId).toBe(state0.currentSceneId);

    const redone = reducer(undone, { type: 'history-redo' } as any);
    expect(Object.keys(redone.project.scenes).length).toBe(beforeSceneIds.length + 1);
  });

  it('batches canvas drags into a single history entry', () => {
    const state0 = reducer(seededState(), { type: 'select', selection: { kind: 'entity', id: 'e1' } } as any);
    const x0 = sceneOf(state0).entities.e1.x;
    const y0 = sceneOf(state0).entities.e1.y;

    const state1 = reducer(state0, { type: 'begin-canvas-interaction', kind: 'entity', id: 'e1' } as any);
    const state2 = reducer(state1, { type: 'move-entity', id: 'e1', dx: 10, dy: 0 } as any);
    const state3 = reducer(state2, { type: 'move-entity', id: 'e1', dx: 0, dy: 20 } as any);
    const state4 = reducer(state3, { type: 'end-canvas-interaction' } as any);

    expect(sceneOf(state4).entities.e1.x).toBe(x0 + 10);
    expect(sceneOf(state4).entities.e1.y).toBe(y0 + 20);
    expect(state4.history.past).toHaveLength(1);

    const undone = reducer(state4, { type: 'history-undo' } as any);
    expect(sceneOf(undone).entities.e1.x).toBe(x0);
    expect(sceneOf(undone).entities.e1.y).toBe(y0);
  });

  it('reuses one semantic burst id during a resize interaction and allocates a new one for the next interaction', () => {
    const state0 = seededState();

    const state1 = reducer(state0, { type: 'begin-canvas-interaction', kind: 'bounds', id: 'scene-1', handle: 'right' } as any);
    const state2 = reducer(state1, { type: 'update-scene-world', width: 960, height: 540 } as any);
    const state3 = reducer(state2, { type: 'update-scene-world', width: 1280, height: 720 } as any);
    const firstBurstId = state2.lastProjectHistoryEventDrafts?.[0]?.burstId;
    const secondBurstId = state3.lastProjectHistoryEventDrafts?.[0]?.burstId;

    expect(firstBurstId).toBeTruthy();
    expect(secondBurstId).toBe(firstBurstId);

    const state4 = reducer(state3, { type: 'end-canvas-interaction' } as any);
    const state5 = reducer(state4, { type: 'begin-canvas-interaction', kind: 'bounds', id: 'scene-1', handle: 'right' } as any);
    const state6 = reducer(state5, { type: 'update-scene-world', width: 1440, height: 900 } as any);

    expect(state6.lastProjectHistoryEventDrafts?.[0]?.burstId).toBeTruthy();
    expect(state6.lastProjectHistoryEventDrafts?.[0]?.burstId).not.toBe(firstBurstId);
  });

  it('merges consecutive nudges within the merge window', () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_700_000_000_000)
      .mockReturnValueOnce(1_700_000_000_100);

    const state0 = reducer(seededState(), { type: 'select', selection: { kind: 'entity', id: 'e1' } } as any);
    const x0 = sceneOf(state0).entities.e1.x;

    const state1 = reducer(state0, { type: 'move-entity', id: 'e1', dx: 1, dy: 0 } as any);
    const state2 = reducer(state1, { type: 'move-entity', id: 'e1', dx: 1, dy: 0 } as any);

    expect(sceneOf(state2).entities.e1.x).toBe(x0 + 2);
    expect(state2.history.past).toHaveLength(1);

    const undone = reducer(state2, { type: 'history-undo' } as any);
    expect(sceneOf(undone).entities.e1.x).toBe(x0);

    // Outside merge window -> new entry
    (Date.now as any).mockReturnValueOnce(1_700_000_001_000);
    const state3 = reducer(state2, { type: 'move-entity', id: 'e1', dx: 1, dy: 0 } as any);
    expect(state3.history.past).toHaveLength(2);
  });

  it('batches alt-drag duplication and movement into a single history entry', () => {
    const state0 = reducer(seededState(), { type: 'select', selection: { kind: 'entity', id: 'e1' } } as any);
    const scene0 = sceneOf(state0);
    const entityCount0 = Object.keys(scene0.entities).length;

    const state1 = reducer(state0, { type: 'begin-canvas-interaction', kind: 'entity', id: 'e1' } as any);
    const state2 = reducer(state1, { type: 'duplicate-entities', entityIds: ['e1'] } as any);
    expect(Object.keys(sceneOf(state2).entities).length).toBe(entityCount0 + 1);

    const selection = state2.selection;
    if (selection.kind !== 'entity') throw new Error('Expected entity selection');
    const duplicateId = selection.id;

    const state3 = reducer(state2, { type: 'move-entity', id: duplicateId, dx: 12, dy: 0 } as any);
    const state4 = reducer(state3, { type: 'end-canvas-interaction' } as any);

    expect(state4.history.past).toHaveLength(1);

    const undone = reducer(state4, { type: 'history-undo' } as any);
    expect(Object.keys(sceneOf(undone).entities).length).toBe(entityCount0);
    expect(sceneOf(undone).entities[duplicateId]).toBeUndefined();
  });

  it('records layout-entities as a single undo step', () => {
    const state0 = seededState();
    const scene0 = sceneOf(state0);
    const x1 = scene0.entities.e1.x;
    const y1 = scene0.entities.e1.y;
    const x2 = scene0.entities.e2.x;
    const y2 = scene0.entities.e2.y;

    const laidOut = reducer(state0, {
      type: 'layout-entities',
      positions: [
        { id: 'e1', x: x1 + 10, y: y1 + 20 },
        { id: 'e2', x: x2 + 30, y: y2 + 40 },
      ],
    } as any);
    expect(laidOut.history.past).toHaveLength(1);

    const undone = reducer(laidOut, { type: 'history-undo' } as any);
    expect(sceneOf(undone).entities.e1.x).toBe(x1);
    expect(sceneOf(undone).entities.e1.y).toBe(y1);
    expect(sceneOf(undone).entities.e2.x).toBe(x2);
    expect(sceneOf(undone).entities.e2.y).toBe(y2);
  });

  it('records demo pack import as a single undo step', () => {
    const state0 = seededState();

    const imported = reducer(state0, {
      type: 'import-demo-pack-assets',
      entries: [
        {
          kind: 'image',
          assetId: 'enemy-a',
          path: 'assets/demo-pack/images/enemy_A.png',
          originalName: 'enemy_A.png',
          mimeType: 'image/png',
          width: 64,
          height: 64,
        },
        {
          kind: 'audio',
          assetId: 'theme',
          path: 'assets/demo-pack/audio/Simulacra-chosic.com_.mp3',
          originalName: 'Simulacra-chosic.com_.mp3',
          mimeType: 'audio/mpeg',
        },
      ],
    } as any);

    expect(imported.history.past).toHaveLength(1);
    expect(imported.history.past[0]).toMatchObject({ summary: 'Imported Demo Pack' });
    expect(imported.lastProjectChangeSummary).toBe('Imported Demo Pack');
    expect(imported.project.assets.images['enemy-a']).toBeDefined();
    expect(imported.project.audio.sounds.theme).toBeDefined();

    const undone = reducer(imported, { type: 'history-undo' } as any);
    expect(undone.project.assets.images['enemy-a']).toBeUndefined();
    expect(undone.project.audio.sounds.theme).toBeUndefined();
    expect(undone.lastProjectChangeSummary).toBe('Undid Imported Demo Pack');
  });

  it('describes bulk entity and grouping commands precisely', () => {
    const base = seededState();
    const project = structuredClone(sampleProject);
    project.scenes[project.initialSceneId].groups = {};
    project.scenes[project.initialSceneId].attachments = {};
    const state0 = {
      ...base,
      project,
      selection: { kind: 'entities', ids: ['e1', 'e2'] },
      expandedGroups: {},
    };

    const patched = reducer(state0, {
      type: 'patch-entities',
      entityIds: ['e1', 'e2'],
      patch: { visible: false },
    } as any);
    expect(latestSummary(patched)).toBe('Updated 2 entities');

    const grouped = reducer(patched, { type: 'create-group-from-selection', name: 'Front Line' } as any);
    expect(latestSummary(grouped)).toBe('Created group Front Line');
    const createdGroupId = Object.keys(sceneOf(grouped).groups)[0];

    const addToGroup = reducer(grouped, {
      type: 'add-entities-to-group',
      groupId: createdGroupId,
      entityIds: ['e3', 'e4'],
    } as any);
    expect(latestSummary(addToGroup)).toBe('Added 2 entities to Front Line');

    const removedFromGroup = reducer(addToGroup, {
      type: 'remove-entity-from-group',
      groupId: createdGroupId,
      entityId: 'e4',
    } as any);
    expect(latestSummary(removedFromGroup)).toBe('Removed entity from Front Line');
  });

  it('captures semantic entity rename and movement drafts from project-changing actions', () => {
    const base = seededState();
    const scene = sceneOf(base);

    const renamed = reducer(base, {
      type: 'update-entity',
      id: 'e1',
      next: {
        ...scene.entities.e1,
        name: 'Hero Spawn',
      },
    } as any);

    expect(renamed.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'entity.renamed',
        scope: { kind: 'entity', sceneId: renamed.currentSceneId, entityId: 'e1' },
        summary: 'Renamed entity to Hero Spawn',
      }),
    ]);

    const moved = reducer(renamed, { type: 'move-entity', id: 'e1', dx: 12, dy: -8 } as any);
    expect(moved.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'entity.moved',
        scope: { kind: 'entity', sceneId: moved.currentSceneId, entityId: 'e1' },
        summary: 'Moved entity Hero Spawn',
      }),
    ]);

    const movedMany = reducer(renamed, { type: 'move-entities', entityIds: ['e1', 'e2'], dx: 5, dy: 10 } as any);
    expect(movedMany.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'entity.moved',
        scope: { kind: 'scene', sceneId: movedMany.currentSceneId },
        summary: 'Moved 2 entities',
        details: ['Moved entity Hero Spawn', 'Moved entity e2'],
      }),
    ]);
  });

  it('describes bounds drags as one movement-bounds history event', () => {
    const state0 = seededState();
    const state1 = reducer(state0, { type: 'begin-canvas-interaction', kind: 'bounds', id: 'att-move-right', handle: 'right' } as any);
    const state2 = reducer(state1, {
      type: 'update-bounds',
      id: 'att-move-right',
      bounds: { minX: 80, maxX: 960, minY: 60, maxY: 720 },
    } as any);
    const state3 = reducer(state2, { type: 'end-canvas-interaction' } as any);

    expect(state3.history.past).toHaveLength(1);
    expect(latestSummary(state3)).toBe('Updated movement bounds');
  });

  it('describes scene systems like input, layers, collisions, and triggers precisely', () => {
    const inputUpdated = reducer(seededState(), {
      type: 'set-scene-input',
      input: { activeMapNone: true },
    } as any);
    expect(latestSummary(inputUpdated)).toBe('Updated scene input');

    const withLayers = reducer(seededState(), {
      type: 'set-scene-background-layers',
      layers: [
        { assetId: 'bg-1', x: 0, y: 0, depth: -100, layout: 'cover' },
        { assetId: 'bg-2', x: 0, y: 0, depth: -200, layout: 'cover' },
      ],
    } as any);
    expect(latestSummary(withLayers)).toBe('Updated background layers');
    const reordered = reducer(withLayers, { type: 'move-background-layer', fromIndex: 0, toIndex: 1 } as any);
    expect(latestSummary(reordered)).toBe('Reordered background layers');

    const collisionAdded = reducer(seededState(), { type: 'add-collision-rule' } as any);
    expect(latestSummary(collisionAdded)).toBe('Added collision rule');
    const collisionId = sceneOf(collisionAdded).collisionRules[0].id;
    const collisionUpdated = reducer(collisionAdded, { type: 'update-collision-rule', id: collisionId, patch: { interaction: 'overlap' } } as any);
    expect(latestSummary(collisionUpdated)).toBe('Updated collision rule');
    const collisionRemoved = reducer(collisionUpdated, { type: 'remove-collision-rule', id: collisionId } as any);
    expect(latestSummary(collisionRemoved)).toBe('Removed collision rule');

    const triggerAdded = reducer(seededState(), { type: 'add-trigger-zone' } as any);
    expect(latestSummary(triggerAdded)).toBe('Added trigger trigger-1');
    const triggerUpdated = reducer(triggerAdded, { type: 'update-trigger-zone', id: 'trigger-1', patch: { name: 'Exit Gate' } } as any);
    expect(latestSummary(triggerUpdated)).toBe('Updated trigger Exit Gate');
    const triggerRemoved = reducer(triggerUpdated, { type: 'remove-trigger-zone', id: 'trigger-1' } as any);
    expect(latestSummary(triggerRemoved)).toBe('Removed trigger Exit Gate');
  });

  it('captures semantic drafts for scene audio, input, and background-layer actions', () => {
    const base = seededState();
    const withAudio = reducer(base, {
      type: 'add-audio-asset-from-file',
      file: {
        dataUrl: 'data:audio/mp3;base64,AAAA',
        originalName: 'music_theme.mp3',
        mimeType: 'audio/mpeg',
      },
    } as any);

    const withMusic = reducer(withAudio, {
      type: 'set-scene-music',
      music: { assetId: 'music-theme', loop: true, volume: 0.65, fadeMs: 250 },
    } as any);
    expect(withMusic.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'scene.music.set',
        summary: 'Music -> music_theme.mp3',
      }),
    ]);

    const withAmbience = reducer(withMusic, {
      type: 'set-scene-ambience',
      ambience: [{ assetId: 'music-theme', loop: true, volume: 0.35 }],
    } as any);
    expect(withAmbience.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'scene.ambience.set',
        summary: 'Updated scene ambience',
      }),
    ]);

    const withInput = reducer(withAmbience, {
      type: 'set-scene-input',
      input: { activeMapNone: true },
    } as any);
    expect(withInput.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'scene.input.set',
        summary: 'Updated scene input',
      }),
    ]);

    const withLayers = reducer(withInput, {
      type: 'set-scene-background-layers',
      layers: [{ assetId: 'bg-1', x: 0, y: 0, depth: -100, layout: 'cover' }],
    } as any);
    expect(withLayers.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'background.layers.set',
        summary: 'Updated background layers',
      }),
    ]);

    const updatedLayer = reducer(withLayers, {
      type: 'update-background-layer',
      index: 0,
      patch: { depth: -222 },
    } as any);
    expect(updatedLayer.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'background.layer.updated',
        summary: 'Updated background layer',
      }),
    ]);

    const reorderedLayers = reducer(reducer(withInput, {
      type: 'set-scene-background-layers',
      layers: [
        { assetId: 'bg-1', x: 0, y: 0, depth: -100, layout: 'cover' },
        { assetId: 'bg-2', x: 0, y: 0, depth: -200, layout: 'cover' },
      ],
    } as any), {
      type: 'move-background-layer',
      fromIndex: 0,
      toIndex: 1,
    } as any);
    expect(reorderedLayers.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'background.layers.reordered',
        summary: 'Reordered background layers',
      }),
    ]);

    const removedLayer = reducer(withLayers, { type: 'remove-background-layer', index: 0 } as any);
    expect(removedLayer.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'background.layer.removed',
        summary: 'Removed background layer',
      }),
    ]);
  });

  it('captures semantic drafts for collision, trigger, and input-map actions', () => {
    const base = seededState();

    const collisionAdded = reducer(base, { type: 'add-collision-rule' } as any);
    expect(collisionAdded.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'collision.rule.added',
        summary: 'Added collision rule',
      }),
    ]);
    const collisionId = sceneOf(collisionAdded).collisionRules[0].id;

    const collisionUpdated = reducer(collisionAdded, {
      type: 'update-collision-rule',
      id: collisionId,
      patch: { interaction: 'overlap' },
    } as any);
    expect(collisionUpdated.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'collision.rule.updated',
        summary: 'Updated collision rule',
      }),
    ]);

    const collisionRemoved = reducer(collisionUpdated, { type: 'remove-collision-rule', id: collisionId } as any);
    expect(collisionRemoved.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'collision.rule.removed',
        summary: 'Removed collision rule',
      }),
    ]);

    const triggerAdded = reducer(base, { type: 'add-trigger-zone' } as any);
    expect(triggerAdded.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'trigger.added',
        summary: 'Added trigger trigger-1',
      }),
    ]);

    const triggerUpdated = reducer(triggerAdded, {
      type: 'update-trigger-zone',
      id: 'trigger-1',
      patch: { name: 'Exit Gate' },
    } as any);
    expect(triggerUpdated.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'trigger.updated',
        summary: 'Updated trigger Exit Gate',
      }),
    ]);

    const triggerRemoved = reducer(triggerUpdated, { type: 'remove-trigger-zone', id: 'trigger-1' } as any);
    expect(triggerRemoved.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'trigger.removed',
        summary: 'Removed trigger Exit Gate',
      }),
    ]);

    const inputMapCreated = reducer(base, { type: 'create-input-map', mapId: 'default_controls' } as any);
    expect(inputMapCreated.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'input.map.created',
        summary: 'Added input map default_controls',
      }),
    ]);

    const inputBindingAdded = reducer(inputMapCreated, {
      type: 'add-input-binding',
      mapId: 'default_controls',
      actionId: 'Jump',
      binding: { device: 'keyboard', key: 'Space', event: 'held' },
    } as any);
    expect(inputBindingAdded.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'input.binding.added',
        summary: 'Added input binding Jump on default_controls',
      }),
    ]);

    const inputBindingRemoved = reducer(inputBindingAdded, {
      type: 'remove-input-binding',
      mapId: 'default_controls',
      actionId: 'Jump',
      index: 0,
    } as any);
    expect(inputBindingRemoved.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'input.binding.removed',
        summary: 'Removed input binding Jump from default_controls',
      }),
    ]);

    const inputMapDuplicated = reducer(inputMapCreated, {
      type: 'duplicate-input-map',
      sourceMapId: 'default_controls',
      nextMapId: 'menu_controls',
    } as any);
    expect(inputMapDuplicated.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'input.map.duplicated',
        summary: 'Duplicated input map default_controls',
      }),
    ]);

    const defaultInputMapSet = reducer(inputMapCreated, {
      type: 'set-project-default-input-map',
      mapId: 'default_controls',
    } as any);
    expect(defaultInputMapSet.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'project.default-input-map.set',
        summary: 'Set default input map to default_controls',
      }),
    ]);

    const inputMapRemoved = reducer(defaultInputMapSet, {
      type: 'remove-input-map',
      mapId: 'default_controls',
    } as any);
    expect(inputMapRemoved.lastProjectHistoryEventDrafts).toEqual([
      expect.objectContaining({
        kind: 'input.map.removed',
        summary: 'Removed input map default_controls',
      }),
    ]);
  });
});

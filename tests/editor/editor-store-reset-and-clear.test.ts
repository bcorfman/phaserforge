import { describe, expect, it } from 'vitest';
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

describe('EditorStore reset + clear scene', () => {
  it('clears a scene while preserving id + world size', () => {
    const state0 = seededState();
    const scene0 = state0.project.scenes[state0.currentSceneId];
    expect(Object.keys(scene0.entities ?? {}).length).toBeGreaterThan(0);
    expect(scene0.world.width).toBeGreaterThan(0);

    const cleared = reducer(state0, { type: 'clear-scene', sceneId: state0.currentSceneId } as any);
    const scene1 = cleared.project.scenes[cleared.currentSceneId];

    expect(scene1.id).toBe(scene0.id);
    expect(scene1.world).toEqual(scene0.world);
    expect(Object.keys(scene1.entities ?? {})).toHaveLength(0);
    expect(Object.keys(scene1.groups ?? {})).toHaveLength(0);
    expect(Object.keys(scene1.attachments ?? {})).toHaveLength(0);
    expect(Object.keys(scene1.eventBlocks ?? {})).toHaveLength(0);
    expect(Object.keys(scene1.behaviors ?? {})).toHaveLength(0);
    expect(Object.keys(scene1.actions ?? {})).toHaveLength(0);
    expect(Object.keys(scene1.conditions ?? {})).toHaveLength(0);
    expect(scene1.backgroundLayers ?? []).toHaveLength(0);
    expect(scene1.collisionRules ?? []).toHaveLength(0);
    expect(scene1.triggers ?? []).toHaveLength(0);
    expect(cleared.dirty).toBe(true);
    expect(cleared.selection).toEqual({ kind: 'none' });
    expect(cleared.history.past).toHaveLength(1);
  });

  it('resets the project to a new empty scene and clears history', () => {
    const state0 = reducer(seededState(), { type: 'set-startup-mode', startupMode: 'new_empty_scene' } as any);
    expect(Object.keys(state0.project.scenes).length).toBeGreaterThan(0);

    const reset = reducer(state0, { type: 'reset-project' } as any);
    expect(reset.project.initialSceneId).toBe('scene-1');
    expect(Object.keys(reset.project.scenes)).toEqual(['scene-1']);
    expect(reset.currentSceneId).toBe('scene-1');
    expect(Object.keys(reset.project.scenes['scene-1'].entities ?? {})).toHaveLength(0);
    expect(reset.dirty).toBe(true);
    expect(reset.selection).toEqual({ kind: 'none' });
    expect(reset.history.past).toHaveLength(1);
    expect(reset.history.future).toHaveLength(0);
    // Resetting content should not change the configured startup mode preference.
    expect(reset.startupMode).toBe('new_empty_scene');
  });
});

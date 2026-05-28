import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../../src/model/emptyProject';
import { serializeProjectToYaml } from '../../src/model/serialization';
import { summarizeProject, summarizeYamlWorkspace } from '../../src/editor/workspaceSummary';

describe('workspace summary', () => {
  it('summarizeProject counts scenes/entities/groups/assets', () => {
    const project = createEmptyProject();
    const scene = project.scenes[project.initialSceneId];
    scene.entities.e1 = { id: 'e1', x: 0, y: 0, width: 10, height: 10 };
    scene.entities.e2 = { id: 'e2', x: 0, y: 0, width: 10, height: 10 };
    scene.groups.g1 = { id: 'g1', name: 'G', members: ['e1'], layout: { type: 'freeform' } } as any;
    project.assets.images.i1 = { id: 'i1', source: { kind: 'embedded', dataUrl: 'data:' } } as any;
    project.audio.sounds.s1 = { id: 's1', source: { kind: 'embedded', dataUrl: 'data:' } } as any;

    expect(summarizeProject(project)).toEqual({ scenes: 1, entities: 2, groups: 1, assets: 2 });
  });

  it('summarizeYamlWorkspace returns canonical yaml + counts for valid yaml', () => {
    const project = createEmptyProject();
    const yaml = serializeProjectToYaml(project);
    const res = summarizeYamlWorkspace(yaml);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(typeof res.canonicalYaml).toBe('string');
    expect(res.summary.scenes).toBe(1);
  });

  it('summarizeYamlWorkspace handles invalid yaml', () => {
    const res = summarizeYamlWorkspace('::: not yaml');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.summary).toEqual({ scenes: 0, entities: 0, groups: 0, assets: 0 });
    expect(res.error.length).toBeGreaterThan(0);
  });
});


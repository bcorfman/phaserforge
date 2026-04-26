import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SceneInspectorPanel } from '../../src/editor/SceneInspectorPanel';
import { sampleProject } from '../../src/model/sampleProject';

describe('SceneInspectorPanel', () => {
  it('consolidates scene sections under a single scene header', () => {
    const sceneId = sampleProject.initialSceneId;
    const scene = sampleProject.scenes[sceneId];
    const markup = renderToStaticMarkup(
      <SceneInspectorPanel
        project={sampleProject as any}
        sceneId={sceneId}
        scene={scene as any}
        dispatch={() => {}}
        disabled={false}
      />
    );

    expect(markup.match(/Scene: scene-1/g)?.length ?? 0).toBe(1);
    expect(markup).toContain('Expand All');
    expect(markup).toContain('Collapse All');
  });

  it('defaults to only Background Layers expanded (Option C2)', () => {
    const sceneId = sampleProject.initialSceneId;
    const scene = sampleProject.scenes[sceneId];
    const markup = renderToStaticMarkup(
      <SceneInspectorPanel
        project={sampleProject as any}
        sceneId={sceneId}
        scene={scene as any}
        dispatch={() => {}}
        disabled={false}
      />
    );

    expect(markup).toContain('No background layers yet');
    expect(markup).toContain('data-testid="background-add-layer-button"');
    expect(markup).not.toContain('Add audio assets in the left panel');
    expect(markup).not.toContain('Create an input map in the left panel');
  });

  it('renders compact foldout summaries for scene sections', () => {
    const sceneId = sampleProject.initialSceneId;
    const scene = sampleProject.scenes[sceneId];
    const markup = renderToStaticMarkup(
      <SceneInspectorPanel
        project={sampleProject as any}
        sceneId={sceneId}
        scene={scene as any}
        dispatch={() => {}}
        disabled={false}
      />
    );

    expect(markup).toContain('0 layers');
    expect(markup).toContain('Music: (none)');
    expect(markup).toContain('Ambience: 0');
    expect(markup).toContain('Active: (none)');
    expect(markup).toContain('Fallback: (none)');
  });
});

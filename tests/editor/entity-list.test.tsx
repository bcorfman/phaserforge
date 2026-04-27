import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EntityListView } from '../../src/editor/EntityList';
import { sampleProject } from '../../src/model/sampleProject';

describe('EntityList', () => {
  it('renders sprites and formations sections without actions', () => {
    const markup = renderToStaticMarkup(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleProject.scenes[sampleProject.initialSceneId]}
        selection={{ kind: 'none' }}
        sidebarScope="scene"
        expandedGroups={{ 'g-enemies': false }}
        mode="edit"
        dispatch={() => {}}
      />
    );

    expect(markup).toContain('Sprites');
    expect(markup).toContain('Trigger Zones');
    expect(markup).toContain('Formations');
    expect(markup).toContain('Enemy Formation');
    expect(markup).not.toContain('Actions');
    expect(markup).not.toContain('Move Right');
  });

  it('does not render panel count badges in section headers', () => {
    const markup = renderToStaticMarkup(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleProject.scenes[sampleProject.initialSceneId]}
        selection={{ kind: 'none' }}
        sidebarScope="scene"
        expandedGroups={{ 'g-enemies': false }}
        mode="edit"
        dispatch={() => {}}
      />
    );

    expect(markup).not.toContain('panel-count');
  });

  it('renders per-member remove buttons when a formation is expanded', () => {
    const markup = renderToStaticMarkup(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleProject.scenes[sampleProject.initialSceneId]}
        selection={{ kind: 'none' }}
        sidebarScope="scene"
        expandedGroups={{ 'g-enemies': true }}
        mode="edit"
        dispatch={() => {}}
      />
    );

    expect(markup).toContain('group-member-g-enemies-e1');
    expect(markup).toContain('group-member-remove-g-enemies-e1');
    const removeIndex = markup.indexOf('group-member-remove-g-enemies-e1');
    expect(removeIndex).toBeGreaterThanOrEqual(0);
    expect(markup.slice(removeIndex, removeIndex + 240)).toContain('>-</button>');
  });

  it('renders formation chevrons to the left of formation labels', () => {
    const markup = renderToStaticMarkup(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleProject.scenes[sampleProject.initialSceneId]}
        selection={{ kind: 'none' }}
        sidebarScope="scene"
        expandedGroups={{ 'g-enemies': false }}
        mode="edit"
        dispatch={() => {}}
      />
    );

    const toggleIndex = markup.indexOf('toggle-group-g-enemies');
    const labelIndex = markup.indexOf('group-item-g-enemies');
    expect(toggleIndex).toBeGreaterThanOrEqual(0);
    expect(labelIndex).toBeGreaterThanOrEqual(0);
    expect(toggleIndex).toBeLessThan(labelIndex);
  });

  it('disables scene switching in play mode', () => {
    const markup = renderToStaticMarkup(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleProject.scenes[sampleProject.initialSceneId]}
        selection={{ kind: 'none' }}
        sidebarScope="scene"
        expandedGroups={{ 'g-enemies': false }}
        mode="play"
        dispatch={() => {}}
      />
    );

    expect(markup).toContain(`data-testid=\"scene-item-${sampleProject.initialSceneId}\"`);
    expect(markup).toContain('disabled');
  });

  it('renders project-scoped panels when the project scope tab is active', () => {
    const markup = renderToStaticMarkup(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleProject.scenes[sampleProject.initialSceneId]}
        selection={{ kind: 'none' }}
        sidebarScope="project"
        expandedGroups={{ 'g-enemies': false }}
        mode="edit"
        dispatch={() => {}}
      />
    );

    expect(markup).toContain('Input Maps');
    expect(markup).toContain('Audio');
    expect(markup).toContain('Import Sprites');
    expect(markup).not.toContain('Formations');
    expect(markup).not.toContain('Trigger Zones');
  });
});

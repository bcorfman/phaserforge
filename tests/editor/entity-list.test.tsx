import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EntityListView } from '../../src/editor/EntityList';
import { sampleScene } from '../../src/model/sampleScene';
import { sampleProject } from '../../src/model/sampleProject';

describe('EntityList', () => {
  it('renders sprites and formations sections without actions', () => {
    const markup = renderToStaticMarkup(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleScene}
        selection={{ kind: 'none' }}
        expandedGroups={{ 'g-enemies': false }}
        dispatch={() => {}}
      />
    );

    expect(markup).toContain('Sprites');
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
        scene={sampleScene}
        selection={{ kind: 'none' }}
        expandedGroups={{ 'g-enemies': false }}
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
        scene={sampleScene}
        selection={{ kind: 'none' }}
        expandedGroups={{ 'g-enemies': true }}
        dispatch={() => {}}
      />
    );

    expect(markup).toContain('group-member-g-enemies-e1');
    expect(markup).toContain('edit-group-member-g-enemies-e1');
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
        scene={sampleScene}
        selection={{ kind: 'none' }}
        expandedGroups={{ 'g-enemies': false }}
        dispatch={() => {}}
      />
    );

    const toggleIndex = markup.indexOf('toggle-group-g-enemies');
    const labelIndex = markup.indexOf('group-item-g-enemies');
    expect(toggleIndex).toBeGreaterThanOrEqual(0);
    expect(labelIndex).toBeGreaterThanOrEqual(0);
    expect(toggleIndex).toBeLessThan(labelIndex);
  });
});

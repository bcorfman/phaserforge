// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EntityListView } from '../../src/editor/EntityList';
import { createProjectRevision, formatProjectRevisionTimestamp } from '../../src/editor/projectTreeHistory';
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

  it('renders the project tree and project panels in project tree mode', () => {
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
    expect(markup).toContain('Project Tree');
    expect(markup).toContain('Scenes');
    expect(markup).toContain('create-scene-button');
    expect(markup).not.toContain('Active Project Summary');
    expect(markup).not.toContain('project-picker-panel');
    expect(markup).not.toContain('project-startup-panel');
    expect(markup).not.toContain('Startup &amp; Reset');
  });

  it('renders the project revisions back button with the inspector back label', () => {
    const markup = renderToStaticMarkup(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleProject.scenes[sampleProject.initialSceneId]}
        selection={{ kind: 'none' }}
        sidebarScope="projectRevisions"
        expandedGroups={{ 'g-enemies': false }}
        mode="edit"
        dispatch={() => {}}
      />
    );

    expect(markup).toContain('data-testid=\"project-revisions-back-button\"');
    expect(markup).toContain('aria-label=\"Back to Project Tree\"');
    expect(markup).toContain('← Back');
  });

  it('renders richer revision metadata in project revisions mode', () => {
    const olderRevision = createProjectRevision(sampleProject, {
      id: 'rev-1',
      updatedAt: '2026-06-17T10:11:00.000Z',
      reason: 'autosave',
    });
    const renamedProject = structuredClone(sampleProject);
    renamedProject.title = 'History Demo';
    const revision = createProjectRevision(renamedProject, {
      id: 'rev-2',
      updatedAt: '2026-06-17T10:12:00.000Z',
      reason: 'autosave',
    });

    const markup = renderToStaticMarkup(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleProject.scenes[sampleProject.initialSceneId]}
        selection={{ kind: 'none' }}
        sidebarScope="projectRevisions"
        revisions={[revision, olderRevision]}
        expandedGroups={{ 'g-enemies': false }}
        mode="edit"
        dispatch={() => {}}
      />
    );

    expect(markup).toContain(formatProjectRevisionTimestamp(revision));
    expect(markup).toContain('Renamed to History Demo');
    expect(markup).not.toContain('Autosave checkpoint');
    expect(markup).not.toContain('Start: scene-1');
  });

  it('flexes the scenes list so the assets dock can reach the bottom', () => {
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

    expect(markup).toContain('class=\"panel-scroll\" style=\"overflow:auto;min-height:0;padding-right:2px;flex:1');
  });
});

// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityListView } from '../../src/editor/EntityList';
import { createProjectRevision } from '../../src/editor/projectTreeHistory';
import { sampleProject } from '../../src/model/sampleProject';

describe('EntityList project history retention', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T12:00:00.000Z'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens a single retention prompt when History is visited and routes archive choices through callbacks', () => {
    const recentRevision = createProjectRevision(sampleProject, {
      id: 'rev-recent',
      updatedAt: '2026-06-23T12:00:00.000Z',
    });
    const oldProject = structuredClone(sampleProject);
    oldProject.title = 'Old Candidate';
    const oldRevision = createProjectRevision(oldProject, {
      id: 'rev-old',
      updatedAt: '2026-05-21T12:00:00.000Z',
    });
    const onArchiveHistoryRevisions = vi.fn();

    render(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleProject.scenes[sampleProject.initialSceneId]}
        selection={{ kind: 'none' }}
        sidebarScope="projectRevisions"
        revisions={[recentRevision, oldRevision]}
        expandedGroups={{ 'g-enemies': false }}
        mode="edit"
        dispatch={() => {}}
        onArchiveHistoryRevisions={onArchiveHistoryRevisions}
      />
    );

    expect(screen.getByTestId('project-history-retention-dialog')).toBeTruthy();
    expect(screen.getByText('Older versions found')).toBeTruthy();
    fireEvent.click(screen.getByTestId('project-history-retention-archive'));

    expect(onArchiveHistoryRevisions).toHaveBeenCalledWith(['rev-old']);
  });

  it('defaults to the past 7 days filter and lets the user expand to 14 days', () => {
    const threeDaysAgo = createProjectRevision(sampleProject, {
      id: 'rev-3d',
      updatedAt: '2026-06-22T12:00:00.000Z',
    });
    const tenDaysAgoProject = structuredClone(sampleProject);
    tenDaysAgoProject.title = 'Ten Day Build';
    const tenDaysAgo = createProjectRevision(tenDaysAgoProject, {
      id: 'rev-10d',
      updatedAt: '2026-06-15T12:00:00.000Z',
    });

    render(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleProject.scenes[sampleProject.initialSceneId]}
        selection={{ kind: 'none' }}
        sidebarScope="projectRevisions"
        revisions={[threeDaysAgo, tenDaysAgo]}
        expandedGroups={{ 'g-enemies': false }}
        mode="edit"
        dispatch={() => {}}
      />
    );

    expect(screen.getByTestId('project-history-filter-7').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Untitled Project')).toBeTruthy();
    expect(screen.queryByText('Ten Day Build')).toBeNull();

    fireEvent.click(screen.getByTestId('project-history-filter-14'));

    expect(screen.getByTestId('project-history-filter-14').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Ten Day Build')).toBeTruthy();
  });

  it('renders each revision timestamp in a dedicated non-wrapping end column', () => {
    const revision = createProjectRevision(sampleProject, {
      id: 'rev-layout',
      updatedAt: '2026-06-26T21:10:00.000Z',
    });

    render(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleProject.scenes[sampleProject.initialSceneId]}
        selection={{ kind: 'none' }}
        sidebarScope="projectRevisions"
        revisions={[revision]}
        expandedGroups={{ 'g-enemies': false }}
        mode="edit"
        dispatch={() => {}}
      />
    );

    const rowButton = screen.getByTestId('project-revision-row-button-rev-layout');
    const timestamp = screen.getByTestId('project-revision-timestamp-rev-layout');

    expect(rowButton.getAttribute('style') ?? '').toContain('grid-template-columns: minmax(0, 1fr) auto');
    expect(timestamp.getAttribute('style') ?? '').toContain('white-space: nowrap');
    expect(timestamp.getAttribute('style') ?? '').toContain('text-align: right');
  });

  it('removes teaser top spacing and shows a divider below revision actions', () => {
    const previousProject = structuredClone(sampleProject);
    previousProject.title = 'Renamed Demo';
    const previous = createProjectRevision(previousProject, {
      id: 'rev-older',
      updatedAt: '2026-06-25T21:10:00.000Z',
    });
    const latestProject = structuredClone(sampleProject);
    latestProject.title = 'Pattern Demo';
    latestProject.publishTitle = 'Pattern Demo Live';
    latestProject.publishGithubPagesRepo = 'acme/pattern-demo';
    const latest = createProjectRevision(latestProject, {
      id: 'rev-newest',
      updatedAt: '2026-06-26T21:10:00.000Z',
    });

    render(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleProject.scenes[sampleProject.initialSceneId]}
        selection={{ kind: 'none' }}
        sidebarScope="projectRevisions"
        revisions={[latest, previous]}
        expandedGroups={{ 'g-enemies': false }}
        mode="edit"
        dispatch={() => {}}
      />
    );

    const teaser = screen.getByTestId('project-revision-teaser-rev-newest');
    const divider = screen.getByTestId('project-revision-divider-rev-newest');

    expect(teaser.getAttribute('style') ?? '').toContain('margin-top: 0');
    expect(divider.className).toContain('scene-graph-menu-divider');
  });

  it('groups repetitive history rows and expands into named per-item details', () => {
    const baseProject = structuredClone(sampleProject);
    const firstProject = structuredClone(sampleProject);
    firstProject.scenes[firstProject.initialSceneId].entities.enemy_c = {
      id: 'enemy_c',
      name: 'enemy_c',
      x: 64,
      y: 64,
      width: 16,
      height: 16,
    } as any;
    const secondProject = structuredClone(firstProject);
    secondProject.scenes[secondProject.initialSceneId].entities.ship_a = {
      id: 'ship_a',
      name: 'ship_a',
      x: 96,
      y: 64,
      width: 16,
      height: 16,
    } as any;
    const thirdProject = structuredClone(secondProject);
    thirdProject.scenes[thirdProject.initialSceneId].entities.effect_purple = {
      id: 'effect_purple',
      name: 'effect_purple',
      x: 128,
      y: 64,
      width: 16,
      height: 16,
    } as any;

    const baseRevision = createProjectRevision(baseProject, {
      id: 'rev-base',
      updatedAt: '2026-06-27T23:00:00.000Z',
    });
    const firstRevision = createProjectRevision(firstProject, {
      id: 'rev-first',
      updatedAt: '2026-06-27T23:00:20.000Z',
      reason: 'autosave',
    });
    const secondRevision = createProjectRevision(secondProject, {
      id: 'rev-second',
      updatedAt: '2026-06-27T23:00:40.000Z',
      reason: 'autosave',
    });
    const thirdRevision = createProjectRevision(thirdProject, {
      id: 'rev-third',
      updatedAt: '2026-06-27T23:01:00.000Z',
      reason: 'autosave',
    });

    render(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleProject.scenes[sampleProject.initialSceneId]}
        selection={{ kind: 'none' }}
        sidebarScope="projectRevisions"
        revisions={[thirdRevision, secondRevision, firstRevision, baseRevision]}
        expandedGroups={{ 'g-enemies': false }}
        mode="edit"
        dispatch={() => {}}
      />
    );

    expect(screen.getAllByTestId(/project-revision-row-button-/)).toHaveLength(2);
    expect(screen.getByTestId('project-revision-row-button-rev-third').textContent).toContain('3 entities added');
    expect(screen.getByTestId('project-revision-teaser-rev-third').textContent).toContain('+3 more changes');

    fireEvent.click(screen.getByTestId('project-revision-teaser-rev-third'));

    const detailList = screen.getByTestId('project-revision-details-rev-third');
    expect(detailList.textContent).toContain('enemy_c added');
    expect(detailList.textContent).toContain('ship_a added');
    expect(detailList.textContent).toContain('effect_purple added');
  });
});

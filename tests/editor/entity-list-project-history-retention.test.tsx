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
});

// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectPickerPanel } from '../../src/editor/ProjectPickerPanel';
import type { ProjectLibraryEntry } from '../../src/editor/projectLibrary';

function entry(overrides: Partial<ProjectLibraryEntry> = {}): ProjectLibraryEntry {
  return {
    id: 'local:1',
    projectId: 'project-1',
    title: 'Laser Gates Iteration',
    updatedAt: '2026-06-05T10:12:00.000Z',
    sceneCount: 4,
    source: 'cloud',
    status: 'cloud',
    isCurrent: true,
    ...overrides,
  };
}

describe('ProjectPickerPanel', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders sidebar filters and the unified project list', () => {
    render(
      <ProjectPickerPanel
        counts={{ cloud: 12, local: 3, unsynced: 2 }}
        filter="recent"
        onCreateProject={() => {}}
        onFilterChange={() => {}}
        onOpenProject={() => {}}
        onDeleteProject={() => {}}
        onRefreshCloudProjects={() => {}}
        onSearchChange={() => {}}
        projects={[
          entry(),
          entry({ id: 'local:2', projectId: 'project-2', title: 'Local Debug Copy', source: 'local', status: 'local', isCurrent: false, sceneCount: 1 }),
        ]}
        search=""
      />
    );

    expect(screen.getByTestId('project-picker-panel')).toBeTruthy();
    expect(screen.getByText('Project Library')).toBeTruthy();
    expect(screen.getByTestId('project-picker-filter-all')).toBeTruthy();
    expect(screen.getByTestId('project-picker-filter-recent')).toBeTruthy();
    expect(screen.getByTestId('project-picker-filter-cloud')).toBeTruthy();
    expect(screen.getByTestId('project-picker-filter-local')).toBeTruthy();
    expect(screen.getByTestId('project-picker-filter-templates')).toBeTruthy();
    expect(screen.getByText('Cloud Sync Issues')).toBeTruthy();
    expect(screen.getByText('Local Debug Copy')).toBeTruthy();
    expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
    expect(screen.queryByRole('tablist', { name: 'Project filters' })).toBeTruthy();
    expect(screen.queryByText('Active Project Summary')).toBeNull();
  });

  it('updates the list heading and empty copy for the local filter', () => {
    render(
      <ProjectPickerPanel
        counts={{ cloud: 12, local: 3, unsynced: 2 }}
        filter="local"
        onCreateProject={() => {}}
        onFilterChange={() => {}}
        onOpenProject={() => {}}
        onDeleteProject={() => {}}
        onRefreshCloudProjects={() => {}}
        onSearchChange={() => {}}
        projects={[]}
        search=""
      />
    );

    expect(screen.getAllByText('Local Projects').length).toBeGreaterThan(0);
    expect(screen.getByText('No locally stored projects match this filter yet.')).toBeTruthy();
  });

  it('routes user actions through callbacks', () => {
    const onOpenProject = vi.fn();
    const onSearchChange = vi.fn();
    const onFilterChange = vi.fn();

    render(
      <ProjectPickerPanel
        counts={{ cloud: 1, local: 0, unsynced: 0 }}
        filter="recent"
        onCreateProject={() => {}}
        onFilterChange={onFilterChange}
        onOpenProject={onOpenProject}
        onDeleteProject={() => {}}
        onRefreshCloudProjects={() => {}}
        onSearchChange={onSearchChange}
        projects={[entry()]}
        search=""
      />
    );

    fireEvent.change(screen.getByTestId('project-picker-search'), { target: { value: 'laser' } });
    fireEvent.click(screen.getByTestId('project-picker-filter-cloud'));
    fireEvent.click(screen.getByTestId('project-open-local:1'));

    expect(onSearchChange).toHaveBeenCalledWith('laser');
    expect(onFilterChange).toHaveBeenCalledWith('cloud');
    expect(onOpenProject).toHaveBeenCalledWith('local:1');
  });

  it('offers delete from the row menu for non-current local and cloud projects', () => {
    const onDeleteProject = vi.fn();
    render(
      <ProjectPickerPanel
        counts={{ cloud: 1, local: 1, unsynced: 0 }}
        filter="recent"
        onCreateProject={() => {}}
        onFilterChange={() => {}}
        onOpenProject={() => {}}
        onDeleteProject={onDeleteProject}
        onRefreshCloudProjects={() => {}}
        onSearchChange={() => {}}
        projects={[
          entry({ id: 'cloud:1', projectId: 'game-1', source: 'cloud', status: 'cloud', isCurrent: false }),
          entry({ id: 'local:2', projectId: 'project-2', source: 'local', status: 'local', isCurrent: false }),
        ]}
        search=""
      />,
    );

    fireEvent.click(screen.getByTestId('project-actions-cloud:1'));
    fireEvent.click(screen.getByTestId('project-delete-cloud:1'));
    fireEvent.click(screen.getByTestId('project-delete-confirm'));
    expect(onDeleteProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'cloud:1', source: 'cloud' }));
  });

  it('does not offer deletion for the current project', () => {
    render(
      <ProjectPickerPanel
        counts={{ cloud: 1, local: 0, unsynced: 0 }}
        filter="cloud"
        onCreateProject={() => {}}
        onFilterChange={() => {}}
        onOpenProject={() => {}}
        onDeleteProject={() => {}}
        onRefreshCloudProjects={() => {}}
        onSearchChange={() => {}}
        projects={[entry({ id: 'cloud:current', source: 'cloud', status: 'cloud', isCurrent: true })]}
        search=""
      />,
    );

    fireEvent.click(screen.getByTestId('project-actions-cloud:current'));
    expect(screen.getByTestId('project-delete-cloud:current')).toHaveProperty('disabled', true);
  });
});

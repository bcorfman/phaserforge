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

  it('renders sources, recent projects, and active summary actions', () => {
    render(
      <ProjectPickerPanel
        activeProject={entry()}
        counts={{ cloud: 12, local: 3, unsynced: 2 }}
        filter="recent"
        onCreateProject={() => {}}
        onDuplicateProject={() => {}}
        onExportYaml={() => {}}
        onFilterChange={() => {}}
        onImportYaml={() => {}}
        onOpenProject={() => {}}
        onRefreshCloudProjects={() => {}}
        onSearchChange={() => {}}
        onToggleSyncMode={() => {}}
        projects={[
          entry(),
          entry({ id: 'local:2', projectId: 'project-2', title: 'Local Debug Copy', source: 'local', status: 'local', isCurrent: false, sceneCount: 1 }),
        ]}
        search=""
        syncMode="online"
      />
    );

    expect(screen.getByTestId('project-picker-panel')).toBeTruthy();
    expect(screen.getByText('Cloud Projects')).toBeTruthy();
    expect(screen.getByText('12 available')).toBeTruthy();
    expect(screen.getByText('Local Debug Copy')).toBeTruthy();
    expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
    expect(screen.getByTestId('project-sync-toggle').textContent).toContain('Online');
  });

  it('routes user actions through callbacks', () => {
    const onOpenProject = vi.fn();
    const onSearchChange = vi.fn();
    const onFilterChange = vi.fn();

    render(
      <ProjectPickerPanel
        activeProject={entry()}
        counts={{ cloud: 1, local: 0, unsynced: 0 }}
        filter="recent"
        onCreateProject={() => {}}
        onDuplicateProject={() => {}}
        onExportYaml={() => {}}
        onFilterChange={onFilterChange}
        onImportYaml={() => {}}
        onOpenProject={onOpenProject}
        onRefreshCloudProjects={() => {}}
        onSearchChange={onSearchChange}
        onToggleSyncMode={() => {}}
        projects={[entry()]}
        search=""
        syncMode="offline"
      />
    );

    fireEvent.change(screen.getByTestId('project-picker-search'), { target: { value: 'laser' } });
    fireEvent.click(screen.getByTestId('project-picker-filter-cloud'));
    fireEvent.click(screen.getByTestId('project-open-local:1'));

    expect(onSearchChange).toHaveBeenCalledWith('laser');
    expect(onFilterChange).toHaveBeenCalledWith('cloud');
    expect(onOpenProject).toHaveBeenCalledWith('local:1');
  });
});

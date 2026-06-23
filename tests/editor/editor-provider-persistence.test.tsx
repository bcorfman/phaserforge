// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const persistenceSpies = vi.hoisted(() => ({
  saveActiveProjectRecord: vi.fn(async () => []),
  saveProjectRecordImmediately: vi.fn(async () => undefined),
}));

vi.mock('../../src/model/editorConfig', async () => {
  const actual = await vi.importActual<typeof import('../../src/model/editorConfig')>('../../src/model/editorConfig');
  return {
    ...actual,
    loadEditorConfig: vi.fn(async () => ({ startupMode: 'new_empty_scene' as const })),
    loadEditorRegistry: vi.fn(async () => actual.EMPTY_EDITOR_REGISTRY),
  };
});

vi.mock('../../src/editor/projectPersistence', async () => {
  const actual = await vi.importActual<typeof import('../../src/editor/projectPersistence')>('../../src/editor/projectPersistence');
  const { createEmptyProject } = await vi.importActual<typeof import('../../src/model/emptyProject')>('../../src/model/emptyProject');
  const project = createEmptyProject();
  project.id = 'project-1';
  project.title = 'Untitled Project';
  const record = actual.buildStoredProjectRecord(project, { id: project.id });
  return {
    ...actual,
    projectPersistence: {
      ...actual.projectPersistence,
      load: vi.fn(async () => ({
        localProjects: [record],
        workspace: { activeProjectId: project.id, syncMode: 'online' as const },
        preferences: null,
      })),
      saveActiveProjectRecord: persistenceSpies.saveActiveProjectRecord,
      saveProjectRecordImmediately: persistenceSpies.saveProjectRecordImmediately,
      loadWorkspaceStateRecord: vi.fn(async () => ({ activeProjectId: project.id, syncMode: 'online' as const })),
      loadPreferencesRecord: vi.fn(async () => null),
      loadProjectById: vi.fn(async () => record),
      loadViewState: vi.fn(async () => null),
      loadLastPublishInfo: vi.fn(async () => null),
      refreshCloudProjects: vi.fn(async () => []),
    },
  };
});

import { EditorProvider, useEditorStore } from '../../src/editor/EditorStore';

function RenameOnReadyHarness() {
  const { state, dispatch } = useEditorStore();

  useEffect(() => {
    if (!state.initialized || state.project.title === 'Snapshot Rescue') return;
    dispatch({ type: 'set-project-metadata', title: 'Snapshot Rescue' } as any);
  }, [dispatch, state.initialized, state.project.title]);

  return null;
}

describe('EditorProvider persistence', () => {
  beforeEach(() => {
    persistenceSpies.saveActiveProjectRecord.mockClear();
    persistenceSpies.saveProjectRecordImmediately.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('immediately persists active project metadata updates as a durable project row', async () => {
    render(
      <EditorProvider>
        <RenameOnReadyHarness />
      </EditorProvider>
    );

    await waitFor(() => {
      expect(persistenceSpies.saveProjectRecordImmediately).toHaveBeenCalledWith(expect.objectContaining({
        id: 'project-1',
        title: 'Snapshot Rescue',
      }));
    });
  });
});

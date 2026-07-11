// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_PACK_ASSET_MANIFEST } from '../../src/editor/demoPackAssets';
import { createEmptyProject } from '../../src/model/emptyProject';
import { buildStoredProjectRecord } from '../../src/editor/projectPersistence';

const persistenceSpies = vi.hoisted(() => ({
  load: vi.fn(),
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
  persistenceSpies.load.mockImplementation(async () => ({
    localProjects: [record],
    workspace: { activeProjectId: project.id, syncMode: 'online' as const },
    preferences: null,
    restoreWarnings: [],
  }));
  return {
    ...actual,
    projectPersistence: {
      ...actual.projectPersistence,
      load: persistenceSpies.load,
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

function ImportDemoPackOnReadyHarness() {
  const { state, dispatch } = useEditorStore();

  useEffect(() => {
    if (!state.initialized) return;
    if (Object.keys(state.project.assets.images).length > 0 || Object.keys(state.project.audio.sounds).length > 0) return;
    dispatch({ type: 'import-demo-pack-assets', entries: DEMO_PACK_ASSET_MANIFEST } as any);
  }, [dispatch, state.initialized, state.project.assets.images, state.project.audio.sounds]);

  return null;
}

function RenameAndPublishOnReadyHarness() {
  const { state, dispatch } = useEditorStore();

  useEffect(() => {
    if (!state.initialized) return;
    if (state.project.title === 'Pattern Demo' && state.project.publishGithubPagesRepo === 'zoof') return;
    dispatch({ type: 'set-project-metadata', title: 'Pattern Demo', publishGithubPagesRepo: 'zoof' } as any);
  }, [dispatch, state.initialized, state.project.publishGithubPagesRepo, state.project.title]);

  return null;
}

function StatusMessageHarness({ onStatus }: { onStatus: (value: string | undefined) => void }) {
  const { state } = useEditorStore();

  useEffect(() => {
    onStatus(state.statusMessage);
  }, [onStatus, state.statusMessage]);

  return null;
}

describe('EditorProvider persistence', () => {
  beforeEach(() => {
    persistenceSpies.load.mockClear();
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

  it('persists the captured command summary into autosaved project revisions', async () => {
    render(
      <EditorProvider>
        <ImportDemoPackOnReadyHarness />
      </EditorProvider>
    );

    await waitFor(() => {
      expect(persistenceSpies.saveProjectRecordImmediately).toHaveBeenCalledWith(expect.objectContaining({
        revisions: expect.arrayContaining([
          expect.objectContaining({
            changeSummary: 'Imported Demo Pack',
          }),
        ]),
      }));
    });
  });

  it('persists semantic history events alongside autosaved revisions for supported project actions', async () => {
    render(
      <EditorProvider>
        <RenameAndPublishOnReadyHarness />
      </EditorProvider>
    );

    await waitFor(() => {
      expect(persistenceSpies.saveProjectRecordImmediately).toHaveBeenCalledWith(expect.objectContaining({
        historyEvents: expect.arrayContaining([
          expect.objectContaining({
            kind: 'project.renamed',
            summary: 'Renamed to Pattern Demo',
          }),
          expect.objectContaining({
            kind: 'publish.repo.set',
            summary: 'Set publish repo to zoof',
          }),
        ]),
      }));
    });

    const savedRecords = persistenceSpies.saveProjectRecordImmediately.mock.calls
      .map(([record]) => record)
      .filter((record: any) => Array.isArray(record?.historyEvents) && record.historyEvents.length >= 2);
    const latestRecord = savedRecords.at(-1);
    expect(latestRecord?.historyEvents?.map((event: any) => event.kind)).toEqual(
      expect.arrayContaining(['project.renamed', 'publish.repo.set'])
    );
    expect(latestRecord?.historyEvents?.map((event: any) => event.kind)).not.toContain('publish.title.set');
    expect(latestRecord?.revisions?.[0]?.historyEventIds).toEqual(
      expect.arrayContaining(latestRecord.historyEvents.map((event: any) => event.id))
    );
  });

  it('surfaces a status warning when durable autosave rejects an invalid project head', async () => {
    persistenceSpies.saveActiveProjectRecord.mockRejectedValueOnce(
      new Error('initialSceneId references unknown scene scene-1')
    );
    const onStatus = vi.fn();

    render(
      <EditorProvider>
        <RenameOnReadyHarness />
        <StatusMessageHarness onStatus={onStatus} />
      </EditorProvider>
    );

    await waitFor(() => {
      expect(onStatus).toHaveBeenCalledWith(
        'Autosave blocked: initialSceneId references unknown scene scene-1. Your last valid saved version was preserved.'
      );
    });
  });

  it('surfaces a restore warning when invalid stored project rows are skipped during hydration', async () => {
    const project = createEmptyProject();
    project.id = 'project-1';
    project.title = 'Untitled Project';
    const record = buildStoredProjectRecord(project, { id: project.id });
    persistenceSpies.load.mockResolvedValueOnce({
      localProjects: [record],
      workspace: { activeProjectId: 'project-1', syncMode: 'online' as const },
      preferences: null,
      restoreWarnings: [
        'stored project record project-invalid: revisions must be an array or omitted, got null',
      ],
    } as any);
    const onStatus = vi.fn();

    render(
      <EditorProvider>
        <StatusMessageHarness onStatus={onStatus} />
      </EditorProvider>
    );

    await waitFor(() => {
      expect(onStatus).toHaveBeenCalledWith(
        'Restore warning: stored project record project-invalid: revisions must be an array or omitted, got null'
      );
    });
  });
});

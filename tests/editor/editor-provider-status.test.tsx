// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/model/editorConfig', async () => {
  const actual = await vi.importActual<typeof import('../../src/model/editorConfig')>('../../src/model/editorConfig');
  return {
    ...actual,
    loadEditorConfig: vi.fn(async () => ({ startupMode: 'new_empty_scene' as const })),
    loadEditorRegistry: vi.fn(async () => actual.EMPTY_EDITOR_REGISTRY),
  };
});

import { EditorProvider, useEditorStore } from '../../src/editor/EditorStore';
import { ToolbarView } from '../../src/editor/Toolbar';

function StatusHarness() {
  const { state, dispatch, persistence } = useEditorStore();

  useEffect(() => {
    if (!state.initialized || state.statusMessage) return;
    dispatch({
      type: 'set-status',
      message: 'Loaded YAML: fixture.yaml',
      expiresAt: Date.now() + 10,
    });
  }, [dispatch, state.initialized, state.statusMessage]);

  return <ToolbarView state={state} dispatch={dispatch} onToggleSyncMode={() => void persistence.toggleSyncMode()} />;
}

describe('EditorProvider status expiry', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('clears transient status messages after their expiration time', async () => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        clear: () => {
          storage.clear();
        },
      },
    });

    render(
      <EditorProvider>
        <StatusHarness />
      </EditorProvider>
    );

    expect((await screen.findByTestId('toolbar-status')).textContent).toContain('fixture.yaml');
    await waitFor(() => {
      expect(screen.queryByTestId('toolbar-status')).toBeNull();
    });
  });
});

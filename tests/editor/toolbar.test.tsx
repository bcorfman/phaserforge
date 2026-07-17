// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const toolbarStore = vi.hoisted(() => ({
  state: {
    dirty: false,
    uiScale: 0.95,
    themeMode: 'system',
    error: undefined as string | undefined,
    statusMessage: undefined as string | undefined,
    syncMode: 'online' as 'online' | 'offline',
  },
  dispatch: vi.fn(),
  persistence: {
    toggleSyncMode: vi.fn(),
  },
}));

vi.mock('../../src/editor/EditorStore', () => ({
  useEditorStore: () => ({
    state: toolbarStore.state,
    dispatch: toolbarStore.dispatch,
    persistence: toolbarStore.persistence,
  }),
}));

import { Toolbar } from '../../src/editor/Toolbar';

describe('Toolbar', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    window.history.pushState({}, '', '/');
    toolbarStore.dispatch.mockReset();
    toolbarStore.state.dirty = false;
    toolbarStore.state.uiScale = 0.95;
    toolbarStore.state.themeMode = 'system';
    toolbarStore.state.error = undefined;
    toolbarStore.state.statusMessage = undefined;
    toolbarStore.state.syncMode = 'online';
    toolbarStore.persistence.toggleSyncMode.mockReset();
  });

  it('renders dirty/status/error state from the editor store', () => {
    toolbarStore.state.dirty = true;
    toolbarStore.state.error = 'Broken';
    toolbarStore.state.statusMessage = 'Saved';

    render(<Toolbar />);

    expect(screen.getByTestId('project-sync-badge').textContent).toBe('Online');
    expect(screen.getByTestId('toolbar-error').textContent).toBe('Broken');
    expect(screen.getByTestId('toolbar-status').textContent).toBe('Saved');
  });

  it('dispatches theme and ui scale changes', () => {
    toolbarStore.state.uiScale = 1;
    toolbarStore.state.themeMode = 'light';

    render(<Toolbar />);

    fireEvent.click(screen.getByTestId('theme-mode-dark'));
    fireEvent.change(screen.getByTestId('ui-scale-slider'), { target: { value: '1.1' } });

    expect(toolbarStore.dispatch).toHaveBeenNthCalledWith(1, { type: 'set-theme-mode', themeMode: 'dark' });
    expect(toolbarStore.dispatch).toHaveBeenNthCalledWith(2, { type: 'set-ui-scale', uiScale: 1.1 });
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('toggles sync mode from the toolbar badge', () => {
    toolbarStore.state.syncMode = 'offline';

    render(<Toolbar />);

    fireEvent.click(screen.getByTestId('project-sync-badge'));

    expect(toolbarStore.persistence.toggleSyncMode).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('project-sync-badge').textContent).toBe('Offline');
  });

  it('marks dev channel builds without changing stable toolbar chrome', () => {
    window.history.pushState({}, '', '/phaserforge/dev/');

    render(<Toolbar />);

    expect(screen.getByTestId('deploy-channel-badge').textContent).toBe('Dev');
  });

  it('marks the summary copy as single-line on wide layouts', () => {
    render(<Toolbar />);

    expect(screen.getByText(/Move entities on the canvas/).className).toContain('toolbar-summary-single-line');
  });
});

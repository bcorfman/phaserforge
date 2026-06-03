// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const inspectorPaneStore = vi.hoisted(() => ({
  state: { id: 'state' },
  dispatch: vi.fn(),
}));

const cloudPanelSpy = vi.hoisted(() => ({
  onLoadYaml: undefined as ((yaml: string, sourceLabel: string) => void) | undefined,
  onStatus: undefined as ((message: string) => void) | undefined,
  onError: undefined as ((message: string) => void) | undefined,
  cachedUser: undefined as { id: string; email: string } | null | undefined,
  resolveUser: vi.fn<() => Promise<{ id: string; email: string } | null>>(),
}));

vi.mock('../../src/editor/EditorStore', () => ({
  useEditorStore: () => ({
    state: inspectorPaneStore.state,
    dispatch: inspectorPaneStore.dispatch,
  }),
}));

vi.mock('../../src/editor/Inspector', () => ({
  Inspector: () => <div data-testid="mock-inspector">Inspector body</div>,
}));

vi.mock('../../src/editor/CloudAccountPanel', () => ({
  getCachedCloudAccountUserSnapshot: () => cloudPanelSpy.cachedUser,
  resolveCachedCloudAccountUser: cloudPanelSpy.resolveUser,
  CloudAccountPanel: (props: {
    onLoadYaml: (yaml: string, sourceLabel: string) => void;
    onStatus: (message: string) => void;
    onError: (message: string) => void;
  }) => {
    cloudPanelSpy.onLoadYaml = props.onLoadYaml;
    cloudPanelSpy.onStatus = props.onStatus;
    cloudPanelSpy.onError = props.onError;
    return <div data-testid="mock-cloud-panel">Cloud body</div>;
  },
}));

import { InspectorPane } from '../../src/editor/InspectorPane';

describe('InspectorPane tabs', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    inspectorPaneStore.dispatch.mockReset();
    delete (globalThis as { location?: { hostname: string } }).location;
    cloudPanelSpy.onLoadYaml = undefined;
    cloudPanelSpy.onStatus = undefined;
    cloudPanelSpy.onError = undefined;
    cloudPanelSpy.cachedUser = undefined;
    cloudPanelSpy.resolveUser.mockReset();
  });

  it('hides cloud tab controls on localhost and renders the inspector', () => {
    (globalThis as { location?: { hostname: string } }).location = { hostname: 'localhost' };

    render(<InspectorPane />);

    expect(screen.queryByTestId('inspector-pane-tab-cloud')).toBeNull();
    expect(screen.getByTestId('mock-inspector').textContent).toBe('Inspector body');
  });

  it('switches to cloud and routes panel callbacks back through dispatch', () => {
    (globalThis as { location?: { hostname: string } }).location = { hostname: 'phaserforge.app' };
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    cloudPanelSpy.cachedUser = { id: 'u1', email: 'alice@example.com' };

    render(<InspectorPane />);

    fireEvent.click(screen.getByTestId('inspector-pane-tab-cloud'));
    expect(screen.getByTestId('mock-cloud-panel').textContent).toBe('Cloud body');

    cloudPanelSpy.onLoadYaml?.('id: test', 'demo.yaml');
    cloudPanelSpy.onStatus?.('Synced');
    cloudPanelSpy.onError?.('Denied');

    expect(inspectorPaneStore.dispatch).toHaveBeenNthCalledWith(1, {
      type: 'load-yaml-text',
      text: 'id: test',
      sourceLabel: 'demo.yaml',
    });
    expect(inspectorPaneStore.dispatch).toHaveBeenNthCalledWith(2, {
      type: 'set-status',
      message: 'Synced',
      expiresAt: 1_700_000_004_000,
    });
    expect(inspectorPaneStore.dispatch).toHaveBeenNthCalledWith(3, {
      type: 'set-error',
      error: 'Denied',
    });
  });

  it('starts on Cloud while auth is unresolved, then switches to Inspector for authenticated users', async () => {
    (globalThis as { location?: { hostname: string } }).location = { hostname: 'phaserforge.app' };
    let resolveAuth: ((user: { id: string; email: string } | null) => void) | null = null;
    cloudPanelSpy.resolveUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAuth = resolve;
        }),
    );

    render(<InspectorPane />);

    expect(screen.getByTestId('mock-cloud-panel').textContent).toBe('Cloud body');

    resolveAuth?.({ id: 'u1', email: 'alice@example.com' });

    expect(await screen.findByTestId('mock-inspector')).toBeTruthy();
  });

  it('stays on Cloud after auth resolves when no user is signed in', async () => {
    (globalThis as { location?: { hostname: string } }).location = { hostname: 'phaserforge.app' };
    cloudPanelSpy.resolveUser.mockResolvedValueOnce(null);

    render(<InspectorPane />);

    expect(screen.getByTestId('mock-cloud-panel').textContent).toBe('Cloud body');
    expect(await screen.findByTestId('mock-cloud-panel')).toBeTruthy();
    expect(screen.queryByTestId('mock-inspector')).toBeNull();
  });
});

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
});

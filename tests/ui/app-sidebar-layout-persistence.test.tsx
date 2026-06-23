// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const persistence = vi.hoisted(() => ({
  readCachedWorkspaceStateRecord: vi.fn(() => null),
  readCachedPreferencesRecord: vi.fn(() => null),
  loadWorkspaceStateRecord: vi.fn(async () => ({
    activeProjectId: null,
    syncMode: 'online' as const,
    leftPaneWidth: 300,
    rightPaneWidth: 380,
  })),
  updateWorkspaceStateRecord: vi.fn(async (patch: unknown) => patch),
  saveViewState: vi.fn(async () => {}),
  loadViewState: vi.fn(async () => null),
}));

const dispatch = vi.hoisted(() => vi.fn());

const mockState = {
  revisionPreview: undefined,
  project: {
    id: 'project-1',
    title: 'Untitled Project',
    initialSceneId: 'scene-1',
    assets: { fonts: {}, images: {}, spriteSheets: {} },
    audio: { sounds: {} },
    scenes: {
      'scene-1': {
        id: 'scene-1',
        name: 'Scene 1',
        entities: {},
        groups: {},
        attachments: {},
        eventBlocks: {},
        behaviors: {},
        actions: {},
        conditions: {},
        backgroundLayers: [],
        collisionRules: [],
        triggers: [],
      },
    },
  },
  currentSceneId: 'scene-1',
  selection: { kind: 'none' },
  mode: 'edit',
  dirty: false,
  yamlText: '',
  error: undefined,
  hasSeenViewHint: true,
  startupMode: 'new_empty_scene',
  initialized: true,
  themeMode: 'system',
  uiScale: 0.95,
  showHitboxOverlay: true,
  formationDraft: undefined,
};

vi.mock('../../src/phaser/PhaserHost', () => ({
  PhaserGame: ({ currentActiveScene }: { currentActiveScene?: () => void }) => {
    React.useEffect(() => {
      currentActiveScene?.();
    }, [currentActiveScene]);
    return <div data-testid="mock-phaser-game" />;
  },
}));

vi.mock('../../src/phaser/EventBus', () => ({
  EventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
  getActiveScene: () => null,
}));

vi.mock('../../src/phaser/pendingRuntimeRequest', () => ({
  consumePendingRuntimeRequestedSceneId: () => null,
}));

vi.mock('../../src/editor/EditorStore', () => ({
  EditorProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useEditorStore: () => ({ state: mockState, dispatch }),
}));

vi.mock('../../src/editor/EntityList', () => ({
  EntityList: () => <div data-testid="mock-entity-list" />,
}));

vi.mock('../../src/editor/InspectorPane', () => ({
  InspectorPane: () => <div data-testid="mock-inspector-pane-content" />,
}));

vi.mock('../../src/editor/Toolbar', () => ({
  Toolbar: () => <div data-testid="toolbar" />,
}));

vi.mock('../../src/editor/CanvasOverlay', () => ({
  CanvasOverlay: () => null,
}));

vi.mock('../../src/editor/ViewbarYamlControls', () => ({
  ViewbarYamlControls: () => null,
}));

vi.mock('../../src/editor/boundsCondition', () => ({
  getEditableBoundsConditionId: () => null,
}));

vi.mock('../../src/editor/fontLoader', () => ({
  loadProjectFonts: vi.fn(async () => {}),
}));

vi.mock('../../src/editor/projectPersistence', () => ({
  projectPersistence: persistence,
}));

vi.mock('../../src/editor/viewport', () => ({
  formatZoomPercent: (value: number) => `${Math.round(value * 100)}%`,
}));

vi.mock('../../src/editor/sceneWorld', () => ({
  getSceneWorld: () => ({ width: 1000, height: 800 }),
}));

vi.mock('../../src/editor/formationDraft', () => ({
  computeFormationDraftPositions: () => [],
  getTemplateSize: () => ({ width: 0, height: 0 }),
}));

vi.mock('../../src/util/viewStateStorage', () => ({
  canRestorePersistedView: () => false,
  doesReportedViewMatchCurrentScene: () => true,
  isViewStateApproximatelyEqual: () => false,
  shouldPersistViewState: () => false,
  shouldResetViewStateForProjectChange: () => false,
}));

vi.mock('../../src/testing/testBridge', () => ({
  registerAppStateGetter: vi.fn(),
  registerActionDispatcher: vi.fn(),
  registerModeToggleHandler: vi.fn(),
  registerResetSceneHandler: vi.fn(),
  registerSelectionSetter: vi.fn(),
  registerUndoRedoHandlers: vi.fn(),
  unregisterAppStateGetter: vi.fn(),
  unregisterActionDispatcher: vi.fn(),
  unregisterModeToggleHandler: vi.fn(),
  unregisterResetSceneHandler: vi.fn(),
  unregisterSelectionSetter: vi.fn(),
  unregisterUndoRedoHandlers: vi.fn(),
}));

import App from '../../src/App';

function setRect(element: HTMLElement, width: number, height: number) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      width,
      height,
      top: 0,
      right: width,
      bottom: height,
      left: 0,
      toJSON: () => ({}),
    }),
  });
}

describe('App sidebar layout persistence', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('flushes the latest right pane width on pagehide after a resize', async () => {
    const view = render(<App />);
    const appBody = view.container.querySelector('.app-body') as HTMLElement | null;
    if (!appBody) throw new Error('App body not rendered');
    setRect(appBody, 2200, 980);

    await waitFor(() => {
      expect(persistence.loadWorkspaceStateRecord).toHaveBeenCalled();
    });

    const splitter = view.getByTestId('right-pane-splitter');

    fireEvent.mouseDown(splitter, { button: 0, clientX: 1820 });
    fireEvent.mouseMove(window, { clientX: 1300 });
    fireEvent.mouseUp(window, { clientX: 1300 });

    await waitFor(() => {
      expect(appBody.style.gridTemplateColumns).toContain('900px');
    });
    await waitFor(() => {
      expect(persistence.updateWorkspaceStateRecord).toHaveBeenCalledWith({
        leftPaneWidth: 300,
        rightPaneWidth: 900,
      });
    });

    const callsBeforePageHide = persistence.updateWorkspaceStateRecord.mock.calls.length;
    window.dispatchEvent(new PageTransitionEvent('pagehide'));

    await waitFor(() => {
      expect(persistence.updateWorkspaceStateRecord.mock.calls.length).toBeGreaterThan(callsBeforePageHide);
    });
    expect(persistence.updateWorkspaceStateRecord).toHaveBeenLastCalledWith({
      leftPaneWidth: 300,
      rightPaneWidth: 900,
    });
  });

  it('seeds the first render from cached sidebar widths before async hydration finishes', () => {
    persistence.readCachedWorkspaceStateRecord.mockReturnValueOnce({
      activeProjectId: 'project-1',
      syncMode: 'online',
      leftPaneWidth: 336,
      rightPaneWidth: 712,
    });
    persistence.loadWorkspaceStateRecord.mockImplementationOnce(() => new Promise(() => {}));

    const view = render(<App />);
    const appBody = view.container.querySelector('.app-body') as HTMLElement | null;
    if (!appBody) throw new Error('App body not rendered');

    expect(appBody.style.gridTemplateColumns).toContain('336px');
    expect(appBody.style.gridTemplateColumns).toContain('712px');
    expect(view.getByTestId('app-root').getAttribute('data-boot-ready')).toBe('true');
  });

  it('keeps the shell boot-hidden until workspace hydration finishes when no cached layout exists', async () => {
    let resolveWorkspace: ((workspace: {
      activeProjectId: null;
      syncMode: 'online';
      leftPaneWidth: number;
      rightPaneWidth: number;
    }) => void) | null = null;
    persistence.loadWorkspaceStateRecord.mockImplementationOnce(() => new Promise((resolve) => {
      resolveWorkspace = resolve;
    }));

    const view = render(<App />);
    expect(view.getByTestId('app-root').getAttribute('data-boot-ready')).toBe('false');

    resolveWorkspace?.({
      activeProjectId: null,
      syncMode: 'online',
      leftPaneWidth: 300,
      rightPaneWidth: 380,
    });

    await waitFor(() => {
      expect(view.getByTestId('app-root').getAttribute('data-boot-ready')).toBe('true');
    });
  });
});

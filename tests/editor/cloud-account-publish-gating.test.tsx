// @vitest-environment jsdom
import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { fireEvent } from '@testing-library/react';
import { createEmptyProject } from '../../src/model/emptyProject';
import {
  clearPersistenceDebugEntries,
  readPersistenceDebugEntries,
  setPersistenceDebugEnabled,
} from '../../src/util/persistenceDebug';

const api = vi.hoisted(() => {
  return {
    fetchCsrfToken: vi.fn(async () => 'csrf'),
    me: vi.fn(async () => {
      throw new Error('not_signed_in');
    }),
    signup: vi.fn(async () => {
      throw new Error('not_implemented');
    }),
    login: vi.fn(async () => {
      throw new Error('not_implemented');
    }),
    logout: vi.fn(async () => {}),
    listGames: vi.fn(async () => ({ games: [] })),
    getGame: vi.fn(async () => {
      throw new Error('not_found');
    }),
    createGame: vi.fn(async () => ({ game: { id: 'g1', title: 'G', created_at: 'c', updated_at: 'u' } })),
    updateGame: vi.fn(async () => ({ game: { id: 'g1', title: 'G', created_at: 'c', updated_at: 'u' } })),
    disconnectGithub: vi.fn(async () => {}),
    getGithubPagesPublishInfo: vi.fn(async () => ({ ok: false, error: 'github_not_linked' })),
    checkGithubPagesTarget: vi.fn(async () => ({
      ok: true,
      url: 'https://x',
      exists: false,
      routeExists: false,
      pagesConfigured: false,
      deploymentStatus: null,
      currentPublishLive: null,
    })),
    publishToGithubPages: vi.fn(async () => ({ ok: true, url: 'https://x', repo: 'zoof', repoCreated: true, deploymentStatus: 'queued', publishMarker: 'marker-1' })),
  };
});

const persistence = vi.hoisted(() => {
  return {
    loadLatestActiveProjectSnapshotRecord: vi.fn(async () => null),
    saveWorkspaceBackup: vi.fn(async () => {}),
    loadLastPublishInfo: vi.fn(async () => null),
    saveLastPublishInfo: vi.fn(async () => {}),
  };
});

vi.mock('../../src/cloud/api', () => api);
vi.mock('../../src/editor/projectPersistence', () => ({
  projectPersistence: persistence,
}));

import { CloudAccountPanel, __resetCloudAccountPanelAuthCacheForTests } from '../../src/editor/CloudAccountPanel';

function baseState(): any {
  return {
    initialized: true,
    syncMode: 'online',
    project: { assets: { images: {}, spriteSheets: {}, fonts: {} }, audio: { sounds: {} } },
  };
}

function applyProjectMetadataAction(current: any, action: any) {
  return {
    ...current,
    project: {
      ...current.project,
      ...(typeof action.title === 'string' ? { title: action.title } : {}),
      ...(typeof action.publishTitle === 'string' ? { publishTitle: action.publishTitle } : {}),
      ...(typeof action.publishGithubPagesRepo === 'string'
        ? { publishGithubPagesRepo: action.publishGithubPagesRepo }
        : {}),
    },
  };
}

function renderIntoDom(element: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return {
    container,
    root,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

function createStorageMock(): Storage {
  let store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store = new Map<string, string>();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe('CloudAccountPanel publish gating', () => {
  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, 'localStorage', {
      value: createStorageMock(),
      configurable: true,
    });
    Object.defineProperty(window, 'sessionStorage', {
      value: createStorageMock(),
      configurable: true,
    });
  });
  afterAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  afterEach(() => {
    __resetCloudAccountPanelAuthCacheForTests();
    window.localStorage.clear();
    clearPersistenceDebugEntries();
    setPersistenceDebugEnabled(false);
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('autosaves edits to the mapped cloud game after a debounce', async () => {
    vi.useFakeTimers();
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'dev@example.com' } });

    const project = createEmptyProject();
    project.id = 'project-1';
    project.title = 'Pattern Demo';

    const dispatch = vi.fn();
    const onStatus = vi.fn();
    const onError = vi.fn();
    const view = renderIntoDom(
      <CloudAccountPanel
        state={{ project }}
        activeCloudGameId="g-1"
        dispatch={dispatch as any}
        onLoadYaml={() => {}}
        onStatus={onStatus}
        onError={onError}
      />
    );

    try {
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(api.me).toHaveBeenCalled();
      expect(document.querySelector('.cloud-signed-in')?.textContent).toContain('dev@example.com');
      api.updateGame.mockClear();

      const edited = structuredClone(project);
      edited.title = 'Pattern Demo 2';

      act(() => {
        view.root.render(
          <CloudAccountPanel
            state={{ project: edited }}
            activeCloudGameId="g-1"
            dispatch={dispatch as any}
            onLoadYaml={() => {}}
            onStatus={onStatus}
            onError={onError}
          />
        );
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(api.updateGame).toHaveBeenCalledWith(
        'g-1',
        expect.objectContaining({
          title: 'Pattern Demo 2',
          project: expect.objectContaining({
            title: 'Pattern Demo 2',
          }),
        }),
        'csrf',
      );
      expect(onError).not.toHaveBeenCalled();
    } finally {
      view.cleanup();
    }
  });

  it('refreshes csrf and retries autosave when the cached token is stale', async () => {
    vi.useFakeTimers();
    api.fetchCsrfToken.mockReset();
    api.fetchCsrfToken.mockResolvedValueOnce('stale-csrf').mockResolvedValueOnce('fresh-csrf');
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'dev@example.com' } });

    const project = createEmptyProject();
    project.id = 'project-1';
    project.title = 'Pattern Demo';

    api.updateGame
      .mockRejectedValueOnce(new Error('csrf_required [403 PUT /api/v1/games/g-1]'))
      .mockResolvedValueOnce({ game: { id: 'g-1', title: 'Pattern Demo 2', created_at: 'c', updated_at: 'u' } });

    const dispatch = vi.fn();
    const onStatus = vi.fn();
    const onError = vi.fn();
    const view = renderIntoDom(
      <CloudAccountPanel
        state={{ project }}
        activeCloudGameId="g-1"
        dispatch={dispatch as any}
        onLoadYaml={() => {}}
        onStatus={onStatus}
        onError={onError}
      />
    );

    try {
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      api.updateGame.mockClear();

      const edited = structuredClone(project);
      edited.title = 'Pattern Demo 2';

      act(() => {
        view.root.render(
          <CloudAccountPanel
            state={{ project: edited }}
            activeCloudGameId="g-1"
            dispatch={dispatch as any}
            onLoadYaml={() => {}}
            onStatus={onStatus}
            onError={onError}
          />
        );
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(api.fetchCsrfToken).toHaveBeenCalledTimes(2);
      expect(api.updateGame).toHaveBeenNthCalledWith(
        1,
        'g-1',
        expect.objectContaining({
          title: 'Pattern Demo 2',
          project: expect.objectContaining({ title: 'Pattern Demo 2' }),
        }),
        'stale-csrf',
      );
      expect(api.updateGame).toHaveBeenNthCalledWith(
        2,
        'g-1',
        expect.objectContaining({
          title: 'Pattern Demo 2',
          project: expect.objectContaining({ title: 'Pattern Demo 2' }),
        }),
        'fresh-csrf',
      );
      expect(onError).not.toHaveBeenCalledWith(expect.stringContaining('csrf_required'));
    } finally {
      view.cleanup();
    }
  });

  it('clears a transient cloud autosave error after the retry succeeds', async () => {
    vi.useFakeTimers();
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'dev@example.com' } });

    const initialProject = createEmptyProject();
    initialProject.id = 'project-1';
    initialProject.title = 'Pattern Demo';

    api.updateGame
      .mockRejectedValueOnce(new Error('internal_error [500 PUT /api/v1/games/g-1]'))
      .mockResolvedValueOnce({ updated_at: 'u2' });

    const onStatus = vi.fn();

    function Harness({ project }: { project: any }) {
      const [state, setState] = React.useState<any>({
        initialized: true,
        syncMode: 'online',
        project: structuredClone(project),
        error: undefined,
      });

      React.useEffect(() => {
        setState((current: any) => ({ ...current, project: structuredClone(project) }));
      }, [project]);

      const dispatch = React.useCallback((action: any) => {
        setState((current: any) => {
          if (action.type === 'set-error') {
            return { ...current, error: action.error };
          }
          return current;
        });
      }, []);

      return (
        <div>
          <div data-testid="error-state">{state.error ?? ''}</div>
          <CloudAccountPanel
            state={state}
            activeCloudGameId="g-1"
            dispatch={dispatch as any}
            onLoadYaml={() => {}}
            onStatus={onStatus}
            onError={(message) => dispatch({ type: 'set-error', error: message })}
          />
        </div>
      );
    }

    const view = renderIntoDom(<Harness project={initialProject} />);
    try {
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      api.updateGame.mockClear();

      const edited = structuredClone(initialProject);
      edited.title = 'Pattern Demo 2';

      act(() => {
        view.root.render(<Harness project={edited} />);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(api.updateGame).toHaveBeenCalledTimes(1);
      expect(view.container.querySelector('[data-testid="error-state"]')?.textContent).toContain('internal_error');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(api.updateGame).toHaveBeenCalledTimes(2);
      expect(view.container.querySelector('[data-testid="error-state"]')?.textContent).toBe('');
    } finally {
      view.cleanup();
    }
  });

  it('does not autosave a placeholder project before the editor finishes hydrating', async () => {
    vi.useFakeTimers();
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'dev@example.com' } });

    const project = createEmptyProject();
    project.id = 'project-startup-placeholder';
    project.title = 'Untitled Project';

    const view = renderIntoDom(
      <CloudAccountPanel
        state={{ initialized: false, syncMode: 'online', project }}
        dispatch={vi.fn() as any}
        onLoadYaml={() => {}}
        onCloudGameLinked={vi.fn()}
        onStatus={vi.fn()}
        onError={vi.fn()}
      />
    );

    try {
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      await flushEffects();
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(api.createGame).not.toHaveBeenCalled();
      expect(api.updateGame).not.toHaveBeenCalled();
    } finally {
      view.cleanup();
    }
  });

  it('renders login inputs as a real form and submits credentials through the login handler', async () => {
    api.me.mockResolvedValueOnce({ user: null });
    api.login.mockResolvedValueOnce({ user: { id: 'u1', email: 'dev@example.com' } });

    const onStatus = vi.fn();
    const onError = vi.fn();
    const view = renderIntoDom(
      <CloudAccountPanel
        state={{ project: createEmptyProject() }}
        dispatch={vi.fn() as any}
        onLoadYaml={() => {}}
        onStatus={onStatus}
        onError={onError}
      />,
    );

    try {
      await flushEffects();

      fireEvent.click(document.querySelector('[role="tab"][aria-label="Log in"]') as Element);

      const form = document.querySelector('.cloud-auth-form') as HTMLFormElement | null;
      const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement | null;
      const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement | null;
      const submitButton = document.querySelector('[data-testid="cloud-account-submit"]') as HTMLButtonElement | null;

      expect(form).not.toBeNull();
      expect(emailInput?.type).toBe('email');
      expect(emailInput?.autocomplete).toBe('email');
      expect(passwordInput?.autocomplete).toBe('current-password');
      expect(submitButton?.type).toBe('submit');

      fireEvent.change(emailInput as HTMLInputElement, { target: { value: 'dev@example.com' } });
      fireEvent.change(passwordInput as HTMLInputElement, { target: { value: 'hunter2' } });

      await act(async () => {
        fireEvent.submit(form as HTMLFormElement);
        await Promise.resolve();
      });

      expect(api.fetchCsrfToken).toHaveBeenCalled();
      expect(api.login).toHaveBeenCalledWith('dev@example.com', 'hunter2', 'csrf');
      expect(onStatus).toHaveBeenCalledWith('Signed in as dev@example.com');
      expect(onError).not.toHaveBeenCalled();
    } finally {
      view.cleanup();
    }
  });

  it('flushes a pending cloud autosave when the page is hidden before the debounce elapses', async () => {
    vi.useFakeTimers();
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'dev@example.com' } });
    setPersistenceDebugEnabled(true);

    const project = createEmptyProject();
    project.id = 'project-1';
    project.title = 'Pattern Demo';

    const view = renderIntoDom(
      <CloudAccountPanel
        state={{ project }}
        activeCloudGameId="g-1"
        dispatch={vi.fn() as any}
        onLoadYaml={() => {}}
        onStatus={vi.fn()}
        onError={vi.fn()}
      />
    );

    try {
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      api.updateGame.mockClear();

      const edited = structuredClone(project);
      edited.title = 'Pattern Demo 2';

      act(() => {
        view.root.render(
          <CloudAccountPanel
            state={{ project: edited }}
            activeCloudGameId="g-1"
            dispatch={vi.fn() as any}
            onLoadYaml={() => {}}
            onStatus={vi.fn()}
            onError={vi.fn()}
          />
        );
      });

      act(() => {
        window.dispatchEvent(new PageTransitionEvent('pagehide'));
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(api.updateGame).toHaveBeenCalledWith(
        'g-1',
        expect.objectContaining({
          title: 'Pattern Demo 2',
          project: expect.objectContaining({
            title: 'Pattern Demo 2',
          }),
        }),
        'csrf',
      );

      const events = readPersistenceDebugEntries().map((entry) => entry.event);
      expect(events).toContain('cloud:pagehide-flush');
      expect(events).toContain('cloud:autosave-flush-start');
      expect(events).toContain('cloud:autosave-flush-success');
    } finally {
      view.cleanup();
    }
  });

  it('creates a cloud game for a signed-in project when no mapping exists yet', async () => {
    vi.useFakeTimers();
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'dev@example.com' } });

    const project = createEmptyProject();
    project.id = 'project-create';
    project.title = 'Cloud Save Demo';

    const view = renderIntoDom(
      <CloudAccountPanel
        state={{ project }}
        dispatch={vi.fn() as any}
        onLoadYaml={() => {}}
        onStatus={vi.fn()}
        onError={vi.fn()}
      />
    );

    try {
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(api.me).toHaveBeenCalled();
      expect(document.querySelector('.cloud-signed-in')?.textContent).toContain('dev@example.com');

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(api.createGame).toHaveBeenCalledWith(
        'Cloud Save Demo',
        expect.objectContaining({
          id: 'project-create',
          title: 'Cloud Save Demo',
        }),
        'csrf',
      );
    } finally {
      view.cleanup();
    }
  });

  it('notifies the host when autosave links a project to a new cloud game', async () => {
    vi.useFakeTimers();
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'dev@example.com' } });

    const project = createEmptyProject();
    project.id = 'project-create';
    project.title = 'Cloud Save Demo';
    const onCloudGameLinked = vi.fn();

    const view = renderIntoDom(
      <CloudAccountPanel
        state={{ project }}
        dispatch={vi.fn() as any}
        onLoadYaml={() => {}}
        onCloudGameLinked={onCloudGameLinked}
        onStatus={vi.fn()}
        onError={vi.fn()}
      />
    );

    try {
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      await flushEffects();
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(onCloudGameLinked).toHaveBeenCalledWith('g1');
    } finally {
      view.cleanup();
    }
  });

  it('autosaves edits to the active cloud-backed project even when the local mapping is missing', async () => {
    vi.useFakeTimers();
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'dev@example.com' } });

    const project = createEmptyProject();
    project.id = 'project-1';
    project.title = 'Pattern Demo';

    const dispatch = vi.fn();
    const onStatus = vi.fn();
    const onError = vi.fn();
    const view = renderIntoDom(
      <CloudAccountPanel
        state={{ project }}
        activeCloudGameId="g-1"
        dispatch={dispatch as any}
        onLoadYaml={() => {}}
        onStatus={onStatus}
        onError={onError}
      />,
    );

    try {
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      api.updateGame.mockClear();
      api.createGame.mockClear();

      const edited = structuredClone(project);
      edited.publishTitle = 'Pattern Demo';

      act(() => {
        view.root.render(
          <CloudAccountPanel
            state={{ project: edited }}
            activeCloudGameId="g-1"
            dispatch={dispatch as any}
            onLoadYaml={() => {}}
            onStatus={onStatus}
            onError={onError}
          />,
        );
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(api.updateGame).toHaveBeenCalledWith(
        'g-1',
        expect.objectContaining({
          title: 'Pattern Demo',
          project: expect.objectContaining({
            publishTitle: 'Pattern Demo',
          }),
        }),
        'csrf',
      );
      expect(api.createGame).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    } finally {
      view.cleanup();
    }
  });

  it('recreates a missing cloud game instead of surfacing not_found for a stale local cloud link', async () => {
    vi.useFakeTimers();
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'dev@example.com' } });
    api.updateGame.mockRejectedValueOnce(new Error('not_found'));
    api.createGame.mockResolvedValueOnce({ game: { id: 'g-recreated', title: 'Pattern Demo 2', created_at: 'c', updated_at: 'u' } });

    const project = createEmptyProject();
    project.id = 'project-stale-link';
    project.title = 'Pattern Demo';

    const onCloudGameLinked = vi.fn();
    const onError = vi.fn();
    const view = renderIntoDom(
      <CloudAccountPanel
        state={{ project }}
        activeCloudGameId="g-stale"
        dispatch={vi.fn() as any}
        onLoadYaml={() => {}}
        onCloudGameLinked={onCloudGameLinked}
        onStatus={vi.fn()}
        onError={onError}
      />,
    );

    try {
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      api.updateGame.mockClear();

      const edited = structuredClone(project);
      edited.title = 'Pattern Demo 2';

      act(() => {
        view.root.render(
          <CloudAccountPanel
            state={{ project: edited }}
            activeCloudGameId="g-stale"
            dispatch={vi.fn() as any}
            onLoadYaml={() => {}}
            onCloudGameLinked={onCloudGameLinked}
            onStatus={vi.fn()}
            onError={onError}
          />,
        );
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(api.updateGame).toHaveBeenCalledWith(
        'g-stale',
        expect.objectContaining({
          title: 'Pattern Demo 2',
        }),
        'csrf',
      );
      expect(api.createGame).toHaveBeenCalledWith(
        'Pattern Demo 2',
        expect.objectContaining({
          id: 'project-stale-link',
          title: 'Pattern Demo 2',
        }),
        'csrf',
      );
      expect(onCloudGameLinked).toHaveBeenCalledWith('g-recreated');
      expect(onError).not.toHaveBeenCalledWith('not_found');
    } finally {
      view.cleanup();
    }
  });

  it('shows a workspace conflict for a linked project only when sync mode is offline', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'dev@example.com' } });

    const deviceProject = createEmptyProject();
    deviceProject.id = 'project-1';
    deviceProject.title = 'Device Project';
    const currentCloudProject = structuredClone(deviceProject);
    currentCloudProject.title = 'Current Cloud Project';

    persistence.loadLatestActiveProjectSnapshotRecord.mockResolvedValueOnce({
      id: 'project-1',
      projectId: 'project-1',
      title: 'Device Project',
      project: deviceProject,
      updatedAt: '2026-06-21T11:16:00.000Z',
      sceneCount: 1,
      origin: 'local-only',
      syncStatus: 'local',
      revisions: [],
    });

    api.getGame.mockImplementation(async (id: string) => {
      if (id === 'g1') {
        return {
          game: {
            id: 'g1',
            title: 'Current Cloud Project',
            created_at: 'c',
            updated_at: 'u1',
            project: currentCloudProject,
          },
        };
      }
      throw new Error(`unexpected game id ${id}`);
    });
    const onLoadProject = vi.fn();

    const view = renderIntoDom(
      <CloudAccountPanel
        state={{ project: deviceProject, syncMode: 'offline' }}
        activeCloudGameId="g1"
        dispatch={vi.fn() as any}
        onLoadYaml={() => {}}
        onLoadProject={onLoadProject}
        onStatus={vi.fn()}
        onError={vi.fn()}
      />
    );

    try {
      await flushEffects();
      await flushEffects();

      expect(api.getGame).toHaveBeenCalledWith('g1');
      expect(document.querySelector('[data-testid="workspace-conflict-modal"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="workspace-conflict-cloud-card"]')?.textContent).toContain('Current Cloud Project');
      (document.querySelector('[data-testid="workspace-conflict-use-cloud"]') as HTMLButtonElement | null)?.click();
      expect(persistence.saveWorkspaceBackup).toHaveBeenCalledWith(deviceProject, 'device');
      expect(onLoadProject).toHaveBeenCalledWith(currentCloudProject, 'cloud:workspace');
    } finally {
      view.cleanup();
    }
  });

  it('does not raise a startup conflict for an unlinked local project just because cloud games exist', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'dev@example.com' } });

    const deviceProject = createEmptyProject();
    deviceProject.id = 'project-1';
    deviceProject.title = 'Device Project';

    const onStatus = vi.fn();
    const view = renderIntoDom(
      <CloudAccountPanel
        state={{ project: deviceProject, syncMode: 'online' }}
        dispatch={vi.fn() as any}
        onLoadYaml={() => {}}
        onStatus={onStatus}
        onError={vi.fn()}
      />
    );

    try {
      await flushEffects();
      await flushEffects();

      expect(api.getGame).not.toHaveBeenCalled();
      expect(api.listGames).not.toHaveBeenCalled();
      expect(document.querySelector('[data-testid="workspace-conflict-modal"]')).toBeNull();
      expect(onStatus).not.toHaveBeenCalledWith(expect.stringContaining('Workspace conflict detected'));
    } finally {
      view.cleanup();
    }
  });

  it('does not raise a startup conflict for a linked online project and lets autosave reconcile it', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'dev@example.com' } });

    const deviceProject = createEmptyProject();
    deviceProject.id = 'project-1';
    deviceProject.title = 'Device Project';

    const onStatus = vi.fn();
    const view = renderIntoDom(
      <CloudAccountPanel
        state={{ project: deviceProject, syncMode: 'online' }}
        activeCloudGameId="g1"
        dispatch={vi.fn() as any}
        onLoadYaml={() => {}}
        onStatus={onStatus}
        onError={vi.fn()}
      />
    );

    try {
      await flushEffects();
      await flushEffects();

      expect(api.getGame).not.toHaveBeenCalled();
      expect(document.querySelector('[data-testid="workspace-conflict-modal"]')).toBeNull();
      expect(onStatus).not.toHaveBeenCalledWith(expect.stringContaining('Workspace conflict detected'));
    } finally {
      view.cleanup();
    }
  });

  it('shows a compact Publish section when not signed in', async () => {
    api.me.mockImplementationOnce(async () => {
      throw new Error('not_signed_in');
    });

    function Harness() {
      const [state, setState] = React.useState<any>({
        project: {
          id: 'p1',
          title: 'Pattern demo',
          publishGithubPagesRepo: 'zoof',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
        },
      });
      return (
        <CloudAccountPanel
          state={state}
          dispatch={(action) => {
            if (action.type !== 'set-project-metadata') return;
            setState((current: any) => ({
              ...current,
              project: {
                ...current.project,
                ...(typeof action.title === 'string' ? { title: action.title } : {}),
                ...(typeof action.publishGithubPagesRepo === 'string'
                  ? { publishGithubPagesRepo: action.publishGithubPagesRepo }
                  : {}),
              },
            }));
          }}
          onLoadYaml={() => {}}
          onStatus={() => {}}
          onError={() => {}}
        />
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();
      const publish = document.querySelector('[data-testid="cloud-publish-pages-section"]') as HTMLElement | null;
      expect(publish).toBeTruthy();
      expect(publish?.textContent).toContain('PUBLISH');
      expect(document.querySelector('[aria-label="Publish repository"]')).toBeFalsy();
      expect(document.querySelector('[data-testid="cloud-publish-signin-cta"]')).toBeTruthy();
    } finally {
      view.cleanup();
    }
  });

  it('defaults to the Create tab for first-time users and shows invite-code signup fields', async () => {
    api.me.mockImplementationOnce(async () => {
      throw new Error('not_signed_in');
    });

    function Harness() {
      const [state, setState] = React.useState<any>({
        project: {
          id: 'p1',
          title: 'Pattern demo',
          publishGithubPagesRepo: 'zoof',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
        },
      });
      return (
        <CloudAccountPanel
          state={state}
          dispatch={(action) => {
            if (action.type !== 'set-project-metadata') return;
            setState((current: any) => ({
              ...current,
              project: {
                ...current.project,
                ...(typeof action.title === 'string' ? { title: action.title } : {}),
                ...(typeof action.publishGithubPagesRepo === 'string'
                  ? { publishGithubPagesRepo: action.publishGithubPagesRepo }
                  : {}),
              },
            }));
          }}
          onLoadYaml={() => {}}
          onStatus={() => {}}
          onError={() => {}}
        />
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();
      expect(document.querySelector('[role="tablist"][aria-label="Cloud account mode"]')).toBeTruthy();
      expect(document.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain('Create');
      expect(document.querySelector('[aria-label="Invite code"]')).toBeTruthy();
      expect(document.body.textContent).toContain('Create your account with your invite code.');
      expect(document.querySelector('[data-testid="cloud-account-submit"]')?.textContent).toContain('Create account');
      expect(document.body.textContent).toContain('Already have an account?');
    } finally {
      view.cleanup();
    }
  });

  it('signs up cleanly when a wiped backend leaves the current project linked to a stale cloud game id', async () => {
    vi.useFakeTimers();
    api.me.mockImplementationOnce(async () => {
      throw new Error('not_signed_in');
    });
    api.signup.mockResolvedValueOnce({ user: { id: 'u1', email: 'dev@example.com' } });
    api.getGame.mockRejectedValue(new Error('not_found'));
    api.createGame.mockResolvedValueOnce({ game: { id: 'g-recreated', title: 'Untitled', created_at: 'c', updated_at: 'u' } });

    const project = createEmptyProject();
    project.id = 'project-stale-signup';
    project.title = 'Untitled';

    const onCloudGameLinked = vi.fn();
    const onError = vi.fn();

    const view = renderIntoDom(
      <CloudAccountPanel
        state={{ project, syncMode: 'online' }}
        activeCloudGameId="g-stale"
        dispatch={() => {}}
        onLoadYaml={() => {}}
        onCloudGameLinked={onCloudGameLinked}
        onStatus={() => {}}
        onError={onError}
      />,
    );

    try {
      await flushEffects();

      const form = document.querySelector('.cloud-auth-form') as HTMLFormElement | null;
      const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement | null;
      const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement | null;
      const inviteInput = document.querySelector('input[aria-label="Invite code"]') as HTMLInputElement | null;

      fireEvent.change(emailInput as HTMLInputElement, { target: { value: 'dev@example.com' } });
      fireEvent.change(passwordInput as HTMLInputElement, { target: { value: 'hunter2' } });
      fireEvent.change(inviteInput as HTMLInputElement, { target: { value: 'invite-code-123' } });

      await act(async () => {
        fireEvent.submit(form as HTMLFormElement);
        await vi.runAllTimersAsync();
      });

      expect(api.signup).toHaveBeenCalledWith('dev@example.com', 'hunter2', 'csrf', 'invite-code-123');
      expect(api.createGame).toHaveBeenCalledWith(
        'Untitled',
        expect.objectContaining({
          id: 'project-stale-signup',
          title: 'Untitled',
        }),
        'csrf',
      );
      expect(onCloudGameLinked).toHaveBeenCalledWith('g-recreated');
      expect(onError).not.toHaveBeenCalledWith('not_found');
    } finally {
      view.cleanup();
    }
  });

  it('still defaults to the Create tab even if a stale local account-created hint exists', async () => {
    api.me.mockImplementationOnce(async () => {
      throw new Error('not_signed_in');
    });
    window.localStorage.setItem('phaserforge.cloud.account_created_v1', '1');

    const view = renderIntoDom(
      <CloudAccountPanel
        state={{
          project: {
            id: 'p1',
            title: 'Pattern demo',
            publishGithubPagesRepo: 'zoof',
            assets: { images: {}, spriteSheets: {}, fonts: {} },
            audio: { sounds: {} },
          },
        }}
        dispatch={() => {}}
        onLoadYaml={() => {}}
        onStatus={() => {}}
        onError={() => {}}
      />,
    );
    try {
      await flushEffects();
      expect(document.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain('Create');
      expect(document.querySelector('[aria-label="Invite code"]')).toBeTruthy();
      expect(document.body.textContent).toContain('Create your account with your invite code.');
      expect(document.querySelector('[data-testid="cloud-account-submit"]')?.textContent).toContain('Create account');
      expect(document.body.textContent).toContain('Already have an account?');
    } finally {
      view.cleanup();
    }
  });

  it('switches to the Create tab to show invite-code signup fields and copy', async () => {
    api.me.mockImplementationOnce(async () => {
      throw new Error('not_signed_in');
    });

    const view = renderIntoDom(
      <CloudAccountPanel
        state={{
          project: {
            id: 'p1',
            title: 'Pattern demo',
            publishGithubPagesRepo: 'zoof',
            assets: { images: {}, spriteSheets: {}, fonts: {} },
            audio: { sounds: {} },
          },
        }}
        dispatch={() => {}}
        onLoadYaml={() => {}}
        onStatus={() => {}}
        onError={() => {}}
      />,
    );
    try {
      await flushEffects();
      await act(async () => {
        (document.querySelector('[role="tab"][aria-label="Create"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });

      expect(document.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain('Create');
      expect(document.querySelector('[aria-label="Invite code"]')).toBeTruthy();
      expect(document.body.textContent).toContain('Create your account with your invite code.');
      expect(document.querySelector('[data-testid="cloud-account-submit"]')?.textContent).toContain('Create account');
      expect(document.body.textContent).toContain('Already have an account?');
    } finally {
      view.cleanup();
    }
  });

  it('shows Connect GitHub CTA (and hides the form) when signed in but GitHub is not linked', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValueOnce({ ok: false, error: 'github_not_linked' });

    const view = renderIntoDom(
      <CloudAccountPanel
        state={{
          project: {
            id: 'p1',
            title: 'Pattern demo',
            publishGithubPagesRepo: 'zoof',
            assets: { images: {}, spriteSheets: {}, fonts: {} },
            audio: { sounds: {} },
          },
        }}
        dispatch={() => {}}
        onLoadYaml={() => {}}
        onStatus={() => {}}
        onError={() => {}}
      />,
    );
    try {
      await flushEffects();
      const publish = document.querySelector('[data-testid="cloud-publish-pages-section"]') as HTMLElement | null;
      expect(publish).toBeTruthy();
      expect(document.querySelector('[aria-label="Publish repository"]')).toBeFalsy();
      expect(document.body.textContent).toContain('Your account is ready. Connect GitHub to enable publishing.');
      const cta = document.querySelector('[data-testid="cloud-publish-connect-github-cta"]') as HTMLButtonElement | null;
      expect(cta).toBeTruthy();
      act(() => cta!.click());
      expect(document.querySelector('[data-testid="github-connect-modal"]')).toBeTruthy();
    } finally {
      view.cleanup();
    }
  });

  it('uses neutral reconnect copy in the Connect GitHub modal', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValueOnce({ ok: false, error: 'github_not_linked' });

    const view = renderIntoDom(
      <CloudAccountPanel state={baseState()} dispatch={() => {}} onLoadYaml={() => {}} onStatus={() => {}} onError={() => {}} />,
    );
    try {
      await flushEffects();
      act(() => {
        (document.querySelector('[data-testid="cloud-publish-connect-github-cta"]') as HTMLButtonElement).click();
      });
      const modal = document.querySelector('[data-testid="github-connect-modal"]') as HTMLElement | null;
      expect(modal?.textContent).toContain('Continue to GitHub to connect your account.');
      expect(modal?.textContent).toContain('the connection may complete immediately');
      expect(modal?.textContent).not.toContain('authorize PhaserForge');
    } finally {
      view.cleanup();
    }
  });

  it('explains that disconnect only removes the PhaserForge link and exposes a GitHub settings link', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValueOnce({
      ok: true,
      login: 'alice',
      pagesBaseUrl: 'https://alice.github.io/',
    });

    const view = renderIntoDom(
      <CloudAccountPanel state={baseState()} dispatch={() => {}} onLoadYaml={() => {}} onStatus={() => {}} onError={() => {}} />,
    );
    try {
      await flushEffects();
      expect(document.body.textContent).toContain('Disconnect only removes the GitHub link from PhaserForge.');
      const settingsLink = document.querySelector('[data-testid="github-authorized-apps-link"]') as HTMLAnchorElement | null;
      expect(settingsLink).toBeTruthy();
      expect(settingsLink?.href).toBe('https://github.com/settings/connections/applications');
    } finally {
      view.cleanup();
    }
  });

  it('uses non-guaranteed switching copy in the Switch GitHub modal', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValueOnce({
      ok: true,
      login: 'alice',
      pagesBaseUrl: 'https://alice.github.io/',
    });

    const view = renderIntoDom(
      <CloudAccountPanel state={baseState()} dispatch={() => {}} onLoadYaml={() => {}} onStatus={() => {}} onError={() => {}} />,
    );
    try {
      await flushEffects();
      act(() => {
        (document.querySelector('[aria-label="Switch GitHub account"]') as HTMLButtonElement).click();
      });
      const modal = document.querySelector('[data-testid="github-connect-modal"]') as HTMLElement | null;
      expect(modal?.textContent).toContain('If you are already signed into the target GitHub account, the switch may complete immediately.');
      expect(modal?.textContent).toContain('use a private window');
      expect(modal?.textContent).not.toContain('Currently linked: alice. Continuing may change the linked account.');
    } finally {
      view.cleanup();
    }
  });

  it('shows the Publish form when signed in and GitHub is linked', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValueOnce({ ok: true, login: 'alice', pagesBaseUrl: 'https://alice.github.io/' });

    const view = renderIntoDom(
      <CloudAccountPanel state={baseState()} dispatch={() => {}} onLoadYaml={() => {}} onStatus={() => {}} onError={() => {}} />,
    );
    try {
      await flushEffects();
      const publish = document.querySelector('[data-testid="cloud-publish-pages-section"]') as HTMLElement | null;
      expect(publish).toBeTruthy();
      expect(document.querySelector('[aria-label="Publish repository"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="cloud-publish-connect-github-cta"]')).toBeFalsy();
      expect(document.querySelector('[data-testid="cloud-publish-pages-help"]')?.textContent).not.toContain('Public repo:');
      expect(document.querySelector('[data-testid="cloud-publish-pages-help"]')?.textContent).not.toContain('Embedded assets only.');

      // Game/title controls belong to account area, not inside Publish section.
      expect(publish?.querySelector('select')).toBeFalsy();
    } finally {
      view.cleanup();
    }
  });

  it('renders the publish URL preview below Repository and updates it as the repo changes', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValue({
      ok: true,
      login: 'bcorfman',
      pagesBaseUrl: 'https://bcorfman.github.io/',
    });

    function Harness() {
      const [state, setState] = React.useState<any>(baseState());
      return (
        <CloudAccountPanel
          state={state}
          dispatch={(action) => {
            if (action.type !== 'set-project-metadata') return;
            setState((current: any) => ({
              ...current,
              project: {
                ...current.project,
                ...(typeof action.title === 'string' ? { title: action.title } : {}),
                ...(typeof action.publishGithubPagesRepo === 'string'
                  ? { publishGithubPagesRepo: action.publishGithubPagesRepo }
                  : {}),
              },
            }));
          }}
          onLoadYaml={() => {}}
          onStatus={() => {}}
          onError={() => {}}
        />
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();

      const routeInput = document.querySelector('[aria-label="Publish repository"]') as HTMLInputElement | null;
      const preview = document.querySelector('[data-testid="cloud-publish-pages-target"]') as HTMLElement | null;

      expect(routeInput).toBeTruthy();
      expect(preview).toBeTruthy();
      expect(routeInput?.compareDocumentPosition(preview!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(preview?.textContent).toContain('https://bcorfman.github.io/<repo>/');

      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(routeInput, 'zoof');
        else routeInput!.value = 'zoof';
        routeInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        routeInput!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        await Promise.resolve();
      });

      expect(preview?.textContent).toContain('https://bcorfman.github.io/zoof/');
    } finally {
      view.cleanup();
    }
  });

  it('keeps the Publish title local while typing and does not rename the project tree title', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValueOnce({ ok: true, login: 'alice', pagesBaseUrl: 'https://alice.github.io/' });

    const dispatch = vi.fn();

    function Harness() {
      const [state, setState] = React.useState<any>({
        project: {
          id: 'p1',
          title: 'Project Tree Title',
          publishTitle: 'Initial Publish Title',
          publishGithubPagesRepo: 'zoof',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
        },
      });
      return (
        <>
          <div data-testid="project-tree-title">{state.project.title}</div>
          <div data-testid="publish-title-state">{state.project.publishTitle}</div>
          <CloudAccountPanel
            state={state}
            dispatch={(action) => {
              dispatch(action);
              if (action.type !== 'set-project-metadata') return;
              setState((current: any) => applyProjectMetadataAction(current, action));
            }}
            onLoadYaml={() => {}}
            onStatus={() => {}}
            onError={() => {}}
          />
        </>
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();

      const titleInput = document.querySelector('[data-testid="cloud-publish-pages-section"] input[placeholder="My Game"]') as HTMLInputElement | null;
      expect(titleInput?.value).toBe('Initial Publish Title');

      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(titleInput, 'Published Title Only');
        else titleInput!.value = 'Published Title Only';
        titleInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        titleInput!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        await Promise.resolve();
      });

      expect(titleInput?.value).toBe('Published Title Only');
      expect(document.querySelector('[data-testid="project-tree-title"]')?.textContent).toBe('Project Tree Title');
      expect(document.querySelector('[data-testid="publish-title-state"]')?.textContent).toBe('Initial Publish Title');
      expect(dispatch).not.toHaveBeenCalled();

      await act(async () => {
        titleInput?.focus();
        titleInput?.blur();
        await Promise.resolve();
      });

      expect(document.querySelector('[data-testid="project-tree-title"]')?.textContent).toBe('Project Tree Title');
      expect(document.querySelector('[data-testid="publish-title-state"]')?.textContent).toBe('Published Title Only');
      expect(dispatch).toHaveBeenCalledWith({ type: 'set-project-metadata', publishTitle: 'Published Title Only' });
    } finally {
      view.cleanup();
    }
  });

  it('keeps the Publish repository local while typing and persists it on blur', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValueOnce({
      ok: true,
      login: 'bcorfman',
      pagesBaseUrl: 'https://bcorfman.github.io/',
    });
    setPersistenceDebugEnabled(true);

    const dispatch = vi.fn();

    function Harness() {
      const [state, setState] = React.useState<any>({
        project: {
          id: 'p1',
          title: 'Project Tree Title',
          publishTitle: 'Publish Title',
          publishGithubPagesRepo: 'old-repo',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
        },
      });
      return (
        <>
          <div data-testid="repo-state">{state.project.publishGithubPagesRepo}</div>
          <CloudAccountPanel
            state={state}
            dispatch={(action) => {
              dispatch(action);
              if (action.type !== 'set-project-metadata') return;
              setState((current: any) => applyProjectMetadataAction(current, action));
            }}
            onLoadYaml={() => {}}
            onStatus={() => {}}
            onError={() => {}}
          />
        </>
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();

      const routeInput = document.querySelector('[aria-label="Publish repository"]') as HTMLInputElement | null;
      const preview = document.querySelector('[data-testid="cloud-publish-pages-target"]') as HTMLElement | null;

      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(routeInput, 'new-repo');
        else routeInput!.value = 'new-repo';
        routeInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        routeInput!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        await Promise.resolve();
      });

      expect(routeInput?.value).toBe('new-repo');
      expect(preview?.textContent).toContain('https://bcorfman.github.io/new-repo/');
      expect(document.querySelector('[data-testid="repo-state"]')?.textContent).toBe('old-repo');
      expect(dispatch).not.toHaveBeenCalled();

      await act(async () => {
        routeInput?.focus();
        routeInput?.blur();
        await Promise.resolve();
      });

      expect(document.querySelector('[data-testid="repo-state"]')?.textContent).toBe('new-repo');
      expect(dispatch).toHaveBeenCalledWith({ type: 'set-project-metadata', publishGithubPagesRepo: 'new-repo' });
      expect(readPersistenceDebugEntries()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          event: 'cloud:publish-repo-draft-persist-dispatch',
          details: expect.objectContaining({
            draft: 'new-repo',
            stored: 'old-repo',
          }),
        }),
      ]));
    } finally {
      view.cleanup();
    }
  });

  it('shows a neutral loading state until auth resolves', async () => {
    let resolveMe: ((value: { user: { id: string; email: string } }) => void) | null = null;
    api.me.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMe = resolve;
        }),
    );

    const view = renderIntoDom(
      <CloudAccountPanel state={baseState()} dispatch={() => {}} onLoadYaml={() => {}} onStatus={() => {}} onError={() => {}} />,
    );
    try {
      expect(document.querySelector('[data-testid="cloud-account-loading"]')?.textContent).toContain('Checking account');
      expect(document.querySelector('[data-testid="cloud-publish-signin-cta"]')).toBeFalsy();
      expect(document.querySelector('.cloud-signed-in')).toBeFalsy();

      resolveMe?.({ user: { id: 'u1', email: 'a@b.c' } });
      await flushEffects();

      expect(document.querySelector('[data-testid="cloud-account-loading"]')).toBeFalsy();
      expect(document.querySelector('.cloud-signed-in')?.textContent).toContain('a@b.c');
    } finally {
      view.cleanup();
    }
  });

  it('refreshes csrf and retries publish once when the cached token is stale', async () => {
    api.fetchCsrfToken.mockReset();
    api.fetchCsrfToken.mockResolvedValueOnce('stale-csrf').mockResolvedValueOnce('fresh-csrf');
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValueOnce({
      ok: true,
      login: 'bcorfman',
      pagesBaseUrl: 'https://bcorfman.github.io/',
    });
    api.createGame.mockResolvedValueOnce({ game: { id: 'g1', title: 'Pattern demo', created_at: 'c', updated_at: 'u' } });
    api.publishToGithubPages
      .mockResolvedValueOnce({ ok: false, error: 'csrf_required' })
      .mockResolvedValueOnce({ ok: true, url: 'https://x', repo: 'zoof', repoCreated: true, deploymentStatus: 'queued', publishMarker: 'marker-1' });

    const onStatus = vi.fn();
    const onError = vi.fn();

    function Harness() {
      const [state, setState] = React.useState<any>({
        project: {
          id: 'p1',
          title: 'Pattern demo',
          publishGithubPagesRepo: 'patterndemo',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
        },
      });
      return (
        <CloudAccountPanel
          state={state}
          dispatch={(action) => {
            if (action.type !== 'set-project-metadata') return;
            setState((current: any) => ({
              ...current,
              project: {
                ...current.project,
                ...(typeof action.title === 'string' ? { title: action.title } : {}),
                ...(typeof action.publishGithubPagesRepo === 'string'
                  ? { publishGithubPagesRepo: action.publishGithubPagesRepo }
                  : {}),
              },
            }));
          }}
          onLoadYaml={() => {}}
          onStatus={onStatus}
          onError={onError}
        />
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();
      await flushEffects();
      await act(async () => {
        (document.querySelector('[data-testid="cloud-publish-pages-button"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();
      await flushEffects();
      await act(async () => {
        (view.container.querySelector('[data-testid="publish-confirm-submit"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();

      expect(api.fetchCsrfToken).toHaveBeenCalledTimes(2);
      expect(api.publishToGithubPages).toHaveBeenNthCalledWith(1, 'g1', 'patterndemo', 'stale-csrf');
      expect(api.publishToGithubPages).toHaveBeenNthCalledWith(2, 'g1', 'patterndemo', 'fresh-csrf');
      expect(onError).not.toHaveBeenCalledWith('csrf_required');
      expect(onStatus).toHaveBeenCalledWith('Published zoof to https://x. GitHub Pages may take about a minute to go live.');
    } finally {
      view.cleanup();
    }
  });

  it('shows explicit publish progress while GitHub Pages upload is running', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValue({
      ok: true,
      login: 'bcorfman',
      pagesBaseUrl: 'https://bcorfman.github.io/',
    });
    api.createGame.mockResolvedValueOnce({ game: { id: 'g1', title: 'Pattern demo', created_at: 'c', updated_at: 'u' } });

    let resolvePublish: ((value: { ok: true; url: string; repo: string; repoCreated: boolean; deploymentStatus: 'built' | 'building' | 'queued' | 'configured'; publishMarker: string }) => void) | null = null;
    api.publishToGithubPages.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePublish = resolve;
        }),
    );

    function Harness() {
      const [state, setState] = React.useState<any>({
        project: {
          id: 'p1',
          title: 'Pattern demo',
          publishGithubPagesRepo: 'zoof',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
        },
      });
      return (
        <CloudAccountPanel
          state={state}
          dispatch={(action) => {
            if (action.type !== 'set-project-metadata') return;
            setState((current: any) => ({
              ...current,
              project: {
                ...current.project,
                ...(typeof action.title === 'string' ? { title: action.title } : {}),
                ...(typeof action.publishGithubPagesRepo === 'string'
                  ? { publishGithubPagesRepo: action.publishGithubPagesRepo }
                  : {}),
              },
            }));
          }}
          onLoadYaml={() => {}}
          onStatus={() => {}}
          onError={() => {}}
        />
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();
      await flushEffects();
      await act(async () => {
        (document.querySelector('[data-testid="cloud-publish-pages-button"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();
      await flushEffects();
      await act(async () => {
        (view.container.querySelector('[data-testid="publish-confirm-submit"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();

      expect(document.querySelector('[data-testid="cloud-publish-progress"]')?.textContent).toContain('Uploading files and workflow to GitHub');
      expect(document.querySelector('[data-testid="publish-confirm-submit"]')).toBeFalsy();

      await act(async () => {
        resolvePublish?.({ ok: true, url: 'https://x', repo: 'zoof', repoCreated: true, deploymentStatus: 'queued', publishMarker: 'marker-1' });
        await Promise.resolve();
      });
      await flushEffects();

      expect(document.querySelector('[data-testid="cloud-publish-progress"]')?.textContent).toContain('Waiting for GitHub Pages to go live');
      expect(document.querySelector('[data-testid="publish-confirm-submit"]')).toBeFalsy();
    } finally {
      view.cleanup();
    }
  });

  it('shows an open button after publish is live and only opens the game when clicked', async () => {
    vi.useFakeTimers();
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValue({
      ok: true,
      login: 'bcorfman',
      pagesBaseUrl: 'https://bcorfman.github.io/',
    });
    api.createGame.mockResolvedValueOnce({ game: { id: 'g1', title: 'Pattern demo', created_at: 'c', updated_at: 'u' } });
    api.checkGithubPagesTarget
      .mockResolvedValueOnce({ ok: true, url: 'https://x', exists: false, routeExists: false, pagesConfigured: false, deploymentStatus: null, currentPublishLive: null })
      .mockResolvedValueOnce({ ok: true, url: 'https://x', exists: true, routeExists: true, pagesConfigured: true, deploymentStatus: 'built', currentPublishLive: true });

    let resolvePublish: ((value: { ok: true; url: string; repo: string; repoCreated: boolean; deploymentStatus: 'built' | 'building' | 'queued' | 'configured'; publishMarker: string }) => void) | null = null;
    api.publishToGithubPages.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePublish = resolve;
        }),
    );

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('https://x/?pf_check=')) {
          return new Response(
            '<!doctype html><html><head><meta name="phaserforge-publish-marker" content="marker-1"></head><body></body></html>',
            { status: 200 },
          );
        }
        throw new Error(`Unhandled fetch ${url}`);
      }),
    });

    function Harness() {
      const [state, setState] = React.useState<any>({
        project: {
          id: 'p1',
          title: 'Pattern demo',
          publishGithubPagesRepo: 'zoof',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
        },
      });
      return (
        <CloudAccountPanel
          state={state}
          dispatch={(action) => {
            if (action.type !== 'set-project-metadata') return;
            setState((current: any) => ({
              ...current,
              project: {
                ...current.project,
                ...(typeof action.title === 'string' ? { title: action.title } : {}),
                ...(typeof action.publishGithubPagesRepo === 'string'
                  ? { publishGithubPagesRepo: action.publishGithubPagesRepo }
                  : {}),
              },
            }));
          }}
          onLoadYaml={() => {}}
          onStatus={() => {}}
          onError={() => {}}
        />
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();
      await flushEffects();
      await act(async () => {
        (document.querySelector('[data-testid="cloud-publish-pages-button"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();
      await flushEffects();
      await act(async () => {
        (view.container.querySelector('[data-testid="publish-confirm-submit"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();

      expect(document.querySelector('.workspace-conflict-header .button')).toBeFalsy();
      expect(openSpy).not.toHaveBeenCalled();
      expect(api.publishToGithubPages).toHaveBeenCalledTimes(1);
      expect(document.querySelector('[data-testid="publish-confirm-modal"] [data-testid="cloud-publish-open-button"]')).toBeFalsy();

      await act(async () => {
        resolvePublish?.({ ok: true, url: 'https://x', repo: 'zoof', repoCreated: true, deploymentStatus: 'built', publishMarker: 'marker-1' });
        await Promise.resolve();
      });
      await flushEffects();
      expect(document.querySelector('[data-testid="cloud-publish-progress"]')?.textContent).toContain('Waiting for GitHub Pages to go live');
      expect(document.querySelector('[data-testid="publish-confirm-submit"]')).toBeFalsy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      await flushEffects();

      const openButton = document.querySelector('[data-testid="publish-confirm-modal"] [data-testid="cloud-publish-open-button"]') as HTMLButtonElement | null;
      expect(openButton?.textContent).toContain('Open Published Game');
      expect(document.querySelector('[data-testid="publish-confirm-help"]')?.textContent).toContain('Repository zoof is live at https://x');
      expect(openSpy).not.toHaveBeenCalled();

      await act(async () => {
        openButton?.click();
        await Promise.resolve();
      });

      expect(openSpy).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/x\/\?pf_publish=\d+$/), '_blank', 'noopener,noreferrer');
    } finally {
      if (originalFetch === undefined) {
        delete (globalThis as any).fetch;
      } else {
        Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      }
      openSpy.mockRestore();
      view.cleanup();
    }
  });

  it('waits for the live publish token before showing the open button', async () => {
    vi.useFakeTimers();
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValue({
      ok: true,
      login: 'bcorfman',
      pagesBaseUrl: 'https://bcorfman.github.io/',
    });
    api.createGame.mockResolvedValueOnce({ game: { id: 'g1', title: 'Pattern demo', created_at: 'c', updated_at: 'u' } });
    api.publishToGithubPages.mockResolvedValueOnce({ ok: true, url: 'https://x', repo: 'zoof', repoCreated: true, deploymentStatus: 'queued', publishMarker: 'marker-1' });
    api.checkGithubPagesTarget
      .mockResolvedValueOnce({ ok: true, url: 'https://x', exists: false, routeExists: false, pagesConfigured: false, deploymentStatus: null, currentPublishLive: null })
      .mockResolvedValueOnce({ ok: true, url: 'https://x', exists: true, routeExists: true, pagesConfigured: true, deploymentStatus: 'built', currentPublishLive: true });

    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('https://x/?pf_check=')) {
          return new Response(
            '<!doctype html><html><head><meta name="phaserforge-publish-marker" content="marker-1"></head><body></body></html>',
            { status: 200 },
          );
        }
        throw new Error(`Unhandled fetch ${url}`);
      }),
    });

    function Harness() {
      const [state, setState] = React.useState<any>({
        project: {
          id: 'p1',
          title: 'Pattern demo',
          publishGithubPagesRepo: 'zoof',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
        },
      });
      return (
        <CloudAccountPanel
          state={state}
          dispatch={(action) => {
            if (action.type !== 'set-project-metadata') return;
            setState((current: any) => ({
              ...current,
              project: {
                ...current.project,
                ...(typeof action.title === 'string' ? { title: action.title } : {}),
                ...(typeof action.publishGithubPagesRepo === 'string'
                  ? { publishGithubPagesRepo: action.publishGithubPagesRepo }
                  : {}),
              },
            }));
          }}
          onLoadYaml={() => {}}
          onStatus={() => {}}
          onError={() => {}}
        />
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();
      await flushEffects();
      await act(async () => {
        (document.querySelector('[data-testid="cloud-publish-pages-button"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();
      await flushEffects();
      await act(async () => {
        (view.container.querySelector('[data-testid="publish-confirm-submit"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();

      expect(document.querySelector('[data-testid="publish-confirm-modal"] [data-testid="cloud-publish-open-button"]')).toBeFalsy();
      expect(document.querySelector('[data-testid="publish-confirm-help"]')?.textContent).toContain(
        'Open Published Game will appear when the new version is live.',
      );
      expect(document.querySelector('[data-testid="cloud-publish-progress"]')?.textContent).toContain('Waiting for GitHub Pages to go live');
      expect(document.querySelector('[data-testid="publish-confirm-submit"]')).toBeFalsy();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      await flushEffects();
      expect(api.checkGithubPagesTarget).toHaveBeenNthCalledWith(2, 'zoof', 'csrf', 'marker-1');
      expect(api.checkGithubPagesTarget).toHaveBeenCalledTimes(2);
      expect(document.querySelector('[data-testid="publish-confirm-modal"] [data-testid="cloud-publish-open-button"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="cloud-publish-progress"]')).toBeFalsy();
    } finally {
      if (originalFetch === undefined) {
        delete (globalThis as any).fetch;
      } else {
        Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      }
      view.cleanup();
    }
  });

  it('shows the open button when the browser verifies the published token even if the check response does not mark it live', async () => {
    vi.useFakeTimers();
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValue({
      ok: true,
      login: 'bcorfman',
      pagesBaseUrl: 'https://bcorfman.github.io/',
    });
    api.createGame.mockResolvedValueOnce({ game: { id: 'g1', title: 'Pattern demo', created_at: 'c', updated_at: 'u' } });
    api.publishToGithubPages.mockResolvedValueOnce({ ok: true, url: 'https://x', repo: 'zoof', repoCreated: true, deploymentStatus: 'queued', publishMarker: 'marker-1' });
    api.checkGithubPagesTarget
      .mockResolvedValueOnce({ ok: true, url: 'https://x', exists: false, routeExists: false, pagesConfigured: false, deploymentStatus: null, currentPublishLive: null })
      .mockResolvedValueOnce({ ok: true, url: 'https://x', exists: true, routeExists: true, pagesConfigured: true, deploymentStatus: 'built', currentPublishLive: null });

    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('https://x/?pf_check=')) {
          return new Response(
            '<!doctype html><html><head><meta name="phaserforge-publish-marker" content="marker-1"></head><body></body></html>',
            { status: 200 },
          );
        }
        throw new Error(`Unhandled fetch ${url}`);
      }),
    });

    function Harness() {
      const [state, setState] = React.useState<any>({
        project: {
          id: 'p1',
          title: 'Pattern demo',
          publishGithubPagesRepo: 'zoof',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
        },
      });
      return (
        <CloudAccountPanel
          state={state}
          dispatch={(action) => {
            if (action.type !== 'set-project-metadata') return;
            setState((current: any) => ({
              ...current,
              project: {
                ...current.project,
                ...(typeof action.title === 'string' ? { title: action.title } : {}),
                ...(typeof action.publishGithubPagesRepo === 'string'
                  ? { publishGithubPagesRepo: action.publishGithubPagesRepo }
                  : {}),
              },
            }));
          }}
          onLoadYaml={() => {}}
          onStatus={() => {}}
          onError={() => {}}
        />
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();
      await flushEffects();
      await act(async () => {
        (document.querySelector('[data-testid="cloud-publish-pages-button"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();
      await flushEffects();
      await act(async () => {
        (view.container.querySelector('[data-testid="publish-confirm-submit"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      await flushEffects();

      expect(api.checkGithubPagesTarget).toHaveBeenNthCalledWith(2, 'zoof', 'csrf', 'marker-1');
      expect(document.querySelector('[data-testid="publish-confirm-modal"] [data-testid="cloud-publish-open-button"]')).toBeTruthy();
    } finally {
      if (originalFetch === undefined) {
        delete (globalThis as any).fetch;
      } else {
        Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      }
      view.cleanup();
    }
  });

  it('keeps waiting when the server says a publish is live but the published html is still stale', async () => {
    vi.useFakeTimers();
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValue({
      ok: true,
      login: 'bcorfman',
      pagesBaseUrl: 'https://bcorfman.github.io/',
    });
    api.createGame.mockResolvedValueOnce({ game: { id: 'g1', title: 'Pattern demo', created_at: 'c', updated_at: 'u' } });
    api.publishToGithubPages.mockResolvedValueOnce({ ok: true, url: 'https://x', repo: 'zoof', repoCreated: true, deploymentStatus: 'queued', publishMarker: 'marker-1' });
    api.checkGithubPagesTarget
      .mockResolvedValueOnce({ ok: true, url: 'https://x', exists: false, routeExists: false, pagesConfigured: false, deploymentStatus: null, currentPublishLive: null })
      .mockResolvedValueOnce({ ok: true, url: 'https://x', exists: true, routeExists: true, pagesConfigured: true, deploymentStatus: 'built', currentPublishLive: true });

    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('https://x/?pf_check=')) {
          return new Response(
            '<!doctype html><html><head><meta name="phaserforge-publish-marker" content="older-marker"></head><body></body></html>',
            { status: 200 },
          );
        }
        throw new Error(`Unhandled fetch ${url}`);
      }),
    });

    function Harness() {
      const [state, setState] = React.useState<any>({
        project: {
          id: 'p1',
          title: 'Pattern demo',
          publishGithubPagesRepo: 'zoof',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
        },
      });
      return (
        <CloudAccountPanel
          state={state}
          dispatch={(action) => {
            if (action.type !== 'set-project-metadata') return;
            setState((current: any) => ({
              ...current,
              project: {
                ...current.project,
                ...(typeof action.title === 'string' ? { title: action.title } : {}),
                ...(typeof action.publishGithubPagesRepo === 'string'
                  ? { publishGithubPagesRepo: action.publishGithubPagesRepo }
                  : {}),
              },
            }));
          }}
          onLoadYaml={() => {}}
          onStatus={() => {}}
          onError={() => {}}
        />
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();
      await flushEffects();
      await act(async () => {
        (document.querySelector('[data-testid="cloud-publish-pages-button"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();
      await flushEffects();
      await act(async () => {
        (view.container.querySelector('[data-testid="publish-confirm-submit"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      await flushEffects();

      expect(document.querySelector('[data-testid="publish-confirm-modal"] [data-testid="cloud-publish-open-button"]')).toBeFalsy();
      expect(document.querySelector('[data-testid="publish-confirm-submit"]')).toBeFalsy();
      expect(document.querySelector('[data-testid="cloud-publish-progress"]')?.textContent).toContain('Waiting for GitHub Pages to go live');
    } finally {
      if (originalFetch === undefined) {
        delete (globalThis as any).fetch;
      } else {
        Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      }
      view.cleanup();
    }
  });

  it('clears the previous published route before checking a renamed repository target', async () => {
    vi.useFakeTimers();
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValue({
      ok: true,
      login: 'bcorfman',
      pagesBaseUrl: 'https://bcorfman.github.io/',
    });
    api.createGame.mockResolvedValueOnce({ game: { id: 'g1', title: 'Pattern demo', created_at: 'c', updated_at: 'u' } });
    api.publishToGithubPages.mockResolvedValueOnce({ ok: true, url: 'https://bcorfman.github.io/zoof/', repo: 'zoof', repoCreated: true, deploymentStatus: 'queued', publishMarker: 'marker-1' });
    api.checkGithubPagesTarget
      .mockResolvedValueOnce({ ok: true, url: 'https://bcorfman.github.io/zoof/', exists: false, routeExists: false, pagesConfigured: false, deploymentStatus: null, currentPublishLive: null })
      .mockResolvedValueOnce({ ok: true, url: 'https://bcorfman.github.io/zoof/', exists: true, routeExists: true, pagesConfigured: true, deploymentStatus: 'built', currentPublishLive: true })
      .mockResolvedValueOnce({ ok: true, url: 'https://bcorfman.github.io/zoof2/', exists: false, routeExists: false, pagesConfigured: false, deploymentStatus: null, currentPublishLive: null });

    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('https://bcorfman.github.io/zoof/?pf_check=')) {
          return new Response(
            '<!doctype html><html><head><meta name="phaserforge-publish-marker" content="marker-1"></head><body></body></html>',
            { status: 200 },
          );
        }
        throw new Error(`Unhandled fetch ${url}`);
      }),
    });

    function Harness() {
      const [state, setState] = React.useState<any>({
        project: {
          id: 'p1',
          title: 'Pattern demo',
          publishGithubPagesRepo: 'zoof',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
        },
      });
      return (
        <CloudAccountPanel
          state={state}
          dispatch={(action) => {
            if (action.type !== 'set-project-metadata') return;
            setState((current: any) => ({
              ...current,
              project: {
                ...current.project,
                ...(typeof action.title === 'string' ? { title: action.title } : {}),
                ...(typeof action.publishGithubPagesRepo === 'string'
                  ? { publishGithubPagesRepo: action.publishGithubPagesRepo }
                  : {}),
              },
            }));
          }}
          onLoadYaml={() => {}}
          onStatus={() => {}}
          onError={() => {}}
        />
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();
      await flushEffects();
      await act(async () => {
        (document.querySelector('[data-testid="cloud-publish-pages-button"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();
      await act(async () => {
        (view.container.querySelector('[data-testid="publish-confirm-submit"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      await flushEffects();

      expect(document.querySelector('[data-testid="publish-confirm-modal"] [data-testid="cloud-publish-open-button"]')?.textContent).toContain(
        'Open Published Game',
      );
      await act(async () => {
        (document.querySelector('[data-testid="publish-confirm-modal"] .cloud-row .button') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();

      const routeInput = document.querySelector('[aria-label="Publish repository"]') as HTMLInputElement | null;
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(routeInput, 'zoof2');
        else routeInput!.value = 'zoof2';
        routeInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        routeInput!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        await Promise.resolve();
      });

      await act(async () => {
        (document.querySelector('[data-testid="cloud-publish-pages-button"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();

      expect(api.checkGithubPagesTarget).toHaveBeenNthCalledWith(3, 'zoof2', 'csrf');
      expect(document.querySelector('[data-testid="publish-confirm-help"]')?.textContent ?? '').not.toContain('Repository zoof is live');
      expect(document.querySelector('[data-testid="publish-confirm-modal"] [data-testid="cloud-publish-open-button"]')).toBeFalsy();
      expect(document.querySelector('[data-testid="publish-confirm-submit"]')?.textContent).toContain('Create repo and publish');
    } finally {
      if (originalFetch === undefined) {
        delete (globalThis as any).fetch;
      } else {
        Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      }
      view.cleanup();
    }
  });

  it('clears stale published-route state as soon as the repository draft changes', async () => {
    vi.useFakeTimers();
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValue({
      ok: true,
      login: 'bcorfman',
      pagesBaseUrl: 'https://bcorfman.github.io/',
    });
    api.createGame.mockResolvedValueOnce({ game: { id: 'g1', title: 'Pattern demo', created_at: 'c', updated_at: 'u' } });
    api.publishToGithubPages.mockResolvedValueOnce({
      ok: true,
      url: 'https://bcorfman.github.io/zoof/',
      repo: 'zoof',
      repoCreated: true,
      deploymentStatus: 'queued',
      publishMarker: 'marker-1',
    });
    api.checkGithubPagesTarget
      .mockResolvedValueOnce({ ok: true, url: 'https://bcorfman.github.io/zoof/', exists: false, routeExists: false, pagesConfigured: false, deploymentStatus: null, currentPublishLive: null })
      .mockResolvedValueOnce({ ok: true, url: 'https://bcorfman.github.io/zoof/', exists: true, routeExists: true, pagesConfigured: true, deploymentStatus: 'built', currentPublishLive: true });

    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('https://bcorfman.github.io/zoof/?pf_check=')) {
          return new Response(
            '<!doctype html><html><head><meta name="phaserforge-publish-marker" content="marker-1"></head><body></body></html>',
            { status: 200 },
          );
        }
        throw new Error(`Unhandled fetch ${url}`);
      }),
    });

    function Harness() {
      const [state, setState] = React.useState<any>({
        project: {
          id: 'p1',
          title: 'Pattern demo',
          publishGithubPagesRepo: 'zoof',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
        },
      });
      return (
        <CloudAccountPanel
          state={state}
          dispatch={(action) => {
            if (action.type !== 'set-project-metadata') return;
            setState((current: any) => ({
              ...current,
              project: {
                ...current.project,
                ...(typeof action.title === 'string' ? { title: action.title } : {}),
                ...(typeof action.publishGithubPagesRepo === 'string'
                  ? { publishGithubPagesRepo: action.publishGithubPagesRepo }
                  : {}),
              },
            }));
          }}
          onLoadYaml={() => {}}
          onStatus={() => {}}
          onError={() => {}}
        />
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();
      await flushEffects();
      await act(async () => {
        (document.querySelector('[data-testid="cloud-publish-pages-button"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();
      await act(async () => {
        (view.container.querySelector('[data-testid="publish-confirm-submit"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      await flushEffects();

      expect(document.querySelector('[data-testid="cloud-publish-open-button"]')?.textContent).toContain('Open Published Game');

      const routeInput = document.querySelector('[aria-label="Publish repository"]') as HTMLInputElement | null;
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(routeInput, 'zoof2');
        else routeInput!.value = 'zoof2';
        routeInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        routeInput!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        await Promise.resolve();
      });
      await flushEffects();

      expect(document.querySelector('[data-testid="cloud-publish-open-button"]')).toBeFalsy();
      expect(document.querySelector('[data-testid="publish-confirm-help"]')?.textContent ?? '').not.toContain('Repository zoof is live');
      expect(document.querySelector('[data-testid="publish-confirm-modal"]')).toBeFalsy();
    } finally {
      if (originalFetch === undefined) {
        delete (globalThis as any).fetch;
      } else {
        Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      }
      view.cleanup();
    }
  });

  it('keeps a deployment note visible after publish succeeds', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValue({
      ok: true,
      login: 'bcorfman',
      pagesBaseUrl: 'https://bcorfman.github.io/',
    });
    api.createGame.mockResolvedValueOnce({ game: { id: 'g1', title: 'Pattern demo', created_at: 'c', updated_at: 'u' } });
    api.publishToGithubPages.mockResolvedValueOnce({ ok: true, url: 'https://x', repo: 'zoof', repoCreated: true, deploymentStatus: 'queued', publishMarker: 'marker-1' });

    function Harness() {
      const [state, setState] = React.useState<any>({
        project: {
          id: 'p1',
          title: 'Pattern demo',
          publishGithubPagesRepo: 'zoof',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
        },
      });
      return (
        <CloudAccountPanel
          state={state}
          dispatch={(action) => {
            if (action.type !== 'set-project-metadata') return;
            setState((current: any) => ({
              ...current,
              project: {
                ...current.project,
                ...(typeof action.title === 'string' ? { title: action.title } : {}),
                ...(typeof action.publishGithubPagesRepo === 'string'
                  ? { publishGithubPagesRepo: action.publishGithubPagesRepo }
                  : {}),
              },
            }));
          }}
          onLoadYaml={() => {}}
          onStatus={() => {}}
          onError={() => {}}
        />
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();
      await act(async () => {
        (document.querySelector('[data-testid="cloud-publish-pages-button"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();
      await act(async () => {
        (view.container.querySelector('[data-testid="publish-confirm-submit"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();

      expect(document.querySelector('[data-testid="cloud-publish-pages-help"]')?.textContent).toContain(
        'GitHub Pages accepted the deployment for zoof',
      );
    } finally {
      view.cleanup();
    }
  });

  it('refreshes csrf and retries the publish check when the cached token is stale', async () => {
    api.fetchCsrfToken.mockReset();
    api.fetchCsrfToken.mockResolvedValueOnce('stale-csrf').mockResolvedValueOnce('fresh-csrf');
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValueOnce({
      ok: true,
      login: 'bcorfman',
      pagesBaseUrl: 'https://bcorfman.github.io/',
    });
    api.checkGithubPagesTarget
      .mockResolvedValueOnce({ ok: false, error: 'csrf_required' })
      .mockResolvedValueOnce({ ok: true, url: 'https://x', exists: false, routeExists: false, pagesConfigured: false, deploymentStatus: null, currentPublishLive: null });

    const onError = vi.fn();

    function Harness() {
      const [state, setState] = React.useState<any>({
        project: {
          id: 'p1',
          title: 'Pattern demo',
          publishGithubPagesRepo: 'patterndemo',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
        },
      });
      return (
        <CloudAccountPanel
          state={state}
          dispatch={(action) => {
            if (action.type !== 'set-project-metadata') return;
            setState((current: any) => ({
              ...current,
              project: {
                ...current.project,
                ...(typeof action.title === 'string' ? { title: action.title } : {}),
                ...(typeof action.publishGithubPagesRepo === 'string'
                  ? { publishGithubPagesRepo: action.publishGithubPagesRepo }
                  : {}),
              },
            }));
          }}
          onLoadYaml={() => {}}
          onStatus={() => {}}
          onError={onError}
        />
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();
      await act(async () => {
        (document.querySelector('[data-testid="cloud-publish-pages-button"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();
      await flushEffects();

      expect(api.fetchCsrfToken).toHaveBeenCalledTimes(2);
      expect(api.checkGithubPagesTarget).toHaveBeenNthCalledWith(1, 'patterndemo', 'stale-csrf');
      expect(api.checkGithubPagesTarget).toHaveBeenNthCalledWith(2, 'patterndemo', 'fresh-csrf');
      expect(onError).not.toHaveBeenCalledWith('csrf_required');
      expect(document.querySelector('[data-testid="publish-confirm-submit"]')).toBeTruthy();
    } finally {
      view.cleanup();
    }
  });

  it('warns before overwriting an existing route', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValueOnce({
      ok: true,
      login: 'bcorfman',
      pagesBaseUrl: 'https://bcorfman.github.io/',
    });
    api.checkGithubPagesTarget.mockResolvedValue({
      ok: true,
      url: 'https://bcorfman.github.io/zoof/',
      exists: false,
      routeExists: true,
      pagesConfigured: false,
      deploymentStatus: null,
      currentPublishLive: null,
    });

    function Harness() {
      const [state, setState] = React.useState<any>({
        project: {
          id: 'p1',
          title: 'Pattern demo',
          publishGithubPagesRepo: 'zoof',
          assets: { images: {}, spriteSheets: {}, fonts: {} },
          audio: { sounds: {} },
        },
      });
      return (
        <CloudAccountPanel
          state={state}
          dispatch={(action) => {
            if (action.type !== 'set-project-metadata') return;
            setState((current: any) => ({
              ...current,
              project: {
                ...current.project,
                ...(typeof action.title === 'string' ? { title: action.title } : {}),
                ...(typeof action.publishGithubPagesRepo === 'string'
                  ? { publishGithubPagesRepo: action.publishGithubPagesRepo }
                  : {}),
              },
            }));
          }}
          onLoadYaml={() => {}}
          onStatus={() => {}}
          onError={() => {}}
        />
      );
    }

    const view = renderIntoDom(<Harness />);
    try {
      await flushEffects();
      await act(async () => {
        (document.querySelector('[data-testid="cloud-publish-pages-button"]') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      await flushEffects();

      expect(document.querySelector('[data-testid="publish-confirm-modal"]')?.textContent).toContain(
        'Content already exists at this GitHub Pages route. Publishing will overwrite the files currently served there.',
      );
      expect(document.querySelector('[data-testid="publish-confirm-submit"]')?.textContent).toContain('Overwrite route and publish');
    } finally {
      view.cleanup();
    }
  });

  it('reuses resolved auth on remount instead of showing the signed-out layout first', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValue({ ok: false, error: 'github_not_linked' });

    const firstView = renderIntoDom(
      <CloudAccountPanel state={baseState()} dispatch={() => {}} onLoadYaml={() => {}} onStatus={() => {}} onError={() => {}} />,
    );
    await flushEffects();
    firstView.cleanup();

    const secondView = renderIntoDom(
      <CloudAccountPanel state={baseState()} dispatch={() => {}} onLoadYaml={() => {}} onStatus={() => {}} onError={() => {}} />,
    );
    try {
      expect(document.querySelector('[data-testid="cloud-account-loading"]')).toBeFalsy();
      expect(document.querySelector('.cloud-signed-in')?.textContent).toContain('a@b.c');
      expect(api.me).toHaveBeenCalledTimes(1);
      expect(document.querySelector('[data-testid="cloud-publish-signin-cta"]')).toBeFalsy();
    } finally {
      secondView.cleanup();
    }
  });

  it('reuses resolved GitHub publish info on remount instead of showing checking state first', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValueOnce({
      ok: true,
      login: 'alice',
      pagesBaseUrl: 'https://alice.github.io/',
    });

    const firstView = renderIntoDom(
      <CloudAccountPanel state={baseState()} dispatch={() => {}} onLoadYaml={() => {}} onStatus={() => {}} onError={() => {}} />,
    );
    await flushEffects();
    firstView.cleanup();

    const secondView = renderIntoDom(
      <CloudAccountPanel state={baseState()} dispatch={() => {}} onLoadYaml={() => {}} onStatus={() => {}} onError={() => {}} />,
    );
    try {
      expect(document.querySelector('[data-testid="cloud-github-connection"]')?.textContent).toContain('connected as alice');
      expect(document.querySelector('[data-testid="cloud-publish-connect-github-cta"]')).toBeFalsy();
      expect(document.querySelector('[aria-label="Publish repository"]')).toBeTruthy();
      expect(document.body.textContent).not.toContain('Checking GitHub connection');
      expect(api.getGithubPagesPublishInfo).toHaveBeenCalledTimes(1);
    } finally {
      secondView.cleanup();
    }
  });

  it('surfaces GitHub auth callback errors from the URL and then scrubs them', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValueOnce({ ok: false, error: 'github_not_linked' });

    const onError = vi.fn();
    window.history.replaceState({}, '', '/?githubAuthError=github_account_in_use#cloud');

    const view = renderIntoDom(
      <CloudAccountPanel state={baseState()} dispatch={() => {}} onLoadYaml={() => {}} onStatus={() => {}} onError={onError} />,
    );
    try {
      await flushEffects();
      expect(onError).toHaveBeenCalledWith('That GitHub account is already linked to a different PhaserForge account.');
      expect(window.location.search).toBe('');
      expect(window.location.hash).toBe('#cloud');
    } finally {
      view.cleanup();
      window.history.replaceState({}, '', '/');
    }
  });
});

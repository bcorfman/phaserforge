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
    checkGithubPagesTarget: vi.fn(async () => ({ ok: true, url: 'https://x', exists: false, routeExists: false, pagesConfigured: false, deploymentStatus: null })),
    publishToGithubPages: vi.fn(async () => ({ ok: true, url: 'https://x', repo: 'zoof', repoCreated: true, deploymentStatus: 'queued' })),
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

  it('defaults to the Log in tab for returning users who already created an account', async () => {
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
      expect(document.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain('Log in');
      expect(document.querySelector('[aria-label="Invite code"]')).toBeFalsy();
      expect(document.body.textContent).toContain('Log in to access your cloud projects and publishing tools.');
      expect(document.querySelector('[data-testid="cloud-account-submit"]')?.textContent).toContain('Log in');
      expect(document.body.textContent).toContain('Create');
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
      .mockResolvedValueOnce({ ok: true, url: 'https://x', repo: 'zoof', repoCreated: true, deploymentStatus: 'queued' });

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

    let resolvePublish: ((value: { ok: true; url: string; repo: string; repoCreated: boolean; deploymentStatus: 'built' | 'building' | 'queued' | 'configured' }) => void) | null = null;
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
      expect(document.querySelector('[data-testid="publish-confirm-submit"]')?.textContent).toContain('Publishing');

      await act(async () => {
        resolvePublish?.({ ok: true, url: 'https://x', repo: 'zoof', repoCreated: true, deploymentStatus: 'queued' });
        await Promise.resolve();
      });
      await flushEffects();
    } finally {
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
    api.publishToGithubPages.mockResolvedValueOnce({ ok: true, url: 'https://x', repo: 'zoof', repoCreated: true, deploymentStatus: 'queued' });

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
      .mockResolvedValueOnce({ ok: true, url: 'https://x', exists: false, routeExists: false, pagesConfigured: false, deploymentStatus: null });

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
    api.checkGithubPagesTarget.mockResolvedValueOnce({
      ok: true,
      url: 'https://bcorfman.github.io/zoof/',
      exists: false,
      routeExists: true,
      pagesConfigured: false,
      deploymentStatus: null,
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

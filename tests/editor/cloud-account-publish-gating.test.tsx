// @vitest-environment jsdom
import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

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
    getGame: vi.fn(async () => ({ game: { id: 'g1', title: 'G', created_at: 'c', updated_at: 'u', yaml: '' } })),
    createGame: vi.fn(async () => ({ game: { id: 'g1', title: 'G', created_at: 'c', updated_at: 'u' } })),
    updateGame: vi.fn(async () => ({ game: { id: 'g1', title: 'G', created_at: 'c', updated_at: 'u' } })),
    disconnectGithub: vi.fn(async () => {}),
    getGithubPagesPublishInfo: vi.fn(async () => ({ ok: false, error: 'github_not_linked' })),
    checkGithubPagesTarget: vi.fn(async () => ({ url: 'https://x', exists: false, status: 404 })),
    publishToGithubPages: vi.fn(async () => ({ ok: true, url: 'https://x' })),
  };
});

vi.mock('../../src/cloud/api', () => api);

import { CloudAccountPanel, __resetCloudAccountPanelAuthCacheForTests } from '../../src/editor/CloudAccountPanel';

function baseState(): any {
  return {
    project: { assets: { images: {}, spriteSheets: {}, fonts: {} }, audio: { sounds: {} } },
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

describe('CloudAccountPanel publish gating', () => {
  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  afterEach(() => {
    __resetCloudAccountPanelAuthCacheForTests();
    vi.clearAllMocks();
  });

  it('shows a compact Publish section when not signed in', async () => {
    api.me.mockImplementationOnce(async () => {
      throw new Error('not_signed_in');
    });

    const view = renderIntoDom(
      <CloudAccountPanel state={baseState()} dispatch={() => {}} onLoadYaml={() => {}} onStatus={() => {}} onError={() => {}} />,
    );
    try {
      await flushEffects();
      const publish = document.querySelector('[data-testid="cloud-publish-pages-section"]') as HTMLElement | null;
      expect(publish).toBeTruthy();
      expect(publish?.textContent).toContain('PUBLISH');
      expect(document.querySelector('[aria-label="Publish route"]')).toBeFalsy();
      expect(document.querySelector('[data-testid="cloud-publish-signin-cta"]')).toBeTruthy();
    } finally {
      view.cleanup();
    }
  });

  it('shows Connect GitHub CTA (and hides the form) when signed in but GitHub is not linked', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValueOnce({ ok: false, error: 'github_not_linked' });

    const view = renderIntoDom(
      <CloudAccountPanel state={baseState()} dispatch={() => {}} onLoadYaml={() => {}} onStatus={() => {}} onError={() => {}} />,
    );
    try {
      await flushEffects();
      const publish = document.querySelector('[data-testid="cloud-publish-pages-section"]') as HTMLElement | null;
      expect(publish).toBeTruthy();
      expect(document.querySelector('[aria-label="Publish route"]')).toBeFalsy();
      const cta = document.querySelector('[data-testid="cloud-publish-connect-github-cta"]') as HTMLButtonElement | null;
      expect(cta).toBeTruthy();
      act(() => cta!.click());
      expect(document.querySelector('[data-testid="github-connect-modal"]')).toBeTruthy();
    } finally {
      view.cleanup();
    }
  });

  it('shows the Publish form when signed in and GitHub is linked', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValueOnce({ ok: true, login: 'alice', pagesBaseUrl: 'https://alice.github.io/', repo: 'alice/alice.github.io' });

    const view = renderIntoDom(
      <CloudAccountPanel state={baseState()} dispatch={() => {}} onLoadYaml={() => {}} onStatus={() => {}} onError={() => {}} />,
    );
    try {
      await flushEffects();
      const publish = document.querySelector('[data-testid="cloud-publish-pages-section"]') as HTMLElement | null;
      expect(publish).toBeTruthy();
      expect(document.querySelector('[aria-label="Publish route"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="cloud-publish-connect-github-cta"]')).toBeFalsy();
      expect(document.querySelector('[data-testid="cloud-publish-pages-help"]')?.textContent).not.toContain('Public repo:');
      expect(document.querySelector('[data-testid="cloud-publish-pages-help"]')?.textContent).not.toContain('Embedded assets only.');

      // Game/title controls belong to account area, not inside Publish section.
      expect(publish?.querySelector('select')).toBeFalsy();
    } finally {
      view.cleanup();
    }
  });

  it('renders the publish URL preview below Route and updates it as the route changes', async () => {
    api.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c' } });
    api.getGithubPagesPublishInfo.mockResolvedValueOnce({
      ok: true,
      login: 'bcorfman',
      pagesBaseUrl: 'https://bcorfman.github.io/',
      repo: 'bcorfman/bcorfman.github.io',
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
                ...(typeof action.publishGithubPagesRoute === 'string'
                  ? { publishGithubPagesRoute: action.publishGithubPagesRoute }
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

      const routeInput = document.querySelector('[aria-label="Publish route"]') as HTMLInputElement | null;
      const preview = document.querySelector('[data-testid="cloud-publish-pages-target"]') as HTMLElement | null;

      expect(routeInput).toBeTruthy();
      expect(preview).toBeTruthy();
      expect(routeInput?.compareDocumentPosition(preview!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(preview?.textContent).toContain('https://bcorfman.github.io/<route>/');

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
      repo: 'alice/alice.github.io',
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
      expect(document.querySelector('[aria-label="Publish route"]')).toBeTruthy();
      expect(document.body.textContent).not.toContain('Checking GitHub connection');
      expect(api.getGithubPagesPublishInfo).toHaveBeenCalledTimes(1);
    } finally {
      secondView.cleanup();
    }
  });
});

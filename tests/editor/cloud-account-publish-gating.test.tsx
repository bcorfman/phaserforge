// @vitest-environment jsdom
import React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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

import { CloudAccountPanel } from '../../src/editor/CloudAccountPanel';

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

  it('shows a compact Publish section when not signed in', async () => {
    api.me.mockImplementationOnce(async () => {
      throw new Error('not_signed_in');
    });

    const view = renderIntoDom(
      <CloudAccountPanel state={baseState()} onLoadYaml={() => {}} onStatus={() => {}} onError={() => {}} />,
    );
    try {
      await flushEffects();
      expect(document.querySelector('[data-testid="cloud-publish-pages-section"]')).toBeTruthy();
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
      <CloudAccountPanel state={baseState()} onLoadYaml={() => {}} onStatus={() => {}} onError={() => {}} />,
    );
    try {
      await flushEffects();
      expect(document.querySelector('[data-testid="cloud-publish-pages-section"]')).toBeTruthy();
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
      <CloudAccountPanel state={baseState()} onLoadYaml={() => {}} onStatus={() => {}} onError={() => {}} />,
    );
    try {
      await flushEffects();
      expect(document.querySelector('[data-testid="cloud-publish-pages-section"]')).toBeTruthy();
      expect(document.querySelector('[aria-label="Publish route"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="cloud-publish-connect-github-cta"]')).toBeFalsy();
    } finally {
      view.cleanup();
    }
  });
});

import { describe, expect, it, vi } from 'vitest';

describe('cloud api', () => {
  it('fetchCsrfToken hits /api/auth/csrf with credentials', async () => {
    vi.resetModules();
    delete process.env.VITE_API_BASE_URL;
    const { fetchCsrfToken } = await import('../../src/cloud/api');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('/api/v1/auth/csrf');
      expect(init?.credentials).toBe('include');
      return new Response(JSON.stringify({ csrfToken: 't' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    await expect(fetchCsrfToken()).resolves.toBe('t');
  });

  it('uses VITE_API_BASE_URL when provided', async () => {
    vi.resetModules();
    process.env.VITE_API_BASE_URL = 'https://example.test';
    const { fetchCsrfToken } = await import('../../src/cloud/api');

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://example.test/api/v1/auth/csrf');
      expect(init?.credentials).toBe('include');
      return new Response(JSON.stringify({ csrfToken: 't2' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    await expect(fetchCsrfToken()).resolves.toBe('t2');
  });

  it('createGame sends csrf header and json body', async () => {
    vi.resetModules();
    delete process.env.VITE_API_BASE_URL;
    const { createGame } = await import('../../src/cloud/api');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('/api/v1/games');
      expect(init?.method).toBe('POST');
      expect((init?.headers as any)['x-csrf-token']).toBe('csrf');
      expect((init?.headers as any)['content-type']).toBe('application/json');
      expect(init?.body).toBe(JSON.stringify({ title: 'My Game', yaml: 'scenes: []' }));
      return new Response(JSON.stringify({ game: { id: 'g', title: 'My Game', created_at: 'c', updated_at: 'u' } }), { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    await expect(createGame('My Game', 'scenes: []', 'csrf')).resolves.toEqual({
      game: { id: 'g', title: 'My Game', created_at: 'c', updated_at: 'u' },
    });
  });

  it('checkGithubPagesTarget posts json body with credentials', async () => {
    vi.resetModules();
    delete process.env.VITE_API_BASE_URL;
    const { checkGithubPagesTarget } = await import('../../src/cloud/api');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('/api/v1/publish/github-pages/check');
      expect(init?.method).toBe('POST');
      expect(init?.credentials).toBe('include');
      expect((init?.headers as any)['x-csrf-token']).toBe('csrf');
      expect((init?.headers as any)['content-type']).toBe('application/json');
      expect(init?.body).toBe(JSON.stringify({ repo: 'mygame' }));
      return new Response(JSON.stringify({ ok: true, url: 'u', exists: false, routeExists: true, pagesConfigured: false, deploymentStatus: null }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    await expect(checkGithubPagesTarget('mygame', 'csrf')).resolves.toEqual({
      ok: true,
      url: 'u',
      exists: false,
      routeExists: true,
      pagesConfigured: false,
      deploymentStatus: null,
    });
  });

  it('publishToGithubPages sends csrf header', async () => {
    vi.resetModules();
    delete process.env.VITE_API_BASE_URL;
    const { publishToGithubPages } = await import('../../src/cloud/api');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('/api/v1/publish/github-pages');
      expect(init?.method).toBe('POST');
      expect((init?.headers as any)['x-csrf-token']).toBe('csrf');
      expect((init?.headers as any)['content-type']).toBe('application/json');
      expect(init?.credentials).toBe('include');
      expect(init?.body).toBe(JSON.stringify({ gameId: 'g1', repo: 'r1' }));
      return new Response(JSON.stringify({ ok: true, url: 'https://x', repo: 'r1', repoCreated: true, deploymentStatus: 'queued' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    await expect(publishToGithubPages('g1', 'r1', 'csrf')).resolves.toEqual({
      ok: true,
      url: 'https://x',
      repo: 'r1',
      repoCreated: true,
      deploymentStatus: 'queued',
    });
  });
});

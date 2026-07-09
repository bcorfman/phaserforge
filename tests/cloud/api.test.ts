import { describe, expect, it, vi } from 'vitest';
import { createEmptyProject } from '../../src/model/emptyProject';

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
    const project = createEmptyProject();
    project.id = 'project-1';
    project.title = 'My Game';
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('/api/v1/games');
      expect(init?.method).toBe('POST');
      expect((init?.headers as any)['x-csrf-token']).toBe('csrf');
      expect((init?.headers as any)['content-type']).toBe('application/json');
      expect(init?.body).toBe(JSON.stringify({ title: 'My Game', project }));
      return new Response(JSON.stringify({ game: { id: 'g', title: 'My Game', created_at: 'c', updated_at: 'u' } }), { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    await expect(createGame('My Game', project, 'csrf')).resolves.toEqual({
      game: { id: 'g', title: 'My Game', created_at: 'c', updated_at: 'u' },
    });
  });

  it('surfaces a readable error when a cloud save payload is too large', async () => {
    vi.resetModules();
    delete process.env.VITE_API_BASE_URL;
    const { updateGame } = await import('../../src/cloud/api');
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: 'payload_too_large' }), { status: 413, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock as any);

    await expect(updateGame('g1', { project: createEmptyProject() }, 'csrf')).rejects.toThrow(
      'Project is too large to save to the cloud. Reduce project size and try again.',
    );
  });

  it('uploadEmbeddedAsset posts the embedded payload with csrf', async () => {
    vi.resetModules();
    delete process.env.VITE_API_BASE_URL;
    const { uploadEmbeddedAsset } = await import('../../src/cloud/api');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('/api/v1/assets');
      expect(init?.method).toBe('POST');
      expect((init?.headers as any)['x-csrf-token']).toBe('csrf');
      expect((init?.headers as any)['content-type']).toBe('application/json');
      expect(init?.body).toBe(JSON.stringify({ dataUrl: 'data:audio/mpeg;base64,AAAA', originalName: 'theme.mp3', mimeType: 'audio/mpeg' }));
      return new Response(JSON.stringify({ asset: { kind: 'cloud', assetId: 'asset-1', originalName: 'theme.mp3', mimeType: 'audio/mpeg' } }), { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    await expect(uploadEmbeddedAsset({ dataUrl: 'data:audio/mpeg;base64,AAAA', originalName: 'theme.mp3', mimeType: 'audio/mpeg' }, 'csrf')).resolves.toEqual({
      kind: 'cloud',
      assetId: 'asset-1',
      originalName: 'theme.mp3',
      mimeType: 'audio/mpeg',
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
      expect(init?.body).toBe(JSON.stringify({ repo: 'mygame', publishToken: 'token-1' }));
      return new Response(
        JSON.stringify({ ok: true, url: 'u', exists: false, routeExists: true, pagesConfigured: false, deploymentStatus: null, currentPublishLive: false }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock as any);

    await expect(checkGithubPagesTarget('mygame', 'csrf', 'token-1')).resolves.toEqual({
      ok: true,
      url: 'u',
      exists: false,
      routeExists: true,
      pagesConfigured: false,
      deploymentStatus: null,
      currentPublishLive: false,
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
      return new Response(JSON.stringify({ ok: true, url: 'https://x', repo: 'r1', repoCreated: true, deploymentStatus: 'queued', publishToken: 'token-1' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    await expect(publishToGithubPages('g1', 'r1', 'csrf')).resolves.toEqual({
      ok: true,
      url: 'https://x',
      repo: 'r1',
      repoCreated: true,
      deploymentStatus: 'queued',
      publishToken: 'token-1',
    });
  });
});

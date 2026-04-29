import { describe, expect, it, vi } from 'vitest';

import { createGame, fetchCsrfToken } from '../../src/cloud/api';

describe('cloud api', () => {
  it('fetchCsrfToken hits /api/auth/csrf with credentials', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('/api/v1/auth/csrf');
      expect(init?.credentials).toBe('include');
      return new Response(JSON.stringify({ csrfToken: 't' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    await expect(fetchCsrfToken()).resolves.toBe('t');
  });

  it('createGame sends csrf header and json body', async () => {
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
});

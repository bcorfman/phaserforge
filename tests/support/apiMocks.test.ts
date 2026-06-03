import { describe, expect, it } from 'vitest';

import { getDefaultApiStubResponse } from './apiMocks';

describe('default API stubs', () => {
  it('returns a logged-out auth bootstrap by default', () => {
    expect(getDefaultApiStubResponse('http://127.0.0.1:4173/api/v1/auth/csrf', 'GET')).toEqual({
      status: 200,
      body: { csrfToken: 'e2e-csrf' },
    });
    expect(getDefaultApiStubResponse('http://127.0.0.1:4173/api/v1/auth/me', 'GET')).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    });
  });

  it('returns a minimal game payload for game detail routes', () => {
    const response = getDefaultApiStubResponse('http://127.0.0.1:4173/api/v1/games/game-123', 'GET');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      game: {
        id: 'game-123',
        title: 'E2E Stub Game',
      },
    });
  });

  it('marks unknown API routes as unhandled', () => {
    expect(getDefaultApiStubResponse('http://127.0.0.1:4173/api/v1/unknown', 'GET')).toEqual({
      status: 503,
      body: { error: 'e2e_api_stub_unhandled' },
    });
  });
});

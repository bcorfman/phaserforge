import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../server/src/server/app';
import { createMemoryRepositories } from '../../server/src/server/repositories/memory';

function makeApp() {
  const repositories = createMemoryRepositories();
  const app = createApp({
    settings: {
      corsAllowOrigins: ['http://localhost:5173'],
      cookieName: 'pa_session',
      csrfCookieName: 'pa_csrf',
      cookieSecure: false,
      cookieSameSite: 'lax',
      sessionTtlMs: 1000 * 60 * 60,
      trustProxy: false,
      publicBaseUrl: 'http://localhost:8787',
      frontendBaseUrl: 'http://localhost:5173',
      inviteOnly: false,
      inviteTtlMs: 1000 * 60 * 60,
    },
    repositories,
  });
  return { app, repositories };
}

async function signup(agent: request.SuperTest<request.Test>) {
  const csrfRes = await agent.get('/api/v1/auth/csrf').expect(200);
  const csrf = csrfRes.body.csrfToken as string;

  const res = await agent
    .post('/api/v1/auth/signup')
    .set('x-csrf-token', csrf)
    .send({ email: 'alice@example.com', password: 'password123' })
    .expect(200);

  return { csrf, userId: res.body.user.id as string };
}

describe('publish github pages', () => {
  it('requires auth', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await agent.get('/api/v1/publish/github-pages/info').expect(401);
  });

  it('info returns github_not_linked without oauth', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await signup(agent);
    const res = await agent.get('/api/v1/publish/github-pages/info').expect(400);
    expect(res.body.error).toBe('github_not_linked');
  });

  it('check returns url and exists flag', async () => {
    const { app, repositories } = makeApp();
    const agent = request.agent(app);
    const { userId, csrf } = await signup(agent);

    await repositories.oauth.create({
      id: 'oa1',
      userId,
      provider: 'github',
      providerAccountId: '123',
      providerLogin: 'alice',
      accessToken: 't',
      createdAt: new Date().toISOString(),
    } as any);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.method).toBe('HEAD');
        expect(String(input)).toBe('https://alice.github.io/mygame/');
        return new Response('', { status: 404 });
      }) as any,
    );

    const res = await agent
      .post('/api/v1/publish/github-pages/check')
      .set('x-csrf-token', csrf)
      .send({ route: 'mygame' })
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.url).toBe('https://alice.github.io/mygame/');
    expect(res.body.exists).toBe(false);
  });
});

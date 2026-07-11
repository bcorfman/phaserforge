import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../server/src/server/app';
import { createMemoryRepositories } from '../../server/src/server/repositories/memory';

function makeApp(settingsOverrides: Partial<Parameters<typeof createApp>[0]['settings']> = {}) {
  const app = createApp({
    // Implementation provides a test backing store; tests assert API behavior.
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
      ...settingsOverrides,
    },
  });
  return { app };
}

async function getCsrf(agent: request.SuperTest<request.Test>) {
  const res = await agent.get('/api/v1/auth/csrf').expect(200);
  const csrf = res.body.csrfToken as string;
  expect(typeof csrf).toBe('string');
  const setCookie = (res.headers['set-cookie'] ?? []).join(';');
  expect(setCookie).toContain('pa_csrf=');
  expect(setCookie.toLowerCase()).not.toContain('httponly');
  return { csrf };
}

async function getCsrfWithCookie(app: any) {
  const res = await request(app).get('/api/v1/auth/csrf').expect(200);
  const csrf = res.body.csrfToken as string;
  expect(typeof csrf).toBe('string');
  const setCookies = (res.headers['set-cookie'] ?? []) as string[];
  const csrfCookie = setCookies.find((c) => c.startsWith('pa_csrf='))?.split(';')[0];
  expect(csrfCookie).toBeTruthy();
  return { csrf, csrfCookie: csrfCookie! };
}

describe('auth', () => {
  it('exposes health endpoint', async () => {
    const { app } = makeApp();
    await request(app).get('/api/v1/health').expect(200).expect({ status: 'ok' });
  });

  it('serves csrf responses with no-store cache headers', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/v1/auth/csrf').expect(200);

    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.headers.pragma).toBe('no-cache');
    expect(res.headers.expires).toBe('0');
    expect(res.headers['surrogate-control']).toBe('no-store');
  });

  it('signs up and returns session cookie', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    const { csrf } = await getCsrf(agent);

    const res = await agent
      .post('/api/v1/auth/signup')
      .set('x-csrf-token', csrf)
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);

    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.headers['set-cookie']?.join(';') ?? '').toContain('pa_session=');
  });

  it('issues a persistent session cookie using the configured session TTL', async () => {
    const sessionTtlMs = 1000 * 60 * 60 * 24 * 30;
    const { app } = makeApp({ sessionTtlMs });
    const agent = request.agent(app);
    const { csrf } = await getCsrf(agent);

    const res = await agent
      .post('/api/v1/auth/signup')
      .set('x-csrf-token', csrf)
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);

    const sessionCookie = ((res.headers['set-cookie'] ?? []) as string[]).find((value) => value.startsWith('pa_session='));
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie).toContain('Max-Age=2592000');
    expect(sessionCookie).toContain('Expires=');
  });

  it('emits SameSite=None; Secure cookies when configured', async () => {
    const { app } = makeApp({ cookieSameSite: 'none', cookieSecure: false });
    const csrfRes = await request(app).get('/api/v1/auth/csrf').expect(200);
    const csrfSetCookie = (csrfRes.headers['set-cookie'] ?? []).join(';').toLowerCase();
    expect(csrfSetCookie).toContain('samesite=none');
    expect(csrfSetCookie).toContain('secure');

    const csrf = csrfRes.body.csrfToken as string;
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .set('Cookie', [`pa_csrf=${csrf}`])
      .set('x-csrf-token', csrf)
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);

    const sessionSetCookie = (signupRes.headers['set-cookie'] ?? []).join(';').toLowerCase();
    expect(sessionSetCookie).toContain('samesite=none');
    expect(sessionSetCookie).toContain('secure');
  });

  it('emits SameSite=None; Secure cookies automatically for cross-origin frontend deployments', async () => {
    const { app } = makeApp({
      cookieSameSite: 'lax',
      cookieSecure: false,
      frontendBaseUrl: 'https://bcorfman.github.io/phaserforge',
      publicBaseUrl: 'https://phaseractions-studio-production.up.railway.app',
    });
    const csrfRes = await request(app).get('/api/v1/auth/csrf').expect(200);
    const csrfSetCookie = (csrfRes.headers['set-cookie'] ?? []).join(';').toLowerCase();
    expect(csrfSetCookie).toContain('samesite=none');
    expect(csrfSetCookie).toContain('secure');

    const csrf = csrfRes.body.csrfToken as string;
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .set('Cookie', [`pa_csrf=${csrf}`])
      .set('x-csrf-token', csrf)
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);

    const sessionSetCookie = (signupRes.headers['set-cookie'] ?? []).join(';').toLowerCase();
    expect(sessionSetCookie).toContain('samesite=none');
    expect(sessionSetCookie).toContain('secure');
  });

  it('rejects missing CSRF on signup', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/signup').send({ email: 'alice@example.com', password: 'password123' }).expect(403);
  });

  it('logs in after signup', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    const csrf1 = await getCsrf(agent);

    await agent
      .post('/api/v1/auth/signup')
      .set('x-csrf-token', csrf1.csrf)
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);

    await agent.post('/api/v1/auth/logout').set('x-csrf-token', csrf1.csrf).expect(200);

    const csrf2 = await getCsrf(agent);
    const res = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrf2.csrf)
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);

    expect(res.body.user.email).toBe('alice@example.com');
  });

  it('github oauth callback redirects back to frontend base url', async () => {
    const { app } = makeApp({
      cookieSameSite: 'none',
      frontendBaseUrl: 'https://bcorfman.github.io/phaserforge',
      publicBaseUrl: 'https://phaseractions-studio-production.up.railway.app',
      githubOAuth: { clientId: 'cid', clientSecret: 'csecret' },
    });
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://github.com/login/oauth/access_token') {
        expect(init?.method).toBe('POST');
        return new Response(JSON.stringify({ access_token: 'at' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url === 'https://api.github.com/user') {
        return new Response(JSON.stringify({ id: 123, login: 'alice' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url === 'https://api.github.com/user/emails') {
        return new Response(JSON.stringify([{ email: 'alice@example.com', primary: true, verified: true }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    };
    vi.stubGlobal('fetch', fetchMock as any);

    // Establish an authenticated session first (OAuth linking requires Cloud login).
    const { csrf, csrfCookie } = await getCsrfWithCookie(app);
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .set('Cookie', [csrfCookie])
      .set('x-csrf-token', csrf)
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);
    const sessionCookie = ((signupRes.headers['set-cookie'] ?? []) as string[]).find((c) => c.startsWith('pa_session='))?.split(';')[0];
    expect(sessionCookie).toBeTruthy();

    const startRes = await request(app).get('/api/v1/auth/github/start?returnTo=%2Fphaserforge%2F').set('Cookie', [sessionCookie!]).expect(302);
    const location = startRes.headers.location as string;
    expect(location).toContain('https://github.com/login/oauth/authorize');
    const redirectUrl = new URL(location);
    const state = redirectUrl.searchParams.get('state');
    expect(state).toBeTruthy();

    const setCookies = (startRes.headers['set-cookie'] ?? []) as string[];
    const oauthState = setCookies.find((c) => c.startsWith('pa_oauth_state='))?.split(';')[0];
    const returnTo = setCookies.find((c) => c.startsWith('pa_return_to='))?.split(';')[0];
    expect(oauthState).toBeTruthy();
    expect(returnTo).toBeTruthy();

    const cbRes = await request(app)
      .get(`/api/v1/auth/github/callback?code=abc&state=${encodeURIComponent(state!)}`)
      .set('Cookie', [sessionCookie!, oauthState!, returnTo!])
      .expect(302);
    expect(cbRes.headers.location).toBe('https://bcorfman.github.io/phaserforge/');
  });

  it('github oauth start accepts absolute returnTo matching frontend origin', async () => {
    const { app } = makeApp({
      frontendBaseUrl: 'https://bcorfman.github.io/phaserforge/',
      publicBaseUrl: 'https://phaseractions-studio-production.up.railway.app',
      githubOAuth: { clientId: 'cid', clientSecret: 'csecret' },
    });

    const { csrf, csrfCookie } = await getCsrfWithCookie(app);
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .set('Cookie', [csrfCookie])
      .set('x-csrf-token', csrf)
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);
    const sessionCookie = ((signupRes.headers['set-cookie'] ?? []) as string[]).find((c) => c.startsWith('pa_session='))?.split(';')[0];
    expect(sessionCookie).toBeTruthy();

    const res = await request(app)
      .get('/api/v1/auth/github/start?returnTo=https%3A%2F%2Fbcorfman.github.io%2Fphaserforge%2F%3Fx%3D1%23hash')
      .set('Cookie', [sessionCookie!])
      .expect(302);

    const location = res.headers.location as string;
    expect(location).toContain('https://github.com/login/oauth/authorize');

    const setCookies = (res.headers['set-cookie'] ?? []) as string[];
    const returnTo = setCookies.find((c) => c.startsWith('pa_return_to='))?.split(';')[0] ?? '';
    // Stores a normalized path-only value.
    expect(decodeURIComponent(returnTo.replace(/^pa_return_to=/, ''))).toBe('/phaserforge/?x=1#hash');
  });

  it('github oauth start rejects absolute returnTo with a different origin', async () => {
    const { app } = makeApp({
      frontendBaseUrl: 'https://bcorfman.github.io/phaserforge/',
      publicBaseUrl: 'https://phaseractions-studio-production.up.railway.app',
      githubOAuth: { clientId: 'cid', clientSecret: 'csecret' },
    });

    const { csrf, csrfCookie } = await getCsrfWithCookie(app);
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .set('Cookie', [csrfCookie])
      .set('x-csrf-token', csrf)
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);
    const sessionCookie = ((signupRes.headers['set-cookie'] ?? []) as string[]).find((c) => c.startsWith('pa_session='))?.split(';')[0];
    expect(sessionCookie).toBeTruthy();

    await request(app).get('/api/v1/auth/github/start?returnTo=https%3A%2F%2Fevil.example%2Fphaserforge%2F').set('Cookie', [sessionCookie!]).expect(400, {
      error: 'invalid_return_to',
    });
  });

  it('blocks switching GitHub accounts by default when already linked', async () => {
    const { app } = makeApp({
      cookieSameSite: 'none',
      frontendBaseUrl: 'https://bcorfman.github.io/phaserforge',
      publicBaseUrl: 'https://phaseractions-studio-production.up.railway.app',
      githubOAuth: { clientId: 'cid', clientSecret: 'csecret' },
    });

    const { csrf, csrfCookie } = await getCsrfWithCookie(app);
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .set('Cookie', [csrfCookie])
      .set('x-csrf-token', csrf)
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);
    const sessionCookie = ((signupRes.headers['set-cookie'] ?? []) as string[]).find((c) => c.startsWith('pa_session='))?.split(';')[0];
    expect(sessionCookie).toBeTruthy();

    // First link: GitHub user id 123.
    let ghUserId = 123;
    const fetchMock = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://github.com/login/oauth/access_token') {
        return new Response(JSON.stringify({ access_token: 'at' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url === 'https://api.github.com/user') {
        return new Response(JSON.stringify({ id: ghUserId, login: ghUserId === 123 ? 'alice' : 'bob' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url === 'https://api.github.com/user/emails') {
        return new Response(JSON.stringify([{ email: 'alice@example.com', primary: true, verified: true }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    };
    vi.stubGlobal('fetch', fetchMock as any);

    const startRes1 = await request(app).get('/api/v1/auth/github/start?returnTo=%2Fphaserforge%2F').set('Cookie', [sessionCookie!]).expect(302);
    const redirectUrl1 = new URL(startRes1.headers.location as string);
    const state1 = redirectUrl1.searchParams.get('state');
    const setCookies1 = (startRes1.headers['set-cookie'] ?? []) as string[];
    const oauthState1 = setCookies1.find((c) => c.startsWith('pa_oauth_state='))?.split(';')[0];
    const returnTo1 = setCookies1.find((c) => c.startsWith('pa_return_to='))?.split(';')[0];
    await request(app)
      .get(`/api/v1/auth/github/callback?code=abc&state=${encodeURIComponent(state1!)}`)
      .set('Cookie', [sessionCookie!, oauthState1!, returnTo1!])
      .expect(302);

    // Second link attempt: GitHub user id 456 should be blocked by default.
    ghUserId = 456;
    const startRes2 = await request(app).get('/api/v1/auth/github/start?returnTo=%2Fphaserforge%2F').set('Cookie', [sessionCookie!]).expect(302);
    const redirectUrl2 = new URL(startRes2.headers.location as string);
    const state2 = redirectUrl2.searchParams.get('state');
    const setCookies2 = (startRes2.headers['set-cookie'] ?? []) as string[];
    const oauthState2 = setCookies2.find((c) => c.startsWith('pa_oauth_state='))?.split(';')[0];
    const returnTo2 = setCookies2.find((c) => c.startsWith('pa_return_to='))?.split(';')[0];
    const callbackRes = await request(app)
      .get(`/api/v1/auth/github/callback?code=def&state=${encodeURIComponent(state2!)}`)
      .set('Cookie', [sessionCookie!, oauthState2!, returnTo2!])
      .expect(302);
    expect(callbackRes.headers.location).toBe('https://bcorfman.github.io/phaserforge/?githubAuthError=github_already_linked_different_account');
  });

  it('allows switching GitHub accounts when forceSwitch=1 is set', async () => {
    const { app } = makeApp({
      cookieSameSite: 'none',
      frontendBaseUrl: 'https://bcorfman.github.io/phaserforge',
      publicBaseUrl: 'https://phaseractions-studio-production.up.railway.app',
      githubOAuth: { clientId: 'cid', clientSecret: 'csecret' },
    });

    const { csrf, csrfCookie } = await getCsrfWithCookie(app);
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .set('Cookie', [csrfCookie])
      .set('x-csrf-token', csrf)
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);
    const sessionCookie = ((signupRes.headers['set-cookie'] ?? []) as string[]).find((c) => c.startsWith('pa_session='))?.split(';')[0];
    expect(sessionCookie).toBeTruthy();

    let ghUserId = 123;
    const fetchMock = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://github.com/login/oauth/access_token') {
        return new Response(JSON.stringify({ access_token: 'at' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url === 'https://api.github.com/user') {
        return new Response(JSON.stringify({ id: ghUserId, login: ghUserId === 123 ? 'alice' : 'bob' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url === 'https://api.github.com/user/emails') {
        return new Response(JSON.stringify([{ email: 'alice@example.com', primary: true, verified: true }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    };
    vi.stubGlobal('fetch', fetchMock as any);

    const startRes1 = await request(app).get('/api/v1/auth/github/start?returnTo=%2Fphaserforge%2F').set('Cookie', [sessionCookie!]).expect(302);
    const redirectUrl1 = new URL(startRes1.headers.location as string);
    const state1 = redirectUrl1.searchParams.get('state');
    const setCookies1 = (startRes1.headers['set-cookie'] ?? []) as string[];
    const oauthState1 = setCookies1.find((c) => c.startsWith('pa_oauth_state='))?.split(';')[0];
    const returnTo1 = setCookies1.find((c) => c.startsWith('pa_return_to='))?.split(';')[0];
    await request(app)
      .get(`/api/v1/auth/github/callback?code=abc&state=${encodeURIComponent(state1!)}`)
      .set('Cookie', [sessionCookie!, oauthState1!, returnTo1!])
      .expect(302);

    ghUserId = 456;
    const startRes2 = await request(app)
      .get('/api/v1/auth/github/start?returnTo=%2Fphaserforge%2F&forceSwitch=1')
      .set('Cookie', [sessionCookie!])
      .expect(302);
    const redirectUrl2 = new URL(startRes2.headers.location as string);
    const state2 = redirectUrl2.searchParams.get('state');
    const setCookies2 = (startRes2.headers['set-cookie'] ?? []) as string[];
    const oauthState2 = setCookies2.find((c) => c.startsWith('pa_oauth_state='))?.split(';')[0];
    const forceSwitch2 = setCookies2.find((c) => c.startsWith('pa_oauth_force_switch='))?.split(';')[0];
    const returnTo2 = setCookies2.find((c) => c.startsWith('pa_return_to='))?.split(';')[0];
    expect(forceSwitch2).toBeTruthy();
    await request(app)
      .get(`/api/v1/auth/github/callback?code=def&state=${encodeURIComponent(state2!)}`)
      .set('Cookie', [sessionCookie!, oauthState2!, forceSwitch2!, returnTo2!])
      .expect(302);
  });

  it('reassigns a GitHub account to the current PhaserForge user after OAuth succeeds', async () => {
    const repositories = createMemoryRepositories();
    const app = createApp({
      settings: {
        corsAllowOrigins: ['http://localhost:5173'],
        cookieName: 'pa_session',
        csrfCookieName: 'pa_csrf',
        cookieSecure: false,
        cookieSameSite: 'none',
        sessionTtlMs: 1000 * 60 * 60,
        trustProxy: false,
        publicBaseUrl: 'https://phaseractions-studio-production.up.railway.app',
        frontendBaseUrl: 'https://bcorfman.github.io/phaserforge',
        inviteOnly: false,
        inviteTtlMs: 1000 * 60 * 60,
        githubOAuth: { clientId: 'cid', clientSecret: 'csecret' },
      },
      repositories,
    });

    const { csrf: csrf1, csrfCookie: csrfCookie1 } = await getCsrfWithCookie(app);
    const signupRes1 = await request(app)
      .post('/api/v1/auth/signup')
      .set('Cookie', [csrfCookie1])
      .set('x-csrf-token', csrf1)
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);
    const sessionCookie1 = ((signupRes1.headers['set-cookie'] ?? []) as string[]).find((c) => c.startsWith('pa_session='))?.split(';')[0];
    expect(sessionCookie1).toBeTruthy();

    const { csrf: csrf2, csrfCookie: csrfCookie2 } = await getCsrfWithCookie(app);
    const signupRes2 = await request(app)
      .post('/api/v1/auth/signup')
      .set('Cookie', [csrfCookie2])
      .set('x-csrf-token', csrf2)
      .send({ email: 'bob@example.com', password: 'password123' })
      .expect(200);
    const sessionCookie2 = ((signupRes2.headers['set-cookie'] ?? []) as string[]).find((c) => c.startsWith('pa_session='))?.split(';')[0];
    expect(sessionCookie2).toBeTruthy();

    const fetchMock = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://github.com/login/oauth/access_token') {
        return new Response(JSON.stringify({ access_token: 'at' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url === 'https://api.github.com/user') {
        return new Response(JSON.stringify({ id: 123, login: 'alice' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url === 'https://api.github.com/user/emails') {
        return new Response(JSON.stringify([{ email: 'alice@example.com', primary: true, verified: true }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    };
    vi.stubGlobal('fetch', fetchMock as any);

    const ownerStartRes = await request(app).get('/api/v1/auth/github/start?returnTo=%2Fphaserforge%2F').set('Cookie', [sessionCookie1!]).expect(302);
    const ownerState = new URL(ownerStartRes.headers.location as string).searchParams.get('state');
    const ownerSetCookies = (ownerStartRes.headers['set-cookie'] ?? []) as string[];
    const ownerOauthState = ownerSetCookies.find((c) => c.startsWith('pa_oauth_state='))?.split(';')[0];
    const ownerReturnTo = ownerSetCookies.find((c) => c.startsWith('pa_return_to='))?.split(';')[0];
    await request(app)
      .get(`/api/v1/auth/github/callback?code=abc&state=${encodeURIComponent(ownerState!)}`)
      .set('Cookie', [sessionCookie1!, ownerOauthState!, ownerReturnTo!])
      .expect(302);

    const contenderStartRes = await request(app).get('/api/v1/auth/github/start?returnTo=%2Fphaserforge%2F').set('Cookie', [sessionCookie2!]).expect(302);
    const contenderState = new URL(contenderStartRes.headers.location as string).searchParams.get('state');
    const contenderSetCookies = (contenderStartRes.headers['set-cookie'] ?? []) as string[];
    const contenderOauthState = contenderSetCookies.find((c) => c.startsWith('pa_oauth_state='))?.split(';')[0];
    const contenderReturnTo = contenderSetCookies.find((c) => c.startsWith('pa_return_to='))?.split(';')[0];
    const callbackRes = await request(app)
      .get(`/api/v1/auth/github/callback?code=def&state=${encodeURIComponent(contenderState!)}`)
      .set('Cookie', [sessionCookie2!, contenderOauthState!, contenderReturnTo!])
      .expect(302);

    expect(callbackRes.headers.location).toBe('https://bcorfman.github.io/phaserforge/');

    const reassignedLink = await repositories.oauth.findByProviderAccount('github', '123');
    expect(reassignedLink?.userId).toBe(signupRes2.body.user.id);
    expect(reassignedLink?.accessToken).toBe('at');

    const originalOwnerLink = await repositories.oauth.findByUserIdProvider(signupRes1.body.user.id, 'github');
    expect(originalOwnerLink).toBeNull();
  });

  it('reclaims an orphaned GitHub link when reconnecting from the current account', async () => {
    const repositories = createMemoryRepositories();
    await repositories.oauth.create({
      id: 'oa_stale',
      userId: 'user_stale',
      provider: 'github',
      providerAccountId: '123',
      providerLogin: 'alice',
      accessToken: 'old-token',
      createdAt: new Date().toISOString(),
    });

    const appWithRepos = createApp({
      settings: {
        corsAllowOrigins: ['http://localhost:5173'],
        cookieName: 'pa_session',
        csrfCookieName: 'pa_csrf',
        cookieSecure: false,
        cookieSameSite: 'none',
        sessionTtlMs: 1000 * 60 * 60,
        trustProxy: false,
        publicBaseUrl: 'https://phaseractions-studio-production.up.railway.app',
        frontendBaseUrl: 'https://bcorfman.github.io/phaserforge',
        inviteOnly: false,
        inviteTtlMs: 1000 * 60 * 60,
        githubOAuth: { clientId: 'cid', clientSecret: 'csecret' },
      },
      repositories,
    });

    const { csrf, csrfCookie } = await getCsrfWithCookie(appWithRepos);
    const signupRes = await request(appWithRepos)
      .post('/api/v1/auth/signup')
      .set('Cookie', [csrfCookie])
      .set('x-csrf-token', csrf)
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);
    const sessionCookie = ((signupRes.headers['set-cookie'] ?? []) as string[]).find((c) => c.startsWith('pa_session='))?.split(';')[0];
    expect(sessionCookie).toBeTruthy();

    const fetchMock = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://github.com/login/oauth/access_token') {
        return new Response(JSON.stringify({ access_token: 'at' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url === 'https://api.github.com/user') {
        return new Response(JSON.stringify({ id: 123, login: 'alice' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url === 'https://api.github.com/user/emails') {
        return new Response(JSON.stringify([{ email: 'alice@example.com', primary: true, verified: true }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    };
    vi.stubGlobal('fetch', fetchMock as any);

    const startRes = await request(appWithRepos).get('/api/v1/auth/github/start?returnTo=%2Fphaserforge%2F').set('Cookie', [sessionCookie!]).expect(302);
    const state = new URL(startRes.headers.location as string).searchParams.get('state');
    const setCookies = (startRes.headers['set-cookie'] ?? []) as string[];
    const oauthState = setCookies.find((c) => c.startsWith('pa_oauth_state='))?.split(';')[0];
    const returnTo = setCookies.find((c) => c.startsWith('pa_return_to='))?.split(';')[0];
    await request(appWithRepos)
      .get(`/api/v1/auth/github/callback?code=abc&state=${encodeURIComponent(state!)}`)
      .set('Cookie', [sessionCookie!, oauthState!, returnTo!])
      .expect(302);

    const link = await repositories.oauth.findByProviderAccount('github', '123');
    expect(link?.userId).toBe(signupRes.body.user.id);
    expect(link?.accessToken).toBe('at');
  });

  it('disconnects GitHub account via authenticated endpoint', async () => {
    const { app } = makeApp({
      cookieSameSite: 'none',
      frontendBaseUrl: 'https://bcorfman.github.io/phaserforge',
      publicBaseUrl: 'https://phaseractions-studio-production.up.railway.app',
      githubOAuth: { clientId: 'cid', clientSecret: 'csecret' },
    });

    const { csrf, csrfCookie } = await getCsrfWithCookie(app);
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .set('Cookie', [csrfCookie])
      .set('x-csrf-token', csrf)
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);
    const sessionCookie = ((signupRes.headers['set-cookie'] ?? []) as string[]).find((c) => c.startsWith('pa_session='))?.split(';')[0];
    expect(sessionCookie).toBeTruthy();

    const fetchMock = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://github.com/login/oauth/access_token') {
        return new Response(JSON.stringify({ access_token: 'at' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url === 'https://api.github.com/user') {
        return new Response(JSON.stringify({ id: 123, login: 'alice' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url === 'https://api.github.com/user/emails') {
        return new Response(JSON.stringify([{ email: 'alice@example.com', primary: true, verified: true }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    };
    vi.stubGlobal('fetch', fetchMock as any);

    const startRes = await request(app).get('/api/v1/auth/github/start?returnTo=%2Fphaserforge%2F').set('Cookie', [sessionCookie!]).expect(302);
    const redirectUrl = new URL(startRes.headers.location as string);
    const state = redirectUrl.searchParams.get('state');
    const setCookies = (startRes.headers['set-cookie'] ?? []) as string[];
    const oauthState = setCookies.find((c) => c.startsWith('pa_oauth_state='))?.split(';')[0];
    const returnTo = setCookies.find((c) => c.startsWith('pa_return_to='))?.split(';')[0];
    await request(app)
      .get(`/api/v1/auth/github/callback?code=abc&state=${encodeURIComponent(state!)}`)
      .set('Cookie', [sessionCookie!, oauthState!, returnTo!])
      .expect(302);

    // Disconnect requires CSRF.
    await request(app).post('/api/v1/auth/github/disconnect').set('Cookie', [sessionCookie!]).expect(403);
    const { csrf: csrf2, csrfCookie: csrfCookie2 } = await getCsrfWithCookie(app);
    await request(app)
      .post('/api/v1/auth/github/disconnect')
      .set('Cookie', [sessionCookie!, csrfCookie2])
      .set('x-csrf-token', csrf2)
      .expect(200, { ok: true });
  });
});

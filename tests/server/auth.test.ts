import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../server/src/server/app';

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

describe('auth', () => {
  it('exposes health endpoint', async () => {
    const { app } = makeApp();
    await request(app).get('/api/v1/health').expect(200).expect({ status: 'ok' });
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
        return new Response(JSON.stringify({ id: 123 }), { status: 200, headers: { 'content-type': 'application/json' } });
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

    const startRes = await request(app).get('/api/v1/auth/github/start?returnTo=%2Fphaserforge%2F').expect(302);
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
      .set('Cookie', [oauthState!, returnTo!])
      .expect(302);
    expect(cbRes.headers.location).toBe('https://bcorfman.github.io/phaserforge/');
  });
});

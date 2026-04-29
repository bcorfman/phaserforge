import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../server/src/server/app';

function makeApp() {
  const app = createApp({
    // Implementation provides a test backing store; tests assert API behavior.
    settings: {
      corsAllowOrigins: ['http://localhost:5173'],
      cookieName: 'pa_session',
      csrfCookieName: 'pa_csrf',
      cookieSecure: false,
      sessionTtlMs: 1000 * 60 * 60,
      trustProxy: false,
      publicBaseUrl: 'http://localhost:8787',
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
});

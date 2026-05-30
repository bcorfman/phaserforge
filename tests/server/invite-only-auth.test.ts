import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../server/src/server/app';
import { createMemoryRepositories } from '../../server/src/server/repositories/memory';
import { sha256Base64Url } from '../../server/src/security/crypto';

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
      inviteOnly: true,
      inviteTtlMs: 1000 * 60 * 60,
      githubOAuth: { clientId: 'cid', clientSecret: 'csecret' },
    },
    repositories,
  });
  return { app, repositories };
}

async function getCsrf(app: any) {
  const res = await request(app).get('/api/v1/auth/csrf').expect(200);
  const csrf = res.body.csrfToken as string;
  expect(typeof csrf).toBe('string');
  return csrf;
}

describe('invite-only auth', () => {
  it('rejects password signup without invite token when inviteOnly enabled', async () => {
    const { app } = makeApp();
    const csrf = await getCsrf(app);
    await request(app)
      .post('/api/v1/auth/signup')
      .set('Cookie', [`pa_csrf=${csrf}`])
      .set('x-csrf-token', csrf)
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(403)
      .expect({ error: 'invite_required' });
  });

  it('accepts password signup with valid invite token and consumes it', async () => {
    const { app, repositories } = makeApp();
    const inviteToken = 'inv_tok_123456';
    const tokenHash = sha256Base64Url(inviteToken);
    const now = Date.now();
    await repositories.invites.create({
      id: 'inv1',
      email: 'alice@example.com',
      tokenHash,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 60_000).toISOString(),
      usedAt: null,
      usedByUserId: null,
    });

    const csrf = await getCsrf(app);
    await request(app)
      .post('/api/v1/auth/signup')
      .set('Cookie', [`pa_csrf=${csrf}`])
      .set('x-csrf-token', csrf)
      .send({ email: 'alice@example.com', password: 'password123', inviteToken })
      .expect(200);

    const invite = await repositories.invites.findByTokenHash(tokenHash);
    expect(invite?.usedAt).toBeTruthy();

    const csrf2 = await getCsrf(app);
    await request(app)
      .post('/api/v1/auth/signup')
      .set('Cookie', [`pa_csrf=${csrf2}`])
      .set('x-csrf-token', csrf2)
      .send({ email: 'bob@example.com', password: 'password123', inviteToken })
      .expect(403)
      .expect({ error: 'invite_invalid' });
  });

  it('requires Cloud login before starting GitHub OAuth linking', async () => {
    const { app } = makeApp();
    await request(app).get('/api/v1/auth/github/start?returnTo=%2F').expect(401).expect({ error: 'unauthorized' });
  });
});

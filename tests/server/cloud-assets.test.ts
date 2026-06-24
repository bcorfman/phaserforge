import request from 'supertest';
import { describe, expect, it } from 'vitest';

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

describe('cloud asset routes', () => {
  it('uploads an embedded asset and serves its bytes back to the same user', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    const { csrf } = await signup(agent);

    const upload = await agent
      .post('/api/v1/assets')
      .set('x-csrf-token', csrf)
      .send({
        dataUrl: 'data:audio/mpeg;base64,QUJDRA==',
        originalName: 'theme.mp3',
        mimeType: 'audio/mpeg',
      })
      .expect(201);

    expect(upload.body.asset).toMatchObject({
      kind: 'cloud',
      originalName: 'theme.mp3',
      mimeType: 'audio/mpeg',
    });
    expect(typeof upload.body.asset.assetId).toBe('string');

    const assetId = upload.body.asset.assetId as string;
    const content = await agent.get(`/api/v1/assets/${assetId}/content`).expect(200);
    expect(content.headers['content-type']).toMatch(/audio\/mpeg/);
    expect(Buffer.from(content.body).toString('utf8')).toBe('ABCD');
  });
});

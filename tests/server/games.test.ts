import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../server/src/server/app';

function makeApp() {
  const app = createApp({
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

async function signup(agent: request.SuperTest<request.Test>) {
  const csrfRes = await agent.get('/api/v1/auth/csrf').expect(200);
  const csrf = csrfRes.body.csrfToken as string;

  await agent
    .post('/api/v1/auth/signup')
    .set('x-csrf-token', csrf)
    .send({ email: 'alice@example.com', password: 'password123' })
    .expect(200);

  return { csrf };
}

describe('games', () => {
  it('requires auth', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await agent.get('/api/v1/games').expect(401);
  });

  it('creates and fetches a game for the logged-in user', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    const { csrf } = await signup(agent);

    const created = await agent
      .post('/api/v1/games')
      .set('x-csrf-token', csrf)
      .send({ title: 'My Game', yaml: 'scenes: []' })
      .expect(201);

    const id = created.body.game.id as string;
    expect(typeof id).toBe('string');

    const fetched = await agent.get(`/api/v1/games/${id}`).expect(200);
    expect(fetched.body.game.title).toBe('My Game');
    expect(fetched.body.game.yaml).toBe('scenes: []');
  });
});

import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { requireCsrf } from '../../server/src/security/csrf';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(requireCsrf({ cookieName: 'pa_csrf', headerName: 'x-csrf-token' }));
  app.post('/state-change', (_req, res) => res.json({ ok: true }));
  app.get('/read-only', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('requireCsrf', () => {
  it('allows safe methods without token', async () => {
    const app = makeApp();
    await request(app).get('/read-only').expect(200).expect({ ok: true });
  });

  it('rejects state-changing requests without token', async () => {
    const app = makeApp();
    await request(app).post('/state-change').send({}).expect(403).expect({ error: 'csrf_required' });
  });

  it('rejects mismatched token', async () => {
    const app = makeApp();
    await request(app)
      .post('/state-change')
      .set('Cookie', ['pa_csrf=abc'])
      .set('x-csrf-token', 'def')
      .send({})
      .expect(403)
      .expect({ error: 'csrf_required' });
  });

  it('allows matching cookie + header token', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/state-change')
      .set('Cookie', ['pa_csrf=abc'])
      .set('x-csrf-token', 'abc')
      .send({})
      .expect(200);

    expect(res.body).toEqual({ ok: true });
  });
});


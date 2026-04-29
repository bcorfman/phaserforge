import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';

import type { CreateAppOptions, Repositories } from './types';
import { requireCsrf } from '../security/csrf';
import { authRouter } from './routes/auth';
import { gamesRouter } from './routes/games';
import { createMemoryRepositories } from './repositories/memory';

function corsAllowlistMiddleware(origins: string[]) {
  const allow = new Set(origins);
  return function corsAllowlist(req: express.Request, res: express.Response, next: (err?: unknown) => void) {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    if (origin && allow.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}

export function createApp(options: CreateAppOptions) {
  const { settings } = options;
  const repositories: Repositories = options.repositories ?? createMemoryRepositories();

  const app = express();
  app.disable('x-powered-by');
  if (settings.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(corsAllowlistMiddleware(settings.corsAllowOrigins));
  app.use(express.json({ limit: '1mb' }));
  // codeql[js/missing-token-validation] CSRF is enforced by `requireCsrf` middleware directly below.
  app.use(cookieParser());

  app.use(
    requireCsrf({
      cookieName: settings.csrfCookieName,
      headerName: 'x-csrf-token',
    }),
  );

  app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/v1/auth', authRouter(settings, repositories));
  app.use('/api/v1/games', gamesRouter(settings, repositories));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // Avoid leaking stack traces by default.
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}

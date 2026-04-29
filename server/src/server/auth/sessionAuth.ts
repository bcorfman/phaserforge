import type { Request, RequestHandler } from 'express';

import { sha256Base64Url } from '../../security/crypto';
import type { Repositories } from '../types';
import type { Settings } from '../../settings';

export type AuthedRequest = Request & { userId: string };

export function requireAuth(settings: Settings, repositories: Repositories): RequestHandler {
  return async (req, res, next) => {
    const token = typeof req.cookies?.[settings.cookieName] === 'string' ? req.cookies[settings.cookieName] : undefined;
    if (!token) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const tokenHash = sha256Base64Url(token);
    const session = await repositories.sessions.findByTokenHash(tokenHash);
    if (!session) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await repositories.sessions.deleteByTokenHash(tokenHash);
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const now = new Date().toISOString();
    void repositories.sessions.touchLastSeen(session.id, now);

    (req as unknown as { userId: string }).userId = session.userId;
    next();
  };
}

import type { Request, Response } from 'express';
import { safeEqual } from './crypto';

export type CsrfConfig = {
  cookieName: string;
  headerName: string;
};

export function getCsrfCookieValue(req: Request, cookieName: string): string | undefined {
  const value = req.cookies?.[cookieName];
  return typeof value === 'string' ? value : undefined;
}

export function requireCsrf(config: CsrfConfig) {
  return function requireCsrfMiddleware(req: Request, res: Response, next: (err?: unknown) => void) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

    const cookieVal = getCsrfCookieValue(req, config.cookieName);
    const headerValRaw = req.header(config.headerName);
    const headerVal = typeof headerValRaw === 'string' ? headerValRaw : undefined;

    if (!cookieVal || !headerVal || !safeEqual(cookieVal, headerVal)) {
      res.status(403).json({ error: 'csrf_required' });
      return;
    }
    next();
  };
}


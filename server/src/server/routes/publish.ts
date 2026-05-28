import express from 'express';
import type { Settings } from '../../settings';
import type { Repositories } from '../types';
import { requireAuth } from '../auth/sessionAuth';
import { z } from 'zod';
import { checkGithubPagesTarget, publishGameToGithubPages, publishInfo } from '../services/publishService';

const RouteSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((v) => !v.startsWith('http://') && !v.startsWith('https://'), 'route_must_not_be_url')
  .transform((v) => v.replace(/^\/+/, '').replace(/\/+$/, ''));

export function publishRouter(settings: Settings, repositories: Repositories) {
  const router = express.Router();
  router.use(requireAuth(settings, repositories));

  router.get('/github-pages/info', async (req, res) => {
    const userId = (req as unknown as { userId: string }).userId;
    const info = await publishInfo(repositories, userId);
    if (!info.ok) {
      res.status(400).json({ error: info.error });
      return;
    }
    res.json(info);
  });

  router.post('/github-pages/check', async (req, res) => {
    const parsed = z.object({ route: RouteSchema }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    const userId = (req as unknown as { userId: string }).userId;
    const result = await checkGithubPagesTarget(repositories, userId, parsed.data.route);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  router.post('/github-pages', async (req, res) => {
    const parsed = z.object({ gameId: z.string().min(1), route: RouteSchema, allowOverwrite: z.boolean().optional() }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    const userId = (req as unknown as { userId: string }).userId;
    const result = await publishGameToGithubPages(repositories, userId, parsed.data);
    if (!result.ok) {
      res.status(result.error === 'not_found' ? 404 : 400).json({ error: result.error, ...(result.url ? { url: result.url } : {}) });
      return;
    }
    res.json(result);
  });

  return router;
}


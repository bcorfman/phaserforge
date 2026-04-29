import type { RequestHandler } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';

import type { Repositories } from '../types';
import type { Settings } from '../../settings';
import { requireAuth } from '../auth/sessionAuth';
import { createGame, deleteGame, GameSchemas, getGame, listGames, updateGame } from '../services/gameService';

function getUserId(req: Parameters<RequestHandler>[0]): string {
  return (req as unknown as { userId: string }).userId;
}

export function gamesRouter(settings: Settings, repositories: Repositories) {
  const router = express.Router();

  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  router.use(requireAuth(settings, repositories));

  router.get('/', async (req, res) => {
    res.json(await listGames(repositories, getUserId(req)));
  });

  router.post('/', writeLimiter, async (req, res) => {
    const parsed = GameSchemas.create.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }

    const result = await createGame(repositories, getUserId(req), parsed.data);
    res.status(201).json(result);
  });

  router.get('/:id', async (req, res) => {
    const result = await getGame(repositories, getUserId(req), req.params.id);
    if (!result) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(result);
  });

  router.put('/:id', writeLimiter, async (req, res) => {
    const parsed = GameSchemas.update.safeParse(req.body);
    if (!parsed.success || (!parsed.data.title && !parsed.data.yaml)) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }

    const result = await updateGame(repositories, getUserId(req), req.params.id, parsed.data);
    if (!result) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(result);
  });

  router.delete('/:id', writeLimiter, async (req, res) => {
    const ok = await deleteGame(repositories, getUserId(req), req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}


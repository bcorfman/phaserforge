import { z } from 'zod';

import type { ProjectSpec } from '../../../../src/model/types';
import { validateProjectSpec } from '../../../../src/model/validation';
import type { Repositories } from '../types';
import { newId } from '../../security/ids';

const projectSchema = z.custom<ProjectSpec>((value) => {
  try {
    validateProjectSpec(value as ProjectSpec);
    return true;
  } catch {
    return false;
  }
}, { message: 'invalid_project' });

export const GameSchemas = {
  create: z.object({
    title: z.string().trim().min(1).max(100),
    project: projectSchema,
  }),
  update: z.object({
    title: z.string().trim().min(1).max(100).optional(),
    project: projectSchema.optional(),
  }),
};

export async function listGames(repositories: Repositories, userId: string) {
  const games = await repositories.games.listByUserId(userId);
  return {
    games: games.map((g) => ({
      id: g.id,
      title: g.title,
      created_at: g.createdAt,
      updated_at: g.updatedAt,
    })),
  };
}

export async function createGame(repositories: Repositories, userId: string, input: { title: string; project: ProjectSpec }) {
  const now = new Date().toISOString();
  const id = newId('game');
  await repositories.games.create({
    id,
    userId,
    title: input.title,
    project: structuredClone(input.project),
    createdAt: now,
    updatedAt: now,
  });

  return {
    game: { id, title: input.title, created_at: now, updated_at: now },
  };
}

export async function getGame(repositories: Repositories, userId: string, id: string) {
  const game = await repositories.games.findByIdForUser(id, userId);
  if (!game) return null;
  return {
    game: {
      id: game.id,
      title: game.title,
      project: structuredClone(game.project),
      created_at: game.createdAt,
      updated_at: game.updatedAt,
    },
  };
}

export async function updateGame(
  repositories: Repositories,
  userId: string,
  id: string,
  patch: { title?: string; project?: ProjectSpec },
) {
  const now = new Date().toISOString();
  const updated = await repositories.games.updateForUser(id, userId, {
    ...patch,
    ...(patch.project ? { project: structuredClone(patch.project) } : {}),
    updatedAt: now,
  });
  if (!updated) return null;
  return { ok: true, updated_at: updated.updatedAt };
}

export async function deleteGame(repositories: Repositories, userId: string, id: string) {
  const ok = await repositories.games.deleteForUser(id, userId);
  return ok;
}

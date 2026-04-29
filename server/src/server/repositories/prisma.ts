import type { PrismaClient } from '@prisma/client';

import type {
  CloudGame,
  CloudGameMeta,
  GameRepository,
  OAuthAccountRecord,
  OAuthRepository,
  Repositories,
  SessionRecord,
  SessionRepository,
  UserRecord,
  UserRepository,
} from '../types';

function toIso(date: Date): string {
  return date.toISOString();
}

export function createPrismaRepositories(prisma: PrismaClient): Repositories {
  const users: UserRepository = {
    async findById(id) {
      const row = await prisma.user.findUnique({ where: { id } });
      if (!row) return null;
      return { id: row.id, email: row.email, passwordHash: row.passwordHash, createdAt: toIso(row.createdAt) };
    },
    async findByEmail(email) {
      const row = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!row) return null;
      return { id: row.id, email: row.email, passwordHash: row.passwordHash, createdAt: toIso(row.createdAt) };
    },
    async create(user) {
      const row = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email.toLowerCase(),
          passwordHash: user.passwordHash,
          createdAt: new Date(user.createdAt),
        },
      });
      return { id: row.id, email: row.email, passwordHash: row.passwordHash, createdAt: toIso(row.createdAt) };
    },
  };

  const oauth: OAuthRepository = {
    async findByProviderAccount(provider, providerAccountId) {
      const row = await prisma.oAuthAccount.findFirst({ where: { provider, providerAccountId } });
      if (!row) return null;
      return {
        id: row.id,
        userId: row.userId,
        provider: row.provider,
        providerAccountId: row.providerAccountId,
        createdAt: toIso(row.createdAt),
      };
    },
    async create(account) {
      const row = await prisma.oAuthAccount.create({
        data: {
          id: account.id,
          userId: account.userId,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          createdAt: new Date(account.createdAt),
        },
      });
      return {
        id: row.id,
        userId: row.userId,
        provider: row.provider,
        providerAccountId: row.providerAccountId,
        createdAt: toIso(row.createdAt),
      };
    },
  };

  const sessions: SessionRepository = {
    async findByTokenHash(tokenHash) {
      const row = await prisma.session.findUnique({ where: { tokenHash } });
      if (!row) return null;
      return {
        id: row.id,
        userId: row.userId,
        tokenHash: row.tokenHash,
        createdAt: toIso(row.createdAt),
        expiresAt: toIso(row.expiresAt),
        lastSeenAt: toIso(row.lastSeenAt),
      };
    },
    async create(session) {
      const row = await prisma.session.create({
        data: {
          id: session.id,
          userId: session.userId,
          tokenHash: session.tokenHash,
          createdAt: new Date(session.createdAt),
          expiresAt: new Date(session.expiresAt),
          lastSeenAt: new Date(session.lastSeenAt),
        },
      });
      return {
        id: row.id,
        userId: row.userId,
        tokenHash: row.tokenHash,
        createdAt: toIso(row.createdAt),
        expiresAt: toIso(row.expiresAt),
        lastSeenAt: toIso(row.lastSeenAt),
      };
    },
    async deleteByTokenHash(tokenHash) {
      await prisma.session.deleteMany({ where: { tokenHash } });
    },
    async touchLastSeen(id, lastSeenAt) {
      await prisma.session.updateMany({ where: { id }, data: { lastSeenAt: new Date(lastSeenAt) } });
    },
  };

  const games: GameRepository = {
    async listByUserId(userId) {
      const rows = await prisma.game.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, userId: true, title: true, createdAt: true, updatedAt: true },
      });
      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        title: row.title,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      }));
    },
    async create(game) {
      const row = await prisma.game.create({
        data: {
          id: game.id,
          userId: game.userId,
          title: game.title,
          yaml: game.yaml,
          createdAt: new Date(game.createdAt),
          updatedAt: new Date(game.updatedAt),
        },
      });
      return {
        id: row.id,
        userId: row.userId,
        title: row.title,
        yaml: row.yaml,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      };
    },
    async findByIdForUser(id, userId) {
      const row = await prisma.game.findFirst({ where: { id, userId } });
      if (!row) return null;
      return {
        id: row.id,
        userId: row.userId,
        title: row.title,
        yaml: row.yaml,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      };
    },
    async updateForUser(id, userId, patch) {
      const row = await prisma.game.updateMany({
        where: { id, userId },
        data: {
          ...(typeof patch.title === 'string' ? { title: patch.title } : {}),
          ...(typeof patch.yaml === 'string' ? { yaml: patch.yaml } : {}),
          updatedAt: new Date(patch.updatedAt),
        },
      });
      if (row.count === 0) return null;
      return { updatedAt: patch.updatedAt };
    },
    async deleteForUser(id, userId) {
      const row = await prisma.game.deleteMany({ where: { id, userId } });
      return row.count > 0;
    },
  };

  return { users, oauth, sessions, games };
}


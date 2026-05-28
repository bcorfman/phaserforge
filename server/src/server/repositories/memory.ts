import type {
  CloudGame,
  CloudGameMeta,
  GameRepository,
  InviteRecord,
  InviteRepository,
  OAuthAccountRecord,
  OAuthRepository,
  Repositories,
  SessionRecord,
  SessionRepository,
  UserRecord,
  UserRepository,
} from '../types';

function clone<T>(value: T): T {
  return structuredClone(value);
}

class MemoryUserRepository implements UserRepository {
  private byId = new Map<string, UserRecord>();
  private byEmail = new Map<string, string>();

  async findById(id: string): Promise<UserRecord | null> {
    return clone(this.byId.get(id) ?? null);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const id = this.byEmail.get(email.toLowerCase()) ?? null;
    if (!id) return null;
    return this.findById(id);
  }

  async create(user: { id: string; email: string; passwordHash: string | null; createdAt: string }): Promise<UserRecord> {
    const record: UserRecord = { ...user, email: user.email.toLowerCase() };
    const key = record.email;
    if (this.byEmail.has(key)) {
      throw new Error('unique_email_violation');
    }
    this.byId.set(record.id, record);
    this.byEmail.set(key, record.id);
    return clone(record);
  }
}

class MemoryOAuthRepository implements OAuthRepository {
  private byId = new Map<string, OAuthAccountRecord>();
  private byProvider = new Map<string, string>();
  private byUserProvider = new Map<string, string>();

  async findByProviderAccount(provider: string, providerAccountId: string): Promise<OAuthAccountRecord | null> {
    const key = `${provider}:${providerAccountId}`;
    const id = this.byProvider.get(key);
    if (!id) return null;
    return clone(this.byId.get(id) ?? null);
  }

  async findByUserIdProvider(userId: string, provider: string): Promise<OAuthAccountRecord | null> {
    const key = `${userId}:${provider}`;
    const id = this.byUserProvider.get(key);
    if (!id) return null;
    return clone(this.byId.get(id) ?? null);
  }

  async create(oauth: OAuthAccountRecord): Promise<OAuthAccountRecord> {
    const key = `${oauth.provider}:${oauth.providerAccountId}`;
    if (this.byProvider.has(key)) {
      throw new Error('unique_provider_account_violation');
    }
    this.byId.set(oauth.id, oauth);
    this.byProvider.set(key, oauth.id);
    this.byUserProvider.set(`${oauth.userId}:${oauth.provider}`, oauth.id);
    return clone(oauth);
  }

  async update(id: string, patch: { providerLogin?: string | null; accessToken?: string | null }): Promise<void> {
    const existing = this.byId.get(id);
    if (!existing) return;
    if ('providerLogin' in patch) existing.providerLogin = patch.providerLogin ?? null;
    if ('accessToken' in patch) existing.accessToken = patch.accessToken ?? null;
  }
}

class MemorySessionRepository implements SessionRepository {
  private byId = new Map<string, SessionRecord>();
  private byHash = new Map<string, string>();

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const id = this.byHash.get(tokenHash);
    if (!id) return null;
    return clone(this.byId.get(id) ?? null);
  }

  async create(session: SessionRecord): Promise<SessionRecord> {
    if (this.byHash.has(session.tokenHash)) {
      throw new Error('unique_token_hash_violation');
    }
    this.byId.set(session.id, session);
    this.byHash.set(session.tokenHash, session.id);
    return clone(session);
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    const id = this.byHash.get(tokenHash);
    if (!id) return;
    this.byHash.delete(tokenHash);
    this.byId.delete(id);
  }

  async touchLastSeen(id: string, lastSeenAt: string): Promise<void> {
    const existing = this.byId.get(id);
    if (!existing) return;
    existing.lastSeenAt = lastSeenAt;
  }
}

class MemoryInviteRepository implements InviteRepository {
  private byId = new Map<string, InviteRecord>();
  private byHash = new Map<string, string>();

  async findByTokenHash(tokenHash: string): Promise<InviteRecord | null> {
    const id = this.byHash.get(tokenHash);
    if (!id) return null;
    return clone(this.byId.get(id) ?? null);
  }

  async findUsableByTokenHash(tokenHash: string, nowIso: string): Promise<InviteRecord | null> {
    const inv = await this.findByTokenHash(tokenHash);
    if (!inv) return null;
    if (inv.usedAt) return null;
    if (new Date(inv.expiresAt).getTime() <= new Date(nowIso).getTime()) return null;
    return inv;
  }

  async findUsableByEmail(email: string, nowIso: string): Promise<InviteRecord | null> {
    const key = email.toLowerCase();
    const now = new Date(nowIso).getTime();
    for (const inv of this.byId.values()) {
      if (inv.email.toLowerCase() !== key) continue;
      if (inv.usedAt) continue;
      if (new Date(inv.expiresAt).getTime() <= now) continue;
      return clone(inv);
    }
    return null;
  }

  async create(invite: InviteRecord): Promise<InviteRecord> {
    if (this.byHash.has(invite.tokenHash)) {
      throw new Error('unique_token_hash_violation');
    }
    const record: InviteRecord = { ...invite, email: invite.email.toLowerCase() };
    this.byId.set(record.id, record);
    this.byHash.set(record.tokenHash, record.id);
    return clone(record);
  }

  async markUsed(id: string, userId: string, usedAtIso: string): Promise<void> {
    const existing = this.byId.get(id);
    if (!existing) return;
    existing.usedAt = usedAtIso;
    existing.usedByUserId = userId;
  }
}

class MemoryGameRepository implements GameRepository {
  private byId = new Map<string, CloudGame>();
  private byUser = new Map<string, Set<string>>();

  async listByUserId(userId: string): Promise<CloudGameMeta[]> {
    const ids = Array.from(this.byUser.get(userId) ?? []);
    const games = ids
      .map((id) => this.byId.get(id))
      .filter(Boolean) as CloudGame[];

    games.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
    return clone(
      games.map((g) => ({
        id: g.id,
        userId: g.userId,
        title: g.title,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
    );
  }

  async create(game: CloudGame): Promise<CloudGame> {
    this.byId.set(game.id, clone(game));
    if (!this.byUser.has(game.userId)) this.byUser.set(game.userId, new Set());
    this.byUser.get(game.userId)!.add(game.id);
    return clone(game);
  }

  async findByIdForUser(id: string, userId: string): Promise<CloudGame | null> {
    const game = this.byId.get(id);
    if (!game || game.userId !== userId) return null;
    return clone(game);
  }

  async updateForUser(
    id: string,
    userId: string,
    patch: { title?: string; yaml?: string; updatedAt: string },
  ): Promise<{ updatedAt: string } | null> {
    const existing = this.byId.get(id);
    if (!existing || existing.userId !== userId) return null;
    if (typeof patch.title === 'string') existing.title = patch.title;
    if (typeof patch.yaml === 'string') existing.yaml = patch.yaml;
    existing.updatedAt = patch.updatedAt;
    return { updatedAt: patch.updatedAt };
  }

  async deleteForUser(id: string, userId: string): Promise<boolean> {
    const existing = this.byId.get(id);
    if (!existing || existing.userId !== userId) return false;
    this.byId.delete(id);
    this.byUser.get(userId)?.delete(id);
    return true;
  }
}

export function createMemoryRepositories(): Repositories {
  const users = new MemoryUserRepository();
  return {
    users,
    oauth: new MemoryOAuthRepository(),
    sessions: new MemorySessionRepository(),
    invites: new MemoryInviteRepository(),
    games: new MemoryGameRepository(),
  };
}

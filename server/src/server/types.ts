import type { Settings } from '../settings';
import type { ProjectSpec } from '../../src/model/types';

export type AuthUser = {
  id: string;
  email: string;
};

export type CloudGameMeta = {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type CloudGame = CloudGameMeta & {
  project: ProjectSpec;
};

export type CloudAssetRecord = {
  id: string;
  userId: string;
  bytes: Uint8Array;
  mimeType: string | null;
  originalName: string | null;
  createdAt: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
};

export type OAuthAccountRecord = {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  providerLogin?: string | null;
  accessToken?: string | null;
  createdAt: string;
};

export type InviteRecord = {
  id: string;
  email: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedByUserId: string | null;
};

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string | null;
  createdAt: string;
};

export type UserRepository = {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  create(user: { id: string; email: string; passwordHash: string | null; createdAt: string }): Promise<UserRecord>;
};

export type OAuthRepository = {
  findByProviderAccount(provider: string, providerAccountId: string): Promise<OAuthAccountRecord | null>;
  findByUserIdProvider(userId: string, provider: string): Promise<OAuthAccountRecord | null>;
  create(oauth: OAuthAccountRecord): Promise<OAuthAccountRecord>;
  update(id: string, patch: { providerLogin?: string | null; accessToken?: string | null }): Promise<void>;
  deleteByUserIdProvider(userId: string, provider: string): Promise<void>;
};

export type SessionRepository = {
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  create(session: SessionRecord): Promise<SessionRecord>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  touchLastSeen(id: string, lastSeenAt: string): Promise<void>;
};

export type InviteRepository = {
  findByTokenHash(tokenHash: string): Promise<InviteRecord | null>;
  findUsableByTokenHash(tokenHash: string, nowIso: string): Promise<InviteRecord | null>;
  findUsableByEmail(email: string, nowIso: string): Promise<InviteRecord | null>;
  create(invite: InviteRecord): Promise<InviteRecord>;
  markUsed(id: string, userId: string, usedAtIso: string): Promise<void>;
  deleteUnusedByTokenHash(tokenHash: string): Promise<void>;
  deleteUnusedByEmail(email: string): Promise<number>;
};

export type GameRepository = {
  listByUserId(userId: string): Promise<CloudGameMeta[]>;
  create(game: CloudGame): Promise<CloudGame>;
  findByIdForUser(id: string, userId: string): Promise<CloudGame | null>;
  updateForUser(
    id: string,
    userId: string,
    patch: { title?: string; project?: ProjectSpec; updatedAt: string },
  ): Promise<{ updatedAt: string } | null>;
  deleteForUser(id: string, userId: string): Promise<boolean>;
};

export type AssetRepository = {
  create(asset: CloudAssetRecord): Promise<CloudAssetRecord>;
  findByIdForUser(id: string, userId: string): Promise<CloudAssetRecord | null>;
};

export type Repositories = {
  users: UserRepository;
  oauth: OAuthRepository;
  sessions: SessionRepository;
  invites: InviteRepository;
  games: GameRepository;
  assets: AssetRepository;
};

export type CreateAppOptions = {
  settings: Settings;
  repositories?: Repositories;
};

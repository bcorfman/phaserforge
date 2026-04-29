import type { Response } from 'express';
import { z } from 'zod';

import type { Repositories } from '../types';
import type { Settings } from '../../settings';
import { newId } from '../../security/ids';
import { randomToken, sha256Base64Url } from '../../security/crypto';
import { hashPassword, verifyPassword } from '../../security/passwords';

const Email = z.string().trim().min(3).max(320).email();
const Password = z.string().min(8).max(200);

export const AuthSchemas = {
  signup: z.object({ email: Email, password: Password }),
  login: z.object({ email: Email, password: Password }),
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function setSessionCookie(res: Response, settings: Settings, token: string) {
  res.cookie(settings.cookieName, token, {
    httpOnly: true,
    secure: settings.cookieSecure,
    sameSite: 'lax',
    path: '/',
    ...(settings.cookieDomain ? { domain: settings.cookieDomain } : {}),
  });
}

export function clearSessionCookie(res: Response, settings: Settings) {
  res.clearCookie(settings.cookieName, { path: '/', ...(settings.cookieDomain ? { domain: settings.cookieDomain } : {}) });
}

export async function signupWithPassword(
  settings: Settings,
  repositories: Repositories,
  res: Response,
  input: { email: string; password: string },
) {
  const email = normalizeEmail(input.email);
  const existing = await repositories.users.findByEmail(email);
  if (existing) return { ok: false as const, error: 'email_taken' as const };

  const passwordHash = await hashPassword(input.password);
  const now = new Date().toISOString();
  const userId = newId('user');

  try {
    await repositories.users.create({ id: userId, email, passwordHash, createdAt: now });
  } catch (err) {
    if (err instanceof Error && err.message === 'unique_email_violation') return { ok: false as const, error: 'email_taken' as const };
    throw err;
  }

  await createSession(settings, repositories, res, userId);

  return { ok: true as const, user: { id: userId, email } };
}

export async function loginWithPassword(
  settings: Settings,
  repositories: Repositories,
  res: Response,
  input: { email: string; password: string },
) {
  const email = normalizeEmail(input.email);
  const user = await repositories.users.findByEmail(email);
  if (!user || !user.passwordHash) return { ok: false as const, error: 'invalid_credentials' as const };

  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) return { ok: false as const, error: 'invalid_credentials' as const };

  await createSession(settings, repositories, res, user.id);

  return { ok: true as const, user: { id: user.id, email: user.email } };
}

export async function logout(settings: Settings, repositories: Repositories, reqCookies: any, res: Response) {
  const token = typeof reqCookies?.[settings.cookieName] === 'string' ? reqCookies[settings.cookieName] : undefined;
  if (token) {
    await repositories.sessions.deleteByTokenHash(sha256Base64Url(token));
  }
  clearSessionCookie(res, settings);
  return { ok: true as const };
}

async function createSession(settings: Settings, repositories: Repositories, res: Response, userId: string) {
  const now = new Date().toISOString();
  const sessionToken = randomToken(32);
  const sessionTokenHash = sha256Base64Url(sessionToken);
  const sessionId = newId('sess');
  const expiresAt = new Date(Date.now() + settings.sessionTtlMs).toISOString();
  await repositories.sessions.create({
    id: sessionId,
    userId,
    tokenHash: sessionTokenHash,
    createdAt: now,
    expiresAt,
    lastSeenAt: now,
  });
  setSessionCookie(res, settings, sessionToken);
}

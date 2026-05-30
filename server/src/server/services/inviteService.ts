import type { Repositories } from '../types';
import { sha256Base64Url } from '../../security/crypto';

type Ok<T> = T & { ok: true };
type Err<E extends string> = { ok: false; error: E };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function revokeUnusedInviteByCode(
  repositories: Repositories,
  code: string,
): Promise<Ok<{ revoked: 1 }> | Err<'invalid_code' | 'not_found' | 'already_used'>> {
  const token = code.trim();
  if (token.length < 8) return { ok: false, error: 'invalid_code' };
  const tokenHash = sha256Base64Url(token);
  const invite = await repositories.invites.findByTokenHash(tokenHash);
  if (!invite) return { ok: false, error: 'not_found' };
  if (invite.usedAt) return { ok: false, error: 'already_used' };
  await repositories.invites.deleteUnusedByTokenHash(tokenHash);
  return { ok: true, revoked: 1 };
}

export async function revokeUnusedInvitesByEmail(
  repositories: Repositories,
  email: string,
): Promise<Ok<{ revoked: number }> | Err<'invalid_email'>> {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes('@')) return { ok: false, error: 'invalid_email' };
  const revoked = await repositories.invites.deleteUnusedByEmail(normalized);
  return { ok: true, revoked };
}


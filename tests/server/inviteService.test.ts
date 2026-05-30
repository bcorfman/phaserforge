import { describe, expect, it } from 'vitest';

import { createMemoryRepositories } from '../../server/src/server/repositories/memory';
import { sha256Base64Url } from '../../server/src/security/crypto';
import { revokeUnusedInviteByCode, revokeUnusedInvitesByEmail } from '../../server/src/server/services/inviteService';

describe('inviteService', () => {
  it('revokes an unused invite by code', async () => {
    const repositories = createMemoryRepositories();
    const code = 'inv_tok_123456789';
    const tokenHash = sha256Base64Url(code);
    await repositories.invites.create({
      id: 'inv1',
      email: 'alice@example.com',
      tokenHash,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      usedAt: null,
      usedByUserId: null,
    });

    const res = await revokeUnusedInviteByCode(repositories, code);
    expect(res).toEqual({ ok: true, revoked: 1 });
    const after = await repositories.invites.findByTokenHash(tokenHash);
    expect(after).toBeNull();
  });

  it('does not revoke a used invite by code', async () => {
    const repositories = createMemoryRepositories();
    const code = 'inv_tok_used_123456789';
    const tokenHash = sha256Base64Url(code);
    await repositories.invites.create({
      id: 'inv1',
      email: 'alice@example.com',
      tokenHash,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      usedAt: new Date().toISOString(),
      usedByUserId: 'u1',
    });

    const res = await revokeUnusedInviteByCode(repositories, code);
    expect(res).toEqual({ ok: false, error: 'already_used' });
    const after = await repositories.invites.findByTokenHash(tokenHash);
    expect(after).not.toBeNull();
  });

  it('revokes unused invites by email (case-insensitive) and keeps used invites', async () => {
    const repositories = createMemoryRepositories();
    const now = Date.now();
    await repositories.invites.create({
      id: 'inv1',
      email: 'alice@example.com',
      tokenHash: sha256Base64Url('code1'),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 60_000).toISOString(),
      usedAt: null,
      usedByUserId: null,
    });
    await repositories.invites.create({
      id: 'inv2',
      email: 'ALICE@EXAMPLE.COM',
      tokenHash: sha256Base64Url('code2'),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 60_000).toISOString(),
      usedAt: null,
      usedByUserId: null,
    });
    await repositories.invites.create({
      id: 'inv3',
      email: 'alice@example.com',
      tokenHash: sha256Base64Url('code3'),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 60_000).toISOString(),
      usedAt: new Date(now).toISOString(),
      usedByUserId: 'u1',
    });

    const res = await revokeUnusedInvitesByEmail(repositories, 'Alice@Example.com');
    expect(res).toEqual({ ok: true, revoked: 2 });
    expect(await repositories.invites.findByTokenHash(sha256Base64Url('code1'))).toBeNull();
    expect(await repositories.invites.findByTokenHash(sha256Base64Url('code2'))).toBeNull();
    expect(await repositories.invites.findByTokenHash(sha256Base64Url('code3'))).not.toBeNull();
  });
});


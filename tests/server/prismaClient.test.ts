import { describe, expect, it, vi } from 'vitest';

vi.mock('@prisma/adapter-pg', () => {
  const PrismaPg = vi.fn(function PrismaPg(this: any, options: unknown) {
    this.kind = 'PrismaPg';
    this.options = options;
  });
  return {
    PrismaPg,
  };
});

vi.mock('@prisma/client', () => {
  const PrismaClient = vi.fn(function PrismaClient(this: any, options: unknown) {
    this.kind = 'PrismaClient';
    this.options = options;
  });
  return {
    PrismaClient,
  };
});

describe('createPrismaClient', () => {
  it('returns null when DATABASE_URL is missing', async () => {
    const { createPrismaClient } = await import('../../server/src/db/prismaClient');
    expect(createPrismaClient(undefined)).toBeNull();
  });

  it('creates PrismaClient with PrismaPg adapter when DATABASE_URL is provided', async () => {
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const { PrismaClient } = await import('@prisma/client');
    const { createPrismaClient } = await import('../../server/src/db/prismaClient');

    const databaseUrl = 'postgresql://user:pass@localhost:5432/db';
    const prisma = createPrismaClient(databaseUrl);

    expect(prisma).not.toBeNull();
    expect(PrismaPg).toHaveBeenCalledWith({ connectionString: databaseUrl });
    expect(PrismaClient).toHaveBeenCalledWith({
      adapter: expect.objectContaining({ kind: 'PrismaPg' }),
    });
  });
});

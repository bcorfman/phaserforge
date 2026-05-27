import { createPrismaClient } from '../server/src/db/prismaClient';
import { loadSettingsFromEnv } from '../server/src/settings';
import { randomToken, sha256Base64Url } from '../server/src/security/crypto';
import { newId } from '../server/src/security/ids';
import { createPrismaRepositories } from '../server/src/server/repositories/prisma';

function usage() {
  // eslint-disable-next-line no-console
  console.log('Usage: node --import tsx scripts/create-invite.ts <email>');
}

async function main() {
  const email = process.argv[2]?.trim();
  if (!email) {
    usage();
    process.exitCode = 2;
    return;
  }

  const settings = loadSettingsFromEnv(process.env);
  const prisma = createPrismaClient(process.env.DATABASE_URL);
  if (!prisma) {
    // eslint-disable-next-line no-console
    console.error('DATABASE_URL is required to create invites.');
    process.exitCode = 2;
    return;
  }

  const repositories = createPrismaRepositories(prisma);
  const token = randomToken(32);
  const tokenHash = sha256Base64Url(token);
  const now = Date.now();
  const expiresAt = new Date(now + settings.inviteTtlMs).toISOString();

  await repositories.invites.create({
    id: newId('inv'),
    email,
    tokenHash,
    createdAt: new Date(now).toISOString(),
    expiresAt,
    usedAt: null,
    usedByUserId: null,
  });

  // eslint-disable-next-line no-console
  console.log(`Invite created for ${email}`);
  // eslint-disable-next-line no-console
  console.log(`Invite code: ${token}`);
  if (settings.frontendBaseUrl) {
    // eslint-disable-next-line no-console
    console.log(`Frontend: ${settings.frontendBaseUrl}`);
  }

  await prisma.$disconnect();
}

void main();

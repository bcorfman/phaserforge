import { createPrismaClient } from '../server/src/db/prismaClient';
import { loadSettingsFromEnv } from '../server/src/settings';
import { createPrismaRepositories } from '../server/src/server/repositories/prisma';
import { revokeUnusedInviteByCode, revokeUnusedInvitesByEmail } from '../server/src/server/services/inviteService';

function usage() {
  // eslint-disable-next-line no-console
  console.log('Usage: node --import tsx scripts/revoke-invite.ts --code <inviteCode>');
  // eslint-disable-next-line no-console
  console.log('   or: node --import tsx scripts/revoke-invite.ts --email <email>');
}

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1]?.trim();
}

async function main() {
  const code = readArg('--code');
  const email = readArg('--email');
  if (!code && !email) {
    usage();
    process.exitCode = 2;
    return;
  }
  if (code && email) {
    // eslint-disable-next-line no-console
    console.error('Provide either --code or --email (not both).');
    process.exitCode = 2;
    return;
  }

  // Load TTL/env validation parity with create-invite (and future settings).
  loadSettingsFromEnv(process.env);

  const prisma = createPrismaClient(process.env.DATABASE_URL);
  if (!prisma) {
    // eslint-disable-next-line no-console
    console.error('DATABASE_URL is required to revoke invites.');
    process.exitCode = 2;
    return;
  }

  const repositories = createPrismaRepositories(prisma);
  try {
    if (code) {
      const res = await revokeUnusedInviteByCode(repositories, code);
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error(`Failed to revoke invite: ${res.error}`);
        process.exitCode = 1;
        return;
      }
      // eslint-disable-next-line no-console
      console.log('Invite revoked.');
      return;
    }

    const res = await revokeUnusedInvitesByEmail(repositories, email!);
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(`Failed to revoke invites: ${res.error}`);
      process.exitCode = 1;
      return;
    }
    // eslint-disable-next-line no-console
    console.log(`Revoked ${res.revoked} unused invite(s) for ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();


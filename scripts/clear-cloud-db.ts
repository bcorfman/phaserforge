import { createPrismaClient } from '../server/src/db/prismaClient';

type ClearScope = 'content' | 'all';

function usage() {
  // eslint-disable-next-line no-console
  console.log('Usage: node --import tsx scripts/clear-cloud-db.ts --confirm [--all]');
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('Clears cloud database rows only.');
  // eslint-disable-next-line no-console
  console.log('Defaults to clearing cloud project content only: Game + CloudAsset.');
  // eslint-disable-next-line no-console
  console.log('Pass --all to also clear auth/session/invite/user rows.');
  // eslint-disable-next-line no-console
  console.log('Does not delete bundled repo assets such as assets/demo-pack/.');
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function clearContent(prisma: NonNullable<ReturnType<typeof createPrismaClient>>) {
  const [deletedCloudAssets, deletedGames] = await Promise.all([
    prisma.cloudAsset.count(),
    prisma.game.count(),
  ]);

  await prisma.$executeRawUnsafe('TRUNCATE TABLE "CloudAsset", "Game" CASCADE');

  return {
    deletedCloudAssets,
    deletedGames,
  };
}

async function clearAll(prisma: NonNullable<ReturnType<typeof createPrismaClient>>) {
  const [
    deletedCloudAssets,
    deletedGames,
    deletedSessions,
    deletedOauthAccounts,
    deletedInvites,
    deletedUsers,
  ] = await Promise.all([
    prisma.cloudAsset.count(),
    prisma.game.count(),
    prisma.session.count(),
    prisma.oAuthAccount.count(),
    prisma.invite.count(),
    prisma.user.count(),
  ]);

  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "CloudAsset", "Game", "Session", "OAuthAccount", "Invite", "User" CASCADE',
  );

  return {
    deletedCloudAssets,
    deletedGames,
    deletedSessions,
    deletedOauthAccounts,
    deletedInvites,
    deletedUsers,
  };
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage();
    return;
  }

  if (!hasFlag('--confirm')) {
    usage();
    // eslint-disable-next-line no-console
    console.error('Refusing to clear the cloud DB without --confirm.');
    process.exitCode = 2;
    return;
  }

  const prisma = createPrismaClient(process.env.DATABASE_URL);
  if (!prisma) {
    // eslint-disable-next-line no-console
    console.error('DATABASE_URL is required to clear the cloud DB.');
    process.exitCode = 2;
    return;
  }

  const scope: ClearScope = hasFlag('--all') ? 'all' : 'content';

  try {
    const summary = scope === 'all'
      ? await clearAll(prisma)
      : await clearContent(prisma);

    // eslint-disable-next-line no-console
    console.log(`Cleared cloud DB scope: ${scope}`);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main();

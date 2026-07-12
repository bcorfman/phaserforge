import { createPrismaClient } from '../server/src/db/prismaClient';

type ClearScope = 'content' | 'all';
type PrismaClient = NonNullable<ReturnType<typeof createPrismaClient>>;

type StorageDiagnostic = {
  tableName: string;
  totalSize: string;
};

type CloudAssetStorageDiagnostic = {
  rows: number;
  totalBytes: string;
  maxAssetBytes: string;
};

type ClearDbDiagnostics = {
  databaseSize: string;
  largestTables: StorageDiagnostic[];
  cloudAsset?: CloudAssetStorageDiagnostic;
};

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

export function getDriverErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const meta = 'meta' in error ? error.meta : undefined;
  if (!meta || typeof meta !== 'object') return undefined;

  const driverAdapterError =
    'driverAdapterError' in meta ? meta.driverAdapterError : undefined;
  if (!driverAdapterError || typeof driverAdapterError !== 'object') return undefined;

  const cause = 'cause' in driverAdapterError ? driverAdapterError.cause : undefined;
  if (!cause || typeof cause !== 'object') return undefined;

  return 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined;
}

export function isPostgresOutOfSpaceError(error: unknown): boolean {
  return getDriverErrorCode(error) === '53100';
}

async function clearContent(prisma: PrismaClient) {
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

async function clearAll(prisma: PrismaClient) {
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

async function getClearDbDiagnostics(prisma: PrismaClient): Promise<ClearDbDiagnostics> {
  const databaseSizeRows = await prisma.$queryRawUnsafe<Array<{ size: string }>>(
    'SELECT pg_size_pretty(pg_database_size(current_database())) AS size',
  );

  const largestTables = await prisma.$queryRawUnsafe<Array<{ tableName: string; totalSize: string }>>(
    `
      SELECT
        format('%I.%I', schemaname, relname) AS "tableName",
        pg_size_pretty(pg_total_relation_size(format('%I.%I', schemaname, relname)::regclass)) AS "totalSize"
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(format('%I.%I', schemaname, relname)::regclass) DESC
      LIMIT 5
    `,
  );

  let cloudAsset: CloudAssetStorageDiagnostic | undefined;
  try {
    const cloudAssetRows = await prisma.$queryRawUnsafe<
      Array<{ rows: bigint | number; totalBytes: string; maxAssetBytes: string }>
    >(
      `
        SELECT
          COUNT(*) AS rows,
          pg_size_pretty(COALESCE(SUM(octet_length(bytes)), 0)::bigint) AS "totalBytes",
          pg_size_pretty(COALESCE(MAX(octet_length(bytes)), 0)::bigint) AS "maxAssetBytes"
        FROM "CloudAsset"
      `,
    );
    const summary = cloudAssetRows[0];
    if (summary) {
      cloudAsset = {
        rows: Number(summary.rows),
        totalBytes: summary.totalBytes,
        maxAssetBytes: summary.maxAssetBytes,
      };
    }
  } catch {
    cloudAsset = undefined;
  }

  return {
    databaseSize: databaseSizeRows[0]?.size ?? 'unknown',
    largestTables,
    cloudAsset,
  };
}

export function formatClearDbDiagnostics(scope: ClearScope, diagnostics: ClearDbDiagnostics): string {
  const lines = [
    `Cloud DB clear failed for scope "${scope}": PostgreSQL reported SQLSTATE 53100 (no space left on device).`,
    'This usually means the remote Postgres volume is full, so even TRUNCATE cannot finish its file/WAL work.',
    `Current database size: ${diagnostics.databaseSize}`,
  ];

  if (diagnostics.largestTables.length > 0) {
    lines.push('Largest tables:');
    for (const table of diagnostics.largestTables) {
      lines.push(`- ${table.tableName}: ${table.totalSize}`);
    }
  }

  if (diagnostics.cloudAsset) {
    lines.push(
      `CloudAsset payloads: ${diagnostics.cloudAsset.rows} rows, ${diagnostics.cloudAsset.totalBytes} logical bytes, max asset ${diagnostics.cloudAsset.maxAssetBytes}.`,
    );
  }

  lines.push(
    'Next steps: increase/reset the Railway Postgres storage volume or recreate the database, then rerun this script.',
  );

  return lines.join('\n');
}

export async function main() {
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
  } catch (error) {
    if (isPostgresOutOfSpaceError(error)) {
      const diagnostics = await getClearDbDiagnostics(prisma).catch(() => null);
      // eslint-disable-next-line no-console
      console.error(
        diagnostics
          ? formatClearDbDiagnostics(scope, diagnostics)
          : `Cloud DB clear failed for scope "${scope}": PostgreSQL reported SQLSTATE 53100 (no space left on device). Increase/reset the Railway Postgres storage volume or recreate the database, then rerun this script.`,
      );
      process.exitCode = 1;
      return;
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.main) {
  void main();
}

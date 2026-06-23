import { createPrismaClient } from '../server/src/db/prismaClient';
import { convertLegacyCloudGameYamlToProject } from '../server/src/server/services/gameMigrationService';

type CloudGameRow = {
  id: string;
  title: string;
  yaml: string;
  project: unknown;
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const verifyOnly = process.argv.includes('--verify-only');
  const prisma = createPrismaClient(databaseUrl);
  if (!prisma) {
    throw new Error('Unable to create Prisma client');
  }

  try {
    const rows = await (prisma as any).game.findMany({
      select: { id: true, title: true, yaml: true, project: true },
      orderBy: { updatedAt: 'asc' },
    }) as CloudGameRow[];

    const unmigrated = rows.filter((row) => row.project == null);
    const failures: Array<{ id: string; title: string; error: string }> = [];

    for (const row of unmigrated) {
      try {
        const converted = convertLegacyCloudGameYamlToProject(row.yaml);
        if (!verifyOnly) {
          await (prisma as any).game.update({
            where: { id: row.id },
            data: {
              project: converted.project,
            },
          });
        }
      } catch (error) {
        failures.push({
          id: row.id,
          title: row.title,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const migratedCount = unmigrated.length - failures.length;
    const summary = {
      mode: verifyOnly ? 'verify-only' : 'migrate',
      totalRows: rows.length,
      alreadyStructured: rows.length - unmigrated.length,
      checkedLegacyRows: unmigrated.length,
      migratedCount,
      failureCount: failures.length,
      failures,
    };

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(summary, null, 2));

    if (failures.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});

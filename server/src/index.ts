import { createApp } from './server/app';
import { loadSettingsFromEnv } from './settings';
import { createPrismaRepositories } from './server/repositories/prisma';
import { createPrismaClient } from './db/prismaClient';

const port = Number(process.env.PORT ?? 8787);
const settings = loadSettingsFromEnv(process.env);

async function ensureStructuredCloudGamesReady(prisma: ReturnType<typeof createPrismaClient>): Promise<void> {
  if (!prisma) return;
  const unmigratedCount = await (prisma as any).game.count({
    where: { project: null },
  });
  if (unmigratedCount > 0) {
    throw new Error(`cloud_game_project_migration_required:${unmigratedCount}`);
  }
}

async function bootstrap() {
  const databaseUrl = process.env.DATABASE_URL;
  const prisma = createPrismaClient(databaseUrl);
  await ensureStructuredCloudGamesReady(prisma);
  const repositories = prisma ? createPrismaRepositories(prisma) : undefined;
  const app = createApp({ settings, ...(repositories ? { repositories } : {}) });

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`phaserforge api listening on http://localhost:${port}`);
  });

  process.on('SIGTERM', () => {
    void prisma?.$disconnect();
  });
}

void bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});

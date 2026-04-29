import { createApp } from './server/app';
import { loadSettingsFromEnv } from './settings';
import { createPrismaRepositories } from './server/repositories/prisma';
import { PrismaClient } from '@prisma/client';

const port = Number(process.env.PORT ?? 8787);
const settings = loadSettingsFromEnv(process.env);

const databaseUrl = process.env.DATABASE_URL;
const prisma = databaseUrl ? new PrismaClient({ datasources: { db: { url: databaseUrl } } }) : null;
const repositories = prisma ? createPrismaRepositories(prisma) : undefined;

const app = createApp({ settings, ...(repositories ? { repositories } : {}) });

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`phaseractions api listening on http://localhost:${port}`);
});

process.on('SIGTERM', () => {
  void prisma?.$disconnect();
});

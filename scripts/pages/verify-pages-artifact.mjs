import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function assertFile(filePath, label) {
  if (!(await exists(filePath))) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
}

export async function verifyPagesArtifact(distDir = path.join(repoRoot, 'dist')) {
  await assertFile(path.join(distDir, 'stable', 'index.html'), 'stable editor index');
  await assertFile(path.join(distDir, 'dev', 'index.html'), 'dev editor index');
  await assertFile(path.join(distDir, 'index.html'), 'root index');

  const rootHtml = await readFile(path.join(distDir, 'index.html'), 'utf8');
  if (/<script\b[^>]*\btype=["']module["']/i.test(rootHtml)) {
    throw new Error('Root index must not include an editor module script');
  }
  if (/\.\/assets\/|\/assets\//i.test(rootHtml)) {
    throw new Error('Root index must not reference editor assets');
  }

  const rootEntries = await readdir(distDir);
  if (rootEntries.includes('assets')) {
    throw new Error('Root dist/assets exists; editor assets must live under channel directories');
  }

  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await verifyPagesArtifact(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
}

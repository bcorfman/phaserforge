import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const docsDist = path.join(repoRoot, 'docs', '.vitepress', 'dist');
const pagesDocsDist = path.join(repoRoot, 'dist', 'docs');

await rm(pagesDocsDist, { recursive: true, force: true });
await mkdir(path.dirname(pagesDocsDist), { recursive: true });
await cp(docsDist, pagesDocsDist, { recursive: true });

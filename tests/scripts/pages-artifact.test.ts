import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildRootIndexHtml } from '../../scripts/pages/create-root-index.mjs';
import { verifyPagesArtifact } from '../../scripts/pages/verify-pages-artifact.mjs';

describe('Pages artifact helpers', () => {
  async function makeDist() {
    const dist = await mkdtemp(path.join(os.tmpdir(), 'phaserforge-pages-artifact-'));
    await mkdir(path.join(dist, 'stable'), { recursive: true });
    await mkdir(path.join(dist, 'dev'), { recursive: true });
    await writeFile(path.join(dist, 'stable', 'index.html'), '<script type="module" src="./assets/app.js"></script>', 'utf8');
    await writeFile(path.join(dist, 'dev', 'index.html'), '<script type="module" src="./assets/app.js"></script>', 'utf8');
    await writeFile(path.join(dist, 'index.html'), buildRootIndexHtml(), 'utf8');
    return dist;
  }

  it('builds a root redirect without editor entrypoints', () => {
    const html = buildRootIndexHtml();

    expect(html).toContain('url=./stable/');
    expect(html).not.toMatch(/type="module"/);
    expect(html).not.toContain('./assets/');
  });

  it('accepts channel-only editor bundles', async () => {
    await expect(verifyPagesArtifact(await makeDist())).resolves.toBe(true);
  });

  it('rejects editor assets at the Pages root', async () => {
    const dist = await makeDist();
    await mkdir(path.join(dist, 'assets'));

    await expect(verifyPagesArtifact(dist)).rejects.toThrow('Root dist/assets exists');
  });
});

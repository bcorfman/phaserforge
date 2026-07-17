import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');

export function buildRootIndexHtml({ target = './stable/' } = {}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=${target}" />
    <title>PhaserForge</title>
  </head>
  <body>
    <p><a href="${target}">Open PhaserForge stable</a></p>
  </body>
</html>
`;
}

export async function writeRootIndex({ distDir = path.join(repoRoot, 'dist'), target = './stable/' } = {}) {
  await mkdir(distDir, { recursive: true });
  await writeFile(path.join(distDir, 'index.html'), buildRootIndexHtml({ target }), 'utf8');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await writeRootIndex();
}

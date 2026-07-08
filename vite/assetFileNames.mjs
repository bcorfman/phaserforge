import path from 'node:path';

export function sanitizeAssetStem(fileName = 'asset') {
  const ext = path.extname(fileName);
  const stem = path.basename(fileName, ext);
  return stem
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '') || 'asset';
}

export function buildAssetFileName(assetInfo = {}) {
  const name = Array.isArray(assetInfo.names) ? assetInfo.names[0] : assetInfo.name;
  const sanitized = sanitizeAssetStem(name ?? 'asset');
  return `assets/${sanitized}-[hash][extname]`;
}

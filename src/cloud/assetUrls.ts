import type { AssetFileSource } from '../model/types';
import { resolveProjectAssetPathToUrl } from '../assets/projectAssetPaths';
import { resolveApiUrl } from './api';

const cloudAssetUrlCache = new Map<string, Promise<string | null>>();

function cloudAssetContentUrl(assetId: string): string {
  return resolveApiUrl(`/api/v1/assets/${encodeURIComponent(assetId)}/content`);
}

export function assetSourceKey(source: AssetFileSource): string {
  switch (source.kind) {
    case 'embedded':
      return `embedded:${source.originalName ?? ''}:${source.mimeType ?? ''}:${source.dataUrl.length}`;
    case 'path':
      return `path:${source.path}:${source.originalName ?? ''}:${source.mimeType ?? ''}`;
    case 'cloud':
      return `cloud:${source.assetId}:${source.originalName ?? ''}:${source.mimeType ?? ''}`;
  }
}

export function inlinePreviewUrlForAssetSource(source: AssetFileSource): string {
  if (source.kind === 'embedded') return source.dataUrl;
  if (source.kind === 'path') return resolveProjectAssetPathToUrl(source.path);
  return '';
}

export async function resolveAssetSourceUrl(source: AssetFileSource): Promise<string | null> {
  if (source.kind === 'embedded') return source.dataUrl;
  if (source.kind === 'path') return resolveProjectAssetPathToUrl(source.path);

  let pending = cloudAssetUrlCache.get(source.assetId);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(cloudAssetContentUrl(source.assetId), { credentials: 'include' });
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    })();
    cloudAssetUrlCache.set(source.assetId, pending);
  }
  return pending;
}

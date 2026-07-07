import type { AssetFileSource } from '../model/types';
import { resolveProjectAssetPathToUrl } from '../assets/projectAssetPaths';
import { resolveApiUrl } from './api';

const cloudAssetUrlCache = new Map<string, Promise<string | null>>();
const pathAudioUrlCache = new Map<string, Promise<string>>();

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
  if (source.kind === 'path') {
    const directUrl = resolveProjectAssetPathToUrl(source.path);
    if (!source.mimeType?.startsWith('audio/')) return directUrl;

    let pending = pathAudioUrlCache.get(source.path);
    if (!pending) {
      pending = (async () => {
        try {
          const res = await fetch(directUrl, { cache: 'force-cache' });
          if (!res.ok) return directUrl;
          const blob = await res.blob();
          return URL.createObjectURL(blob);
        } catch {
          return directUrl;
        }
      })();
      pathAudioUrlCache.set(source.path, pending);
    }
    return pending;
  }

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

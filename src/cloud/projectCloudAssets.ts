import type { AssetFileSource, ProjectSpec } from '../model/types';
import { resolveProjectAssetPathToUrl } from '../assets/projectAssetPaths';

type CloudAssetSource = Extract<AssetFileSource, { kind: 'cloud' }>;
type EmbeddedAssetSource = Extract<AssetFileSource, { kind: 'embedded' }>;

async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader === 'function') {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read asset blob'));
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsDataURL(blob);
    });
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const base64 = Buffer.from(bytes).toString('base64');
  return `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
}

export async function prepareProjectForCloudSave(
  project: ProjectSpec,
  upload: (source: EmbeddedAssetSource) => Promise<CloudAssetSource>,
  cache: Map<string, CloudAssetSource> = new Map(),
): Promise<ProjectSpec> {
  const nextProject = structuredClone(project);

  const ensureCloudSource = async (source: AssetFileSource): Promise<AssetFileSource> => {
    if (source.kind === 'cloud') return source;

    const cacheKey = source.kind === 'path' ? source.path : source.dataUrl;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const embeddedSource = source.kind === 'embedded'
      ? source
      : await (async (): Promise<EmbeddedAssetSource> => {
        const res = await fetch(resolveProjectAssetPathToUrl(source.path));
        if (!res.ok) throw new Error(`Failed to load local asset at ${source.path}`);
        const blob = await res.blob();
        return {
          kind: 'embedded',
          dataUrl: await blobToDataUrl(blob),
          ...(source.originalName ? { originalName: source.originalName } : {}),
          mimeType: source.mimeType || blob.type || undefined,
        };
      })();

    const uploaded = await upload(embeddedSource);
    cache.set(cacheKey, uploaded);
    return uploaded;
  };

  for (const asset of Object.values(nextProject.assets.images ?? {})) {
    asset.source = await ensureCloudSource(asset.source);
  }
  for (const asset of Object.values(nextProject.assets.spriteSheets ?? {})) {
    asset.source = await ensureCloudSource(asset.source);
  }
  for (const asset of Object.values(nextProject.assets.fonts ?? {})) {
    asset.source = await ensureCloudSource(asset.source);
  }
  for (const asset of Object.values(nextProject.audio.sounds ?? {})) {
    asset.source = await ensureCloudSource(asset.source);
  }

  return nextProject;
}

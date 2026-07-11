import type { AssetFileSource, ProjectSpec } from '../model/types';
type CloudAssetSource = Extract<AssetFileSource, { kind: 'cloud' }>;
type EmbeddedAssetSource = Extract<AssetFileSource, { kind: 'embedded' }>;

export async function prepareProjectForCloudSave(
  project: ProjectSpec,
  upload: (source: EmbeddedAssetSource) => Promise<CloudAssetSource>,
  cache: Map<string, CloudAssetSource> = new Map(),
): Promise<ProjectSpec> {
  const nextProject = structuredClone(project);

  const ensureCloudSource = async (source: AssetFileSource): Promise<AssetFileSource> => {
    if (source.kind === 'cloud') return source;
    if (source.kind === 'path') return source;

    const cacheKey = source.dataUrl;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const uploaded = await upload(source);
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

import type { AssetFileSource, FontAssetSpec } from '../model/types';
import { resolveAssetSourceUrl } from '../cloud/assetUrls';

async function toFontFaceSourceUrl(source: AssetFileSource): Promise<string | null> {
  return resolveAssetSourceUrl(source);
}

export async function loadProjectFonts(fonts: Record<string, FontAssetSpec> | undefined): Promise<void> {
  if (typeof document === 'undefined' || !(document as any).fonts) return;
  if (typeof (globalThis as any).FontFace !== 'function') return;
  const entries = Object.values(fonts ?? {});
  if (entries.length === 0) return;

  for (const font of entries) {
    const family = (font.name ?? font.id ?? '').trim();
    if (!family) continue;
    const url = await toFontFaceSourceUrl(font.source);
    if (!url) continue;
    try {
      const face = new (globalThis as any).FontFace(family, `url(${url})`);
      await face.load().catch(() => null);
      try {
        (document as any).fonts.add(face);
      } catch {
        // ignore
      }
    } catch {
      // non-blocking
      // eslint-disable-next-line no-console
      console.warn(`Failed to load font "${family}"`);
    }
  }
}

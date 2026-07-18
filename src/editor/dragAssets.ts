import type { Id } from '../model/types';
import type { AssetKind } from './assetReferences';

export const ASSET_DRAG_MIME = 'application/x-phaserforge-asset';

export function hasDraggedAsset(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;
  const types = Array.from(dataTransfer.types ?? []);
  if (types.includes(ASSET_DRAG_MIME)) return true;
  // Fallback for browsers/contexts that don't preserve custom MIME types in HTML5 drag/drop.
  const text = dataTransfer.getData?.('text/plain');
  return typeof text === 'string' && /^(image|spritesheet|audio|font):.+$/.test(text);
}

export function readDraggedAsset(dataTransfer: DataTransfer | null): { assetKind: AssetKind; assetId: Id } | null {
  if (!dataTransfer) return null;
  const parse = (assetKind: unknown, assetId: unknown): { assetKind: AssetKind; assetId: Id } | null => {
    if ((assetKind === 'image' || assetKind === 'spritesheet' || assetKind === 'audio' || assetKind === 'font') && typeof assetId === 'string' && assetId.length > 0) {
      return { assetKind: assetKind as AssetKind, assetId };
    }
    return null;
  };

  const raw = dataTransfer.getData?.(ASSET_DRAG_MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as any;
      return parse(parsed?.assetKind, parsed?.assetId);
    } catch {
      // ignore; fall back to text/plain parsing below
    }
  }

  const text = dataTransfer.getData?.('text/plain');
  if (!text) return null;
  const match = String(text).match(/^(image|spritesheet|audio|font):(.+)$/);
  if (!match) return null;
  return parse(match[1], match[2]);
}

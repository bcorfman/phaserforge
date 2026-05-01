import type { Id } from '../model/types';
import type { AssetKind } from './assetReferences';

export const ASSET_DRAG_MIME = 'application/x-phaseractions-studio-asset';

export function hasDraggedAsset(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;
  const types = Array.from(dataTransfer.types ?? []);
  return types.includes(ASSET_DRAG_MIME);
}

export function readDraggedAsset(dataTransfer: DataTransfer | null): { assetKind: AssetKind; assetId: Id } | null {
  if (!dataTransfer) return null;
  const raw = dataTransfer.getData(ASSET_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as any;
    const assetKind = parsed?.assetKind;
    const assetId = parsed?.assetId;
    if ((assetKind === 'image' || assetKind === 'spritesheet' || assetKind === 'audio' || assetKind === 'font') && typeof assetId === 'string' && assetId.length > 0) {
      return { assetKind, assetId };
    }
    return null;
  } catch {
    return null;
  }
}

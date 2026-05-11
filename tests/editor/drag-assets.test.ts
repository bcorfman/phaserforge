import { describe, expect, test } from 'vitest';
import { ASSET_DRAG_MIME, hasDraggedAsset, readDraggedAsset } from '../../src/editor/dragAssets';

type MockDataTransfer = {
  types?: string[];
  getData: (type: string) => string;
};

function dt(init: { types?: string[]; data?: Record<string, string> }): MockDataTransfer {
  const data = init.data ?? {};
  return {
    types: init.types,
    getData: (type) => data[type] ?? '',
  };
}

describe('dragAssets', () => {
  test('hasDraggedAsset detects the studio MIME type', () => {
    expect(hasDraggedAsset(dt({ types: [ASSET_DRAG_MIME] }) as any)).toBe(true);
    expect(hasDraggedAsset(dt({ types: ['text/plain'] }) as any)).toBe(false);
  });

  test('readDraggedAsset reads from the studio MIME payload', () => {
    const payload = JSON.stringify({ assetKind: 'image', assetId: 'meteor-large' });
    const result = readDraggedAsset(dt({ types: [ASSET_DRAG_MIME], data: { [ASSET_DRAG_MIME]: payload } }) as any);
    expect(result).toEqual({ assetKind: 'image', assetId: 'meteor-large' });
  });

  test('hasDraggedAsset falls back to text/plain when present', () => {
    expect(hasDraggedAsset(dt({ types: ['text/plain'], data: { 'text/plain': 'image:meteor-large' } }) as any)).toBe(true);
    expect(hasDraggedAsset(dt({ types: ['text/plain'], data: { 'text/plain': 'not-an-asset' } }) as any)).toBe(false);
  });

  test('readDraggedAsset falls back to parsing text/plain', () => {
    const result = readDraggedAsset(dt({ types: ['text/plain'], data: { 'text/plain': 'image:meteor-large' } }) as any);
    expect(result).toEqual({ assetKind: 'image', assetId: 'meteor-large' });
  });

  test('readDraggedAsset rejects invalid payloads', () => {
    expect(readDraggedAsset(dt({ types: [ASSET_DRAG_MIME], data: { [ASSET_DRAG_MIME]: 'not json' } }) as any)).toBe(null);
    expect(readDraggedAsset(dt({ types: ['text/plain'], data: { 'text/plain': 'image:' } }) as any)).toBe(null);
    expect(readDraggedAsset(dt({ types: ['text/plain'], data: { 'text/plain': ':meteor-large' } }) as any)).toBe(null);
  });
});


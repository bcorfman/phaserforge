import { describe, expect, it } from 'vitest';
import { initState, reducer } from '../../src/editor/EditorStore';
import { resolveTextFontFamily } from '../../src/editor/textEntity';

function sceneOf(state: any) {
  return state.project.scenes[state.currentSceneId];
}

describe('text entities', () => {
  it('resolves font family with override precedence', () => {
    const state = initState();
    const project = {
      ...state.project,
      assets: {
        ...state.project.assets,
        fonts: {
          f1: { id: 'f1', source: { kind: 'embedded', dataUrl: 'data:font/woff2;base64,AAAA', originalName: 'MyFont.woff2', mimeType: 'font/woff2' }, name: 'MyFont' },
        },
      },
    };

    expect(resolveTextFontFamily(project as any, { value: 'x', fontFamily: 'Inter' } as any)).toBe('Inter');
    expect(resolveTextFontFamily(project as any, { value: 'x', fontAssetId: 'f1' } as any)).toBe('MyFont');
    expect(resolveTextFontFamily(project as any, { value: 'x', fontAssetId: 'missing' } as any)).toBe('missing');
  });

  it('creates a text entity and auto-sizes on edits', () => {
    const state = initState();
    const created = reducer(state as any, { type: 'create-text-entity' } as any);
    expect(created.selection.kind).toBe('entity');
    const id = (created.selection as any).id as string;
    const entity = sceneOf(created).entities[id];
    expect(entity).toBeTruthy();
    expect(entity.text).toBeTruthy();
    expect(entity.asset).toBeUndefined();
    expect(entity.width).toBeGreaterThan(0);
    expect(entity.height).toBeGreaterThan(0);

    const longer = reducer(created as any, {
      type: 'update-entity',
      id,
      next: { ...entity, text: { ...entity.text, value: 'A much longer line of text' } },
    } as any);
    const nextEntity = sceneOf(longer).entities[id];
    expect(nextEntity.width).toBeGreaterThanOrEqual(entity.width);
  });
});

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderAttachmentInspector } from '../../src/editor/Inspector';
import { baseScene } from '../helpers';

function baseProject(): any {
  return {
    id: 'p1',
    assets: { images: {}, spriteSheets: {}, fonts: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: {},
    initialSceneId: 'scene-1',
    counters: {},
    collections: {},
  };
}

describe('Attachment inspector Set Property', () => {
  it('renders property, value-source, random range, and seed controls', () => {
    const markup = renderToStaticMarkup(
      renderAttachmentInspector(
        {
          id: 'att-1',
          target: { type: 'entity', entityId: 'e1' },
          presetId: 'SetProperty',
          enabled: true,
          order: 0,
          params: { property: 'x', valueSource: { kind: 'randomRange', min: 0, max: 720, seed: 'wrap' } },
        } as any,
        baseProject(),
        baseScene(),
        {
          arrange: [],
          conditions: [],
          actions: [
            { type: 'SetProperty', displayName: 'Set Property', category: 'state', implemented: true },
          ],
        } as any,
        () => {},
        () => {}
      )
    );

    expect(markup).toContain('Set Property');
    expect(markup).toContain('data-testid="attachment-setproperty-property-select"');
    expect(markup).toContain('data-testid="attachment-setproperty-value-source-select"');
    expect(markup).toContain('data-testid="attachment-setproperty-random-min"');
    expect(markup).toContain('data-testid="attachment-setproperty-random-max"');
    expect(markup).toContain('data-testid="attachment-setproperty-seed"');
    expect(markup).toMatch(/<div class="inspector-grid-2">[\s\S]*attachment-setproperty-random-min[\s\S]*attachment-setproperty-random-max[\s\S]*<\/div>/);
  });
});

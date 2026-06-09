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

describe('Attachment inspector action type labels', () => {
  it('omits the \"Pattern\" suffix in the action type select', () => {
    const scene = baseScene();
    const project = baseProject();
    const attachment: any = {
      id: 'att-1',
      target: { type: 'entity', entityId: 'e1' },
      presetId: 'WavePattern',
      enabled: true,
      order: 0,
      params: {},
    };

    const markup = renderToStaticMarkup(
      renderAttachmentInspector(
        attachment,
        project,
        scene,
        {
          arrange: [],
          conditions: [],
          actions: [
            { type: 'WavePattern', displayName: 'Wave Pattern', category: 'movement', implemented: true },
            { type: 'Wait', displayName: 'Wait', category: 'core', implemented: true },
          ],
        } as any,
        () => {},
        () => {}
      )
    );

    expect(markup).toContain('data-testid="attachment-type-select"');
    expect(markup).toContain('<option value="WavePattern" selected="">Wave</option>');
    expect(markup).not.toContain('<option value="WavePattern" selected="">Wave Pattern</option>');
  });
});

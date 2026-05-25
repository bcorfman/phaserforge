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

describe('Attachment inspector Repeat', () => {
  it('explains that blank Count means infinite', () => {
    const scene = baseScene();
    const project = baseProject();
    const attachment: any = {
      id: 'att-repeat',
      target: { type: 'entity', entityId: 'e1' },
      presetId: 'Repeat',
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
          actions: [{ type: 'Repeat', displayName: 'Repeat', category: 'flow', implemented: true }],
        } as any,
        () => {},
        () => {}
      )
    );

    expect(markup).toContain('data-testid="attachment-repeat-count-hint"');
    expect(markup).toContain('Leave blank for an infinite loop');
  });
});


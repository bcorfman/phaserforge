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

describe('Attachment inspector Until → Bounds Hit', () => {
  it('renders bounds rectangle controls for ZigzagPattern', () => {
    const scene = baseScene();
    const project = baseProject();
    const attachment: any = {
      id: 'att-1',
      target: { type: 'entity', entityId: 'e1' },
      presetId: 'ZigzagPattern',
      enabled: true,
      order: 0,
      condition: {
        type: 'BoundsHit',
        bounds: { minX: 10, minY: 20, maxX: 30, maxY: 40 },
        mode: 'any',
        scope: 'member-any',
        behavior: 'limit',
      },
      params: { width: 30, height: 15, velocity: 100, segments: 12 },
    };

    const markup = renderToStaticMarkup(
      renderAttachmentInspector(
        attachment,
        project,
        scene,
        { arrange: [], actions: [], conditions: [] },
        () => {},
        () => {}
      )
    );

    expect(markup).toContain('Until');
    expect(markup).toContain('Bounds Hit');
    expect(markup).toContain('Bounds Min X');
    expect(markup).toContain('Bounds Max X');
    expect(markup).toContain('Bounds Min Y');
    expect(markup).toContain('Bounds Max Y');
  });
});


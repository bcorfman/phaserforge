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

describe('Attachment inspector UI', () => {
  it('marks WavePattern Start Progress field as wide-label', () => {
    const scene = baseScene();
    const project = baseProject();
    const attachment: any = {
      id: 'att-1',
      target: { type: 'entity', entityId: 'e1' },
      presetId: 'WavePattern',
      enabled: true,
      order: 0,
      params: { startProgress: 0, endProgress: 1 },
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

    expect(markup).toContain('Start Progress');
    expect(markup).toContain('field-wide-label');
  });

  it('shows helpful empty-state text when no counters exist', () => {
    const scene = baseScene();
    const project = baseProject();
    const attachment: any = {
      id: 'att-2',
      target: { type: 'entity', entityId: 'e1' },
      presetId: 'WavePattern',
      enabled: true,
      order: 0,
      condition: { type: 'CounterCompare', counterId: '', op: '==', value: 0 },
      params: {},
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

    expect(markup).toContain('Counter');
    expect(markup).toMatch(/no counters/i);
    expect(markup).toMatch(/add counters/i);
    expect(markup).toMatch(/scene state/i);
  });

  it('uses a wider gap layout for CounterCompare fields', () => {
    const scene = baseScene();
    const project = baseProject();
    const attachment: any = {
      id: 'att-3',
      target: { type: 'entity', entityId: 'e1' },
      presetId: 'WavePattern',
      enabled: true,
      order: 0,
      condition: { type: 'CounterCompare', counterId: '', op: '==', value: 0 },
      params: {},
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

    expect(markup).toContain('inspector-grid-counter-compare');
    expect(markup).toContain('field-tight-label');
  });
});

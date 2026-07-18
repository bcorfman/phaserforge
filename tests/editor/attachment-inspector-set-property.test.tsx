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
    expect(markup).toContain('data-testid="attachment-setproperty-reroll"');
    expect(markup).toMatch(/<div class="inspector-grid-2">[\s\S]*attachment-setproperty-random-min[\s\S]*attachment-setproperty-random-max[\s\S]*<\/div>/);
  });

  it('shows Event source target choice only for source-providing triggers', () => {
    const scene = baseScene();
    scene.eventBlocks = {
      wrap: {
        id: 'wrap',
        target: { type: 'group', groupId: 'g1' },
        trigger: { type: 'bounds', boundsEvent: 'wrapped', axis: 'y', side: 'any' },
      } as any,
      start: {
        id: 'start',
        target: { type: 'group', groupId: 'g1' },
        trigger: { type: 'start' },
      } as any,
    };

    const boundsMarkup = renderToStaticMarkup(
      renderAttachmentInspector(
        {
          id: 'att-bounds',
          target: { type: 'group', groupId: 'g1' },
          eventId: 'wrap',
          targetMode: 'event-source',
          presetId: 'SetProperty',
          enabled: true,
          order: 0,
          params: { property: 'x', valueSource: { kind: 'constant', value: 0 } },
        } as any,
        baseProject(),
        scene,
        { arrange: [], conditions: [], actions: [{ type: 'SetProperty', displayName: 'Set Property', category: 'state', implemented: true }] } as any,
        () => {},
        () => {}
      )
    );

    const startMarkup = renderToStaticMarkup(
      renderAttachmentInspector(
        {
          id: 'att-start',
          target: { type: 'group', groupId: 'g1' },
          eventId: 'start',
          presetId: 'SetProperty',
          enabled: true,
          order: 0,
          params: { property: 'x', valueSource: { kind: 'constant', value: 0 } },
        } as any,
        baseProject(),
        scene,
        { arrange: [], conditions: [], actions: [{ type: 'SetProperty', displayName: 'Set Property', category: 'state', implemented: true }] } as any,
        () => {},
        () => {}
      )
    );

    expect(boundsMarkup).toContain('data-testid="attachment-target-mode-select"');
    expect(boundsMarkup).toContain('Event source');
    expect(startMarkup).not.toContain('data-testid="attachment-target-mode-select"');
  });

  it('keeps Set Property controls finite and exposes typed event fields by label', () => {
    const scene = baseScene();
    scene.eventBlocks = {
      wrap: {
        id: 'wrap',
        target: { type: 'group', groupId: 'g1' },
        trigger: { type: 'bounds', boundsEvent: 'wrapped', axis: 'y', side: 'any' },
      } as any,
    };

    const markup = renderToStaticMarkup(
      renderAttachmentInspector(
        {
          id: 'att-bounds',
          target: { type: 'group', groupId: 'g1' },
          eventId: 'wrap',
          targetMode: 'event-source',
          presetId: 'SetProperty',
          enabled: true,
          order: 0,
          params: { property: 'x', valueSource: { kind: 'eventField', field: 'positionX' } },
        } as any,
        baseProject(),
        scene,
        {
          arrange: [],
          conditions: [],
          actions: [{
            type: 'SetProperty', displayName: 'Set Property', category: 'state', implemented: true,
            propertyTargets: [
              { key: 'x', type: 'number' },
              { key: 'y', type: 'number' },
              { key: 'tint', type: 'color' },
              { key: 'alpha', type: 'number' },
              { key: 'visible', type: 'boolean' },
              { key: 'vx', type: 'number' },
              { key: 'vy', type: 'number' },
            ],
          }],
        } as any,
        () => {},
        () => {}
      )
    );

    expect(markup).toContain('data-testid="attachment-setproperty-event-field-select"');
    expect(markup).toContain('Position X');
    expect(markup).not.toContain('bounds.minX');
    expect(markup).not.toContain('rand(');
    expect(markup).not.toContain('Script');
    expect(markup).not.toContain('Expression');
  });
});

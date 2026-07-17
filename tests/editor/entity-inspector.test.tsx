// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderEntityInspector } from '../../src/editor/Inspector';
import { sampleScene } from '../../src/model/sampleScene';

const project = {
  id: 'project-1',
  assets: { images: {}, spriteSheets: {}, fonts: {} },
  audio: { sounds: {} },
  inputMaps: {},
  scenes: { [sampleScene.id]: sampleScene as any },
  initialSceneId: sampleScene.id,
  collections: {},
  counters: {},
} as any;

const actionProps = {
  project,
  scene: sampleScene,
  registry: { arrange: [], actions: [], conditions: [] } as any,
  onCreateEventBlock: () => {},
  onUpdateEventBlock: () => {},
  onRemoveEventBlock: () => {},
  onAddAttachment: () => {},
  onSelectAttachment: () => {},
  onMoveAttachment: () => {},
  onReorderAttachments: () => {},
  onRemoveAttachment: () => {},
  onMakeParallelAttachments: () => {},
  onUngroupParallelAttachments: () => {},
  onMoveParallelAttachmentGroup: () => {},
  onCreatePatternFromAttachments: () => {},
  onApplyPattern: () => {},
};

describe('Entity inspector', () => {
  it('renders authored core transform and visual controls', () => {
    const markup = renderToStaticMarkup(
      renderEntityInspector(sampleScene.entities.e1, () => {})
    );

    expect(markup).toContain('Transform');
    expect(markup).toContain('Scale X');
    expect(markup).toContain('Scale Y');
    expect(markup).toContain('Origin X');
    expect(markup).toContain('Origin Y');
    expect(markup).toContain('Hitbox (Bounds)');
    expect(markup).toContain('Flip X');
    expect(markup).toContain('field-checkbox');
    expect(markup).toContain('Visual');
    expect(markup).toContain('Alpha');
    expect(markup).toContain('Visible');
    expect(markup).toContain('Depth');
    expect(markup).toContain('data-testid="entity-tint-picker"');
    expect(markup).toContain('data-testid="entity-tint-hex-input"');
    expect(markup).toContain('data-testid="entity-tint-clear"');
    expect(markup).toContain('Authored values update the selected sprite immediately on the canvas.');
  });

  it('renders Actions/Events after the core property foldouts to avoid tab scope ambiguity', () => {
    const markup = renderToStaticMarkup(
      renderEntityInspector(sampleScene.entities.e1, () => {}, actionProps)
    );

    const transformIndex = markup.indexOf('<div class="inspector-foldout-title">Transform</div>');
    const hitboxIndex = markup.indexOf('<div class="inspector-foldout-title">Hitbox (Bounds)</div>');
    const visualIndex = markup.indexOf('<div class="inspector-foldout-title">Visual</div>');
    const eventsIndex = markup.indexOf('<div class="inspector-foldout-title">Actions/Events</div>');

    expect(transformIndex).toBeGreaterThan(-1);
    expect(hitboxIndex).toBeGreaterThan(transformIndex);
    expect(visualIndex).toBeGreaterThan(hitboxIndex);
    expect(eventsIndex).toBeGreaterThan(visualIndex);
  });

  it('explains natural size, project scale, and world size for asset-backed sprites', () => {
    const projectWithAsset = {
      ...project,
      pixelsPerUnit: 2,
      assets: {
        images: {
          hero: {
            id: 'hero',
            width: 64,
            height: 64,
            source: {
              kind: 'embedded',
              dataUrl: 'data:image/png;base64,AAAA',
              originalName: 'hero.png',
              mimeType: 'image/png',
            },
          },
        },
        spriteSheets: {},
        fonts: {},
      },
    } as any;
    const sceneWithAsset = {
      ...sampleScene,
      entities: {
        ...sampleScene.entities,
        hero: {
          id: 'hero',
          x: 32,
          y: 48,
          width: 32,
          height: 32,
          asset: {
            source: { kind: 'asset', assetId: 'hero' },
            imageType: 'image',
            frame: { kind: 'single' },
          },
        },
      },
    } as any;

    const markup = renderToStaticMarkup(
      renderEntityInspector(sceneWithAsset.entities.hero, () => {}, {
        ...actionProps,
        project: projectWithAsset,
        scene: sceneWithAsset,
      })
    );

    expect(markup).toContain('Natural Size');
    expect(markup).toContain('64×64 px');
    expect(markup).toContain('Project Scale');
    expect(markup).toContain('2 px/unit');
    expect(markup).toContain('World Size');
    expect(markup).toContain('32×32 units');
    expect(markup).not.toContain('Use Project Scale');
    expect(markup).not.toContain('sprite-size-width-px-readonly');
    expect(markup).not.toContain('sprite-size-height-px-readonly');
  });
});

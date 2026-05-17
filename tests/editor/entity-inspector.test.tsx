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
});

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreateFormationPanel } from '../../src/editor/CreateFormationPanel';
import { createEmptyScene } from '../../src/model/emptyScene';
import { sampleScene } from '../../src/model/sampleScene';

const registry = {
  arrange: [
    {
      type: 'line',
      displayName: 'Line',
      category: 'formation',
      targetKinds: ['group'],
      implemented: true,
      parameters: [
        { name: 'startX', type: 'number', default: 0 },
        { name: 'startY', type: 'number', default: 0 },
        { name: 'spacing', type: 'number', default: 50 },
      ],
    },
  ],
  actions: [],
  conditions: [],
};

describe('CreateFormationPanel', () => {
  it('renders creation fields when sprites exist in the scene', () => {
    const markup = renderToStaticMarkup(
      <CreateFormationPanel scene={sampleScene} registry={registry as any} dispatch={() => {}} />
    );

    expect(markup).toContain('Create Formation');
    expect(markup).toContain('Formation Name');
    expect(markup).toContain('Preset');
    expect(markup).toContain('Member Count');
    expect(markup).toContain('data-testid="formation-choose-template-button"');
    expect(markup).toContain('data-testid="formation-create-button"');
  });

  it('shows an import hint and disables creation when no sprites exist', () => {
    const markup = renderToStaticMarkup(
      <CreateFormationPanel scene={createEmptyScene()} registry={registry as any} dispatch={() => {}} />
    );

    expect(markup).toContain('Import a sprite to use as a template');
    expect(markup).toContain('Go to Assets Dock');
    expect(markup).toContain('disabled=""');
  });

  it('renders paired arrange parameters on the same row for grid presets', () => {
    const gridRegistry = {
      arrange: [
        {
          type: 'grid',
          displayName: 'Grid',
          category: 'formation',
          targetKinds: ['group'],
          implemented: true,
          parameters: [
            { name: 'rows', type: 'number', default: 0 },
            { name: 'cols', type: 'number', default: 0 },
            { name: 'startX', type: 'number', default: 0 },
            { name: 'startY', type: 'number', default: 0 },
            { name: 'spacingX', type: 'number', default: 0 },
            { name: 'spacingY', type: 'number', default: 0 },
          ],
        },
      ],
      actions: [],
      conditions: [],
    };

    const markup = renderToStaticMarkup(
      <CreateFormationPanel scene={sampleScene} registry={gridRegistry as any} dispatch={() => {}} />
    );

    const expectPairedInGridRow = (a: string, b: string) => {
      const pattern = `<div class="inspector-grid-2">[\\s\\S]*data-testid="formation-arrange-param-${a}"[\\s\\S]*data-testid="formation-arrange-param-${b}"[\\s\\S]*<\\/div>`;
      expect(markup).toMatch(new RegExp(pattern));
    };

    expectPairedInGridRow('rows', 'cols');
    expectPairedInGridRow('startX', 'startY');
    expectPairedInGridRow('spacingX', 'spacingY');
  });
});

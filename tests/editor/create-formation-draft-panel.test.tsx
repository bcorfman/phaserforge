import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreateFormationDraftPanel } from '../../src/editor/CreateFormationDraftPanel';
import { sampleProject } from '../../src/model/sampleProject';

const scene = sampleProject.scenes[sampleProject.initialSceneId];
const registry = {
  arrange: [
    { type: 'scatter', displayName: 'Scatter', category: 'formation', targetKinds: ['group'], implemented: true },
  ],
  actions: [],
  conditions: [],
};

describe('CreateFormationDraftPanel', () => {
  it('renders Scatter bounds, seed, reroll, and random tint controls', () => {
    const markup = renderToStaticMarkup(
      <CreateFormationDraftPanel
        project={sampleProject}
        scene={scene}
        registry={registry as any}
        draft={{
          template: { kind: 'entity', entityId: 'e1' },
          name: 'Stars',
          arrangeKind: 'scatter',
          memberCount: 80,
          params: { minX: 0, maxX: 720, minY: 5, maxY: 1285, seed: 'stars-1' },
        }}
        dispatch={() => {}}
      />
    );

    expect(markup).toContain('data-testid="formation-draft-scatter-min-x"');
    expect(markup).toContain('data-testid="formation-draft-scatter-max-x"');
    expect(markup).toContain('data-testid="formation-draft-scatter-min-y"');
    expect(markup).toContain('data-testid="formation-draft-scatter-max-y"');
    expect(markup).toContain('data-testid="formation-draft-scatter-seed"');
    expect(markup).toContain('data-testid="formation-draft-scatter-reroll"');
    expect(markup).toContain('data-testid="formation-draft-random-tint"');
    expect(markup).toContain('data-testid="formation-draft-tint-min-r"');
    expect(markup).toContain('disabled=""');
  });

  it('keeps paired Scatter min/max controls in two-column rows', () => {
    const markup = renderToStaticMarkup(
      <CreateFormationDraftPanel
        project={sampleProject}
        scene={scene}
        registry={registry as any}
        draft={{
          template: { kind: 'entity', entityId: 'e1' },
          name: 'Stars',
          arrangeKind: 'scatter',
          memberCount: 80,
          params: { minX: 0, maxX: 720, minY: 5, maxY: 1285, seed: 'stars-1', randomTint: true },
        }}
        dispatch={() => {}}
      />
    );

    const expectPairedInGridRow = (a: string, b: string) => {
      const pattern = `<div class="inspector-grid-2">[\\s\\S]*data-testid="${a}"[\\s\\S]*data-testid="${b}"[\\s\\S]*<\\/div>`;
      expect(markup).toMatch(new RegExp(pattern));
    };

    expectPairedInGridRow('formation-draft-scatter-min-x', 'formation-draft-scatter-max-x');
    expectPairedInGridRow('formation-draft-scatter-min-y', 'formation-draft-scatter-max-y');
    expectPairedInGridRow('formation-draft-tint-min-r', 'formation-draft-tint-max-r');
  });
});

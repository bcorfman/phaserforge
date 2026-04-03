import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderMoveUntilInspector } from '../../src/editor/Inspector';
import { sampleScene } from '../../src/model/sampleScene';

describe('MoveUntil inspector', () => {
  it('inlines linked bounds editing controls for a BoundsHit condition', () => {
    const markup = renderToStaticMarkup(
      renderMoveUntilInspector(
        sampleScene.actions['a-move-right'],
        sampleScene,
        () => {},
        () => {}
      )
    );

    expect(markup).toContain('Boundary Limits');
    expect(markup).toContain('Formation Edges');
    expect(markup).toContain('Clamp at Edge');
    expect(markup).toContain('Min X');
    expect(markup).toContain('Max Y');
  });
});

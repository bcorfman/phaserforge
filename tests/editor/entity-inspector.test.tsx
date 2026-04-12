import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderEntityInspector } from '../../src/editor/Inspector';
import { sampleScene } from '../../src/model/sampleScene';

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
    expect(markup).toContain('Visual');
    expect(markup).toContain('Alpha');
    expect(markup).toContain('Visible');
    expect(markup).toContain('Depth');
    expect(markup).toContain('Authored values update the selected sprite immediately on the canvas.');
  });
});

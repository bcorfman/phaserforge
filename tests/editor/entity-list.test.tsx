import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EntityListView } from '../../src/editor/EntityList';
import { sampleScene } from '../../src/model/sampleScene';

describe('EntityList', () => {
  it('renders sprites and formations sections without actions', () => {
    const markup = renderToStaticMarkup(
      <EntityListView
        scene={sampleScene}
        selection={{ kind: 'none' }}
        expandedGroups={{ 'g-enemies': false }}
        dispatch={() => {}}
      />
    );

    expect(markup).toContain('Sprites');
    expect(markup).toContain('Formations');
    expect(markup).toContain('Enemy Formation');
    expect(markup).not.toContain('Actions');
    expect(markup).not.toContain('Move Right');
  });
});

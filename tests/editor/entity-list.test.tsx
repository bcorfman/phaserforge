import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EntityListView } from '../../src/editor/EntityList';
import { sampleScene } from '../../src/model/sampleScene';

describe('EntityList', () => {
  it('renders sprites, formations, and actions sections', () => {
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
    expect(markup).toContain('Actions');
    expect(markup).toContain('Enemy Formation');
    expect(markup).toContain('Loop');
    expect(markup).toContain('Move Right');
  });
});

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderBehaviorHierarchy } from '../../src/editor/EntityList';
import { sampleScene } from '../../src/model/sampleScene';

describe('EntityList behavior hierarchy', () => {
  it('renders the behavior action tree in behavior-rooted order', () => {
    const markup = renderToStaticMarkup(
      <>{renderBehaviorHierarchy(sampleScene, { kind: 'none' }, () => {}, () => {})}</>
    );

    expect(markup).toContain('Formation Patrol action hierarchy');
    expect(markup).toContain('Loop');
    expect(markup).toContain('Sweep + Drop');
    expect(markup).toContain('Move Right');
    expect(markup).toContain('Pause');

    expect(markup.indexOf('Loop')).toBeLessThan(markup.indexOf('Sweep + Drop'));
    expect(markup.indexOf('Sweep + Drop')).toBeLessThan(markup.indexOf('Move Right'));
    expect(markup.indexOf('Move Right')).toBeLessThan(markup.indexOf('Move Left'));
  });
});

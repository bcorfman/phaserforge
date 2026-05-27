import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderAttachmentInspector } from '../../src/editor/Inspector';
import { sampleScene } from '../../src/model/sampleScene';
import { sampleProject } from '../../src/model/sampleProject';

describe('Attachment inspector', () => {
  it('renders TweenUntil editor controls', () => {
    const markup = renderToStaticMarkup(
      renderAttachmentInspector(
        {
          id: 'att-tween',
          target: { type: 'group', groupId: 'g-enemies' },
          enabled: true,
          order: 0,
          presetId: 'TweenUntil',
          params: { property: 'vy', from: 'current', endValue: -4, durationMs: 2000, easing: 'linear' },
        } as any,
        sampleProject,
        sampleScene,
        {
          arrange: [],
          actions: [{ type: 'TweenUntil', displayName: 'Tween Until', category: 'transforms', targetKinds: ['entity', 'group'], implemented: true }],
          conditions: [],
        },
        () => {},
        () => {}
      )
    );

    expect(markup).toContain('Tween Until');
    expect(markup).toContain('Duration (ms)');
    expect(markup).toContain('Easing');
  });

  it('shows Start Value when From is explicit value', () => {
    const markup = renderToStaticMarkup(
      renderAttachmentInspector(
        {
          id: 'att-tween',
          target: { type: 'group', groupId: 'g-enemies' },
          enabled: true,
          order: 0,
          presetId: 'TweenUntil',
          params: { property: 'x', from: 'value', startValue: 10, endValue: 20, durationMs: 250, easing: 'linear' },
        } as any,
        sampleProject,
        sampleScene,
        {
          arrange: [],
          actions: [{ type: 'TweenUntil', displayName: 'Tween Until', category: 'transforms', targetKinds: ['entity', 'group'], implemented: true }],
          conditions: [],
        },
        () => {},
        () => {}
      )
    );

    expect(markup).toContain('Start Value');
  });
});

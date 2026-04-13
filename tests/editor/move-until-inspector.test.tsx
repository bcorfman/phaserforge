import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderAttachmentInspector } from '../../src/editor/Inspector';
import { sampleScene } from '../../src/model/sampleScene';

describe('Attachment inspector', () => {
  it('shows inline bounds editing controls for a MoveUntil attachment', () => {
    const markup = renderToStaticMarkup(
      renderAttachmentInspector(
        sampleScene.attachments['att-move-right'],
        sampleScene,
        {
          arrange: [],
          actions: [{ type: 'MoveUntil', displayName: 'Move Until', category: 'movement', targetKinds: ['entity', 'group'], implemented: true }],
          conditions: [],
        },
        () => {},
        () => {}
      )
    );

    expect(markup).toContain('Min X');
    expect(markup).toContain('Max Y');
  });
});

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AttachedActionsPanel } from '../../src/editor/AttachedActionsPanel';
import { sampleScene } from '../../src/model/sampleScene';

const registry = {
  arrange: [],
  actions: [
    { type: 'MoveUntil', displayName: 'Move Until', category: 'movement', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'Wait', displayName: 'Wait', category: 'flow', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'Call', displayName: 'Call', category: 'flow', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'Repeat', displayName: 'Repeat', category: 'flow', targetKinds: ['entity', 'group'], implemented: true },
  ],
  conditions: [],
};

describe('AttachedActionsPanel', () => {
  it('renders add buttons and an ordered list of attached actions for a target', () => {
    const markup = renderToStaticMarkup(
      <AttachedActionsPanel
        scene={sampleScene}
        target={{ type: 'entity', entityId: 'e1' }}
        selectedAttachmentId={undefined}
        registry={registry}
        onAddAttachment={() => {}}
        onSelectAttachment={() => {}}
        onMoveAttachment={() => {}}
        onRemoveAttachment={() => {}}
      />
    );

    expect(markup).toContain('Attached Actions');
    expect(markup).toContain('Add');
    expect(markup).toContain('Move Until');
    expect(markup).toContain('Repeat');
    expect(markup).toContain('List');
  });

  it('marks the selected attachment and includes step labels', () => {
    const markup = renderToStaticMarkup(
      <AttachedActionsPanel
        scene={sampleScene}
        target={{ type: 'group', groupId: 'g-enemies' }}
        selectedAttachmentId="att-move-left"
        registry={registry}
        onAddAttachment={() => {}}
        onSelectAttachment={() => {}}
        onMoveAttachment={() => {}}
        onRemoveAttachment={() => {}}
      />
    );

    expect(markup).toContain('Step 1');
    expect(markup).toContain('Loop');
    expect(markup).toContain('Selected');
    expect(markup).toContain('Move Left');
  });
});

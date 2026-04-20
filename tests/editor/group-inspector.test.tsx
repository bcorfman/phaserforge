import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderGroupInspector } from '../../src/editor/Inspector';
import { sampleScene } from '../../src/model/sampleScene';

const registry = {
  arrange: [
    {
      type: 'grid',
      displayName: 'Grid',
      category: 'formation',
      targetKinds: ['group'],
      implemented: true,
      parameters: [
        { name: 'rows', type: 'number' },
        { name: 'cols', type: 'number' },
        { name: 'startX', type: 'number' },
        { name: 'startY', type: 'number' },
        { name: 'spacingX', type: 'number' },
        { name: 'spacingY', type: 'number' },
      ],
    },
  ],
  actions: [
    { type: 'MoveUntil', displayName: 'Move Until', category: 'movement', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'Wait', displayName: 'Wait', category: 'flow', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'Call', displayName: 'Call', category: 'flow', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'Repeat', displayName: 'Repeat', category: 'flow', targetKinds: ['entity', 'group'], implemented: true },
  ],
  conditions: [],
};

describe('Group inspector', () => {
  it('renders editable formation-level controls and read-only member guidance', () => {
    const group = sampleScene.groups['g-enemies'];
    const markup = renderToStaticMarkup(
      renderGroupInspector(group, sampleScene, {
        onSelectMember: () => {},
        onRemoveMember: () => {},
        onUpdateGroup: () => {},
        onUngroup: () => {},
        onDeleteGroup: () => {},
        onAddAttachment: () => {},
        onSelectAttachment: () => {},
        onMoveAttachment: () => {},
        onRemoveAttachment: () => {},
        foldouts: { isOpen: () => true, toggle: () => {} },
        registry,
      })
    );

    expect(markup).toContain('Actions');
    expect(markup).toContain('Grouping');
    expect(markup).toContain('Formation Name');
    expect(markup).toContain('Ungroup');
    expect(markup).toContain('Delete Group');
    expect(markup).toContain('Member sprites are read-only here');
  });

  it('passes the selected attachment marker through the attached actions panel', () => {
    const group = sampleScene.groups['g-enemies'];
    const markup = renderToStaticMarkup(
      renderGroupInspector(group, sampleScene, {
        onSelectMember: () => {},
        onRemoveMember: () => {},
        onUpdateGroup: () => {},
        onUngroup: () => {},
        onDeleteGroup: () => {},
        onAddAttachment: () => {},
        onSelectAttachment: () => {},
        onMoveAttachment: () => {},
        onRemoveAttachment: () => {},
        selectedAttachmentId: 'att-move-left',
        foldouts: { isOpen: () => true, toggle: () => {} },
        registry,
      })
    );

    expect(markup).toContain('Selected');
  });
});

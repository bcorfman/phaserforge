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
  it('renders editable formation-level controls without member management panel', () => {
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
    expect(markup).not.toContain('Expand Members');
    expect(markup).not.toContain('Member sprites are read-only here');
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

  it('renders paired layout parameters on the same row in the layout inspector', () => {
    const group = sampleScene.groups['g-enemies'];
    const markup = renderToStaticMarkup(
      renderGroupInspector(group, sampleScene, {
        onSelectMember: () => {},
        onRemoveMember: () => {},
        onUpdateGroup: () => {},
        onUngroup: () => {},
        onDeleteGroup: () => {},
        onDissolve: () => {},
        onAddAttachment: () => {},
        onSelectAttachment: () => {},
        onMoveAttachment: () => {},
        onRemoveAttachment: () => {},
        foldouts: { isOpen: () => true, toggle: () => {} },
        registry,
        layoutPreset: 'grid',
        setLayoutPreset: () => {},
        layoutParams: {
          rows: '2',
          cols: '3',
          startX: '10',
          startY: '20',
          spacingX: '5',
          spacingY: '6',
        },
        setLayoutParams: () => {},
        applyLayout: () => {},
        convertType: 'grid',
        setConvertType: () => {},
        convertGridDraft: { rows: '2', cols: '3' },
        setConvertGridDraft: () => {},
        supportedArrangeKinds: ['grid'],
        defaultArrangeKind: 'grid',
        convertArrangeKind: 'grid',
        setConvertArrangeKind: () => {},
        applyConvertLayout: () => {},
      })
    );

    expect(markup).toMatch(
      /<div class="inspector-grid-2">[\s\S]*data-testid="arrange-param-rows"[\s\S]*data-testid="arrange-param-cols"[\s\S]*<\/div>/
    );
    expect(markup).toMatch(
      /<div class="inspector-grid-2">[\s\S]*data-testid="arrange-param-startX"[\s\S]*data-testid="arrange-param-startY"[\s\S]*<\/div>/
    );
    expect(markup).toMatch(
      /<div class="inspector-grid-2">[\s\S]*data-testid="arrange-param-spacingX"[\s\S]*data-testid="arrange-param-spacingY"[\s\S]*<\/div>/
    );
  });
});

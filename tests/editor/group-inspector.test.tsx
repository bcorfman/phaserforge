import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderGroupInspector } from '../../src/editor/Inspector';
import { inferGroupGridLayout } from '../../src/editor/formationLayout';
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
    const draft = inferGroupGridLayout(sampleScene, group.id);
    const markup = renderToStaticMarkup(
      renderGroupInspector(group, sampleScene, 'grid', (draft ?? {}) as any, {
        onSelectMember: () => {},
        onRemoveMember: () => {},
        onUpdateGroup: () => {},
        onArrangeGroup: () => {},
        onArrangeGroupGrid: () => {},
        onArrangeKindChange: () => {},
        onArrangeParamsChange: () => {},
        onAddAttachment: () => {},
        onSelectAttachment: () => {},
        onMoveAttachment: () => {},
        onRemoveAttachment: () => {},
        foldouts: { isOpen: () => true, toggle: () => {} },
        registry,
      })
    );

    expect(markup).toContain('Attached Actions');
    expect(markup).toContain('Formation Name');
    expect(markup).toContain('Arrange');
    expect(markup).toContain('Preset');
    expect(markup).toContain('Rows');
    expect(markup).toContain('Cols');
    expect(markup).toContain('Start X');
    expect(markup).toContain('Spacing Y');
    expect(markup).toContain('Apply Arrange Preset');
    expect(markup).toContain('Member sprites are read-only here');
  });

  it('shows the member-count constraint when the draft layout is invalid', () => {
    const group = sampleScene.groups['g-enemies'];
    const markup = renderToStaticMarkup(
      renderGroupInspector(
        group,
        sampleScene,
        'grid',
        { rows: 2, cols: 2, startX: 0, startY: 0, spacingX: 10, spacingY: 10 },
        {
          onSelectMember: () => {},
          onRemoveMember: () => {},
          onUpdateGroup: () => {},
          onArrangeGroup: () => {},
          onArrangeGroupGrid: () => {},
          onArrangeKindChange: () => {},
          onArrangeParamsChange: () => {},
          onAddAttachment: () => {},
          onSelectAttachment: () => {},
          onMoveAttachment: () => {},
          onRemoveAttachment: () => {},
          foldouts: { isOpen: () => true, toggle: () => {} },
          registry,
        }
      )
    );

    expect(markup).toContain('Grid size will become 4 sprites.');
    expect(markup).toContain('data-testid="apply-group-layout-button"');
  });

  it('passes the selected attachment marker through the attached actions panel', () => {
    const group = sampleScene.groups['g-enemies'];
    const draft = inferGroupGridLayout(sampleScene, group.id);
    const markup = renderToStaticMarkup(
      renderGroupInspector(group, sampleScene, 'grid', (draft ?? {}) as any, {
        onSelectMember: () => {},
        onRemoveMember: () => {},
        onUpdateGroup: () => {},
        onArrangeGroup: () => {},
        onArrangeGroupGrid: () => {},
        onArrangeKindChange: () => {},
        onArrangeParamsChange: () => {},
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

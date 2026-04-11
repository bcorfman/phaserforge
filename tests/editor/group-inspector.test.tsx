import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderGroupInspector } from '../../src/editor/Inspector';
import { inferGroupGridLayout } from '../../src/editor/formationLayout';
import { sampleScene } from '../../src/model/sampleScene';

const registry = {
  arrange: [],
  actions: [],
  conditions: [],
};

describe('Group inspector', () => {
  it('renders editable formation-level controls and read-only member guidance', () => {
    const group = sampleScene.groups['g-enemies'];
    const draft = inferGroupGridLayout(sampleScene, group.id);
    const markup = renderToStaticMarkup(
      renderGroupInspector(group, sampleScene, draft, true, {
        onSelectMember: () => {},
        onUpdateGroup: () => {},
        onArrangeGroupGrid: () => {},
        onDraftChange: () => {},
        onAssignFlow: () => {},
        onAssignExistingBehavior: () => {},
        onRenameBehavior: () => {},
        onRemoveBehavior: () => {},
        onAddAction: () => {},
        onMoveAction: () => {},
        onRemoveAction: () => {},
        onSelectBehavior: () => {},
        onSelectAction: () => {},
        registry,
      })
    );

    expect(markup).toContain('Formation Name');
    expect(markup).toContain('Arrange Grid');
    expect(markup).toContain('Rows');
    expect(markup).toContain('Cols');
    expect(markup).toContain('Start X');
    expect(markup).toContain('Spacing Y');
    expect(markup).toContain('Apply Formation Layout');
    expect(markup).toContain('Member sprites are read-only here');
  });

  it('shows the member-count constraint when the draft layout is invalid', () => {
    const group = sampleScene.groups['g-enemies'];
    const markup = renderToStaticMarkup(
      renderGroupInspector(
        group,
        sampleScene,
        { rows: 2, cols: 2, startX: 0, startY: 0, spacingX: 10, spacingY: 10 },
        true,
        {
          onSelectMember: () => {},
          onUpdateGroup: () => {},
          onArrangeGroupGrid: () => {},
          onDraftChange: () => {},
          onAssignFlow: () => {},
          onAssignExistingBehavior: () => {},
          onRenameBehavior: () => {},
          onRemoveBehavior: () => {},
          onAddAction: () => {},
          onMoveAction: () => {},
          onRemoveAction: () => {},
          onSelectBehavior: () => {},
          onSelectAction: () => {},
          registry,
        }
      )
    );

    expect(markup).toContain('Grid size will become 4 sprites.');
    expect(markup).toContain('data-testid="apply-group-layout-button"');
  });

  it('passes the selected action marker through the group action panel', () => {
    const group = sampleScene.groups['g-enemies'];
    const draft = inferGroupGridLayout(sampleScene, group.id);
    const markup = renderToStaticMarkup(
      renderGroupInspector(group, sampleScene, draft, true, {
        onSelectMember: () => {},
        onUpdateGroup: () => {},
        onArrangeGroupGrid: () => {},
        onDraftChange: () => {},
        onAssignFlow: () => {},
        onAssignExistingBehavior: () => {},
        onRenameBehavior: () => {},
        onRemoveBehavior: () => {},
        onAddAction: () => {},
        onMoveAction: () => {},
        onRemoveAction: () => {},
        onSelectBehavior: () => {},
        onSelectAction: () => {},
        selectedActionId: 'a-move-left',
        registry,
      })
    );

    expect(markup).toContain('Preview runs this list from Step 1');
    expect(markup).toContain('Selected');
  });
});

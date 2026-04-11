import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TargetActionPanel } from '../../src/editor/ActionFlowEditor';
import { sampleScene } from '../../src/model/sampleScene';

const registry = {
  arrange: [],
  actions: [
    { type: 'MoveUntil', displayName: 'Move Until', category: 'movement', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'Wait', displayName: 'Wait', category: 'flow', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'Call', displayName: 'Call', category: 'flow', targetKinds: ['entity', 'group'], implemented: true },
  ],
  conditions: [],
};

describe('TargetActionPanel', () => {
  it('shows assign flow controls when the selected target has no behavior', () => {
    const markup = renderToStaticMarkup(
      <TargetActionPanel
        scene={sampleScene}
        target={{ type: 'entity', entityId: 'e1' }}
        registry={registry}
        onAssignFlow={() => {}}
        onAssignExistingBehavior={() => {}}
        onRenameBehavior={() => {}}
        onRemoveBehavior={() => {}}
        onAddAction={() => {}}
        onMoveAction={() => {}}
        onRemoveAction={() => {}}
        onSelectBehavior={() => {}}
        onSelectAction={() => {}}
      />
    );

    expect(markup).toContain('Assign Action Flow');
    expect(markup).toContain('Use Existing Flow');
  });

  it('shows sequence editing controls when the selected group already has a behavior', () => {
    const markup = renderToStaticMarkup(
      <TargetActionPanel
        scene={sampleScene}
        target={{ type: 'group', groupId: 'g-enemies' }}
        selectedActionId="a-move-left"
        registry={registry}
        onAssignFlow={() => {}}
        onAssignExistingBehavior={() => {}}
        onRenameBehavior={() => {}}
        onRemoveBehavior={() => {}}
        onAddAction={() => {}}
        onMoveAction={() => {}}
        onRemoveAction={() => {}}
        onSelectBehavior={() => {}}
        onSelectAction={() => {}}
      />
    );

    expect(markup).toContain('Flow Name');
    expect(markup).toContain('Open Behavior');
    expect(markup).toContain('Remove Flow');
    expect(markup).toContain('Preview runs this list from Step 1');
    expect(markup).toContain('Step 1');
    expect(markup).toContain('Selected');
    expect(markup).toContain('Move Right');
    expect(markup).toContain('Drop');
  });
});

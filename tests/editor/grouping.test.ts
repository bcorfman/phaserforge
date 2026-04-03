import { describe, expect, it } from 'vitest';
import { summarizeSceneGroups, summarizeGridLayout } from '../../src/editor/grouping';
import { sampleScene } from '../../src/model/sampleScene';
import { baseScene } from '../helpers';

describe('editor grouping helpers', () => {
  it('summarizes groups and excludes grouped members from the ungrouped entity list', () => {
    const summary = summarizeSceneGroups(baseScene());

    expect(summary.groups).toHaveLength(1);
    expect(summary.groups[0].members.map((member) => member.id)).toEqual(['e1', 'e2', 'e3']);
    expect(summary.ungroupedEntities).toEqual([]);
  });

  it('detects the sample scene as a 3x5 grid-like formation', () => {
    const summary = summarizeSceneGroups(sampleScene);
    const layout = summarizeGridLayout(summary.groups[0].members);

    expect(layout).toEqual({
      kind: 'grid',
      rows: 3,
      cols: 5,
      spacingX: 48,
      spacingY: 40,
    });
  });
});

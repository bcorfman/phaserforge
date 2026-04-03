import { describe, expect, it } from 'vitest';
import { buildBehaviorActionTrees } from '../../src/editor/actionTree';
import { sampleScene } from '../../src/model/sampleScene';

describe('buildBehaviorActionTrees', () => {
  it('orders actions by behavior root and nested child references', () => {
    const [tree] = buildBehaviorActionTrees(sampleScene);

    expect(tree.behaviorId).toBe('b-formation');
    expect(tree.root.id).toBe('a-root');
    expect(tree.root.children.map((child) => child.id)).toEqual(['a-seq']);
    expect(tree.root.children[0].children.map((child) => child.id)).toEqual([
      'a-move-right',
      'a-drop-right',
      'a-wait-right',
      'a-move-left',
      'a-drop-left',
      'a-wait-left',
    ]);
  });

  it('returns an empty action subtree when the root action is missing', () => {
    const [tree] = buildBehaviorActionTrees({
      ...sampleScene,
      actions: {},
    });

    expect(tree.root).toBeUndefined();
  });
});

// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { EntityListView } from '../../src/editor/EntityList';
import type { GameSceneSpec, ProjectSpec } from '../../src/model/types';

function makeProject(scene: GameSceneSpec): ProjectSpec {
  return {
    id: 'p1',
    assets: { images: {}, spriteSheets: {}, fonts: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: { [scene.id]: scene },
    initialSceneId: scene.id,
    patterns: {},
    counters: {},
    collections: {},
  };
}

describe('EntityList sprites reorder', () => {
  it('dispatches reorder-sprite-order when dropping a sprite onto another sprite row', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    const scene: GameSceneSpec = {
      id: 's1',
      world: { width: 100, height: 100 },
      entities: {
        a: { id: 'a', name: 'A', x: 0, y: 0, width: 10, height: 10, depth: 1 },
        b: { id: 'b', name: 'B', x: 0, y: 0, width: 10, height: 10, depth: 2 },
      },
      groups: {},
      attachments: {},
      eventBlocks: {},
      behaviors: {},
      actions: {},
      conditions: {},
    };
    const project = makeProject(scene);
    const dispatch = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(
        <EntityListView
          project={project}
          currentSceneId="s1"
          scene={scene}
          selection={{ kind: 'none' }}
          sidebarScope="scene"
          expandedGroups={{}}
          mode="edit"
          startupMode="new_empty_scene"
          dispatch={dispatch}
        />
      );
    });

    const targetRow = container.querySelector('[data-testid="ungrouped-entity-a"]') as HTMLElement | null;
    expect(targetRow).not.toBeNull();

    const drop: any = new window.Event('drop', { bubbles: true });
    drop.dataTransfer = {
      getData: (kind: string) => (kind === 'application/x-phaserforge-entity-ids' ? JSON.stringify(['b']) : ''),
    };

    await React.act(async () => {
      targetRow!.dispatchEvent(drop);
    });

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'reorder-sprite-order' }));
    const reorderCall = dispatch.mock.calls.find((call) => call[0]?.type === 'reorder-sprite-order');
    expect(reorderCall?.[0]?.orderedEntityIds).toEqual(['b', 'a']);
  });
});

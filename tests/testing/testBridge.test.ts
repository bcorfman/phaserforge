// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import {
  registerActionDispatcher,
  registerAppStateGetter,
  registerModeToggleHandler,
  registerSceneGetter,
  unregisterActionDispatcher,
  unregisterAppStateGetter,
  unregisterModeToggleHandler,
  unregisterSceneGetter,
} from '../../src/testing/testBridge';

describe('testBridge mode helpers', () => {
  it('exposes setMode() and dispatches mode changes without using the UI toggle handler', () => {
    const handler = vi.fn();
    const dispatch = vi.fn();
    registerModeToggleHandler(handler);
    registerActionDispatcher(dispatch);

    const getState = () =>
      ({
        mode: 'edit',
      }) as any;
    registerAppStateGetter(getState);

    expect(window.__PHASER_FORGE_TEST__?.isEnabled).toBe(true);
    expect(typeof window.__PHASER_FORGE_TEST__?.setMode).toBe('function');
    expect(typeof window.__PHASER_FORGE_TEST__?.pauseActiveProjectRecordPersistence).toBe('function');
    expect(typeof window.__PHASER_FORGE_TEST__?.resumeActiveProjectRecordPersistence).toBe('function');

    window.__PHASER_FORGE_TEST__?.setMode?.('play');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'toggle-mode' });
    expect(handler).not.toHaveBeenCalled();

    unregisterAppStateGetter(getState);
    unregisterActionDispatcher(dispatch);
    unregisterModeToggleHandler(handler);
  });

  it('does not report a ready preferred scene before it becomes active', () => {
    const getState = () =>
      ({
        mode: 'edit',
        initialized: true,
      }) as any;
    registerAppStateGetter(getState);

    const makeScene = (snapshot: { sceneKey: string; ready: boolean; isActive: boolean }) =>
      ({
        getTestSnapshot: () => ({
          ...snapshot,
          zoom: 1,
          scrollX: 0,
          scrollY: 0,
          viewportWidth: 800,
          viewportHeight: 600,
        }),
        getEntityWorldRect: () => null,
        getEntitySpriteWorldRect: () => null,
        getGroupWorldBounds: () => null,
        getGroupFrameVisible: () => null,
        getGroupLabelVisible: () => null,
        getFormationPhysicsGroupInfo: () => null,
        getEditableBoundsRect: () => null,
        getHitboxOverlayInfo: () => null,
        worldToClient: () => null,
        testSetPointerWorld: () => {},
        testPointerDownEntity: () => {},
        testTapWorld: () => {},
        testDragWorld: () => {},
        testDuplicateEntities: () => {},
        testDragBoundsHandle: () => {},
        testPanByScreenDelta: () => {},
      }) as any;

    const gameGetter = () => makeScene({ sceneKey: 'GameScene', ready: true, isActive: true });
    const editorGetter = () => makeScene({ sceneKey: 'EditorScene', ready: true, isActive: false });
    registerSceneGetter(gameGetter);
    registerSceneGetter(editorGetter);

    expect(window.__PHASER_FORGE_TEST__?.getSceneSnapshot()).toMatchObject({
      sceneKey: 'GameScene',
      ready: true,
      isActive: true,
    });

    unregisterSceneGetter(editorGetter);
    unregisterSceneGetter(gameGetter);
    unregisterAppStateGetter(getState);
  });
});

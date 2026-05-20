import { expect, test } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { getFitZoom } from '../../src/editor/viewport';
import { dismissViewHint, getSceneSnapshot, getState, seedProject } from './helpers';

test('startup centers the editor viewport', async ({ page }) => {
  await seedProject(page, createEmptyProject());
  await dismissViewHint(page);

  const state = await getState<{ scene?: { world?: { width: number; height: number } } } | null>(page);
  const world = state?.scene?.world ?? { width: 1024, height: 768 };

  const snapshot = await getSceneSnapshot<{
    ready: boolean;
    sceneKey: string;
    zoom: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
  }>(page);
  expect(snapshot).toMatchObject({ ready: true, sceneKey: 'EditorScene' });

  const expectedZoom = getFitZoom(snapshot.viewportWidth, snapshot.viewportHeight, world.width, world.height);
  const expectedScrollX = world.width / 2 - snapshot.viewportWidth / (2 * expectedZoom);
  const expectedScrollY = world.height / 2 - snapshot.viewportHeight / (2 * expectedZoom);

  expect(Math.abs(snapshot.zoom - expectedZoom)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(snapshot.scrollX - expectedScrollX)).toBeLessThanOrEqual(1);
  expect(Math.abs(snapshot.scrollY - expectedScrollY)).toBeLessThanOrEqual(1);
});


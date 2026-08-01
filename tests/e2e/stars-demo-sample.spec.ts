import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { dispatchAction, gotoStudio, waitForSceneReady } from './helpers';

test('the offline Stars sample renders its members in Play Mode', async ({ page }) => {
  await gotoStudio(page, { forceNavigate: true });
  const yaml = await readFile(path.resolve(process.cwd(), 'samples/stars-demo.yaml'), 'utf8');
  await dispatchAction(page, { type: 'load-yaml-text', text: yaml, sourceLabel: 'stars-demo.yaml' });

  await expect.poll(async () => {
    const state = await page.evaluate(() => window.__PHASER_FORGE_TEST__?.getState?.());
    return Object.keys(state?.scene?.entities ?? {}).length;
  }, { timeout: 15000 }).toBe(401);
  await waitForSceneReady(page);

  await page.evaluate(() => window.__PHASER_FORGE_TEST__?.setMode?.('play'));
  await expect.poll(async () => {
    const snapshot = await page.evaluate(() => window.__PHASER_FORGE_TEST__?.getSceneSnapshot?.());
    return snapshot?.sceneKey;
  }).toBe('GameScene');
  await expect.poll(async () => {
    const snapshot = await page.evaluate(() => window.__PHASER_FORGE_TEST__?.getRenderDebugSnapshot?.());
    return Object.keys(snapshot?.entityDisplay ?? {}).length;
  }).toBe(401);
});

test('editing members of a Stars formation keeps the editor alive', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoStudio(page, { forceNavigate: true });
  const yaml = await readFile(path.resolve(process.cwd(), 'samples/stars-demo.yaml'), 'utf8');
  await dispatchAction(page, { type: 'load-yaml-text', text: yaml, sourceLabel: 'stars-demo.yaml' });
  await expect.poll(async () => {
    const state = await page.evaluate(() => window.__PHASER_FORGE_TEST__?.getState?.());
    return Object.keys(state?.scene?.groups ?? {}).length;
  }, { timeout: 15000 }).toBe(5);

  await dispatchAction(page, { type: 'select', selection: { kind: 'group', id: 'g-stars-blink-1' } });
  await page.getByTestId('canvas-edit-members-button').click();

  await expect(page.getByTestId('app-root')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => window.__PHASER_FORGE_TEST__?.getState?.()?.selection)).toEqual({
    kind: 'entities',
    ids: expect.arrayContaining(['g-stars-blink-1-member']),
  });
  expect(errors).toEqual([]);
});

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

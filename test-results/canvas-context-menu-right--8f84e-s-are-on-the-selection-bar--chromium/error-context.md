# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: canvas-context-menu.spec.ts >> right-click does not open a canvas context menu (selection actions are on the selection bar)
- Location: tests/e2e/canvas-context-menu.spec.ts:8:5

# Error details

```
Test timeout of 60000ms exceeded while running "beforeEach" hook.
```

```
Error: page.goto: Target page, context or browser has been closed
```

# Test source

```ts
  1   | /// <reference path="../../src/vite-env.d.ts" />
  2   | 
  3   | import { expect, type Locator, type Page } from '@playwright/test';
  4   | import { serializeProjectToYaml } from '../../src/model/serialization';
  5   | import { sampleProject } from '../../src/model/sampleProject';
  6   | 
  7   | type Point = { x: number; y: number };
  8   | type Rect = { minX: number; minY: number; maxX: number; maxY: number; centerX?: number; centerY?: number };
  9   | 
  10  | type AssetDragPayload = { assetKind: 'image' | 'spritesheet' | 'audio' | 'font'; assetId: string };
  11  | 
  12  | const IS_CI = Boolean(process.env.CI);
  13  | const APP_BOOT_TIMEOUT_MS = 60000;
  14  | // Local runs can still be resource constrained (e.g. 3 workers + fresh Vite server per run),
  15  | // so keep navigation/scene timeouts a bit more forgiving to avoid false negatives.
  16  | const NAVIGATE_TIMEOUT_MS = IS_CI ? 45000 : 30000;
  17  | const SCENE_READY_TIMEOUT_MS = IS_CI ? 120000 : 60000;
  18  | const SCENE_CONTENT_TIMEOUT_MS = IS_CI ? 30000 : 10000;
  19  | 
  20  | export async function gotoStudio(page: Page, options?: { forceNavigate?: boolean }): Promise<void> {
  21  |   if (!options?.forceNavigate) {
  22  |     const existingAppRoot = page.getByTestId('app-root');
  23  |     if (await existingAppRoot.isVisible().catch(() => false)) {
  24  |       await waitForSceneReady(page);
  25  |       return;
  26  |     }
  27  |   }
  28  | 
  29  |   const bootOnce = async () => {
  30  |     // Explicit timeouts make failures deterministic (instead of hanging until the overall test timeout).
> 31  |     await page.goto('/', { waitUntil: 'domcontentloaded', timeout: NAVIGATE_TIMEOUT_MS });
      |                ^ Error: page.goto: Target page, context or browser has been closed
  32  |     await page.waitForFunction(() => Boolean(window.__PHASER_ACTIONS_STUDIO_TEST__?.isEnabled), { timeout: APP_BOOT_TIMEOUT_MS });
  33  |     await expect(page.getByTestId('app-root')).toBeVisible({ timeout: APP_BOOT_TIMEOUT_MS });
  34  |   };
  35  | 
  36  |   // Multiple retries help when a worker lands on a stale/blank page after navigation.
  37  |   let lastError: unknown;
  38  |   for (let attempt = 0; attempt < 3; attempt += 1) {
  39  |     try {
  40  |       await bootOnce();
  41  |       lastError = undefined;
  42  |       break;
  43  |     } catch (error) {
  44  |       lastError = error;
  45  |     }
  46  |   }
  47  |   if (lastError) {
  48  |     throw lastError;
  49  |   }
  50  |   await waitForSceneReady(page);
  51  | }
  52  | 
  53  | export async function seedSampleScene(page: Page, options: { once?: boolean } = {}): Promise<void> {
  54  |   const yaml = serializeProjectToYaml(sampleProject);
  55  |   await page.addInitScript(
  56  |     ([sceneYaml, seedOnce]) => {
  57  |       const sentinelKey = 'phaseractions.testSeeded.v1';
  58  |       const uiResetKey = 'phaseractions.testUiReset.v1';
  59  |       if (seedOnce && window.localStorage.getItem(sentinelKey)) return;
  60  |       if (seedOnce) window.localStorage.setItem(sentinelKey, '1');
  61  | 
  62  |       // Tests must be isolated by default: reset the persisted authored project before boot.
  63  |       window.localStorage.removeItem('phaseractions.inspectorFoldouts.v1');
  64  |       if (!window.localStorage.getItem(uiResetKey)) {
  65  |         window.localStorage.setItem(uiResetKey, '1');
  66  |         window.localStorage.removeItem('phaseractions.leftPaneWidth.v1');
  67  |         window.localStorage.removeItem('phaseractions.assetsDockHeight.v1');
  68  |         window.localStorage.removeItem('phaseractions.assetsDockShowThumbnails.v1');
  69  |       }
  70  |       window.localStorage.setItem('phaseractions.showHitboxOverlay.v1', '1');
  71  |       window.localStorage.setItem('phaseractions.projectYaml.v1', sceneYaml);
  72  |       window.localStorage.setItem('phaseractions.startupMode.v1', 'reload_last_yaml');
  73  |     },
  74  |     [yaml, Boolean(options.once)]
  75  |   );
  76  |   await gotoStudio(page, { forceNavigate: true });
  77  |   await waitForSampleScene(page);
  78  | }
  79  | 
  80  | export async function seedProject(page: Page, project: any): Promise<void> {
  81  |   const yaml = serializeProjectToYaml(project);
  82  |   await page.addInitScript((sceneYaml) => {
  83  |     const uiResetKey = 'phaseractions.testUiReset.v1';
  84  |     // Keep tests deterministic by clearing persisted UI state tied to previous runs.
  85  |     window.localStorage.removeItem('phaseractions.inspectorFoldouts.v1');
  86  |     if (!window.localStorage.getItem(uiResetKey)) {
  87  |       window.localStorage.setItem(uiResetKey, '1');
  88  |       window.localStorage.removeItem('phaseractions.leftPaneWidth.v1');
  89  |       window.localStorage.removeItem('phaseractions.assetsDockHeight.v1');
  90  |       window.localStorage.removeItem('phaseractions.assetsDockShowThumbnails.v1');
  91  |     }
  92  |     window.localStorage.setItem('phaseractions.showHitboxOverlay.v1', '1');
  93  |     window.localStorage.setItem('phaseractions.projectYaml.v1', sceneYaml);
  94  |     window.localStorage.setItem('phaseractions.startupMode.v1', 'reload_last_yaml');
  95  |   }, yaml);
  96  |   await gotoStudio(page, { forceNavigate: true });
  97  | }
  98  | 
  99  | export async function waitForSceneReady(page: Page): Promise<void> {
  100 |   await page.waitForFunction(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.isSceneReady?.(), { timeout: SCENE_READY_TIMEOUT_MS });
  101 |   await expect(page.locator('#game-container canvas')).toBeVisible({ timeout: SCENE_READY_TIMEOUT_MS });
  102 | }
  103 | 
  104 | export async function waitForSampleScene(page: Page): Promise<void> {
  105 |   await expect.poll(async () => {
  106 |     const state = await getState<{
  107 |       scene?: { entities?: Record<string, unknown>; groups?: Record<string, unknown>; attachments?: Record<string, unknown> };
  108 |     } | null>(page);
  109 |     return {
  110 |       hasState: Boolean(state),
  111 |       hasEntity: Boolean(state?.scene?.entities?.e1),
  112 |       hasGroup: Boolean(state?.scene?.groups?.['g-enemies']),
  113 |       hasAttachment: Boolean(state?.scene?.attachments?.['att-move-right']),
  114 |     };
  115 |   }, { timeout: SCENE_CONTENT_TIMEOUT_MS }).toEqual({
  116 |     hasState: true,
  117 |     hasEntity: true,
  118 |     hasGroup: true,
  119 |     hasAttachment: true,
  120 |   });
  121 | }
  122 | 
  123 | export async function waitForEmptyScene(page: Page): Promise<void> {
  124 |   await expect.poll(async () => {
  125 |     const state = await getState<{ scene?: { entities?: Record<string, unknown>; groups?: Record<string, unknown> } } | null>(page);
  126 |     return {
  127 |       hasState: Boolean(state),
  128 |       entityCount: Object.keys(state?.scene?.entities ?? {}).length,
  129 |       groupCount: Object.keys(state?.scene?.groups ?? {}).length,
  130 |     };
  131 |   }, { timeout: SCENE_CONTENT_TIMEOUT_MS }).toEqual({
```
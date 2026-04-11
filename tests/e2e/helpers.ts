import { expect, type Locator, type Page } from '@playwright/test';
import { serializeSceneToYaml } from '../../src/model/serialization';
import { sampleScene } from '../../src/model/sampleScene';

type Point = { x: number; y: number };
type Rect = { minX: number; minY: number; maxX: number; maxY: number; centerX?: number; centerY?: number };

export async function gotoStudio(page: Page): Promise<void> {
  const existingAppRoot = page.getByTestId('app-root');
  if (await existingAppRoot.isVisible().catch(() => false)) {
    await waitForSceneReady(page);
    return;
  }

  await page.goto('/');
  try {
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 10000 });
  } catch {
    await page.reload();
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 10000 });
  }
  await waitForSceneReady(page);
}

export async function seedSampleScene(page: Page): Promise<void> {
  const yaml = serializeSceneToYaml(sampleScene);
  await page.goto('/');
  await page.evaluate(([sceneYaml]) => {
    window.localStorage.setItem('phaseractions.sceneYaml.v1', sceneYaml);
    window.localStorage.setItem('phaseractions.startupMode.v1', 'reload_last_yaml');
  }, [yaml]);
  await page.reload();
  await waitForSampleScene(page);
}

export async function waitForSceneReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.isSceneReady?.());
  await expect(page.locator('#game-container canvas')).toBeVisible();
}

export async function waitForSampleScene(page: Page): Promise<void> {
  await expect.poll(async () => {
    const state = await getState<{
      scene?: {
        entities?: Record<string, unknown>;
        groups?: Record<string, unknown>;
        actions?: Record<string, unknown>;
      };
    } | null>(page);
    return {
      hasState: Boolean(state),
      hasEntity: Boolean(state?.scene?.entities?.e1),
      hasGroup: Boolean(state?.scene?.groups?.['g-enemies']),
      hasAction: Boolean(state?.scene?.actions?.['a-move-right']),
    };
  }, { timeout: 10000 }).toEqual({
    hasState: true,
    hasEntity: true,
    hasGroup: true,
    hasAction: true,
  });
}

export async function waitForEmptyScene(page: Page): Promise<void> {
  await expect.poll(async () => {
    const state = await getState<{ scene?: { entities?: Record<string, unknown>; groups?: Record<string, unknown> } } | null>(page);
    return {
      hasState: Boolean(state),
      entityCount: Object.keys(state?.scene?.entities ?? {}).length,
      groupCount: Object.keys(state?.scene?.groups ?? {}).length,
    };
  }, { timeout: 10000 }).toEqual({
    hasState: true,
    entityCount: 0,
    groupCount: 0,
  });
}

export async function dismissViewHint(page: Page): Promise<void> {
  const hint = page.getByTestId('view-hint');
  if (await hint.isVisible().catch(() => false)) {
    await page.getByTestId('dismiss-view-hint-button').click();
    await expect(hint).toBeHidden();
  }
}

export async function getState<T = any>(page: Page): Promise<T> {
  return page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.getState()) as Promise<T>;
}

export async function getSceneSnapshot<T = any>(page: Page): Promise<T> {
  return page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.getSceneSnapshot()) as Promise<T>;
}

export async function getEntityWorldRect(page: Page, id: string): Promise<Rect> {
  return page.evaluate((entityId) => window.__PHASER_ACTIONS_STUDIO_TEST__?.getEntityWorldRect(entityId), id) as Promise<Rect>;
}

export async function getGroupWorldBounds(page: Page, id: string): Promise<Rect> {
  return page.evaluate((groupId) => window.__PHASER_ACTIONS_STUDIO_TEST__?.getGroupWorldBounds(groupId), id) as Promise<Rect>;
}

export async function getEditableBoundsRect(page: Page): Promise<Rect> {
  return page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.getEditableBoundsRect()) as Promise<Rect>;
}

export async function worldToClient(page: Page, point: Point): Promise<Point> {
  return page.evaluate((worldPoint) => window.__PHASER_ACTIONS_STUDIO_TEST__?.worldToClient(worldPoint), point) as Promise<Point>;
}

export async function entityClientCenter(page: Page, id: string): Promise<Point> {
  const rect = await getEntityWorldRect(page, id);
  return worldToClient(page, { x: rect.centerX ?? (rect.minX + rect.maxX) / 2, y: rect.centerY ?? (rect.minY + rect.maxY) / 2 });
}

export async function groupClientCenter(page: Page, id: string): Promise<Point> {
  const rect = await getGroupWorldBounds(page, id);
  return worldToClient(page, { x: (rect.minX + rect.maxX) / 2, y: (rect.minY + rect.maxY) / 2 });
}

export async function boundsHandleClient(page: Page, handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'): Promise<Point> {
  const bounds = await getEditableBoundsRect(page);
  const pointMap: Record<typeof handle, Point> = {
    nw: { x: bounds.minX, y: bounds.minY },
    n: { x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY },
    ne: { x: bounds.maxX, y: bounds.minY },
    e: { x: bounds.maxX, y: (bounds.minY + bounds.maxY) / 2 },
    se: { x: bounds.maxX, y: bounds.maxY },
    s: { x: (bounds.minX + bounds.maxX) / 2, y: bounds.maxY },
    sw: { x: bounds.minX, y: bounds.maxY },
    w: { x: bounds.minX, y: (bounds.minY + bounds.maxY) / 2 },
  };

  return worldToClient(page, pointMap[handle]);
}

export async function dragOnCanvas(page: Page, from: Point, to: Point, button: 'left' | 'middle' = 'left'): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up({ button });
}

export async function clickCanvasAt(page: Page, point: Point): Promise<void> {
  await page.mouse.click(point.x, point.y);
}

export async function tapWorld(page: Page, point: Point): Promise<void> {
  await page.evaluate((worldPoint) => window.__PHASER_ACTIONS_STUDIO_TEST__?.tapWorld(worldPoint), point);
}

export async function dragWorld(page: Page, start: Point, end: Point): Promise<void> {
  await page.evaluate(([from, to]) => window.__PHASER_ACTIONS_STUDIO_TEST__?.dragWorld(from, to), [start, end]);
}

export async function dragBoundsHandle(page: Page, handle: string, delta: Point): Promise<void> {
  await page.evaluate(([nextHandle, nextDelta]) => window.__PHASER_ACTIONS_STUDIO_TEST__?.dragBoundsHandle(nextHandle, nextDelta), [handle, delta]);
}

export async function panByScreenDelta(page: Page, delta: Point): Promise<void> {
  await page.evaluate((nextDelta) => window.__PHASER_ACTIONS_STUDIO_TEST__?.panByScreenDelta(nextDelta), delta);
}

export async function expectSelection(page: Page, expected: Record<string, unknown>): Promise<void> {
  await expect.poll(async () => {
    const state = await getState<{ selection?: unknown } | null>(page);
    return JSON.stringify(state?.selection ?? null);
  }).toBe(JSON.stringify(expected));
}

export async function selectGroupInSceneGraph(page: Page, groupId: string): Promise<void> {
  const groupItem = page.getByTestId(`group-item-${groupId}`);
  await expect(groupItem).toBeVisible();
  await groupItem.scrollIntoViewIfNeeded();
  await groupItem.click();
  await expect(page.getByTestId('formation-name-input')).toBeVisible();
}

export async function replaceYaml(page: Page, mutator: (yaml: string) => string): Promise<void> {
  const textarea = page.getByTestId('yaml-textarea');
  const current = await textarea.inputValue();
  await textarea.fill(mutator(current));
}

export async function expectInputValue(input: Locator, expected: string): Promise<void> {
  await expect(input).toBeVisible();
  await expect.poll(() => input.inputValue()).toBe(expected);
}

export async function dispatchShortcut(
  page: Page,
  key: string,
  modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}
): Promise<void> {
  await page.evaluate(
    ([nextKey, nextModifiers]) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: nextKey, ...nextModifiers, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: nextKey, ...nextModifiers, bubbles: true }));
    },
    [key, modifiers]
  );
}

export async function triggerUndo(page: Page): Promise<void> {
  await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.undo());
}

export async function triggerRedo(page: Page): Promise<void> {
  await page.evaluate(() => window.__PHASER_ACTIONS_STUDIO_TEST__?.redo());
}

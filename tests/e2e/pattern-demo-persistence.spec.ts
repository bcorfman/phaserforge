import { expect, test, type Page } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { resolveEntityDefaults } from '../../src/model/entityDefaults';
import { DEMO_PACK_ASSET_MANIFEST } from '../../src/editor/demoPackAssets';
import { measureTextEntityPixels, resolveTextEntityDefaults } from '../../src/editor/textEntity';
import {
  dismissViewHint,
  dispatchAction,
  getEntityWorldRect,
  getSceneSnapshot,
  getState,
  gotoStudio,
  seedProject,
  waitForSceneReady,
} from './helpers';
import { getPatternDemoCloudLiveConfigError } from './patternDemoPersistenceCloudConfig';

test.describe.configure({ timeout: 300_000 });

const PERSISTENCE_TARGET = process.env.PATTERN_DEMO_PERSISTENCE_TARGET ?? 'local';
const USE_LIVE_CLOUD = PERSISTENCE_TARGET === 'cloud-live';
const CLOUD_STORAGE_STATE = process.env.PATTERN_DEMO_CLOUD_STORAGE_STATE;
const CLOUD_MANUAL_LOGIN = process.env.PATTERN_DEMO_CLOUD_MANUAL_LOGIN === '1';
const CLOUD_LIVE_CONFIG_ERROR = getPatternDemoCloudLiveConfigError({
  persistenceTarget: PERSISTENCE_TARGET,
  baseUrl: process.env.PW_BASE_URL,
});

if (CLOUD_STORAGE_STATE) {
  test.use({ storageState: CLOUD_STORAGE_STATE });
}

const TOP_ROW = [
  { key: 'wave', label: 'Wave', x: 130, y: 200, labelY: 120 },
  { key: 'zigzag', label: 'Zigzag', x: 310, y: 200, labelY: 120 },
  { key: 'figure8', label: 'Figure-8', x: 490, y: 200, labelY: 120 },
  { key: 'orbit', label: 'Orbit', x: 670, y: 200, labelY: 120 },
] as const;

const BOTTOM_ROW = [
  { key: 'spiral', label: 'Spiral', x: 220, y: 420, labelY: 340 },
  { key: 'bounce', label: 'Bounce', x: 400, y: 420, labelY: 340 },
  { key: 'patrol', label: 'Patrol', x: 580, y: 420, labelY: 340 },
] as const;

const ALL_SHIPS = [...TOP_ROW, ...BOTTOM_ROW];
const ROUGH_SHIP_POSITIONS: Record<string, { x: number; y: number }> = {
  wave: { x: 110, y: 180 },
  zigzag: { x: 280, y: 190 },
  figure8: { x: 520, y: 210 },
  orbit: { x: 700, y: 195 },
  spiral: { x: 200, y: 395 },
  bounce: { x: 430, y: 435 },
  patrol: { x: 605, y: 410 },
};

type PersistenceSnapshot = {
  project: any;
  currentSceneId: string | null;
  scene: any;
};

type ErrorCollector = {
  pageErrors: string[];
  consoleErrors: string[];
  httpErrors: string[];
  clear: () => void;
};

type Step = {
  label: string;
  apply: (page: Page) => Promise<PersistenceSnapshot>;
};

function getActiveScene(project: any): any {
  return project.scenes[project.initialSceneId];
}

function cloneProject<T>(value: T): T {
  return structuredClone(value);
}

function textEntityId(key: string): string {
  return `text-${key}`;
}

function shipEntityId(key: string): string {
  return `ship-${key}`;
}

function makeTextEntity(project: any, id: string, label: string, x: number, y: number): any {
  const text = resolveTextEntityDefaults({ value: label, align: 'center' } as any);
  const measured = measureTextEntityPixels(project, text);
  return resolveEntityDefaults({
    id,
    name: label,
    x,
    y,
    width: measured.width,
    height: measured.height,
    text,
    asset: undefined,
  } as any);
}

function makeShipEntity(id: string, label: string, x: number, y: number): any {
  return resolveEntityDefaults({
    id,
    name: label,
    x,
    y,
    width: 32,
    height: 32,
    asset: {
      source: { kind: 'asset', assetId: 'ship-sidesa' },
      imageType: 'image',
      frame: { kind: 'single' },
    },
  } as any);
}

function withProjectMutation(project: any, mutate: (draft: any, scene: any) => void): any {
  const draft = cloneProject(project);
  const scene = getActiveScene(draft);
  mutate(draft, scene);
  draft.scenes = { ...draft.scenes, [scene.id]: scene };
  return draft;
}

function buildLabelsProject(project: any): any {
  return withProjectMutation(project, (draft, scene) => {
    const nextEntities = { ...scene.entities };
    for (const ship of ALL_SHIPS) {
      nextEntities[textEntityId(ship.key)] = makeTextEntity(draft, textEntityId(ship.key), ship.label, ship.x, ship.labelY);
    }
    scene.entities = nextEntities;
  });
}

function buildRoughShipsProject(project: any): any {
  return withProjectMutation(project, (_draft, scene) => {
    const nextEntities = { ...scene.entities };
    for (const ship of ALL_SHIPS) {
      const rough = ROUGH_SHIP_POSITIONS[ship.key];
      nextEntities[shipEntityId(ship.key)] = makeShipEntity(shipEntityId(ship.key), ship.label, rough.x, rough.y);
    }
    scene.entities = nextEntities;
    scene.spriteOrder = ALL_SHIPS.map((ship) => shipEntityId(ship.key));
  });
}

function buildAlignedShipsProject(project: any): any {
  return withProjectMutation(project, (_draft, scene) => {
    const nextEntities = { ...scene.entities };
    for (const ship of ALL_SHIPS) {
      const entity = nextEntities[shipEntityId(ship.key)];
      nextEntities[shipEntityId(ship.key)] = { ...entity, x: ship.x, y: ship.y };
    }
    scene.entities = nextEntities;
  });
}

function mergeAttachments(scene: any, attachments: Record<string, any>): void {
  scene.attachments = {
    ...(scene.attachments ?? {}),
    ...attachments,
  };
}

function buildWaveProject(project: any): any {
  return withProjectMutation(project, (_draft, scene) => {
    mergeAttachments(scene, {
      'att-wave-intro': {
        id: 'att-wave-intro',
        target: { type: 'entity', entityId: shipEntityId('wave') },
        presetId: 'WavePattern',
        enabled: true,
        order: 0,
        name: 'Intro',
        params: { amplitude: 30, length: 80, velocity: 80, startProgress: 0.75, endProgress: 1 },
      },
      'att-wave-repeat': {
        id: 'att-wave-repeat',
        target: { type: 'entity', entityId: shipEntityId('wave') },
        presetId: 'Repeat',
        enabled: true,
        order: 1,
        params: {},
        children: ['att-wave-loop'],
      },
      'att-wave-loop': {
        id: 'att-wave-loop',
        target: { type: 'entity', entityId: shipEntityId('wave') },
        presetId: 'WavePattern',
        enabled: true,
        order: 0,
        parentAttachmentId: 'att-wave-repeat',
        name: 'Loop body',
        params: { amplitude: 30, length: 80, velocity: 80, startProgress: 0, endProgress: 1 },
      },
    });
  });
}

function buildZigzagProject(project: any): any {
  return withProjectMutation(project, (_draft, scene) => {
    mergeAttachments(scene, {
      'att-zigzag-offset': {
        id: 'att-zigzag-offset',
        target: { type: 'entity', entityId: shipEntityId('zigzag') },
        presetId: 'MoveBy',
        enabled: true,
        order: 0,
        name: 'Offset',
        params: { dx: -15, dy: -30 },
      },
      'att-zigzag-repeat': {
        id: 'att-zigzag-repeat',
        target: { type: 'entity', entityId: shipEntityId('zigzag') },
        presetId: 'Repeat',
        enabled: true,
        order: 1,
        name: 'Loop',
        params: {},
        children: ['att-zigzag-child-1', 'att-zigzag-child-2'],
      },
      'att-zigzag-child-1': {
        id: 'att-zigzag-child-1',
        target: { type: 'entity', entityId: shipEntityId('zigzag') },
        presetId: 'ZigzagPattern',
        enabled: true,
        order: 0,
        parentAttachmentId: 'att-zigzag-repeat',
        name: 'Child 1',
        params: { width: 30, height: 15, velocity: 100, segments: 5 },
      },
      'att-zigzag-child-2': {
        id: 'att-zigzag-child-2',
        target: { type: 'entity', entityId: shipEntityId('zigzag') },
        presetId: 'ZigzagPattern',
        enabled: true,
        order: 1,
        parentAttachmentId: 'att-zigzag-repeat',
        name: 'Child 2',
        params: { width: -30, height: -15, velocity: 100, segments: 5 },
      },
    });
  });
}

function buildFigureEightProject(project: any): any {
  return withProjectMutation(project, (_draft, scene) => {
    mergeAttachments(scene, {
      'att-figure8-repeat': {
        id: 'att-figure8-repeat',
        target: { type: 'entity', entityId: shipEntityId('figure8') },
        presetId: 'Repeat',
        enabled: true,
        order: 0,
        name: 'Loop',
        params: {},
        children: ['att-figure8-child'],
      },
      'att-figure8-child': {
        id: 'att-figure8-child',
        target: { type: 'entity', entityId: shipEntityId('figure8') },
        presetId: 'FigureEightPattern',
        enabled: true,
        order: 0,
        parentAttachmentId: 'att-figure8-repeat',
        name: 'Child',
        params: { width: 80, height: 60, velocity: 100 },
      },
    });
  });
}

function buildOrbitProject(project: any): any {
  return withProjectMutation(project, (_draft, scene) => {
    scene.entities = {
      ...scene.entities,
      [shipEntityId('orbit')]: {
        ...scene.entities[shipEntityId('orbit')],
        flipY: true,
      },
    };
    mergeAttachments(scene, {
      'att-orbit-repeat': {
        id: 'att-orbit-repeat',
        target: { type: 'entity', entityId: shipEntityId('orbit') },
        presetId: 'Repeat',
        enabled: true,
        order: 0,
        params: {},
        children: ['att-orbit-child'],
      },
      'att-orbit-child': {
        id: 'att-orbit-child',
        target: { type: 'entity', entityId: shipEntityId('orbit') },
        presetId: 'OrbitPattern',
        enabled: true,
        order: 0,
        parentAttachmentId: 'att-orbit-repeat',
        name: 'Child',
        params: { radius: 50, velocity: 100, clockwise: true, centerMode: 'home' },
      },
    });
  });
}

function buildSpiralProject(project: any): any {
  return withProjectMutation(project, (_draft, scene) => {
    mergeAttachments(scene, {
      'att-spiral-repeat': {
        id: 'att-spiral-repeat',
        target: { type: 'entity', entityId: shipEntityId('spiral') },
        presetId: 'Repeat',
        enabled: true,
        order: 0,
        params: {},
        children: ['att-spiral-child-1', 'att-spiral-child-2'],
      },
      'att-spiral-child-1': {
        id: 'att-spiral-child-1',
        target: { type: 'entity', entityId: shipEntityId('spiral') },
        presetId: 'SpiralPattern',
        enabled: true,
        order: 0,
        parentAttachmentId: 'att-spiral-repeat',
        name: 'Child 1',
        params: { maxRadius: 60, revolutions: 2, velocity: 80, direction: 'outward' },
      },
      'att-spiral-child-2': {
        id: 'att-spiral-child-2',
        target: { type: 'entity', entityId: shipEntityId('spiral') },
        presetId: 'SpiralPattern',
        enabled: true,
        order: 1,
        parentAttachmentId: 'att-spiral-repeat',
        name: 'Child 2',
        params: { maxRadius: 60, revolutions: 2, velocity: 80, direction: 'inward', flipY: true },
      },
    });
  });
}

function buildBounceProject(project: any): any {
  return withProjectMutation(project, (_draft, scene) => {
    mergeAttachments(scene, {
      'att-bounce': {
        id: 'att-bounce',
        target: { type: 'entity', entityId: shipEntityId('bounce') },
        presetId: 'BouncePattern',
        enabled: true,
        order: 0,
        name: 'BounceBox',
        params: { velocityX: 100, velocityY: 60, axis: 'both' },
        condition: {
          type: 'BoundsHit',
          bounds: { minX: 350, maxX: 450, minY: 360, maxY: 480 },
          mode: 'any',
          scope: 'member-any',
          behavior: 'bounce',
        },
      },
    });
  });
}

function buildPatrolProject(project: any): any {
  return withProjectMutation(project, (_draft, scene) => {
    mergeAttachments(scene, {
      'att-patrol': {
        id: 'att-patrol',
        target: { type: 'entity', entityId: shipEntityId('patrol') },
        presetId: 'PatrolPattern',
        enabled: true,
        order: 0,
        params: { velocityX: 80, velocityY: 0, axis: 'x' },
        condition: {
          type: 'BoundsHit',
          bounds: { minX: 540, maxX: 620, minY: 400, maxY: 500 },
          mode: 'any',
          scope: 'member-any',
          behavior: 'bounce',
        },
      },
    });
  });
}

function buildMusicProject(project: any): any {
  return withProjectMutation(project, (_draft, scene) => {
    scene.music = {
      assetId: 'sb-indreams-chosic-com',
      loop: true,
      volume: 0.65,
      fadeMs: 250,
    };
  });
}

async function getPersistenceSnapshot(page: Page): Promise<PersistenceSnapshot> {
  const state = await getState<any>(page);
  return {
    project: cloneProject(state?.project ?? null),
    currentSceneId: state?.currentSceneId ?? null,
    scene: cloneProject(state?.scene ?? null),
  };
}

function trackErrors(page: Page): ErrorCollector {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const httpErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const location = message.location();
      const source = location.url ? ` [${location.url}:${location.lineNumber}:${location.columnNumber}]` : '';
      consoleErrors.push(`${message.text()}${source}`);
    }
  });
  page.on('response', (response) => {
    const status = response.status();
    if (status < 400) return;
    const request = response.request();
    httpErrors.push(`${status} ${request.method()} ${response.url()}`);
  });
  return {
    pageErrors,
    consoleErrors,
    httpErrors,
    clear: () => {
      pageErrors.length = 0;
      consoleErrors.length = 0;
      httpErrors.length = 0;
    },
  };
}

function expectNoBrowserErrors(errors: ErrorCollector, label: string): void {
  const relevantHttpErrors = errors.httpErrors.filter(
    (message) =>
      !message.startsWith('401 ')
      && !(USE_LIVE_CLOUD && message.startsWith('403 '))
      && !(USE_LIVE_CLOUD && message.startsWith('500 '))
  );
  const relevantConsoleErrors = errors.consoleErrors.filter(
    (message) =>
      !message.includes('Failed to load resource: the server responded with a status of 401 (Unauthorized)')
      && !(message.includes('Failed to load resource: the server responded with a status of 400') && relevantHttpErrors.length > 0)
      && !message.includes('Failed to load resource: net::ERR_NETWORK_CHANGED')
      && !message.includes('Failed to load resource: net::ERR_QUIC_PROTOCOL_ERROR')
      && !(USE_LIVE_CLOUD && message.includes('Failed to load resource: the server responded with a status of 403'))
      && !(USE_LIVE_CLOUD && message.includes('Failed to load resource: the server responded with a status of 500'))
  );
  expect(errors.pageErrors, `${label}: page errors`).toEqual([]);
  expect(relevantHttpErrors, `${label}: http errors`).toEqual([]);
  expect(relevantConsoleErrors, `${label}: console errors`).toEqual([]);
}

async function expectSnapshot(page: Page, expected: PersistenceSnapshot): Promise<void> {
  await expect.poll(async () => getPersistenceSnapshot(page)).toEqual(expected);
  await expect.poll(async () => {
    const error = (await getState<any>(page))?.error ?? null;
    if (!USE_LIVE_CLOUD || error == null) return null;
    const marker = await getCloudFlushMarker(page);
    if (marker.lastSuccessTimestamp && (!marker.lastErrorTimestamp || marker.lastSuccessTimestamp > marker.lastErrorTimestamp)) {
      return null;
    }
    return error;
  }).toBeNull();
}

async function reopenAndAssert(page: Page, expected: PersistenceSnapshot, label: string): Promise<{ page: Page; errors: ErrorCollector }> {
  const context = page.context();
  await page.close({ runBeforeUnload: true });
  const reopenedPage = await context.newPage();
  const errors = trackErrors(reopenedPage);
  await bootStudio(reopenedPage, { forceNavigate: true });
  await expectSnapshot(reopenedPage, expected);
  expectNoBrowserErrors(errors, `${label} reopen`);
  return { page: reopenedPage, errors };
}

async function settleCloudLivePage(page: Page, errors: ErrorCollector): Promise<void> {
  if (!USE_LIVE_CLOUD) return;
  await page.waitForTimeout(1500);
  errors.clear();
}

async function applyProjectStep(page: Page, sourceLabel: string, mutate: (project: any) => any): Promise<PersistenceSnapshot> {
  const state = await getState<any>(page);
  const nextProject = mutate(state.project);
  await loadProjectSnapshot(page, nextProject, sourceLabel);
  const expected = {
    project: cloneProject(nextProject),
    currentSceneId: state.currentSceneId,
    scene: cloneProject(nextProject.scenes[state.currentSceneId]),
  };
  await expectSnapshot(page, expected);
  return expected;
}

async function loadProjectSnapshot(page: Page, project: any, sourceLabel: string): Promise<void> {
  await dispatchAction(page, { type: 'load-project', project, sourceLabel });
}

function buildPatternDemoSteps(): Step[] {
  return [
    {
      label: 'set world size to 800x600',
      apply: async (page) => {
        await dispatchAction(page, { type: 'update-scene-world', width: 800, height: 600 });
        await expect.poll(async () => ({
          width: (await getPersistenceSnapshot(page)).scene?.world?.width ?? null,
          height: (await getPersistenceSnapshot(page)).scene?.world?.height ?? null,
        })).toEqual({ width: 800, height: 600 });
        return await getPersistenceSnapshot(page);
      },
    },
    {
      label: 'import demo pack assets',
      apply: async (page) => {
        await dispatchAction(page, { type: 'import-demo-pack-assets', entries: DEMO_PACK_ASSET_MANIFEST });
        await expect.poll(async () => {
          const state = await getState<any>(page);
          return {
            hasShip: Boolean(state?.project?.assets?.images?.['ship-sidesa']),
            hasMusic: Boolean(state?.project?.audio?.sounds?.['sb-indreams-chosic-com']),
          };
        }).toEqual({ hasShip: true, hasMusic: true });
        return await getPersistenceSnapshot(page);
      },
    },
    {
      label: 'add and lay out text labels',
      apply: async (page) => applyProjectStep(page, 'pattern-demo-step-labels', buildLabelsProject),
    },
    {
      label: 'create and name the seven sprites',
      apply: async (page) => applyProjectStep(page, 'pattern-demo-step-ships-rough', buildRoughShipsProject),
    },
    {
      label: 'position the ships with layout tools',
      apply: async (page) => applyProjectStep(page, 'pattern-demo-step-ships-aligned', buildAlignedShipsProject),
    },
    {
      label: 'attach the wave action flow',
      apply: async (page) => applyProjectStep(page, 'pattern-demo-step-wave', buildWaveProject),
    },
    {
      label: 'attach the zigzag action flow',
      apply: async (page) => applyProjectStep(page, 'pattern-demo-step-zigzag', buildZigzagProject),
    },
    {
      label: 'attach the figure-8 action flow',
      apply: async (page) => applyProjectStep(page, 'pattern-demo-step-figure8', buildFigureEightProject),
    },
    {
      label: 'attach the orbit action flow',
      apply: async (page) => applyProjectStep(page, 'pattern-demo-step-orbit', buildOrbitProject),
    },
    {
      label: 'attach the spiral action flow',
      apply: async (page) => applyProjectStep(page, 'pattern-demo-step-spiral', buildSpiralProject),
    },
    {
      label: 'attach the bounce action flow',
      apply: async (page) => applyProjectStep(page, 'pattern-demo-step-bounce', buildBounceProject),
    },
    {
      label: 'attach the patrol action flow',
      apply: async (page) => applyProjectStep(page, 'pattern-demo-step-patrol', buildPatrolProject),
    },
    {
      label: 'add demo music to the scene',
      apply: async (page) => applyProjectStep(page, 'pattern-demo-step-music', buildMusicProject),
    },
  ];
}

async function verifyPatternDemoRuntime(page: Page): Promise<void> {
  await page.evaluate(() => window.__PHASER_FORGE_TEST__?.setMode?.('play'));
  await expect.poll(async () => (await getSceneSnapshot<{ sceneKey?: string }>(page))?.sceneKey).toBe('GameScene');

  const initialShipCenters = new Map<string, { x: number; y: number }>();
  const initialLabelCenters = new Map<string, { x: number; y: number }>();
  for (const ship of ALL_SHIPS) {
    const shipRect = await getEntityWorldRect(page, shipEntityId(ship.key));
    const labelRect = await getEntityWorldRect(page, textEntityId(ship.key));
    initialShipCenters.set(ship.key, {
      x: shipRect.centerX ?? (shipRect.minX + shipRect.maxX) / 2,
      y: shipRect.centerY ?? (shipRect.minY + shipRect.maxY) / 2,
    });
    initialLabelCenters.set(ship.key, {
      x: labelRect.centerX ?? (labelRect.minX + labelRect.maxX) / 2,
      y: labelRect.centerY ?? (labelRect.minY + labelRect.maxY) / 2,
    });
  }

  const maxShipMovement = new Map<string, number>();
  const maxLabelMovement = new Map<string, number>();
  for (const ship of ALL_SHIPS) {
    maxShipMovement.set(ship.key, 0);
    maxLabelMovement.set(ship.key, 0);
  }

  for (let sample = 0; sample < 10; sample += 1) {
    await page.waitForTimeout(250);
    for (const ship of ALL_SHIPS) {
      const shipRect = await getEntityWorldRect(page, shipEntityId(ship.key));
      const labelRect = await getEntityWorldRect(page, textEntityId(ship.key));
      const initialShip = initialShipCenters.get(ship.key)!;
      const initialLabel = initialLabelCenters.get(ship.key)!;
      const shipCenter = {
        x: shipRect.centerX ?? (shipRect.minX + shipRect.maxX) / 2,
        y: shipRect.centerY ?? (shipRect.minY + shipRect.maxY) / 2,
      };
      const labelCenter = {
        x: labelRect.centerX ?? (labelRect.minX + labelRect.maxX) / 2,
        y: labelRect.centerY ?? (labelRect.minY + labelRect.maxY) / 2,
      };
      const shipMoved = Math.hypot(shipCenter.x - initialShip.x, shipCenter.y - initialShip.y);
      const labelMoved = Math.hypot(labelCenter.x - initialLabel.x, labelCenter.y - initialLabel.y);
      maxShipMovement.set(ship.key, Math.max(maxShipMovement.get(ship.key) ?? 0, shipMoved));
      maxLabelMovement.set(ship.key, Math.max(maxLabelMovement.get(ship.key) ?? 0, labelMoved));
    }
  }

  for (const ship of ALL_SHIPS) {
    expect(maxShipMovement.get(ship.key) ?? 0, `${ship.label} should move in play mode`).toBeGreaterThan(1);
    expect(maxLabelMovement.get(ship.key) ?? 0, `${ship.label} label should remain static`).toBeLessThanOrEqual(1);
  }

  for (let i = 0; i < 6; i += 1) {
    const bounceRect = await getEntityWorldRect(page, shipEntityId('bounce'));
    const patrolRect = await getEntityWorldRect(page, shipEntityId('patrol'));
    const bounceCenter = {
      x: bounceRect.centerX ?? (bounceRect.minX + bounceRect.maxX) / 2,
      y: bounceRect.centerY ?? (bounceRect.minY + bounceRect.maxY) / 2,
    };
    const patrolCenter = {
      x: patrolRect.centerX ?? (patrolRect.minX + patrolRect.maxX) / 2,
      y: patrolRect.centerY ?? (patrolRect.minY + patrolRect.maxY) / 2,
    };
    expect(bounceCenter.x).toBeGreaterThanOrEqual(350);
    expect(bounceCenter.x).toBeLessThanOrEqual(450);
    expect(bounceCenter.y).toBeGreaterThanOrEqual(360);
    expect(bounceCenter.y).toBeLessThanOrEqual(480);
    expect(patrolCenter.x).toBeGreaterThanOrEqual(540);
    expect(patrolCenter.x).toBeLessThanOrEqual(620);
    expect(patrolCenter.y).toBeGreaterThanOrEqual(400);
    expect(patrolCenter.y).toBeLessThanOrEqual(500);
    await page.waitForTimeout(250);
  }

  await expect.poll(async () => {
    const snapshot = await getSceneSnapshot<{ audio?: { musicAssetId?: string } }>(page);
    return snapshot?.audio?.musicAssetId ?? null;
  }).toBe('sb-indreams-chosic-com');
}

async function initializePatternDemoPage(page: Page): Promise<{ page: Page; errors: ErrorCollector }> {
  if (USE_LIVE_CLOUD) {
    if (CLOUD_LIVE_CONFIG_ERROR) {
      throw new Error(CLOUD_LIVE_CONFIG_ERROR);
    }
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('phaserforge.debugPersistence.v1', '1');
        window.sessionStorage.setItem('phaserforge.testForceCloudEnabled.v1', '1');
      } catch {
        // ignore storage bootstrap failures in tests
      }
    });
    await bootStudio(page, { forceNavigate: true });
    await page.getByTestId('inspector-pane-tab-cloud').click();
    const signInCta = page.getByTestId('cloud-publish-signin-cta');
    if (await signInCta.isVisible().catch(() => false)) {
      if (CLOUD_MANUAL_LOGIN) {
        await page.pause();
        await page.getByTestId('inspector-pane-tab-cloud').click();
      }
    }
    if (await signInCta.isVisible().catch(() => false)) {
      throw new Error(
        'Cloud-live mode requires an authenticated session. Either set PATTERN_DEMO_CLOUD_STORAGE_STATE to a Playwright storage-state file, or run with PATTERN_DEMO_CLOUD_MANUAL_LOGIN=1 and PWDEBUG=1 so you can sign in before the test continues.'
      );
    }
    await expect(page.locator('.cloud-signed-in')).toBeVisible();
    await dispatchAction(page, {
      type: 'load-project',
      project: createEmptyProject(),
      sourceLabel: 'pattern-demo-cloud-seed',
    });
    await expect.poll(async () => {
      const state = await getState<any>(page);
      return {
        projectId: state?.project?.id ?? null,
        sceneCount: Object.keys(state?.project?.scenes ?? {}).length,
      };
    }).toEqual({
      projectId: expect.any(String),
      sceneCount: 1,
    });
  } else {
    await seedProject(page, createEmptyProject() as any);
    await dismissViewHint(page);
  }
  const errors = trackErrors(page);
  expectNoBrowserErrors(errors, 'initial load');
  return { page, errors };
}

async function gotoStudioWithoutDefaultApiStub(page: Page): Promise<void> {
  await page.goto('./', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => Boolean(window.__PHASER_FORGE_TEST__?.isEnabled), { timeout: 20000 });
  await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 20000 });
  await waitForSceneReady(page);
  await dismissViewHint(page);
}

async function bootStudio(page: Page, options?: { forceNavigate?: boolean }): Promise<void> {
  if (USE_LIVE_CLOUD) {
    await gotoStudioWithoutDefaultApiStub(page);
    return;
  }
  await gotoStudio(page, options);
  await dismissViewHint(page);
}

type CloudFlushMarker = {
  successCount: number;
  lastSuccessTimestamp: string | null;
  lastErrorTimestamp: string | null;
};

async function getCloudFlushMarker(page: Page): Promise<CloudFlushMarker> {
  return page.evaluate(() => {
    const entries = (window as any).__PHASER_FORGE_PERSISTENCE_DEBUG__?.read?.() ?? [];
    const successEntries = entries.filter((entry: { event?: string }) => entry.event === 'cloud:autosave-flush-success');
    const errorEntries = entries.filter((entry: { event?: string }) =>
      entry.event === 'cloud:autosave-flush-error'
      || entry.event === 'editor-store:save-active-error'
      || entry.event === 'project-persistence:save-active-project-record-error');
    const lastSuccess = successEntries.at(-1) as { timestamp?: string } | undefined;
    const lastError = errorEntries.at(-1) as { timestamp?: string } | undefined;
    return {
      successCount: successEntries.length,
      lastSuccessTimestamp: typeof lastSuccess?.timestamp === 'string' ? lastSuccess.timestamp : null,
      lastErrorTimestamp: typeof lastError?.timestamp === 'string' ? lastError.timestamp : null,
    };
  });
}

async function getRecentPersistenceEvents(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const entries = (window as any).__PHASER_FORGE_PERSISTENCE_DEBUG__?.read?.() ?? [];
    return entries.slice(-12).map((entry: { event?: string }) => entry.event ?? '(unknown)');
  });
}

async function getRecentPersistenceErrorDetails(page: Page): Promise<Array<{ event: string; details: unknown }>> {
  return page.evaluate(() => {
    const entries = (window as any).__PHASER_FORGE_PERSISTENCE_DEBUG__?.read?.() ?? [];
    return entries
      .filter((entry: { event?: string }) =>
        entry.event === 'cloud:autosave-flush-error'
        || entry.event === 'editor-store:save-active-error'
        || entry.event === 'project-persistence:save-active-project-record-error'
      )
      .slice(-5)
      .map((entry: { event?: string; details?: unknown }) => ({
        event: entry.event ?? '(unknown)',
        details: entry.details ?? null,
      }));
  });
}

async function waitForCloudPersistence(page: Page, label: string, previousMarker: CloudFlushMarker): Promise<CloudFlushMarker> {
  if (!USE_LIVE_CLOUD) return previousMarker;

  const readCloudStatus = async () =>
    page.evaluate(async ({ previousErrorTimestamp }) => {
      const debugEntries = (window as any).__PHASER_FORGE_PERSISTENCE_DEBUG__?.read?.() ?? [];
      const successEntries = debugEntries.filter((entry: { event?: string }) => entry.event === 'cloud:autosave-flush-success');
      const errorEntries = debugEntries.filter((entry: { event?: string }) =>
        entry.event === 'cloud:autosave-flush-error'
        || entry.event === 'editor-store:save-active-error'
        || entry.event === 'project-persistence:save-active-project-record-error');
      const openDb = () =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const request = window.indexedDB.open('phaserforge.persistence.v1', 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
      const db = await openDb();
      const workspace = await new Promise<any>((resolve, reject) => {
        const tx = db.transaction('workspaceState', 'readonly');
        const request = tx.objectStore('workspaceState').get('workspace');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const project = await new Promise<any>((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly');
        const request = tx.objectStore('projects').get(workspace?.activeProjectId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const lastSuccess = successEntries.at(-1) as { timestamp?: string } | undefined;
      const lastError = errorEntries.at(-1) as { timestamp?: string } | undefined;
      return {
        successCount: successEntries.length,
        errorEvents: errorEntries
          .filter((entry: { timestamp?: string }) =>
            previousErrorTimestamp == null
            || (typeof entry.timestamp === 'string' && entry.timestamp > previousErrorTimestamp)
          )
          .map((entry: { event?: string }) => entry.event ?? '(unknown)'),
        recentErrorDetails: errorEntries
          .filter((entry: { timestamp?: string }) =>
            previousErrorTimestamp == null
            || (typeof entry.timestamp === 'string' && entry.timestamp > previousErrorTimestamp)
          )
          .slice(-5)
          .map((entry: { event?: string; details?: unknown }) => ({
            event: entry.event ?? '(unknown)',
            details: entry.details ?? null,
          })),
        lastSuccessTimestamp: typeof lastSuccess?.timestamp === 'string' ? lastSuccess.timestamp : null,
        lastErrorTimestamp: typeof lastError?.timestamp === 'string' ? lastError.timestamp : null,
        syncStatus: project?.syncStatus ?? null,
        cloudProjectId: project?.cloudProjectId ?? null,
      };
    }, { previousErrorTimestamp: previousMarker.lastErrorTimestamp });

  try {
    await expect.poll(async () => {
      const status = await readCloudStatus();
      return (
        status.syncStatus === 'cloud'
        && typeof status.cloudProjectId === 'string'
        && status.cloudProjectId.length > 0
        && typeof status.lastSuccessTimestamp === 'string'
        && status.lastSuccessTimestamp !== previousMarker.lastSuccessTimestamp
        && (
          status.lastErrorTimestamp == null
          || status.lastSuccessTimestamp > status.lastErrorTimestamp
        )
      );
    }, {
      timeout: 30000,
      message: `[cloud:${label}] waiting for active project to become cloud-backed without persistence errors`,
    }).toBe(true);
  } catch (error) {
    const recentEvents = await getRecentPersistenceEvents(page);
    const recentErrorDetails = await getRecentPersistenceErrorDetails(page);
    const cloudStatus = await readCloudStatus();
    const cloudMarker = await getCloudFlushMarker(page);
    throw new Error(
      `[cloud:${label}] persistence failed.\n`
      + `recent events: ${recentEvents.join(' -> ')}\n`
      + `recent error details: ${JSON.stringify(recentErrorDetails)}\n`
      + `status: ${JSON.stringify(cloudStatus)}\n`
      + `marker: ${JSON.stringify(cloudMarker)}\n`
      + `cause: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const nextMarker = await getCloudFlushMarker(page);
  expectNoBrowserErrors(trackErrors(page), `${label} cloud autosave`);
  return nextMarker;
}

async function runPatternDemoPersistence(page: Page, options: { undoRedo: boolean }): Promise<void> {
  let active = await initializePatternDemoPage(page);
  const steps = buildPatternDemoSteps();
  let cloudFlushMarker = await getCloudFlushMarker(active.page);
  let finalSnapshot: PersistenceSnapshot | null = null;

  for (const step of steps) {
    if (options.undoRedo) {
      const beforeStep = await getPersistenceSnapshot(active.page);
      const applied = await step.apply(active.page);
      cloudFlushMarker = await waitForCloudPersistence(active.page, `${step.label} apply`, cloudFlushMarker);
      await settleCloudLivePage(active.page, active.errors);
      expectNoBrowserErrors(active.errors, `${step.label} apply`);
      active = await reopenAndAssert(active.page, applied, `${step.label} applied`);
      await settleCloudLivePage(active.page, active.errors);

      await loadProjectSnapshot(active.page, beforeStep.project, `pattern-demo-revert-${step.label}`);
      await expectSnapshot(active.page, beforeStep);
      cloudFlushMarker = await waitForCloudPersistence(active.page, `${step.label} revert`, cloudFlushMarker);
      await settleCloudLivePage(active.page, active.errors);
      expectNoBrowserErrors(active.errors, `${step.label} revert`);
      active = await reopenAndAssert(active.page, beforeStep, `${step.label} revert`);
      await settleCloudLivePage(active.page, active.errors);

      const reapplied = await step.apply(active.page);
      await expectSnapshot(active.page, reapplied);
      cloudFlushMarker = await waitForCloudPersistence(active.page, `${step.label} reapply`, cloudFlushMarker);
      await settleCloudLivePage(active.page, active.errors);
      expectNoBrowserErrors(active.errors, `${step.label} reapply`);
      active = await reopenAndAssert(active.page, reapplied, `${step.label} reapply`);
      await settleCloudLivePage(active.page, active.errors);
      finalSnapshot = reapplied;
    } else {
      finalSnapshot = await step.apply(active.page);
      cloudFlushMarker = await waitForCloudPersistence(active.page, step.label, cloudFlushMarker);
      await settleCloudLivePage(active.page, active.errors);
      await expectSnapshot(active.page, finalSnapshot);
      expectNoBrowserErrors(active.errors, `${step.label} before reopen`);
      active = await reopenAndAssert(active.page, finalSnapshot, step.label);
      await settleCloudLivePage(active.page, active.errors);
    }
  }

  if (!finalSnapshot) throw new Error('Pattern demo steps produced no final snapshot');

  if (!USE_LIVE_CLOUD && !options.undoRedo) {
    await verifyPatternDemoRuntime(active.page);
    expectNoBrowserErrors(active.errors, 'runtime verification');
    active = await reopenAndAssert(active.page, finalSnapshot, 'runtime verification');
    expectNoBrowserErrors(active.errors, 'final reopen');
  }
}

test('pattern demo persistence survives tab close and reopen after each walkthrough step @slow @regression', async ({ page }) => {
  await runPatternDemoPersistence(page, { undoRedo: false });
});

test.describe('pattern demo undo/redo persistence', () => {
  test.skip(({ browserName }) => browserName === 'webkit', 'The full undo/redo walkthrough exceeds the WebKit full-matrix budget; WebKit still runs the reopen persistence walkthrough.');

  test('pattern demo persistence survives reopen plus undo/redo after each walkthrough step @slow @regression', async ({ page }) => {
    await runPatternDemoPersistence(page, { undoRedo: true });
  });
});

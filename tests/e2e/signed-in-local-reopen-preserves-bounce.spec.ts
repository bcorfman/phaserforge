import { expect, test } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { dismissViewHint, getState, gotoStudio, openProjectScope, seedProject } from './helpers';

function buildBounceProject() {
  const project = createEmptyProject();
  project.id = 'project-signed-in-bounce';
  project.title = 'Pattern Demo';
  project.renderMode = 'smooth-2d';
  project.pixelsPerUnit = 2;
  const scene = project.scenes[project.initialSceneId];
  scene.world = { width: 800, height: 600 };
  scene.entities = {
    bounce_ship: {
      id: 'bounce_ship',
      name: 'Bounce',
      x: 400,
      y: 420,
      width: 32,
      height: 32,
      rotationDeg: 0,
      scaleX: 1,
      scaleY: 1,
      originX: 0.5,
      originY: 0.5,
      alpha: 1,
      visible: true,
      depth: 0,
      flipX: false,
      flipY: false,
    },
  } as any;
  scene.attachments = {
    'att-bounce': {
      id: 'att-bounce',
      target: { type: 'entity', entityId: 'bounce_ship' },
      presetId: 'BouncePattern',
      enabled: true,
      order: 0,
      params: { velocityX: 100, velocityY: 60, axis: 'both' },
      condition: {
        type: 'BoundsHit',
        bounds: { minX: 350, maxX: 450, minY: 360, maxY: 480 },
        mode: 'any',
        scope: 'member-any',
        behavior: 'bounce',
      },
      name: 'BounceBox',
    },
  } as any;
  scene.spriteOrder = ['bounce_ship'];
  return project;
}

async function stubSignedInCloud(page: Parameters<typeof test>[0]['page']) {
  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem('phaserforge.testForceCloudEnabled.v1', '1');
    } catch {
      // ignore storage failures in tests
    }
  });
  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ csrfToken: 'csrf' }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ user: { id: 'u1', email: 'a@b.c' } }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/publish/github-pages-info', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ ok: true, login: 'zoof', pagesBaseUrl: 'https://zoof.github.io/' }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/games', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ games: [] }),
        contentType: 'application/json',
      });
      return;
    }
    await route.fallback();
  });
}

async function expectProjectRestored(page: Parameters<typeof test>[0]['page']) {
  await expect.poll(async () => {
    const state = await getState<any>(page);
    return {
      projectId: state?.project?.id ?? null,
      title: state?.project?.title ?? null,
      entityCount: Object.keys(state?.scene?.entities ?? {}).length,
      attachmentCount: Object.keys(state?.scene?.attachments ?? {}).length,
      bounceBounds: state?.scene?.attachments?.['att-bounce']?.condition?.bounds ?? null,
    };
  }).toEqual({
    projectId: 'project-signed-in-bounce',
    title: 'Pattern Demo',
    entityCount: 1,
    attachmentCount: 1,
    bounceBounds: { minX: 350, maxX: 450, minY: 360, maxY: 480 },
  });
}

test('signed-in local project reopens from indexeddb without blanking the scene @regression', async ({ page }) => {
  await stubSignedInCloud(page);
  const project = buildBounceProject();
  await seedProject(page, project as any);
  await dismissViewHint(page);
  await expectProjectRestored(page);
  await openProjectScope(page);
  await expect(page.getByTestId('project-tree-root-button')).toContainText('Pattern Demo');

  await page.close({ runBeforeUnload: true });

  const reopenedPage = await page.context().newPage();
  try {
    await stubSignedInCloud(reopenedPage);
    await gotoStudio(reopenedPage, { forceNavigate: true });
    await dismissViewHint(reopenedPage);
    await expectProjectRestored(reopenedPage);
    await openProjectScope(reopenedPage);
    await expect(reopenedPage.getByTestId('project-tree-root-button')).toContainText('Pattern Demo');
  } finally {
    await reopenedPage.close();
  }
});

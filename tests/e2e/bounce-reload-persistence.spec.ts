import { expect, test } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { dismissViewHint, getState, gotoStudio, openProjectScope, openSceneScope, seedProject } from './helpers';

function buildBounceProject() {
  const project = createEmptyProject();
  project.id = 'project-bounce-reload';
  project.title = 'Bounce Reload';
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
    bounce_label: {
      id: 'bounce_label',
      name: 'Bounce',
      x: 400,
      y: 340,
      width: 46,
      height: 17,
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
      text: {
        value: 'Bounce',
        fontSize: 14,
        color: '#FFFFFF',
        align: 'center',
      },
    },
  } as any;
  scene.attachments = {
    'att-bounce': {
      id: 'att-bounce',
      target: { type: 'entity', entityId: 'bounce_ship' },
      presetId: 'BouncePattern',
      enabled: true,
      order: 0,
      params: {
        velocityX: 100,
        velocityY: 60,
        axis: 'both',
      },
      condition: {
        type: 'BoundsHit',
        bounds: {
          minX: 350,
          maxX: 450,
          minY: 360,
          maxY: 480,
        },
        mode: 'any',
        scope: 'member-any',
        behavior: 'bounce',
      },
      name: 'BounceBox',
    },
  } as any;
  scene.spriteOrder = ['bounce_ship', 'bounce_label'];
  return project;
}

async function expectBounceProjectState(page: Parameters<typeof test>[0]['page']) {
  await expect.poll(async () => {
    const state = await getState<any>(page);
    const attachment = state?.scene?.attachments?.['att-bounce'];
    return {
      projectId: state?.project?.id ?? null,
      title: state?.project?.title ?? null,
      currentSceneId: state?.currentSceneId ?? null,
      entityIds: Object.keys(state?.scene?.entities ?? {}),
      attachmentBounds: attachment?.condition?.bounds ?? null,
      attachmentVelocityX: attachment?.params?.velocityX ?? null,
    };
  }).toEqual({
    projectId: 'project-bounce-reload',
    title: 'Bounce Reload',
    currentSceneId: 'scene-1',
    entityIds: ['bounce_ship', 'bounce_label'],
    attachmentBounds: {
      minX: 350,
      maxX: 450,
      minY: 360,
      maxY: 480,
    },
    attachmentVelocityX: 100,
  });
}

test('tab close and reopen preserves bounce attachment project state @regression', async ({ page }) => {
  const project = buildBounceProject();
  await seedProject(page, project as any);
  await dismissViewHint(page);
  await expectBounceProjectState(page);

  await openSceneScope(page);
  await page.getByTestId('ungrouped-entity-bounce_ship').click();
  await openProjectScope(page);
  await expect(page.getByTestId('project-tree-root-button')).toContainText('Bounce Reload');

  await page.close({ runBeforeUnload: true });

  const reopenedPage = await page.context().newPage();
  try {
    await gotoStudio(reopenedPage, { forceNavigate: true });
    await dismissViewHint(reopenedPage);
    await expectBounceProjectState(reopenedPage);
    await openProjectScope(reopenedPage);
    await expect(reopenedPage.getByTestId('project-tree-root-button')).toContainText('Bounce Reload');
  } finally {
    await reopenedPage.close();
  }
});

import { expect, test } from '@playwright/test';
import { createEmptyProject } from '../../src/model/emptyProject';
import { dismissViewHint, dispatchAction, getState, openSceneScope, seedProject } from './helpers';

test('authors a small stars scatter fixture with a Bounds/Wrapped event block @critical', async ({ page }) => {
  const project = createEmptyProject() as any;
  project.scenes[project.initialSceneId].world = { width: 720, height: 1280 };
  await seedProject(page, project);
  await dismissViewHint(page);
  await openSceneScope(page);

  await dispatchAction(page, {
    type: 'add-image-asset-from-file',
    file: {
      dataUrl: 'data:image/png;base64,AAAA',
      originalName: 'star.png',
      mimeType: 'image/png',
      width: 3,
      height: 3,
    },
  } as any);

  await page.getByTestId(`formations-add-${project.initialSceneId}`).click();
  await expect(page.getByTestId('create-formation-draft-panel')).toBeVisible();
  await page.getByTestId('formation-draft-template-select').selectOption('asset:image:star');
  await page.getByTestId('formation-draft-name-input').fill('Stars Mini');
  await page.getByTestId('formation-draft-preset-select').selectOption('scatter');
  await page.getByTestId('formation-draft-count-input').fill('3');
  await page.getByTestId('formation-draft-scatter-min-x').fill('0');
  await page.getByTestId('formation-draft-scatter-max-x').fill('720');
  await page.getByTestId('formation-draft-scatter-min-y').fill('5');
  await page.getByTestId('formation-draft-scatter-max-y').fill('1285');
  await page.getByTestId('formation-draft-scatter-seed').fill('stars-mini');
  await page.getByText('Random tint').click();
  await page.getByTestId('formation-draft-random-tint-enabled').check();
  await page.getByTestId('formation-draft-tint-min-r').fill('20');
  await page.getByTestId('formation-draft-tint-max-r').fill('255');
  await page.getByTestId('formation-draft-tint-min-g').fill('20');
  await page.getByTestId('formation-draft-tint-max-g').fill('255');
  await page.getByTestId('formation-draft-tint-min-b').fill('20');
  await page.getByTestId('formation-draft-tint-max-b').fill('255');
  await page.getByTestId('formation-draft-create').click();

  const groupId = await expect.poll(async () => {
    const state = await getState<any>(page);
    const entry = Object.values(state.scene.groups).find((group: any) => group.name === 'Stars Mini') as any;
    return entry?.id ?? null;
  }).not.toBeNull().then(async () => {
    const state = await getState<any>(page);
    return (Object.values(state.scene.groups).find((group: any) => group.name === 'Stars Mini') as any).id;
  });

  await page.getByTestId('add-event-block').click();
  const eventId = await expect.poll(async () => {
    const state = await getState<any>(page);
    const blocks = Object.values(state.scene.eventBlocks ?? {}).filter((block: any) => block.target?.groupId === groupId);
    return blocks[0]?.id ?? null;
  }).not.toBeNull().then(async () => {
    const state = await getState<any>(page);
    const blocks = Object.values(state.scene.eventBlocks ?? {}).filter((block: any) => block.target?.groupId === groupId) as any[];
    return blocks[0].id as string;
  });

  await page.getByTestId(`event-trigger-select-${eventId}`).selectOption('bounds');
  await page.getByTestId(`event-bounds-event-${eventId}`).selectOption('wrapped');
  await page.getByTestId(`event-bounds-axis-${eventId}`).selectOption('y');
  await page.getByTestId(`event-bounds-side-${eventId}`).selectOption('any');
  await page.getByTestId(`event-add-open-${eventId}`).click();
  await page.getByTestId('action-library-add-SetProperty').click();

  await expect.poll(async () => {
    const state = await getState<any>(page);
    const scene = state.scene;
    const group = scene.groups[groupId];
    const members = group.members.map((id: string) => scene.entities[id]);
    const block = scene.eventBlocks[eventId];
    const setProperty = Object.values(scene.attachments).find((attachment: any) => attachment.eventId === eventId && attachment.presetId === 'SetProperty') as any;
    return {
      groupMembers: group.members.length,
      tintsAreAuthored: members.every((entity: any) => Number.isInteger(entity.tint)),
      layout: group.layout,
      trigger: block.trigger,
      action: setProperty ? {
        presetId: setProperty.presetId,
        targetMode: setProperty.targetMode,
        params: setProperty.params,
      } : null,
    };
  }).toEqual({
    groupMembers: 3,
    tintsAreAuthored: true,
    layout: {
      type: 'arrange',
      arrangeKind: 'scatter',
      params: expect.objectContaining({
        minX: 0,
        maxX: 720,
        minY: 5,
        maxY: 1285,
        seed: 'stars-mini',
        randomTint: true,
      }),
    },
    trigger: { type: 'bounds', boundsEvent: 'wrapped', axis: 'y', side: 'any' },
    action: {
      presetId: 'SetProperty',
      targetMode: 'event-source',
      params: {
        property: 'x',
        valueSource: { kind: 'randomRange', min: 0, max: 720, seed: 'wrap-x' },
      },
    },
  });
});

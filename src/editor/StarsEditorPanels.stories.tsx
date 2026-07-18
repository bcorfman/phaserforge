import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { createEmptyProject } from '../model/emptyProject';
import type { AttachmentSpec, EventBlockSpec, SceneSpec } from '../model/types';
import { CreateFormationDraftPanel } from './CreateFormationDraftPanel';
import { EventsPanel } from './EventsPanel';
import { renderGroupInspector } from './Inspector';
import { SceneInspectorPanel } from './SceneInspectorPanel';

const scatterRegistry = {
  arrange: [
    {
      type: 'scatter',
      displayName: 'Scatter',
      category: 'formation',
      targetKinds: ['group'],
      implemented: true,
      parameters: [
        { name: 'minX', type: 'number' },
        { name: 'maxX', type: 'number' },
        { name: 'minY', type: 'number' },
        { name: 'maxY', type: 'number' },
        { name: 'seed', type: 'string' },
      ],
    },
  ],
  actions: [
    { type: 'SetProperty', displayName: 'Set Property', category: 'state', targetKinds: ['entity', 'group'], implemented: true },
    { type: 'MoveUntil', displayName: 'Move Until', category: 'movement', targetKinds: ['group'], implemented: true },
  ],
  conditions: [],
};

function makeStarsProject() {
  const project = createEmptyProject() as any;
  const scene = project.scenes[project.initialSceneId] as SceneSpec;
  scene.world = { width: 720, height: 1280 };
  (scene as any).backgroundColor = 0x000000;
  scene.entities.star = { id: 'star', name: 'Star Template', x: 10, y: 10, width: 3, height: 3, tint: 0xffffff };
  scene.entities.star1 = { id: 'star1', x: 100, y: 100, width: 3, height: 3, tint: 0x224466 };
  scene.entities.star2 = { id: 'star2', x: 200, y: 120, width: 3, height: 3, tint: 0x335577 };
  scene.groups.stars = {
    id: 'stars',
    name: 'Stars Blink 1',
    members: ['star1', 'star2'],
    layout: { type: 'arrange', arrangeKind: 'scatter', params: { minX: 0, maxX: 720, minY: 5, maxY: 1285, seed: 'stars-1' } },
  } as any;
  scene.eventBlocks = {
    wrap: {
      id: 'wrap',
      name: 'When Stars Wrap',
      target: { type: 'group', groupId: 'stars' },
      trigger: { type: 'bounds', boundsEvent: 'wrapped', axis: 'y', side: 'any' },
    } as any,
  };
  scene.attachments = {};
  return project;
}

function ScatterDraftStory({ dispatchSpy = fn() }: { dispatchSpy?: ReturnType<typeof fn> }) {
  const project = makeStarsProject();
  const scene = project.scenes[project.initialSceneId] as SceneSpec;
  return (
    <CreateFormationDraftPanel
      project={project}
      scene={scene}
      registry={scatterRegistry as any}
      draft={{
        template: { kind: 'entity', entityId: 'star' },
        name: 'Stars Blink 1',
        arrangeKind: 'scatter',
        memberCount: 80,
        params: {
          minX: 0,
          maxX: 720,
          minY: 5,
          maxY: 1285,
          seed: 'stars-1',
          randomTint: false,
          tintMinR: 20,
          tintMaxR: 255,
          tintMinG: 20,
          tintMaxG: 255,
          tintMinB: 20,
          tintMaxB: 255,
        },
      }}
      dispatch={dispatchSpy as any}
    />
  );
}

function SceneAppearanceStory({ dispatchSpy = fn(), disabled = false }: { dispatchSpy?: ReturnType<typeof fn>; disabled?: boolean }) {
  const project = makeStarsProject();
  const sceneId = project.initialSceneId;
  return (
    <SceneInspectorPanel
      project={project}
      sceneId={sceneId}
      scene={project.scenes[sceneId] as any}
      dispatch={dispatchSpy as any}
      disabled={disabled}
    />
  );
}

function VariationStory({ previewSpy = fn(), applySpy = fn() }: { previewSpy?: ReturnType<typeof fn>; applySpy?: ReturnType<typeof fn> }) {
  const project = makeStarsProject();
  const scene = project.scenes[project.initialSceneId] as SceneSpec;
  return renderGroupInspector(scene.groups.stars, project as any, scene, {
    registry: scatterRegistry as any,
    onSelectMember: () => {},
    onRemoveMember: () => {},
    onUpdateGroup: () => {},
    onUngroup: () => {},
    onDissolve: () => {},
    onDeleteGroup: () => {},
    onCreateEventBlock: () => {},
    onUpdateEventBlock: () => {},
    onRemoveEventBlock: () => {},
    onAddAttachment: () => {},
    onSelectAttachment: () => {},
    onMoveAttachment: () => {},
    onReorderAttachments: () => {},
    onNestAttachmentsUnderRepeat: () => {},
    onRemoveAttachment: () => {},
    onMakeParallelAttachments: () => {},
    onUngroupParallelAttachments: () => {},
    onMoveParallelAttachmentGroup: () => {},
    onCreatePatternFromAttachments: () => {},
    onApplyPattern: () => {},
    onApplyLoopTemplate: () => {},
    foldouts: { isOpen: () => true, toggle: () => {} },
    variationDraft: { seed: 'variation-1', minR: 20, maxR: 255, minG: 20, maxG: 255, minB: 20, maxB: 255, scope: 'all' },
    onVariationDraftChange: () => {},
    onPreviewTintVariation: previewSpy as any,
    onCancelTintVariation: () => {},
    onApplyTintVariation: applySpy as any,
    onRerollTintVariation: () => {},
    layoutPreset: undefined,
    setLayoutPreset: () => {},
    layoutParams: {},
    setLayoutParams: () => {},
    onArrangeGroup: () => {},
    onUpdateGroupLayout: () => {},
    onCreateAttachment: () => {},
    onUpdateAttachment: () => {},
    onDeleteAttachment: () => {},
  } as any);
}

function BoundsEventStory({ updateSpy = fn(), addAttachmentSpy = fn() }: { updateSpy?: ReturnType<typeof fn>; addAttachmentSpy?: ReturnType<typeof fn> }) {
  const [project, setProject] = useState(() => makeStarsProject());
  const scene = project.scenes[project.initialSceneId] as SceneSpec;
  const updateBlock = (next: EventBlockSpec) => {
    updateSpy(next);
    setProject((prev: any) => {
      const copy = structuredClone(prev);
      copy.scenes[copy.initialSceneId].eventBlocks[next.id] = next;
      return copy;
    });
  };
  const addAttachment = (presetId: string, init: Partial<AttachmentSpec>) => {
    addAttachmentSpy(presetId, init);
    setProject((prev: any) => {
      const copy = structuredClone(prev);
      const nextId = `att-${presetId.toLowerCase()}`;
      copy.scenes[copy.initialSceneId].attachments[nextId] = {
        id: nextId,
        target: { type: 'group', groupId: 'stars' },
        enabled: true,
        order: 0,
        presetId,
        ...init,
      };
      return copy;
    });
  };

  return (
    <EventsPanel
      project={project as any}
      scene={scene}
      target={{ type: 'group', groupId: 'stars' }}
      registry={scatterRegistry as any}
      onCreateEventBlock={() => {}}
      onUpdateEventBlock={updateBlock}
      onRemoveEventBlock={() => {}}
      onAddAttachment={addAttachment}
      onSelectAttachment={() => {}}
      onMoveAttachment={() => {}}
      onReorderAttachments={() => {}}
      onNestAttachmentsUnderRepeat={() => {}}
      onRemoveAttachment={() => {}}
      onMakeParallel={() => {}}
      onUngroupParallel={() => {}}
      onMoveParallelGroup={() => {}}
      onCreatePatternFromAttachments={() => {}}
      onApplyPattern={() => {}}
      onApplyLoopTemplate={() => {}}
    />
  );
}

const meta = {
  title: 'Editor/Stars Demo Panels',
  component: ScatterDraftStory,
} satisfies Meta<typeof ScatterDraftStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ScatterDraftControls: Story = {
  args: { dispatchSpy: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('formation-draft-scatter-min-x')).toBeTruthy();
    expect(canvas.getByTestId('formation-draft-scatter-max-y')).toBeTruthy();
    expect(canvas.getByTestId('formation-draft-scatter-reroll')).toBeTruthy();
    expect(canvas.getByTestId('formation-draft-tint-min-r')).toBeDisabled();
    await userEvent.click(canvas.getByTestId('formation-draft-random-tint-enabled'));
    expect(args.dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'update-formation-draft' }));
  },
};

export const SceneAppearanceControls: StoryObj<typeof SceneAppearanceStory> = {
  render: (args) => <SceneAppearanceStory {...args} />,
  args: { dispatchSpy: fn(), disabled: false },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('scene-background-color-picker')).toHaveValue('#000000');
    await userEvent.click(canvas.getByTestId('scene-background-use-default'));
    expect(args.dispatchSpy).toHaveBeenCalledWith({ type: 'set-scene-background-color', backgroundColor: undefined });
  },
};

export const FormationVisualVariations: StoryObj<typeof VariationStory> = {
  render: (args) => <VariationStory {...args} />,
  args: { previewSpy: fn(), applySpy: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('formation-variation-scope')).toHaveValue('all');
    expect(canvas.getByTestId('formation-variation-min-r')).toBeTruthy();
    expect(canvas.getByTestId('formation-variation-max-b')).toBeTruthy();
    await userEvent.click(canvas.getByTestId('formation-variation-preview'));
    await userEvent.click(canvas.getByTestId('formation-variation-apply'));
    expect(args.previewSpy).toHaveBeenCalled();
    expect(args.applySpy).toHaveBeenCalled();
  },
};

export const BoundsEventNoCodeAction: StoryObj<typeof BoundsEventStory> = {
  render: (args) => <BoundsEventStory {...args} />,
  args: { updateSpy: fn(), addAttachmentSpy: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('event-bounds-event-wrap')).toHaveValue('wrapped');
    expect(canvas.getByTestId('event-bounds-axis-wrap')).toHaveValue('y');
    expect(canvas.getByTestId('event-bounds-side-wrap')).toHaveValue('any');
    expect(canvas.getByTestId('event-bounds-description-wrap').textContent).toContain('relocated');
    await userEvent.selectOptions(canvas.getByTestId('event-bounds-side-wrap'), 'bottom');
    expect(args.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      trigger: expect.objectContaining({ type: 'bounds', side: 'bottom' }),
    }));

    await userEvent.click(canvas.getByTestId('event-add-open-wrap'));
    await userEvent.click(canvas.getByTestId('action-library-add-SetProperty'));
    expect(args.addAttachmentSpy).toHaveBeenCalledWith('SetProperty', expect.objectContaining({
      eventId: 'wrap',
      targetMode: 'event-source',
      params: {
        property: 'x',
        valueSource: { kind: 'randomRange', min: 0, max: 720, seed: 'wrap-x' },
      },
    }));
  },
};

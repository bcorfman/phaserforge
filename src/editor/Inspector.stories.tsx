import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { sampleScene } from '../model/sampleScene';
import type { EntitySpec, ProjectSpec } from '../model/types';
import { MultiEntityInspector } from './MultiEntityInspector';
import { renderEntityInspector } from './Inspector';

const project = {
  id: 'storybook-project',
  assets: { images: {}, spriteSheets: {}, fonts: {} },
  audio: { sounds: {} },
  inputMaps: {},
  scenes: { [sampleScene.id]: sampleScene },
  initialSceneId: sampleScene.id,
  collections: {},
  counters: {},
} as unknown as ProjectSpec;

const registry = { arrange: [], actions: [], conditions: [] } as any;

const actionProps = {
  project,
  scene: sampleScene,
  registry,
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
};

function EntityInspectorStory({ entity, onUpdate = fn() }: { entity: EntitySpec; onUpdate?: ReturnType<typeof fn> }) {
  return renderEntityInspector(entity, onUpdate as any, actionProps);
}

function MultiEntityInspectorStory({ dispatch = fn() }: { dispatch?: ReturnType<typeof fn> }) {
  return (
    <MultiEntityInspector
      entityIds={['e1', 'e2']}
      scene={sampleScene}
      dispatch={dispatch as any}
      disabled={false}
      assetOptions={[]}
    />
  );
}

const meta = {
  title: 'Editor/Inspector',
  component: EntityInspectorStory,
  args: {
    entity: sampleScene.entities.e1,
    onUpdate: fn(),
  },
} satisfies Meta<typeof EntityInspectorStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AuthoredSpriteControls: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Transform')).toBeTruthy();
    expect(canvas.getByTestId('entity-tint-picker')).toBeTruthy();

    const scaleX = canvas.getByTestId('entity-scale-x-input');
    await userEvent.clear(scaleX);
    await userEvent.type(scaleX, '1.25');
    await userEvent.keyboard('{Enter}');

    expect(args.onUpdate).toHaveBeenCalledWith(expect.objectContaining({ scaleX: 1.25 }));
  },
};

export const TextEntityHidesSpriteOnlyControls: StoryObj<typeof EntityInspectorStory> = {
  args: {
    entity: {
      id: 'text-1',
      x: 10,
      y: 10,
      width: 100,
      height: 40,
      text: { value: 'Hello', fontSize: 18, color: '#fff', align: 'left' },
    } as any,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Text')).toBeTruthy();
    expect(canvas.queryByText('Visual')).toBeNull();
    expect(canvas.queryByText('Hitbox (Bounds)')).toBeNull();
  },
};

export const MultiSelectDisablesPositionAndBulkEditsScale: StoryObj<typeof MultiEntityInspectorStory> = {
  render: (args) => <MultiEntityInspectorStory {...args} />,
  args: { dispatch: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('entity-x-input')).toBeDisabled();

    const scaleX = canvas.getByTestId('entity-scale-x-input');
    await userEvent.clear(scaleX);
    await userEvent.type(scaleX, '1.25');
    await userEvent.keyboard('{Enter}');

    expect(args.dispatch).toHaveBeenCalledWith({
      type: 'patch-entities',
      entityIds: ['e1', 'e2'],
      patch: expect.objectContaining({ scaleX: 1.25 }),
    });
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { WorkspaceConflictModal } from './WorkspaceConflictModal';

function makeWorkspaceSide(kind: 'cloud' | 'device', label: string, yamlText: string) {
  return {
    kind,
    label,
    lastSavedLabel: 'May 28, 2026, 10:14 AM',
    yamlText,
    parsed: {
      ok: true,
      summary: { scenes: 1, entities: 2, groups: 1, assets: 1 },
      canonicalYaml: yamlText,
    },
  } as any;
}

const meta = {
  title: 'Editor/WorkspaceConflictModal',
  component: WorkspaceConflictModal,
  args: {
    cloud: makeWorkspaceSide('cloud', 'Cloud', 'id: cloud\nscenes:\n  scene-1: {}'),
    device: makeWorkspaceSide('device', 'This device', 'id: device\nscenes:\n  scene-1: {}'),
    onExportBoth: fn(),
    onChooseCloud: fn(),
    onChooseDevice: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof WorkspaceConflictModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PreviewAndChooseCloud: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole('button', { name: 'Preview' })[0]);
    expect(canvas.getByTestId('workspace-conflict-preview').textContent).toContain('Scenes: 1');
    expect(canvas.getByTestId('workspace-conflict-preview').textContent).toContain('id: cloud');
    await userEvent.click(canvas.getByTestId('workspace-conflict-use-cloud'));
    expect(args.onChooseCloud).toHaveBeenCalled();
  },
};

export const ExportBothAndChooseDevice: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('workspace-conflict-export-both'));
    await userEvent.click(canvas.getByTestId('workspace-conflict-use-device'));
    expect(args.onExportBoth).toHaveBeenCalled();
    expect(args.onChooseDevice).toHaveBeenCalled();
  },
};
